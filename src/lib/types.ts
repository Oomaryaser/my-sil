export interface Salary {
  id?: number;
  month: string;
  base: number;
  allowances: number;
  deductions: number;
  total: number;
  notes?: string;
}

export type IncomeType = 'salary' | 'freelance' | 'side';

export interface IncomeSource {
  id: string;
  month: string;
  name: string;
  type: IncomeType;
  expected_amount: number;
  notes?: string;
  // joined
  payments?: IncomePayment[];
  paid_total?: number;
}

export interface IncomePayment {
  id: string;
  source_id: string;
  month: string;
  amount: number;
  date?: string;
  notes?: string;
}

export const INCOME_TYPE_LABEL: Record<IncomeType, string> = {
  salary:   '💵 راتب',
  freelance:'💻 فريلانس',
  side:     '⚡ دخل جانبي',
};

export const INCOME_TYPE_COLOR: Record<IncomeType, string> = {
  salary:   'var(--accent)',
  freelance:'#a78bfa',
  side:     'var(--green)',
};

export interface Expense {
  id: string;
  month: string;
  name: string;
  amount: number;
  category: string;
  notes?: string;
  date?: string;
}

export type ExpenseType = 'planned' | 'actual';

export const CAT_ICONS: Record<string, string> = {
  food: '🍔',
  transport: '🚗',
  bills: '⚡',
  shopping: '🛍️',
  health: '💊',
  entertainment: '🎬',
  other: '📦',
};

export const CAT_NAMES: Record<string, string> = {
  food: 'طعام',
  transport: 'مواصلات',
  bills: 'فواتير',
  shopping: 'تسوق',
  health: 'صحة',
  entertainment: 'ترفيه',
  other: 'أخرى',
};

export const MONTHS_AR = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];

export function getMonthName(m: string): string {
  const [y, mo] = m.split('-');
  return MONTHS_AR[parseInt(mo) - 1] + ' ' + y;
}

export function formatNum(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('ar-SA');
}
