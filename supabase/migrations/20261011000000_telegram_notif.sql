-- Notifikasi via Telegram (ganti web push)
-- Jalankan sekali di Supabase SQL Editor, atau `supabase db push`.

-- 1) Chat Telegram tiap user. Kosong = belum menghubungkan Telegram.
alter table public.users add column if not exists telegram_chat_id bigint;
alter table public.users add column if not exists telegram_username text;
alter table public.users add column if not exists telegram_linked_at timestamptz;

-- 2) Token sekali pakai untuk menghubungkan akun app <-> chat Telegram.
--    Dibuat Edge Function telegram-bot, berlaku 30 menit, dihapus setelah dipakai.
create table if not exists public.telegram_link_tokens (
  token      text primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Hanya Edge Function (service role) yang boleh baca/tulis tabel token.
-- RLS aktif tanpa policy = tertutup untuk anon & user login.
alter table public.telegram_link_tokens enable row level security;
