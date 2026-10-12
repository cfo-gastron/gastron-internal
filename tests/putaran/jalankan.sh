#!/bin/bash
# Jalankan seluruh regression suite satu putaran gastron-internal.
# Usage: bash tests/putaran/jalankan.sh <baselineUrl> <kandidatUrl> <nama-putaran>
#   baselineUrl = build production terakhir (vite preview), kandidatUrl = build versi baru.
#   Contoh: npx vite preview --port 4301 (folder baseline) & npx vite preview --port 4310 (folder kandidat)
set -u
cd "$(dirname "$0")/../.."
BASE="${1:-http://localhost:4301}"; CAND="${2:-http://localhost:4310}"; NAMA="${3:-putaran}"
OUT="tests/putaran/hasil/$NAMA"; mkdir -p "$OUT"
ok=0; fail=0
step() { echo; echo "=== $1"; }
run() { if "$@"; then ok=$((ok+1)); else fail=$((fail+1)); fi; }

# Dua server harus hidup dulu, kalau tidak hasilnya menyesatkan
for u in "$BASE" "$CAND"; do
  if ! curl -s -o /dev/null --max-time 5 "$u"; then echo "Server $u tidak bisa dibuka. Jalankan vite preview dulu."; exit 99; fi
done

step "1. Unit test aturan approval & notif"
run node --test tests/approval.test.mjs tests/status.test.mjs tests/api.test.mjs tests/rekening.test.mjs tests/roles.test.mjs
step "2. Unit test Edge Function (butuh deno)"
if command -v deno >/dev/null; then run deno test --allow-env supabase/functions/tests/; else echo "deno tidak ada, dilewati"; fi
step "3. Lint (file baru wajib bersih; error lama dicatat)"
npx eslint src 2>&1 | grep problems | tail -1 | tee "$OUT/lint.txt"
step "4. Tes khusus (bug lama + aturan kritis) di kandidat"
run bash -o pipefail -c "node tests/putaran/khusus.mjs '$CAND' | tee '$OUT/khusus.txt'"
step "5. Angka emas (baseline vs kandidat)"
run bash -o pipefail -c "node tests/putaran/numbers.mjs '$BASE' '$CAND' | tee '$OUT/angka.txt'"
step "6. Klik semua tombol"
for vp in desktop mobile; do run bash -o pipefail -c "node tests/putaran/clicks.mjs '$CAND' $vp '$OUT/klik-$vp.json' | tee '$OUT/klik-$vp.txt'"; done
step "7. Screenshot desktop & HP"
run bash -o pipefail -c "node tests/putaran/shots.mjs '$CAND' '$OUT/layar' | tee '$OUT/layar.txt'"
echo; echo "=== HASIL: $ok lulus, $fail gagal  (angka berubah & tombol tanpa efek wajib dijelaskan di log putaran)"
exit $fail
