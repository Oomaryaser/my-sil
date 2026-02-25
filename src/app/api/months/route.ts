import { NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

export async function GET() {
  try {
    await initDB();
    const sql = getDB();
    const salaries  = await sql`SELECT * FROM salaries ORDER BY month DESC`;
    const planned   = await sql`SELECT * FROM planned_expenses ORDER BY month DESC, created_at ASC`;
    const actual    = await sql`SELECT * FROM actual_expenses ORDER BY month DESC, date DESC`;
    const sources   = await sql`
      SELECT s.*, COALESCE(SUM(p.amount),0) AS paid_total
      FROM income_sources s
      LEFT JOIN income_payments p ON p.source_id = s.id
      GROUP BY s.id ORDER BY s.month DESC, s.created_at ASC
    `;
    const payments  = await sql`SELECT * FROM income_payments ORDER BY month DESC, date DESC`;

    const months: Record<string, {
      salary: object | null;
      planned: object[];
      actual: object[];
      income_sources: object[];
    }> = {};

    const ensure = (m: string) => {
      if (!months[m]) months[m] = { salary: null, planned: [], actual: [], income_sources: [] };
    };

    for (const s of salaries)  { ensure(s.month); months[s.month].salary = s; }
    for (const p of planned)   { ensure(p.month); months[p.month].planned.push(p); }
    for (const a of actual)    { ensure(a.month); months[a.month].actual.push(a); }
    for (const s of sources) {
      ensure(s.month);
      (months[s.month].income_sources as object[]).push({
        ...s,
        payments: payments.filter((p: Record<string,unknown>) => p.source_id === s.id),
      });
    }

    return NextResponse.json(months);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
