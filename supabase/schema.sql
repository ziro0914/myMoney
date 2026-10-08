-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요.

-- 가계부를 볼 수 있는 가족 이메일 목록 (아래 insert 문의 이메일을 바꿔서 실행)
create table if not exists members (
  email text primary key
);
alter table members enable row level security;
-- members 테이블에는 정책을 두지 않아서 앱에서는 읽거나 쓸 수 없고, 대시보드에서만 관리합니다.

create or replace function is_member() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from members where email = lower(auth.jwt() ->> 'email'))
$$;

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time text not null default '',
  amount bigint not null,
  description text not null default '',
  category text not null,
  memo text not null default '',
  source text not null check (source in ('import', 'manual')),
  dedupe_key text unique,
  balance bigint,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists transactions_date_idx on transactions (date desc);

create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique,
  category text not null
);

alter table transactions enable row level security;
alter table rules enable row level security;

drop policy if exists "family only" on transactions;
create policy "family only" on transactions for all
  to authenticated using (is_member()) with check (is_member());

drop policy if exists "family only" on rules;
create policy "family only" on rules for all
  to authenticated using (is_member()) with check (is_member());

-- 가족 이메일 등록 (소문자로)
-- insert into members (email) values ('me@example.com'), ('spouse@example.com');
