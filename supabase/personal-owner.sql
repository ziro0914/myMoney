-- personal.sql 다음에 한 번 실행하세요. 혼자 쓰는 가계부 둘이 personal_* 테이블을 같이 쓰도록 owner 컬럼을 넣습니다.
-- - 내 가계부(https://ziro0914.github.io/myMoney/):        owner = 'me' (이미 있던 내역도 'me'가 됩니다)
-- - 새라 가계부(https://ziro0914.github.io/myMoney/saera/): owner = 'saera'
-- 가족 가계부 테이블(transactions, rules, budgets)은 건드리지 않습니다.

alter table personal_transactions add column if not exists owner text not null default 'me';
alter table personal_rules add column if not exists owner text not null default 'me';
alter table personal_budgets add column if not exists owner text not null default 'me';

-- 중복 판단을 사람마다 따로 한다.
alter table personal_transactions drop constraint if exists personal_transactions_dedupe_key_key;
alter table personal_transactions drop constraint if exists personal_transactions_owner_dedupe_key_key;
alter table personal_transactions add constraint personal_transactions_owner_dedupe_key_key unique (owner, dedupe_key);

alter table personal_rules drop constraint if exists personal_rules_keyword_key;
alter table personal_rules drop constraint if exists personal_rules_owner_keyword_key;
alter table personal_rules add constraint personal_rules_owner_keyword_key unique (owner, keyword);

alter table personal_budgets drop constraint if exists personal_budgets_pkey;
alter table personal_budgets add constraint personal_budgets_pkey primary key (owner, month, category);

create index if not exists personal_transactions_owner_date_idx on personal_transactions (owner, date desc);

notify pgrst, 'reload schema';
