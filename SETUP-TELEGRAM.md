# Setup Notifikasi Telegram

Notifikasi Sistem Pengajuan dikirim lewat bot Telegram (menggantikan web push yang tidak jalan di iPhone).
Tiap user cukup sekali menekan **Hubungkan Telegram** di Dashboard, lalu notif masuk ke chat pribadinya.

Pemicu notif tidak berubah: pengajuan baru, approval tiap tahap, hold/tolak/revisi, LPJ baru, approval LPJ.
User yang memicu notif (yang approve/submit) tidak dikirimi notif atas aksinya sendiri.

---

## 1. Bikin bot di BotFather (±2 menit)

1. Buka Telegram, cari **@BotFather**, tekan Start.
2. Kirim `/newbot`.
3. Nama bot (bebas, tampil di chat): misalnya `Gastron Notifikasi`.
4. Username bot (harus diakhiri `bot`, unik): misalnya `GastronInternalBot`.
5. BotFather membalas dengan **token** seperti `7712345678:AAH...`. Simpan, jangan dibagikan.
6. Opsional: `/setuserpic` (logo Gastron), `/setdescription` → `Notifikasi Sistem Pengajuan PT Gastron Indo Energi`.

## 2. Tambah kolom di database

Supabase Dashboard → SQL Editor → tempel isi
`supabase/migrations/20261011000000_telegram_notif.sql` → Run.

## 3. Isi secrets Edge Function

Supabase Dashboard → Edge Functions → Secrets, tambahkan:

| Nama | Isi |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token dari BotFather |
| `TELEGRAM_BOT_USERNAME` | username bot, tanpa `@` (misal `GastronInternalBot`) |
| `TELEGRAM_WEBHOOK_SECRET` | teks acak panjang (dikirim terpisah, jangan ditulis di repo) |
| `APP_URL` | `https://gastron-internal.vercel.app` |

Atau lewat terminal (folder project):

```
npx supabase secrets set TELEGRAM_BOT_TOKEN=TOKEN_DARI_BOTFATHER TELEGRAM_BOT_USERNAME=GastronInternalBot TELEGRAM_WEBHOOK_SECRET=ISI_WEBHOOK_SECRET APP_URL=https://gastron-internal.vercel.app
```

## 4. Deploy Edge Function

```
npx supabase functions deploy telegram-bot --no-verify-jwt
npx supabase functions deploy send-notif --no-verify-jwt
```

(`--no-verify-jwt` memang disengaja: Telegram tidak mengirim JWT, dan login user dicek di dalam fungsinya.)

## 5. Sambungkan bot ke Edge Function (webhook)

Buka URL ini di browser (ganti `TOKEN_DARI_BOTFATHER`):

```
https://api.telegram.org/botTOKEN_DARI_BOTFATHER/setWebhook?url=https://vybfhlpmtsdtegbrdsvo.supabase.co/functions/v1/telegram-bot&secret_token=ISI_WEBHOOK_SECRET&allowed_updates=%5B%22message%22%5D
```

Harus muncul `{"ok":true,"result":true,"description":"Webhook was set"}`.

## 6. Deploy app

Commit & push ke GitHub → Vercel deploy otomatis.

## 7. Tes

1. Buka app → Dashboard → **Hubungkan Telegram** → **Buka Telegram** → tekan **Start**.
   Bot membalas: "✅ Halo …, Telegram kamu sudah terhubung … sebagai CFO".
   Kembali ke app → banner hilang.
2. Tes kirim notif langsung (PowerShell, di folder project). Ambil service_role key di
   Supabase Dashboard → Project Settings → API:

   ```
   curl.exe -X POST https://vybfhlpmtsdtegbrdsvo.supabase.co/functions/v1/send-notif -H "Authorization: Bearer SERVICE_ROLE_KEY" -H "Content-Type: application/json" --data "@test-notif.json"
   ```

   Harus membalas `{"sent":1,"failed":0,"not_linked":0}` dan notif masuk ke Telegram.
3. Minta semua user (CEO, CFO, COO, CAO, Finance, dan pengaju) menekan **Hubungkan Telegram** sekali.

## Kalau ada masalah

- **Bot diam saat tekan Start** → cek langkah 5: buka
  `https://api.telegram.org/botTOKEN/getWebhookInfo`, lihat `last_error_message`.
- **Banner: "Gagal membuat link Telegram (…belum di-set…)"** → secrets langkah 3 belum lengkap, lalu deploy ulang.
- **`not_linked` > 0** → user itu belum menekan Hubungkan Telegram.
- **User mau berhenti** → ketik `/stop` ke bot. Menyambung lagi: tekan Hubungkan Telegram.
- **Log** → Supabase Dashboard → Edge Functions → pilih fungsi → Logs.
