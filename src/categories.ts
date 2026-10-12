import type { Rule } from './types'

export const EXPENSE_CATEGORIES = [
  '식비',
  '카페·간식',
  '마트·생활',
  '쇼핑',
  '교통',
  '주거·공과금',
  '통신',
  '구독',
  '의료',
  '교육',
  '여가',
  '보험',
  '경조사',
  '미분류',
] as const

export const INCOME_CATEGORIES = ['급여', '기타수입'] as const

/** 통계에서 빠지는 분류 (가족 계좌끼리 옮긴 돈 등) */
export const EXCLUDED_CATEGORY = '내부이체'

export const ALL_CATEGORIES: string[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, EXCLUDED_CATEGORY]

const DEFAULT_KEYWORDS: Record<string, string[]> = {
  '식비': ['배달의민족', '배민', '요기요', '쿠팡이츠', '맥도날드', '버거킹', '롯데리아', '김밥', '식당', '치킨', '피자'],
  '카페·간식': ['스타벅스', '투썸', '이디야', '메가커피', '메가MGC', '컴포즈', '빽다방', '할리스', '폴바셋', '파리바게뜨', '뚜레쥬르', '배스킨', '던킨', '커피', '젤라또', '아이스크림', '디저트', '베이커리'],
  '마트·생활': ['이마트', '홈플러스', '롯데마트', '코스트코', '트레이더스', '컬리', 'GS25', 'CU', '세븐일레븐', '이마트24', '다이소', '노브랜드', '하나로마트'],
  '쇼핑': ['쿠팡', '네이버페이', '11번가', 'G마켓', '옥션', '무신사', '올리브영', 'SSG', '신세계', '현대백화점', '롯데백화점', '나이키', '아디다스', '모던하우스', '이케아', '장난감', '토이'],
  '교통': ['카카오T', '택시', '티머니', '코레일', 'SRT', '주유', 'GS칼텍스', 'SK에너지', 'S-OIL', '현대오일뱅크', '하이패스', '주차'],
  '주거·공과금': ['관리비', '전기요금', '한국전력', '도시가스', '가스요금', '수도요금', '월세'],
  '통신': ['SKT', 'SK텔레콤', 'KT', 'LGU+', 'LG유플러스', '알뜰폰'],
  '구독': ['넷플릭스', 'NETFLIX', '유튜브', 'YOUTUBE', '디즈니', '멜론', '스포티파이', '쿠팡와우', '애플', 'APPLE.COM'],
  '의료': ['병원', '의원', '약국', '치과', '한의원'],
  '교육': ['어린이집', '유치원', '학원', '교육', '학습지', '교보문고', '예스24', '알라딘'],
  '여가': ['CGV', '메가박스', '롯데시네마', '야놀자', '여기어때', '에어비앤비'],
  '보험': ['보험', '화재', '생명'],
  '급여': ['급여', '월급', '상여'],
}

export const DEFAULT_RULES: Rule[] = Object.entries(DEFAULT_KEYWORDS).flatMap(([category, keywords]) =>
  keywords.map((keyword) => ({ id: `default:${keyword}`, keyword, category })),
)

/**
 * 사용자 규칙을 먼저, 그 안에서는 긴 키워드를 먼저 확인한다.
 * 맞는 규칙이 없으면 수입은 '기타수입', 지출은 '미분류'.
 */
export function categorize(description: string, amount: number, userRules: Rule[]): string {
  const text = description.toUpperCase()
  const byLength = (a: Rule, b: Rule) => b.keyword.length - a.keyword.length
  for (const rules of [[...userRules].sort(byLength), DEFAULT_RULES]) {
    for (const rule of rules) {
      if (!rule.keyword) continue
      if (text.includes(rule.keyword.toUpperCase())) {
        const isIncomeCategory = (INCOME_CATEGORIES as readonly string[]).includes(rule.category)
        // 기본 수입 규칙은 입금에만 적용 (예: '급여'라는 단어가 들어간 출금은 무시).
        // 지출 분류는 입금(환불)에도 적용해서 그 분류 지출에서 상계되게 한다.
        if (rules === DEFAULT_RULES && isIncomeCategory && amount < 0) continue
        return rule.category
      }
    }
  }
  return amount > 0 ? '기타수입' : '미분류'
}

export function isIncluded(category: string): boolean {
  return category !== EXCLUDED_CATEGORY
}
