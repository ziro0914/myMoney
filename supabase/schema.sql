-- Supabase 대시보드 > SQL Editor 에서 한 번 실행하세요.

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

-- 로그인 없이 쓰는 앱이라 앱의 anon 키로 읽고 쓸 수 있게 연다.
-- anon 키는 웹페이지에 들어 있으므로, 주소를 아는 사람은 누구나 내역을 볼 수 있다.
drop policy if exists "family only" on transactions;
drop policy if exists "app access" on transactions;
create policy "app access" on transactions for all
  to anon, authenticated using (true) with check (true);

drop policy if exists "family only" on rules;
drop policy if exists "app access" on rules;
create policy "app access" on rules for all
  to anon, authenticated using (true) with check (true);

-- 월별 분류 예산. 정한 금액은 다음 달에도 이어지고, 0이면 그 달부터 예산 없음.
create table if not exists budgets (
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  category text not null,
  amount bigint not null check (amount >= 0),
  primary key (month, category)
);
alter table budgets enable row level security;
drop policy if exists "app access" on budgets;
create policy "app access" on budgets for all
  to anon, authenticated using (true) with check (true);
