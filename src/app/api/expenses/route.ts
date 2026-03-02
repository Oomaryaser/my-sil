import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const type = searchParams.get('type');

    if (!month || !type) {
      return NextResponse.json({ error: 'month and type required' }, { status: 400 });
    }

    const rows = type === 'planned'
      ? await sql`SELECT * FROM planned_expenses WHERE user_id = ${auth.user.id} AND month = ${month} ORDER BY created_at ASC`
      : await sql`SELECT * FROM actual_expenses WHERE user_id = ${auth.user.id} AND month = ${month} ORDER BY date DESC, created_at DESC`;

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
    const { type, id, month, name, amount, category, notes, date } = await req.json();

    if (type === 'planned') {
      await sql`
        INSERT INTO planned_expenses (id, user_id, month, name, amount, category, notes)
        VALUES (${id}, ${auth.user.id}, ${month}, ${name}, ${amount}, ${category}, ${notes || ''})
      `;
    } else {
      await sql`
        INSERT INTO actual_expenses (id, user_id, month, name, amount, category, notes, date)
        VALUES (${id}, ${auth.user.id}, ${month}, ${name}, ${amount}, ${category}, ${notes || ''}, ${date || null})
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (!id || !type) return NextResponse.json({ error: 'id and type required' }, { status: 400 });

    if (type === 'planned') {
      await sql`DELETE FROM planned_expenses WHERE id = ${id} AND user_id = ${auth.user.id}`;
    } else {
      await sql`DELETE FROM actual_expenses WHERE id = ${id} AND user_id = ${auth.user.id}`;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
