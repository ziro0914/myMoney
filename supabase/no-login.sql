-- 이메일 로그인을 쓰던 DB를 로그인 없는 방식으로 바꿀 때 한 번 실행한다.
drop policy if exists "family only" on transactions;
drop policy if exists "app access" on transactions;
create policy "app access" on transactions for all
  to anon, authenticated using (true) with check (true);

drop policy if exists "family only" on rules;
drop policy if exists "app access" on rules;
create policy "app access" on rules for all
  to anon, authenticated using (true) with check (true);

