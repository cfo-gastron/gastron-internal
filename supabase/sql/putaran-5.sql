-- Putaran 5: cari pengajuan yang itemnya hilang karena bug "Ubah / Submit Ulang"
-- (kolom pengajuan_items.jumlah dihitung otomatis database, insert dari halaman Ubah selalu gagal,
--  padahal item lama sudah dihapus duluan). Jalankan di Supabase -> SQL Editor, kirim hasilnya.

-- 1. Pengajuan yang punya total tapi tidak punya item sama sekali
select p.kode_surat, p.judul, p.division, p.status, p.total_pengajuan, u.full_name as pengaju, p.submitted_at
from public.pengajuan p
left join public.users u on u.id = p.submitted_by
where p.total_pengajuan > 0
  and not exists (select 1 from public.pengajuan_items i where i.pengajuan_id = p.id)
order by p.submitted_at desc;

-- 2. Cek kolom jumlah memang GENERATED (is_generated = ALWAYS)
select column_name, is_generated, generation_expression
from information_schema.columns
where table_schema = 'public' and table_name = 'pengajuan_items' and column_name = 'jumlah';
