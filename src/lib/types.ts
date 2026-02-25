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
  gift: '🎁',
  charity: '🤲',
  savings: '🏦',
  family: '👨‍👩‍👧',
  other: '📦',
};

export const CAT_NAMES: Record<string, string> = {
  food: 'طعام',
  transport: 'مواصلات',
  bills: 'فواتير',
  shopping: 'تسوق',
  health: 'صحة',
  entertainment: 'ترفيه',
  gift: 'هدية',
  charity: 'هبة / صدقة',
  savings: 'ادخار',
  family: 'عائلة',
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
  return Number(n || 0).toLocaleString('en-US', { useGrouping: true });
}

/** تحويل "YYYY-MM-DD" أو Date إلى "YYYY/M/D" */
export function formatDate(d: string | Date | undefined | null): string {
  if (!d) return '';
  const s = typeof d === 'string' ? d : d.toISOString().slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${y}/${parseInt(m)}/${parseInt(day)}`;
}

/** تاريخ اليوم بصيغة "YYYY/M/D" */
export function todayFormatted(): string {
  return formatDate(new Date().toISOString().slice(0, 10));
}

const DAYS_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

/** اسم اليوم بالعربي لتاريخ "YYYY-MM-DD" */
export function getDayName(dateStr: string): string {
  if (!dateStr || dateStr === 'غير محدد') return '';
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return DAYS_AR[d.getDay()];
}
