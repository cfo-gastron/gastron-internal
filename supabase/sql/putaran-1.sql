-- Putaran 1 (11 Okt 2026) · SQL pendukung. Jalankan per bagian di Supabase SQL Editor.
-- Bagian 1-3 aman dijalankan kapan saja. Bagian 4 hanya pengecekan untuk keputusan owner.

-- =========================================================================
-- 1) CEK: ada pengajuan yang masuk cashflow lebih dari sekali? (temuan H6)
--    Harusnya hasilnya kosong. Kalau ada baris, kirim ke Claude sebelum lanjut ke bagian 2.
select linked_id, count(*) as jumlah_baris, sum(amount) as total
from cashflow_transactions
where linked_id is not null
group by linked_id
having count(*) > 1;

-- =========================================================================
-- 2) KUNCI di database: satu pengajuan maksimal satu baris cashflow.
--    App sudah mencegah dobel, ini lapisan kedua kalau dua orang klik bersamaan.
--    Akan GAGAL kalau bagian 1 masih ada hasil (bersihkan dulu).
create unique index if not exists cashflow_transactions_linked_id_unik
  on cashflow_transactions (linked_id)
  where linked_id is not null;

-- =========================================================================
-- 3) Isi mapping cashflow di database untuk subkategori lama yang belum ter-mapping.
--    Setelah ini semua mapping diatur di halaman Sinkronisasi (satu sumber).
update subkategori_pengajuan s set
  cashflow_cat_id = m.cat_id, cashflow_cat_name = m.cat_name,
  cashflow_subcat_id = m.subcat_id, cashflow_subcat_name = m.subcat_name
from (values
  ('Upah, Bensin, Parkir, Tol Kendaraan', 'd_opex', 'Operational Expenditure', 'd_opex1', 'Upah, Bensin, Parkir, Tol Kendaraan'),
  ('Operasional Kandang',                 'd_opex', 'Operational Expenditure', 'd_opex2', 'Operasional Kandang'),
  ('Pemeliharaan Alat',                   'd_opex', 'Operational Expenditure', 'd_opex6', 'Pemeliharaan Alat'),
  ('Pemeliharaan Kendaraan',              'd_opex', 'Operational Expenditure', 'd_opex5', 'Pemeliharaan Kendaraan'),
  ('Marketing/Mobilisasi Operasional',    'd_opex', 'Operational Expenditure', 'd_opex4', 'Marketing/Mobilisasi Operasional'),
  ('Pembelian Alat',                      'd_capex', 'CapEx', 'd_capex2', 'Pembelian Alat'),
  ('Pembelian Aset',                      'd_capex', 'CapEx', 'd_capex1', 'Pembelian Aset'),
  ('Perjalanan Dinas',                    'd_corp', 'Corporate Support', 'd_corp4', 'Perjalanan Dinas'),
  ('Perlengkapan Kantor',                 'd_off', 'Office', 'd_off2', 'Perlengkapan Kantor')
) as m(nama, cat_id, cat_name, subcat_id, subcat_name)
where s.nama = m.nama and s.cashflow_cat_id is null;

-- =========================================================================
-- 4) PENGECEKAN untuk keputusan owner (tidak mengubah apa pun)

-- 4a) Siapa saja yang punya role eksekutif? (temuan H2: role dipilih sendiri saat login pertama)
--     Pastikan semua nama di sini memang orangnya.
select full_name, email, role, created_at
from users
where role in ('ceo', 'cfo', 'coo', 'cao', 'finance')
order by role, created_at;

-- 4b) Apakah RLS aktif di tabel utama? (temuan H1: pengaju bisa lihat pengajuan semua divisi)
select relname as tabel, relrowsecurity as rls_aktif
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('pengajuan', 'pengajuan_items', 'pengajuan_penerima', 'users', 'lpj', 'cashflow_transactions')
order by relname;

-- 4c) Policy yang berlaku di tabel-tabel itu
select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('pengajuan', 'users', 'lpj', 'cashflow_transactions')
order by tablename, policyname;
