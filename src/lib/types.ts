import type { AppIconName } from '@/lib/icons';

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
  salary: 'راتب',
  freelance: 'فريلانس',
  side: 'دخل جانبي',
};

export const INCOME_TYPE_COLOR: Record<IncomeType, string> = {
  salary: 'var(--accent)',
  freelance: '#a78bfa',
  side: 'var(--green)',
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

export interface HabitEntry {
  id: string;
  habit_id: string;
  month: string;
  date: string;
}

export interface Habit {
  id: string;
  month: string;
  name: string;
  icon?: string;
  color?: string;
  notes?: string;
  entries?: HabitEntry[];
}

export type UserRole = 'admin' | 'user';
export type SubscriptionStatus = 'active' | 'suspended';
export type FeatureRequestStatus = 'pending' | 'planned' | 'in_progress' | 'done';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  subscription_status: SubscriptionStatus;
  subscription_started_at: string;
  subscription_expires_at: string;
  created_at: string;
  isSubscriptionActive: boolean;
  todo_announcement_seen?: boolean;
  has_groq_api_key?: boolean;
}

export interface FeatureRequest {
  id: string;
  user_id: string;
  title: string;
  details: string;
  status: FeatureRequestStatus;
  admin_note?: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
}

export interface AdminUser extends AppUser {
  feature_request_count?: number;
  planned_expenses_count?: number;
  actual_expenses_count?: number;
  income_sources_count?: number;
  habits_count?: number;
}

export interface TodoItem {
  id: string;
  user_id: string;
  title: string;
  notes?: string;
  due_date?: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export const CAT_ICONS: Record<string, AppIconName> = {
  food: 'food',
  transport: 'transport',
  bills: 'bills',
  shopping: 'shopping',
  health: 'health',
  entertainment: 'entertainment',
  gift: 'gift',
  charity: 'charity',
  savings: 'savings',
  family: 'family',
  other: 'other',
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
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export function getMonthName(m: string): string {
  const [y, mo] = m.split('-');
  return MONTHS_AR[parseInt(mo, 10) - 1] + ' ' + y;
}

export function formatNum(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('en-US', { useGrouping: true });
}

export function formatDate(d: string | Date | undefined | null): string {
  if (!d) return '';
  const s = typeof d === 'string' ? d : d.toISOString().slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${y}/${parseInt(m, 10)}/${parseInt(day, 10)}`;
}

export function todayFormatted(): string {
  return formatDate(new Date().toISOString().slice(0, 10));
}

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function getDayName(dateStr: string): string {
  if (!dateStr || dateStr === 'غير محدد') return '';
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return DAYS_AR[d.getDay()];
}
