// 분류 규칙 본체는 서버 함수와 같이 쓰려고 supabase/functions/_shared/categories.ts에 있다.
// 여기서는 지금 빌드하는 가계부(BOOK)에 맞춰 내보낸다.
import { BOOK } from './book'
import type { Rule } from './types'
import {
  EXCLUDED_CATEGORY,
  INCOME_CATEGORIES,
  categorizeFor,
  defaultRules,
  expenseCategories,
} from '../supabase/functions/_shared/categories.ts'

export { EXCLUDED_CATEGORY, INCOME_CATEGORIES }

export const EXPENSE_CATEGORIES: readonly string[] = expenseCategories(BOOK)

export const ALL_CATEGORIES: string[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, EXCLUDED_CATEGORY]

export const DEFAULT_RULES: Rule[] = defaultRules(BOOK)

export function categorize(description: string, amount: number, userRules: Rule[]): string {
  return categorizeFor(BOOK, description, amount, userRules)
}

export function isIncluded(category: string): boolean {
  return category !== EXCLUDED_CATEGORY
}
