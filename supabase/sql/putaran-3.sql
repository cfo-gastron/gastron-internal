-- Putaran 3-4 (12 Okt 2026) · Batalkan approval, Lanjutkan pengajuan ditahan, ubah saat ditahan
-- Dicatat di timeline sebagai approval_logs.action = 'approval_dibatalkan' / 'dilanjutkan' / 'diubah'.

-- 1) CEK: apakah kolom action dibatasi daftar nilai tertentu?
select conname, pg_get_constraintdef(oid) as aturan
from pg_constraint
where conrelid = 'public.approval_logs'::regclass and contype = 'c';

-- 2) Kalau hasil no. 1 ada aturan "action IN (...)" yang belum memuat 'approval_dibatalkan',
--    ganti NAMA_CONSTRAINT dengan nama dari hasil no. 1, lalu jalankan dua baris ini:
-- alter table public.approval_logs drop constraint NAMA_CONSTRAINT;
-- alter table public.approval_logs add constraint approval_logs_action_check
--   check (action in ('submitted', 'approved', 'revision', 'hold', 'rejected', 'approval_dibatalkan', 'dilanjutkan', 'diubah'));

-- Kalau hasil no. 1 kosong: tidak perlu apa-apa.
-- (Tanpa ini fiturnya TETAP jalan, hanya catatannya tidak muncul di timeline.)
