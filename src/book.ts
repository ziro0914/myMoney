// 같은 코드로 두 가계부를 만든다. 빌드할 때 VITE_BOOK으로 고른다.
// - family:   https://ziro0914.github.io/myMoney/family/  (부부가 같이 쓰는 가계부)
// - personal: https://ziro0914.github.io/myMoney/         (나 혼자 쓰는 가계부)
// 두 가계부는 Supabase 테이블과 브라우저 저장 공간을 따로 써서 금액이 섞이지 않는다.

export type Book = 'personal' | 'family'

export const BOOK: Book = import.meta.env.VITE_BOOK === 'personal' ? 'personal' : 'family'

export const BOOK_TITLE = BOOK === 'personal' ? '내 가계부' : '우리집 가계부'

/** Supabase 테이블 이름 앞에 붙는 말. 가족 가계부는 원래 쓰던 테이블을 그대로 쓴다. */
export const TABLE_PREFIX = BOOK === 'personal' ? 'personal_' : ''

/** 브라우저 저장 키 앞에 붙는 말. 두 가계부가 같은 주소(github.io)라 나눠 둔다. */
export const STORAGE_PREFIX = BOOK === 'personal' ? 'ledger.personal.' : 'ledger.'
