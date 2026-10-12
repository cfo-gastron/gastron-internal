-- Putaran 6 (12 Okt 2026) · Role hanya diatur admin (brief Corsec "Pengaturan Role oleh CFO")
-- Jalankan di Supabase → SQL Editor, BERSAMAAN dengan deploy app (selisih beberapa menit).
-- Data lama tidak diubah: pengajuan, item, LPJ, cashflow, approval_logs tidak disentuh.
-- Batalkan: drop trigger users_guard on public.users; drop trigger on_auth_user_created on auth.users;

-- 0a. CEK (hanya membaca). Harapan: kosong. Kalau ada baris, kabari dulu sebelum lanjut.
select id, email, role from public.users
where role is not null and role not in
  ('operational','procurement','corporate_secretary','finance','coo','cao','cfo','ceo');

-- 0b. CEK policy lama di tabel users (catat; lihat langkah 8)
select policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'users';

-- 1. Kolom dan batasan (data lama tidak diubah)
alter table public.users add column if not exists is_admin boolean not null default false;
alter table public.users alter column role drop not null;
alter table public.users alter column role drop default;
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role is null or role in
  ('operational','procurement','corporate_secretary','finance','coo','cao','cfo','ceo')) not valid;

-- 2. Cek admin (security definer supaya tidak terhalang RLS)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false)
$$;

-- 3. Catatan perubahan role
create table if not exists public.role_change_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  changed_by uuid references public.users(id),
  old_role text, new_role text, old_admin boolean, new_admin boolean,
  changed_at timestamptz not null default now()
);
alter table public.role_change_log enable row level security;
grant select on public.role_change_log to authenticated;
drop policy if exists role_log_admin_read on public.role_change_log;
create policy role_log_admin_read on public.role_change_log for select to authenticated using (public.is_admin());

-- 4. Penjaga: hanya admin yang boleh mengubah role / is_admin
create or replace function public.users_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- SQL Editor / service role (Edge Function)
  if tg_op = 'INSERT' then
    if not public.is_admin() then new.role := null; new.is_admin := false; end if;
    return new;
  end if;
  if new.role is distinct from old.role or new.is_admin is distinct from old.is_admin then
    if not public.is_admin() then
      raise exception 'Hanya admin yang bisa mengubah role' using errcode = '42501';
    end if;
    if old.is_admin and not new.is_admin
       and (select count(*) from public.users where is_admin) <= 1 then
      raise exception 'Minimal harus ada satu admin' using errcode = 'P0001';
    end if;
    insert into public.role_change_log(user_id, changed_by, old_role, new_role, old_admin, new_admin)
    values (new.id, auth.uid(), old.role, new.role, old.is_admin, new.is_admin);
  end if;
  return new;
end $$;
drop trigger if exists users_guard on public.users;
create trigger users_guard before insert or update on public.users
  for each row execute function public.users_guard();

-- 5. Profil dibuat otomatis saat login pertama (role kosong).
--    Kalau gagal, login tetap jalan dan app membuat profilnya sendiri.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.users(id, email, full_name, avatar_url)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user gagal untuk %: %', new.email, sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. RLS tabel users
alter table public.users enable row level security;
drop policy if exists users_read on public.users;
drop policy if exists users_insert_self on public.users;
drop policy if exists users_update_self on public.users;
drop policy if exists users_update_admin on public.users;
create policy users_read on public.users for select to authenticated using (true);
create policy users_insert_self on public.users for insert to authenticated with check (id = auth.uid());
create policy users_update_self on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy users_update_admin on public.users for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 7. Setup sekali: jadikan akun CFO admin. Hasilnya harus 1 baris.
update public.users set is_admin = true where role = 'cfo' and full_name ilike 'Febran%' returning email, full_name, is_admin;

-- 8. Hapus policy LAMA (dari hasil 0b) yang mengizinkan update baris ORANG LAIN
--    (qual tanpa "auth.uid() = id", mis. "true"). Contoh:
-- drop policy "NAMA_POLICY_LAMA" on public.users;
