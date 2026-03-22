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
      SELECT ae.*, eg.name AS epic_goal_name
      FROM actual_expenses ae
      LEFT JOIN epic_goals eg
        ON eg.id = ae.epic_goal_id AND eg.user_id = ae.user_id
      WHERE ae.user_id = ${auth.user.id}
      ORDER BY ae.month DESC, ae.date DESC, ae.created_at DESC
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

    const goalAllocations = await sql`
      SELECT *
      FROM epic_goal_allocations
      WHERE user_id = ${auth.user.id}
      ORDER BY month DESC, created_at DESC
    `;

    const surplusAdjustments = await sql`
      SELECT *
      FROM surplus_adjustments
      WHERE user_id = ${auth.user.id}
      ORDER BY month DESC, created_at DESC
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
      goal_allocations: object[];
      surplus_adjustments: object[];
    }> = {};

    const ensure = (month: string) => {
      if (!months[month]) {
        months[month] = {
          salary: null,
          planned: [],
          actual: [],
          income_sources: [],
          habits: [],
          goal_allocations: [],
          surplus_adjustments: [],
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

    for (const allocation of goalAllocations) {
      ensure(allocation.month);
      months[allocation.month].goal_allocations.push(allocation);
    }

    for (const adjustment of surplusAdjustments) {
      ensure(adjustment.month);
      months[adjustment.month].surplus_adjustments.push(adjustment);
    }

    return NextResponse.json(months);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
