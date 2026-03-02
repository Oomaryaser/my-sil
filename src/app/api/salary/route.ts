import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const rows = await sql`SELECT * FROM salaries WHERE user_id = ${auth.user.id} ORDER BY month DESC`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const { month, base, allowances, deductions, total, notes } = await req.json();
    await sql`
      INSERT INTO salaries (user_id, month, base, allowances, deductions, total, notes)
      VALUES (${auth.user.id}, ${month}, ${base}, ${allowances}, ${deductions}, ${total}, ${notes})
      ON CONFLICT (user_id, month) DO UPDATE SET
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
