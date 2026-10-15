// 같은 코드로 여러 가계부를 만든다. 빌드할 때 VITE_BOOK으로 고른다.
// - family:   https://ziro0914.github.io/myMoney/family/  (부부가 같이 쓰는 가계부)
// - personal: https://ziro0914.github.io/myMoney/         (나 혼자 쓰는 가계부)
// - saera:    https://ziro0914.github.io/myMoney/saera/   (새라 혼자 쓰는 가계부)
// 가족 가계부는 transactions 등, 혼자 쓰는 가계부는 personal_* 테이블을 쓰고 owner 컬럼으로 사람을 나눈다.
// 브라우저 저장 공간도 가계부마다 따로 써서 금액이 섞이지 않는다.

export type Book = 'personal' | 'family' | 'saera'

export const BOOK: Book =
  import.meta.env.VITE_BOOK === 'personal' ? 'personal' : import.meta.env.VITE_BOOK === 'saera' ? 'saera' : 'family'

/** 혼자 쓰는 가계부는 사용자를 고르지 않고 이 이름으로 기록한다. */
export const SOLO_USER: string | null = BOOK === 'personal' ? '나' : BOOK === 'saera' ? '새라' : null

export const BOOK_TITLE = BOOK === 'personal' ? '내 가계부' : BOOK === 'saera' ? '새라 가계부' : '우리집 가계부'

/** Supabase 테이블 이름 앞에 붙는 말. 가족 가계부는 원래 쓰던 테이블을 그대로 쓴다. */
export const TABLE_PREFIX = BOOK === 'family' ? '' : 'personal_'

/** personal_* 테이블의 owner 값. 가족 가계부는 owner 컬럼이 없어서 null. */
export const OWNER: string | null = BOOK === 'personal' ? 'me' : BOOK === 'saera' ? 'saera' : null

/** 브라우저 저장 키 앞에 붙는 말. 가계부들이 같은 주소(github.io)라 나눠 둔다. */
export const STORAGE_PREFIX = BOOK === 'family' ? 'ledger.' : `ledger.${BOOK}.`
