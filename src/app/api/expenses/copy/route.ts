import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const body = await req.json();
    const fromMonth = typeof body.fromMonth === 'string' ? body.fromMonth : '';
    const toMonth = typeof body.toMonth === 'string' ? body.toMonth : '';

    if (!fromMonth || !toMonth) {
      return NextResponse.json({ error: 'fromMonth and toMonth required' }, { status: 400 });
    }

    const rows = await sql`
      SELECT name, amount, category, notes
      FROM planned_expenses
      WHERE user_id = ${auth.user.id} AND month = ${fromMonth}
    `;

    if (!rows.length) {
      return NextResponse.json({ ok: true, copied: 0 });
    }

    let copied = 0;
    for (const row of rows) {
      await sql`
        INSERT INTO planned_expenses (id, user_id, month, name, amount, category, notes)
        VALUES (${randomUUID()}, ${auth.user.id}, ${toMonth}, ${row.name}, ${row.amount}, ${row.category}, ${row.notes || ''})
      `;
      copied += 1;
    }

    return NextResponse.json({ ok: true, copied });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
