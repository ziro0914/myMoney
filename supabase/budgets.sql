-- 예산 기능을 추가할 때 이미 쓰던 DB에 한 번 실행한다.
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
