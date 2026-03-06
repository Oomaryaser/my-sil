import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();

    const salaries = await sql`
      SELECT *
      FROM salaries
      WHERE user_id = ${auth.user.id}
      ORDER BY month DESC
    `;

    const planned = await sql`
      SELECT *
      FROM planned_expenses
      WHERE user_id = ${auth.user.id}
      ORDER BY month DESC, created_at ASC
    `;

    const actual = await sql`
      SELECT *
      FROM actual_expenses
      WHERE user_id = ${auth.user.id}
      ORDER BY month DESC, date DESC, created_at DESC
    `;

    const sources = await sql`
      SELECT s.*, COALESCE(SUM(p.amount), 0) AS paid_total
      FROM income_sources s
      LEFT JOIN income_payments p
        ON p.source_id = s.id AND p.user_id = s.user_id
      WHERE s.user_id = ${auth.user.id}
      GROUP BY s.id
      ORDER BY s.month DESC, s.created_at ASC
    `;

    const payments = await sql`
      SELECT *
      FROM income_payments
      WHERE user_id = ${auth.user.id}
      ORDER BY month DESC, date DESC, created_at DESC
    `;

    const habits = await sql`
      SELECT *
      FROM habits
      WHERE user_id = ${auth.user.id}
      ORDER BY month DESC, created_at ASC
    `;

    const habitEntries = await sql`
      SELECT *
      FROM habit_entries
      WHERE user_id = ${auth.user.id}
      ORDER BY month DESC, date ASC, created_at ASC
    `;

    const months: Record<string, {
      salary: object | null;
      planned: object[];
      actual: object[];
      income_sources: object[];
      habits: object[];
    }> = {};

    const ensure = (month: string) => {
      if (!months[month]) {
        months[month] = {
          salary: null,
          planned: [],
          actual: [],
          income_sources: [],
          habits: [],
        };
      }
    };

    for (const salary of salaries) {
      ensure(salary.month);
      months[salary.month].salary = salary;
    }

    for (const expense of planned) {
      ensure(expense.month);
      months[expense.month].planned.push(expense);
    }

    for (const expense of actual) {
      ensure(expense.month);
      months[expense.month].actual.push(expense);
    }

    for (const source of sources) {
      ensure(source.month);
      months[source.month].income_sources.push({
        ...source,
        payments: payments.filter((payment: Record<string, unknown>) => payment.source_id === source.id),
      });
    }

    for (const habit of habits) {
      ensure(habit.month);
      months[habit.month].habits.push({
        ...habit,
        entries: habitEntries.filter((entry: Record<string, unknown>) => entry.habit_id === habit.id),
      });
    }

    return NextResponse.json(months);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
