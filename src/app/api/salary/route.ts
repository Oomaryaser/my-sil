import { NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

export async function GET() {
  try {
    await initDB();
    const sql = getDB();
    const rows = await sql`SELECT * FROM salaries ORDER BY month DESC`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDB();
    const sql = getDB();
    const { month, base, allowances, deductions, total, notes } = await req.json();
    await sql`
      INSERT INTO salaries (month, base, allowances, deductions, total, notes)
      VALUES (${month}, ${base}, ${allowances}, ${deductions}, ${total}, ${notes})
      ON CONFLICT (month) DO UPDATE SET
        base = EXCLUDED.base,
        allowances = EXCLUDED.allowances,
        deductions = EXCLUDED.deductions,
        total = EXCLUDED.total,
        notes = EXCLUDED.notes
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
