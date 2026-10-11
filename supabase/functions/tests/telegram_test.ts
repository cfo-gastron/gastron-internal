// Jalankan: deno test supabase/functions/tests/
// Tes alur data notifikasi Telegram dengan database tiruan (tanpa Supabase / Telegram asli).
import { assertEquals, assert, assertMatch } from 'jsr:@std/assert@1'
import { createLinkUrl, handleUpdate, TOKEN_TTL_MS } from '../_shared/link.ts'
import { deliverNotif } from '../_shared/notif.ts'
import { formatNotif, type Sender } from '../_shared/telegram.ts'

// ---- database tiruan: cukup untuk query yang dipakai fungsi ----
type Row = Record<string, unknown>
function fakeDb(tables: Record<string, Row[]>) {
  return {
    tables,
    from(name: string) {
      tables[name] ??= []
      const filters: ((r: Row) => boolean)[] = []
      let op: 'select' | 'update' | 'delete' | 'insert' = 'select'
      let patch: Row = {}
      let returning = false
      const rows = () => tables[name].filter((r) => filters.every((f) => f(r)))
      const run = () => {
        if (op === 'delete') { tables[name] = tables[name].filter((r) => !filters.every((f) => f(r))); return { data: null, error: null } }
        if (op === 'update') { const hit = rows(); hit.forEach((r) => Object.assign(r, patch)); return { data: returning ? hit : null, error: null } }
        return { data: rows(), error: null }
      }
      const q = {
        select() { if (op !== 'select') returning = true; return q },
        eq(c: string, v: unknown) { filters.push((r) => r[c] === v); return q },
        in(c: string, v: unknown[]) { filters.push((r) => v.includes(r[c])); return q },
        update(p: Row) { op = 'update'; patch = p; return q },
        delete() { op = 'delete'; return q },
        insert(r: Row) { tables[name].push({ created_at: new Date().toISOString(), ...r }); return Promise.resolve({ error: null }) },
        maybeSingle() { const { data } = run(); return Promise.resolve({ data: (data as Row[])?.[0] ?? null, error: null }) },
        single() { const { data } = run(); return Promise.resolve({ data: (data as Row[])?.[0] ?? null, error: null }) },
        then(res: (v: unknown) => unknown) { return Promise.resolve(run()).then(res) },
      }
      return q
    },
  }
}

function fakeSender(fail: Record<number, number> = {}) {
  const sent: { chatId: number | string; html: string; button?: { text: string; url: string } }[] = []
  const send: Sender = (chatId, html, button) => {
    sent.push({ chatId, html, button })
    const status = fail[chatId as number]
    return Promise.resolve(status ? { ok: false, status, description: 'Forbidden: bot was blocked by the user' } : { ok: true, status: 200 })
  }
  return { send, sent }
}

const startMsg = (chatId: number, text: string) => ({ message: { chat: { id: chatId, type: 'private' }, from: { username: 'budi' }, text } })

Deno.test('Hubungkan: link -> /start token -> chat_id tersimpan, token terhapus, pesan sambutan', async () => {
  const db = fakeDb({ users: [{ id: 'u1', full_name: 'Budi Santoso', role: 'cfo', telegram_chat_id: null }] })
  const { url } = await createLinkUrl(db, 'u1', '@GastronNotifBot')
  assertMatch(url!, /^https:\/\/t\.me\/GastronNotifBot\?start=[A-Za-z0-9_-]{24}$/)
  const token = url!.split('start=')[1]

  const { send, sent } = fakeSender()
  assertEquals(await handleUpdate(db, startMsg(111, `/start ${token}`), send), 'linked')
  assertEquals(db.tables.users[0].telegram_chat_id, 111)
  assertEquals(db.tables.users[0].telegram_username, 'budi')
  assertEquals(db.tables.telegram_link_tokens.length, 0)
  assertMatch(sent[0].html, /Halo Budi.*sebagai <b>CFO<\/b>/s)
  assertEquals(sent[0].button?.text, 'Buka aplikasi')

  // Token yang sama tidak bisa dipakai dua kali
  assertEquals(await handleUpdate(db, startMsg(222, `/start ${token}`), send), 'expired')
  assertEquals(db.tables.users[0].telegram_chat_id, 111)
})

Deno.test('Hubungkan: minta link lagi menghapus token lama (1 token aktif per user)', async () => {
  const db = fakeDb({ users: [{ id: 'u1' }] })
  await createLinkUrl(db, 'u1', 'bot')
  await createLinkUrl(db, 'u1', 'bot')
  assertEquals(db.tables.telegram_link_tokens.length, 1)
})

