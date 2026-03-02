import { Habit } from '@/lib/types';
import { normalizeIconName } from '@/lib/icons';

export interface HabitDailyStat {
  date: string;
  dayNumber: number;
  weekdayLabel: string;
  completed: number;
  remaining: number;
  total: number;
  rate: number;
  isTracked: boolean;
  isFuture: boolean;
}

export interface HabitWeeklyStat {
  index: number;
  label: string;
  startDay: number;
  endDay: number;
  daysCount: number;
  completed: number;
  total: number;
  rate: number;
  status: 'completed' | 'current' | 'upcoming';
}

export interface HabitRateStat {
  habitId: string;
  name: string;
  icon: string;
  color: string;
  completed: number;
  total: number;
  rate: number;
}

export interface HabitSummary {
  totalHabits: number;
  totalCompletions: number;
  possibleCompletions: number;
  completionRate: number;
  trackedDaysCount: number;
  averagePerDay: number;
  perfectDays: number;
  dailyStats: HabitDailyStat[];
  weeklyStats: HabitWeeklyStat[];
  habitRates: HabitRateStat[];
  bestHabit: HabitRateStat | null;
  weakestHabit: HabitRateStat | null;
  bestWeek: HabitWeeklyStat | null;
}

const WEEKDAY_SHORT_AR = ['أح', 'اث', 'ثل', 'أر', 'خم', 'جم', 'سب'];

export const HABIT_COLORS = [
  '#4f9cf9',
  '#22c55e',
  '#f97316',
  '#eab308',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f43f5e',
];

function getMonthParts(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return { year, monthNumber };
}

export function getHabitColor(index: number, color?: string | null) {
  return color || HABIT_COLORS[index % HABIT_COLORS.length];
}

export function getMonthDates(month: string) {
  const { year, monthNumber } = getMonthParts(month);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const weekday = new Date(year, monthNumber - 1, day).getDay();

    return {
      date,
      dayNumber: day,
      weekdayLabel: WEEKDAY_SHORT_AR[weekday],
    };
  });
}

function getTrackedDateSet(month: string, today = new Date()) {
  const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const dates = getMonthDates(month).map((item) => item.date);

  if (month < todayMonth) return new Set(dates);
  if (month > todayMonth) return new Set<string>();

  const todayDate = `${todayMonth}-${String(today.getDate()).padStart(2, '0')}`;
  return new Set(dates.filter((date) => date <= todayDate));
}

export function buildHabitSummary(month: string, habits: Habit[], today = new Date()): HabitSummary {
  const monthDates = getMonthDates(month);
  const trackedDateSet = getTrackedDateSet(month, today);
  const totalHabits = habits.length;
  const entrySets = new Map<string, Set<string>>();
  const dailyCounts = new Map<string, number>();

  habits.forEach((habit) => {
    const dates = new Set((habit.entries || []).map((entry) => String(entry.date).slice(0, 10)));
    entrySets.set(habit.id, dates);

    dates.forEach((date) => {
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
    });
  });

  const dailyStats: HabitDailyStat[] = monthDates.map((day) => {
    const completed = dailyCounts.get(day.date) || 0;
    const total = totalHabits;
    const isTracked = trackedDateSet.has(day.date);

    return {
      ...day,
      completed,
      total,
      remaining: Math.max(total - completed, 0),
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      isTracked,
      isFuture: !isTracked,
    };
  });

  const trackedDays = dailyStats.filter((day) => day.isTracked);
  const totalCompletions = trackedDays.reduce((sum, day) => sum + day.completed, 0);
  const possibleCompletions = totalHabits * trackedDays.length;
  const completionRate = possibleCompletions > 0 ? Math.round((totalCompletions / possibleCompletions) * 100) : 0;
  const averagePerDay = trackedDays.length > 0 ? Math.round((totalCompletions / trackedDays.length) * 10) / 10 : 0;
  const perfectDays = trackedDays.filter((day) => day.total > 0 && day.completed === day.total).length;

  const weeklyStats: HabitWeeklyStat[] = [];
  for (let start = 0; start < dailyStats.length; start += 7) {
    const days = dailyStats.slice(start, start + 7);
    const trackedDaysInWeek = days.filter((day) => day.isTracked);
    const completed = trackedDaysInWeek.reduce((sum, day) => sum + day.completed, 0);
    const total = trackedDaysInWeek.reduce((sum, day) => sum + day.total, 0);
    const isUpcoming = trackedDaysInWeek.length === 0;
    const isCompleted = trackedDaysInWeek.length === days.length && days.length > 0;

    weeklyStats.push({
      index: weeklyStats.length + 1,
      label: `الأسبوع ${weeklyStats.length + 1}`,
      startDay: days[0]?.dayNumber || 1,
      endDay: days[days.length - 1]?.dayNumber || 1,
      daysCount: days.length,
      completed,
      total,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      status: isUpcoming ? 'upcoming' : isCompleted ? 'completed' : 'current',
    });
  }

  const habitRates: HabitRateStat[] = habits
    .map((habit, index) => {
      const entries = entrySets.get(habit.id) || new Set<string>();
      const completed = trackedDays.reduce((sum, day) => sum + (entries.has(day.date) ? 1 : 0), 0);
      const total = trackedDays.length;

      return {
        habitId: habit.id,
        name: habit.name,
        icon: normalizeIconName(habit.icon, 'sparkles'),
        color: getHabitColor(index, habit.color),
        completed,
        total,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.rate - a.rate || b.completed - a.completed || a.name.localeCompare(b.name));

  const bestHabit = habitRates[0] || null;
  const weakestHabit = habitRates.length > 0 ? [...habitRates].sort((a, b) => a.rate - b.rate || a.completed - b.completed || a.name.localeCompare(b.name))[0] : null;
  const bestWeek = [...weeklyStats]
    .filter((week) => week.total > 0)
    .sort((a, b) => b.rate - a.rate || b.completed - a.completed)[0] || null;

  return {
    totalHabits,
    totalCompletions,
    possibleCompletions,
    completionRate,
    trackedDaysCount: trackedDays.length,
    averagePerDay,
    perfectDays,
    dailyStats,
    weeklyStats,
    habitRates,
    bestHabit,
    weakestHabit,
    bestWeek,
  };
}
