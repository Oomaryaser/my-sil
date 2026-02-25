export interface Salary {
  id?: number;
  month: string;
  base: number;
  allowances: number;
  deductions: number;
  total: number;
  notes?: string;
}

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
