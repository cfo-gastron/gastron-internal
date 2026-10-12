# Regression suite putaran · Gastron Internal

Satu putaran = Plan (heuristic evaluation) → Do → Check (suite ini + design review) → Act. Log: `docs/putaran-log.md`.

## Pasang (sekali)
    npm install
    npx playwright install chromium      # di laptop; di sandbox Claude sudah ada
    # opsional: deno (untuk unit test Edge Function)

## Jalankan satu putaran
1. Build dua versi dan jalankan masing-masing:
   - baseline (versi production terakhir): `npx vite build && npx vite preview --port 4301`
   - kandidat (versi baru): `npx vite build && npx vite preview --port 4310`
2. `npm run putaran -- http://localhost:4301 http://localhost:4310 r2`
3. Hasil di `tests/putaran/hasil/<nama>/` (tidak ikut git).

## Isi
- `fixture.mjs`  data uji: 7 user (semua role), 15 pengajuan (semua status & divisi), LPJ di tiap tahap. Jam dibekukan 11 Okt 2026 09.00 WIB.
- `mockdb.mjs`   Supabase tiruan di memori (PostgREST + auth + functions + storage). Tidak menyentuh database asli.
- `lib.mjs`      buka app sebagai role tertentu, desktop/HP; daftar halaman yang dicek (`PAGES`).
- `khusus.mjs`   tes K1..Kn: satu tes per bug yang pernah difix / aturan kritis. **Tiap bug yang difix wajib jadi tes K baru.** Jalankan juga ke baseline: tes baru harus gagal di sana.
- `numbers.mjs`  angka emas: semua angka di layar baseline vs kandidat. Angka berubah wajib dijelaskan di log.
- `clicks.mjs`   klik semua tombol di semua halaman (desktop & HP): error, gagal klik, tanpa efek, target sentuh < 32px.
- `shots.mjs`    screenshot semua halaman desktop & HP + deteksi geser horizontal.
- `jalankan.sh`  menjalankan semuanya + unit test (`tests/*.test.mjs`, Edge Function).
