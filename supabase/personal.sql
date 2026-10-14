-- 개인 가계부(https://ziro0914.github.io/myMoney/)용 테이블. SQL Editor에서 한 번 실행하세요.
-- 가족 가계부(transactions, rules, budgets)와 테이블이 달라서 금액이 섞이지 않습니다.

create table if not exists personal_transactions (
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
create index if not exists personal_transactions_date_idx on personal_transactions (date desc);

create table if not exists personal_rules (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique,
  category text not null
);

create table if not exists personal_budgets (
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  category text not null,
  amount bigint not null check (amount >= 0),
  primary key (month, category)
);

alter table personal_transactions enable row level security;
alter table personal_rules enable row level security;
alter table personal_budgets enable row level security;

-- 가족 가계부와 같은 방식(로그인 없음): 앱의 anon 키로 읽고 쓸 수 있다.
-- 주소를 아는 사람은 누구나 볼 수 있으니 주소를 공유하지 마세요.
drop policy if exists "app access" on personal_transactions;
create policy "app access" on personal_transactions for all to anon, authenticated using (true) with check (true);
drop policy if exists "app access" on personal_rules;
create policy "app access" on personal_rules for all to anon, authenticated using (true) with check (true);
drop policy if exists "app access" on personal_budgets;
create policy "app access" on personal_budgets for all to anon, authenticated using (true) with check (true);
