import { readFileSync } from 'node:fs'
// Supabase tiruan (PostgREST + auth + functions + storage) di memori, dipasang lewat Playwright route.
// Cukup untuk query yang dipakai app: select (+ embed), eq/neq/in/is/not.is/gte/lte, order, limit,
// insert/upsert/update/delete, rpc generate_kode_surat, functions send-notif & telegram-bot.

const clone = (x) => JSON.parse(JSON.stringify(x))
let seq = 1000
const newId = (t) => `${t.slice(0, 3)}-${++seq}`

// Relasi embed: tabel induk -> nama embed -> cara mengambil
const RELATIONS = {
  approval_logs: { users: (db, row) => db.users.find((u) => u.id === row.action_by) || null },
  lpj: { lpj_nota: (db, row) => db.lpj_nota.filter((n) => n.lpj_id === row.id) },
  lpj_nota: { lpj_nota_items: (db, row) => db.lpj_nota_items.filter((i) => i.nota_id === row.id) },
}

function splitTop(s) { // pisah koma di level teratas (bukan di dalam kurung)
  const out = []; let depth = 0; let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function parseSelect(sel) {
  const fields = []; const embeds = []
  for (const part of splitTop(sel || '*')) {
    const m = part.match(/^(?:(\w+):)?(\w+)(?:!\w+)?\((.*)\)$/)
    if (m) embeds.push({ alias: m[1] || m[2], table: m[2], select: m[3] })
    else fields.push(part)
  }
  return { fields, embeds }
}

function project(db, table, row, sel) {
  const { fields, embeds } = parseSelect(sel)
  let out = {}
  if (fields.includes('*')) out = { ...row }
  else for (const f of fields) out[f] = row[f]
  for (const e of embeds) {
    const rel = RELATIONS[table]?.[e.table]
    const val = rel ? rel(db, row) : null
    out[e.alias] = Array.isArray(val) ? val.map((v) => project(db, e.table, v, e.select)) : val ? project(db, e.table, val, e.select) : null
  }
  return out
}

function parseVal(v) {
  if (v === 'null') return null
  if (v === 'true') return true
  if (v === 'false') return false
  return v
}
const eqLoose = (a, b) => (a === null || a === undefined ? b === null : String(a) === String(b))

function filterRows(rows, params) {
  return rows.filter((r) => {
    for (const [k, raw] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
      const neg = raw.startsWith('not.')
      const v = neg ? raw.slice(4) : raw
      const [op, ...rest] = v.split('.')
      const arg = rest.join('.')
      let ok
      if (op === 'eq') ok = eqLoose(r[k], parseVal(arg))
      else if (op === 'neq') ok = !eqLoose(r[k], parseVal(arg))
      else if (op === 'is') ok = parseVal(arg) === null ? r[k] === null || r[k] === undefined : r[k] === parseVal(arg)
      else if (op === 'in') ok = arg.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')).some((x) => eqLoose(r[k], x))
      else if (op === 'gte') ok = r[k] >= arg
      else if (op === 'lte') ok = r[k] <= arg
      else ok = true
      if (neg ? ok : !ok) return false
    }
    return true
  })
}

function orderRows(rows, order) {
  if (!order) return rows
  const keys = order.split(',').map((o) => { const [col, dir] = o.split('.'); return { col, desc: dir === 'desc' } })
  return [...rows].sort((a, b) => {
    for (const { col, desc } of keys) {
      if (a[col] === b[col]) continue
      const c = a[col] > b[col] ? 1 : -1
      return desc ? -c : c
    }
    return 0
  })
}

export function createMock(fixture, { me }) {
  const db = clone(fixture)
  const log = { notifs: [], writes: [], tgLinks: 0 }

  async function handle(route) {
    const req = route.request()
    const url = new URL(req.url())
    const method = req.method()
    const headers = req.headers()
    const accept = headers['accept'] || ''
    const prefer = headers['prefer'] || ''
    const json = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: d === undefined ? '' : JSON.stringify(d) })
    if (method === 'OPTIONS') return json({})

    const path = url.pathname
    if (path === '/auth/v1/user') return json(db.__authUsers[me])
    if (path.startsWith('/auth/v1/')) return json({})
    if (path === '/functions/v1/send-notif') { log.notifs.push(req.postDataJSON()); return json({ sent: 1, failed: 0, not_linked: 0 }) }
    if (path === '/functions/v1/telegram-bot') { log.tgLinks++; return json({ url: 'https://t.me/GastronInternalBot?start=TESTTOKEN' }) }
    if (path.startsWith('/storage/v1/object/public/signatures/')) {
      // Logo & tanda tangan uji (bentuk sama dengan aslinya: logo 1966x547, ttd 349x312)
      const f = path.endsWith('logo_gastron.png') ? 'logo_uji.png' : /ttd_\w+\.png$/.test(path) ? 'ttd_uji.png' : null
      if (f) return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(new URL(`./aset/${f}`, import.meta.url)) })
    }
    if (path.startsWith('/storage/v1/object/public/')) return route.fulfill({ status: 404, body: '' })
    if (path.startsWith('/storage/v1/object/')) return json({ Key: path, path: path.split('/').slice(5).join('/') })
    if (path === '/rest/v1/rpc/generate_kode_surat') {
      if (db.__failRpc) return json({ message: 'rpc gagal (tes)' }, 500)
      const div = req.postDataJSON()?.p_division || 'OPR'
      return json(`GTR-${div}-0${(++seq) % 100}-X-2026`)
    }

    const m = path.match(/^\/rest\/v1\/(\w+)$/)
    if (!m) return json({ message: 'not found' }, 404)
    const table = m[1]
    db[table] ??= []
    const params = [...url.searchParams.entries()]
    const sel = url.searchParams.get('select')
    const wantObject = accept.includes('vnd.pgrst.object')
    const respond = (rows) => {
      const out = rows.map((r) => project(db, table, r, sel || '*'))
      if (wantObject) return out.length === 1 ? json(out[0]) : json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 406)
      return json(out)
    }

    if (method === 'GET' || method === 'HEAD') {
      let rows = orderRows(filterRows(db[table], params), url.searchParams.get('order'))
      const limit = url.searchParams.get('limit')
      if (limit) rows = rows.slice(0, Number(limit))
      return respond(rows)
    }
    if (method === 'POST') {
      const body = req.postDataJSON()
      const list = Array.isArray(body) ? body : [body]
      const isUpsert = prefer.includes('resolution=merge-duplicates')
      const conflict = (url.searchParams.get('on_conflict') || 'id').split(',')
      // Seperti database asli: pengajuan_items.jumlah = kolom GENERATED (qty x harga_satuan), tidak boleh diisi
      if (table === 'users' && !db.users.find((u) => u.id === me)?.is_admin) list.forEach((it) => { it.role = null; it.is_admin = false })
      if (db.__gagalInsert === table) return json({ message: `insert ${table} gagal (tes)` }, 500)
      if (table === 'pengajuan_items' && list.some((it) => 'jumlah' in it)) {
        log.writes.push({ method, table, body, gagal: true })
        return json({ code: '428C9', message: 'cannot insert a non-DEFAULT value into column "jumlah"' }, 400)
      }
      const result = []
      for (const item of list) {
        const existing = isUpsert ? db[table].find((r) => conflict.every((c) => item[c] !== undefined && eqLoose(r[c], item[c]))) : null
        if (existing) { Object.assign(existing, item); result.push(existing) } else {
          const row = { id: newId(table), created_at: new Date().toISOString(), ...item }
          if (table === 'pengajuan') row.is_archived ??= false
          if (table === 'pengajuan_items') row.jumlah = Number(row.qty) * Number(row.harga_satuan)
          db[table].push(row); result.push(row)
        }
      }
      log.writes.push({ method, table, body })
      return prefer.includes('return=representation') ? respond(result) : json(undefined, 201)
    }
    if (method === 'PATCH') {
      const body = req.postDataJSON()
      let rows = filterRows(db[table], params)
      // Seperti database asli (RLS + trigger users_guard): non-admin hanya boleh update barisnya sendiri,
      // dan role / is_admin hanya boleh diubah admin; admin terakhir tidak bisa dicabut.
      if (table === 'users') {
        const admin = !!db.users.find((u) => u.id === me)?.is_admin
        if (!admin) rows = rows.filter((r) => r.id === me)
        for (const r of rows) {
          const gantiRole = 'role' in body && body.role !== r.role
          const gantiAdmin = 'is_admin' in body && body.is_admin !== r.is_admin
          if (!gantiRole && !gantiAdmin) continue
          if (!admin) return json({ code: '42501', message: 'Hanya admin yang bisa mengubah role' }, 403)
          if (r.is_admin && body.is_admin === false && db.users.filter((u) => u.is_admin).length <= 1) return json({ code: 'P0001', message: 'Minimal harus ada satu admin' }, 400)
          db.role_change_log ??= []
          db.role_change_log.push({ id: db.role_change_log.length + 1, user_id: r.id, changed_by: me, old_role: r.role, new_role: 'role' in body ? body.role : r.role, old_admin: r.is_admin, new_admin: 'is_admin' in body ? body.is_admin : r.is_admin, changed_at: new Date().toISOString() })
        }
      }
      rows.forEach((r) => Object.assign(r, body))
      log.writes.push({ method, table, body, count: rows.length })
      return prefer.includes('return=representation') ? respond(rows) : json(undefined, 204)
    }
    if (method === 'DELETE') {
      const rows = filterRows(db[table], params)
      db[table] = db[table].filter((r) => !rows.includes(r))
      log.writes.push({ method, table, count: rows.length })
      return prefer.includes('return=representation') ? respond(rows) : json(undefined, 204)
    }
    return json({}, 405)
  }

  return { db, log, handle }
}
