import { NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

export async function GET() {
  try {
    await initDB();
    const sql = getDB();
    const salaries = await sql`SELECT * FROM salaries ORDER BY month DESC`;
    const planned = await sql`SELECT * FROM planned_expenses ORDER BY month DESC, created_at ASC`;
    const actual = await sql`SELECT * FROM actual_expenses ORDER BY month DESC, date DESC`;

    const months: Record<string, { salary: object | null; planned: object[]; actual: object[] }> = {};

    for (const s of salaries) {
      if (!months[s.month]) months[s.month] = { salary: null, planned: [], actual: [] };
      months[s.month].salary = s;
    }
    for (const p of planned) {
      if (!months[p.month]) months[p.month] = { salary: null, planned: [], actual: [] };
      months[p.month].planned.push(p);
    }
    for (const a of actual) {
      if (!months[a.month]) months[a.month] = { salary: null, planned: [], actual: [] };
      months[a.month].actual.push(a);
    }

    return NextResponse.json(months);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
