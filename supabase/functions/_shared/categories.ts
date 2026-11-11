// 분류 목록과 키워드 자동 분류. 앱(src/categories.ts)과 카드 문자 서버 함수(add-card-sms)가 같이 쓴다.
// 그래서 어떤 가계부인지는 import.meta.env 대신 인자로 받는다.

export type Book = 'personal' | 'family' | 'saera'

export interface Rule {
  id: string
  keyword: string
  category: string
}

export const INCOME_CATEGORIES = ['급여', '기타수입'] as const

/** 통계에서 빠지는 분류 (가족 계좌끼리 옮긴 돈 등) */
export const EXCLUDED_CATEGORY = '내부이체'

export function expenseCategories(book: Book): string[] {
  return [
    '식비',
    // 우리집 가계부는 밖에서 사 먹은 돈을 식비와 따로 본다
    ...(book === 'family' ? ['외식비'] : []),
    '카페·간식',
    '마트·생활',
    '쇼핑',
    '교통',
    '주거·공과금',
    '대출이자',
    '통신',
    // 내 가계부는 '구독' 대신 '동창회비'를 쓴다
    book === 'personal' ? '동창회비' : '구독',
    '의료',
    '교육',
    '여가',
    '보험',
    '경조사',
    // 가족 가계부에만 있는 지출 분류
    ...(book === 'family' ? ['용돈', '부모님'] : []),
    '투자',
    '사업비용',
    '미분류',
  ]
}

function defaultKeywords(book: Book): Record<string, string[]> {
  return {
    '식비': ['배달의민족', '배민', '요기요', '쿠팡이츠', '맥도날드', '버거킹', '롯데리아', '김밥', '식당', '치킨', '피자'],
    '카페·간식': ['스타벅스', '투썸', '이디야', '메가커피', '메가MGC', '컴포즈', '빽다방', '할리스', '폴바셋', '파리바게뜨', '뚜레쥬르', '배스킨', '던킨', '커피', '젤라또', '아이스크림', '디저트', '베이커리'],
    '마트·생활': ['이마트', '홈플러스', '롯데마트', '코스트코', '트레이더스', '컬리', 'GS25', 'CU', '세븐일레븐', '이마트24', '다이소', '노브랜드', '하나로마트'],
    '쇼핑': ['쿠팡', '네이버페이', '11번가', 'G마켓', '옥션', '무신사', '올리브영', 'SSG', '신세계', '현대백화점', '롯데백화점', '나이키', '아디다스', '모던하우스', '이케아', '장난감', '토이'],
    '교통': ['카카오T', '택시', '티머니', '코레일', 'SRT', '주유', 'GS칼텍스', 'SK에너지', 'S-OIL', '현대오일뱅크', '하이패스', '주차'],
    '주거·공과금': ['관리비', '전기요금', '한국전력', '도시가스', '가스요금', '수도요금', '월세'],
    '통신': ['SKT', 'SK텔레콤', 'KT', 'LGU+', 'LG유플러스', '알뜰폰'],
    ...(book === 'personal'
      ? { '동창회비': ['동창회', '동문회'] }
      : { '구독': ['넷플릭스', 'NETFLIX', '유튜브', 'YOUTUBE', '디즈니', '멜론', '스포티파이', '쿠팡와우', '애플', 'APPLE.COM'] }),
    '의료': ['병원', '의원', '약국', '치과', '한의원'],
    '교육': ['어린이집', '유치원', '학원', '교육', '학습지', '교보문고', '예스24', '알라딘'],
    '여가': ['CGV', '메가박스', '롯데시네마', '야놀자', '여기어때', '에어비앤비'],
    '보험': ['보험', '화재', '생명'],
    '급여': ['급여', '월급', '상여'],
    '대출이자': ['대출이자', '대출 이자', '이자'],
    ...(book === 'family' ? { '용돈': ['용돈'], '부모님': ['부모님', '어머니', '아버지', '어머님', '아버님', '장모님', '장인어른', '시어머니', '시아버지'] } : {}),
  }
}

// 받은 돈이면 수입으로 둘 분류 (예: 예금 이자 입금은 대출이자가 아님)
const OUTGOING_ONLY = new Set(['용돈', '부모님', '대출이자'])

export function defaultRules(book: Book): Rule[] {
  return Object.entries(defaultKeywords(book)).flatMap(([category, keywords]) =>
    keywords.map((keyword) => ({ id: `default:${keyword}`, keyword, category })),
  )
}

/**
 * 사용자 규칙을 먼저, 그 안에서는 긴 키워드를 먼저 확인한다.
 * 맞는 규칙이 없으면 수입은 '기타수입', 지출은 '미분류'.
 */
export function categorizeFor(book: Book, description: string, amount: number, userRules: Rule[]): string {
  const text = description.toUpperCase()
  const byLength = (a: Rule, b: Rule) => b.keyword.length - a.keyword.length
  const defaults = defaultRules(book)
  for (const rules of [[...userRules].sort(byLength), defaults]) {
    for (const rule of rules) {
      if (!rule.keyword) continue
      if (text.includes(rule.keyword.toUpperCase())) {
        const isIncomeCategory = (INCOME_CATEGORIES as readonly string[]).includes(rule.category)
        // 기본 수입 규칙은 입금에만 적용 (예: '급여'라는 단어가 들어간 출금은 무시).
        // 지출 분류는 입금(환불)에도 적용해서 그 분류 지출에서 상계되게 한다.
        if (rules === defaults && isIncomeCategory && amount < 0) continue
        // 기본 '용돈'·'부모님' 규칙은 보낸 돈(출금)에만. 받은 돈은 수입으로 둔다.
        if (rules === defaults && OUTGOING_ONLY.has(rule.category) && amount > 0) continue
        return rule.category
      }
    }
  }
  return amount > 0 ? '기타수입' : '미분류'
}
