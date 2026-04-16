export type AppIconName =
  | 'logo'
  | 'menu'
  | 'sun'
  | 'moon'
  | 'dashboard'
  | 'income'
  | 'todo'
  | 'habits'
  | 'planned'
  | 'receipt'
  | 'history'
  | 'telegram'
  | 'requests'
  | 'admin'
  | 'food'
  | 'transport'
  | 'bills'
  | 'shopping'
  | 'health'
  | 'entertainment'
  | 'gift'
  | 'charity'
  | 'savings'
  | 'family'
  | 'other'
  | 'sparkles'
  | 'book'
  | 'target'
  | 'heart'
  | 'bolt'
  | 'save'
  | 'trash'
  | 'close'
  | 'plus'
  | 'mic'
  | 'wave'
  | 'search'
  | 'note'
  | 'clock'
  | 'users'
  | 'tools'
  | 'chart'
  | 'calendar'
  | 'check'
  | 'warning'
  | 'mail'
  | 'lock'
  | 'user'
  | 'wallet'
  | 'coins'
  | 'send'
  | 'copy'
  | 'filter'
  | 'edit'
  | 'briefcase'
  | 'chevron-down'
  | 'chevron-left';

export const APP_ICON_NAMES: Record<AppIconName, AppIconName> = {
  logo: 'logo',
  menu: 'menu',
  sun: 'sun',
  moon: 'moon',
  dashboard: 'dashboard',
  income: 'income',
  todo: 'todo',
  habits: 'habits',
  planned: 'planned',
  receipt: 'receipt',
  history: 'history',
  telegram: 'telegram',
  requests: 'requests',
  admin: 'admin',
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
  sparkles: 'sparkles',
  book: 'book',
  target: 'target',
  heart: 'heart',
  bolt: 'bolt',
  save: 'save',
  trash: 'trash',
  close: 'close',
  plus: 'plus',
  mic: 'mic',
  wave: 'wave',
  search: 'search',
  note: 'note',
  clock: 'clock',
  users: 'users',
  tools: 'tools',
  chart: 'chart',
  calendar: 'calendar',
  check: 'check',
  warning: 'warning',
  mail: 'mail',
  lock: 'lock',
  user: 'user',
  wallet: 'wallet',
  coins: 'coins',
  send: 'send',
  copy: 'copy',
  filter: 'filter',
  edit: 'edit',
  briefcase: 'briefcase',
  'chevron-down': 'chevron-down',
  'chevron-left': 'chevron-left',
};

const LEGACY_ICON_ALIASES: Record<string, AppIconName> = {
  '\u{2728}': 'sparkles',
  '\u{1F4DA}': 'book',
  '\u{1F3AF}': 'target',
  '\u{2764}\u{FE0F}': 'heart',
  '\u{2764}': 'heart',
  '\u{26A1}': 'bolt',
  '\u{1F4B5}': 'wallet',
  '\u{1F4BB}': 'tools',
  '\u{1F354}': 'food',
  '\u{1F697}': 'transport',
  '\u{1F6CD}\u{FE0F}': 'shopping',
  '\u{1F48A}': 'health',
  '\u{1F3AC}': 'entertainment',
  '\u{1F381}': 'gift',
  '\u{1F932}': 'charity',
  '\u{1F3E6}': 'savings',
  '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}': 'family',
  '\u{1F4E6}': 'other',
  '\u{1F4CB}': 'planned',
  '\u{1F4CA}': 'chart',
  '\u{1F9FE}': 'receipt',
  '\u{1F4C5}': 'calendar',
  '\u{2708}\u{FE0F}': 'send',
  '\u{1F6E0}\u{FE0F}': 'tools',
  '\u{1F9E0}': 'admin',
  '\u{2705}': 'check',
  '\u{1F4B0}': 'logo',
  '\u{2600}\u{FE0F}': 'sun',
  '\u{1F319}': 'moon',
  '\u{1F916}': 'admin',
  '\u{1F4DD}': 'note',
  '\u{1F4B8}': 'receipt',
  '\u{1F5D3}\u{FE0F}': 'calendar',
};

export function normalizeIconName(value: string | null | undefined, fallback: AppIconName = 'other'): AppIconName {
  if (!value) return fallback;
  if (value in APP_ICON_NAMES) return value as AppIconName;
  return LEGACY_ICON_ALIASES[value] || fallback;
}

export const HABIT_ICON_OPTIONS: Array<{ value: AppIconName; label: string }> = [
  { value: 'sparkles', label: 'تنظيم' },
  { value: 'book', label: 'قراءة' },
  { value: 'target', label: 'تركيز' },
  { value: 'heart', label: 'صحة' },
  { value: 'bolt', label: 'طاقة' },
];