Deno.test('Hubungkan: user tanpa profil ditolak', async () => {
  const db = fakeDb({ users: [] })
  assertEquals((await createLinkUrl(db, 'x', 'bot')).error, 'Profil belum ada. Pilih role dulu.')
})

Deno.test('Hubungkan: token lebih dari 30 menit -> kedaluwarsa & dihapus', async () => {
  const old = new Date(Date.now() - TOKEN_TTL_MS - 1000).toISOString()
  const db = fakeDb({ users: [{ id: 'u1', telegram_chat_id: null }], telegram_link_tokens: [{ token: 'abc', user_id: 'u1', created_at: old }] })
  const { send, sent } = fakeSender()
  assertEquals(await handleUpdate(db, startMsg(111, '/start abc'), send), 'expired')
  assertEquals(db.tables.users[0].telegram_chat_id, null)
  assertEquals(db.tables.telegram_link_tokens.length, 0)
  assertMatch(sent[0].html, /kedaluwarsa/)
})

Deno.test('/stop memutus semua akun di chat itu; /start tanpa token & teks lain -> bantuan; grup diabaikan', async () => {
  const db = fakeDb({ users: [{ id: 'u1', telegram_chat_id: 111 }, { id: 'u2', telegram_chat_id: 222 }] })
  const { send, sent } = fakeSender()
  assertEquals(await handleUpdate(db, startMsg(111, '/stop'), send), 'stopped')
  assertEquals(db.tables.users[0].telegram_chat_id, null)
  assertEquals(db.tables.users[1].telegram_chat_id, 222)
  assertEquals(await handleUpdate(db, startMsg(111, '/start'), send), 'help')
  assertEquals(await handleUpdate(db, startMsg(111, 'halo'), send), 'help')
  assertEquals(await handleUpdate(db, { message: { chat: { id: -5, type: 'group' }, text: '/stop' } }, send), 'ignored')
  assertEquals(sent.length, 3)
})

Deno.test('Kirim notif: hanya user terhubung, pemicu tidak dikirimi, duplikat dihitung sekali', async () => {
  const db = fakeDb({ users: [
    { id: 'pengaju', telegram_chat_id: 1 },
    { id: 'cfo', telegram_chat_id: 2 },
    { id: 'ceo', telegram_chat_id: 3 },
    { id: 'finance', telegram_chat_id: null },
  ] })
  const { send, sent } = fakeSender()
  const r = await deliverNotif(db, { user_ids: ['pengaju', 'cfo', 'cfo', 'ceo', 'finance'], title: '✅ Pengajuan disetujui', body: '"Beli <ban>" udah di-acc', url: '/pengajuan/9' }, 'ceo', send)
  assertEquals(r, { sent: 2, failed: 0, not_linked: 1 })
  assertEquals(sent.map((s) => s.chatId).sort(), [1, 2])
  assertEquals(sent[0].html, '<b>✅ Pengajuan disetujui</b>\n"Beli &lt;ban&gt;" udah di-acc')
  assertEquals(sent[0].button, { text: 'Buka di aplikasi', url: 'https://gastron-internal.vercel.app/pengajuan/9' })
})

Deno.test('Kirim notif: service role (actor null) mengirim ke semua termasuk diri sendiri', async () => {
  const db = fakeDb({ users: [{ id: 'u1', telegram_chat_id: 1 }] })
  const { send } = fakeSender()
  assertEquals((await deliverNotif(db, { user_ids: ['u1'], title: 'Test' }, null, send)).sent, 1)
})

Deno.test('Kirim notif: user blokir bot (403) -> diputus otomatis, user lain tetap terkirim', async () => {
  const db = fakeDb({ users: [{ id: 'a', telegram_chat_id: 1 }, { id: 'b', telegram_chat_id: 2 }] })
  const { send } = fakeSender({ 1: 403 })
  const r = await deliverNotif(db, { user_ids: ['a', 'b'], title: 'X' }, null, send)
  assertEquals(r, { sent: 1, failed: 1, not_linked: 0 })
  assertEquals(db.tables.users[0].telegram_chat_id, null)
  assertEquals(db.tables.users[1].telegram_chat_id, 2)
})

Deno.test('Kirim notif: penerima cuma si pemicu -> tidak ada query & tidak ada kiriman', async () => {
  const db = fakeDb({ users: [{ id: 'u1', telegram_chat_id: 1 }] })
  const { send, sent } = fakeSender()
  assertEquals(await deliverNotif(db, { user_ids: ['u1'], title: 'X' }, 'u1', send), { sent: 0, failed: 0, not_linked: 0 })
  assertEquals(sent.length, 0)
})

Deno.test('Format notif tanpa body', () => {
  assert(formatNotif('A & B', '') === '<b>A &amp; B</b>')
})
