import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const rows = await sql`
      SELECT *
      FROM salaries
      WHERE user_id = ${auth.user.id}
      ORDER BY month DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const body = await req.json();
    const month = typeof body.month === 'string' ? body.month : '';
    const base = Number(body.base || 0);
    const allowances = Number(body.allowances || 0);
    const deductions = Number(body.deductions || 0);
    const total = Number(body.total || 0);
    const notes = typeof body.notes === 'string' ? body.notes : '';

    if (!month) {
      return NextResponse.json({ error: 'month required' }, { status: 400 });
    }

    await sql`
      INSERT INTO salaries (user_id, month, base, allowances, deductions, total, notes)
      VALUES (${auth.user.id}, ${month}, ${base}, ${allowances}, ${deductions}, ${total}, ${notes})
      ON CONFLICT (user_id, month)
      DO UPDATE SET
        base = EXCLUDED.base,
        allowances = EXCLUDED.allowances,
        deductions = EXCLUDED.deductions,
        total = EXCLUDED.total,
        notes = EXCLUDED.notes
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
