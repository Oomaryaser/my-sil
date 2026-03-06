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
    const id = typeof body.id === 'string' ? body.id : '';
    const sourceId = typeof body.source_id === 'string' ? body.source_id : '';
    const month = typeof body.month === 'string' ? body.month : '';
    const amount = Number(body.amount || 0);
    const date = typeof body.date === 'string' ? body.date : null;
    const notes = typeof body.notes === 'string' ? body.notes : '';

    if (!id || !sourceId || !month || amount <= 0) {
      return NextResponse.json({ error: 'بيانات الدفعة غير مكتملة' }, { status: 400 });
    }

    const source = await sql`
      SELECT id
      FROM income_sources
      WHERE id = ${sourceId} AND user_id = ${auth.user.id}
      LIMIT 1
    `;
    if (!source.length) {
      return NextResponse.json({ error: 'مصدر الدخل غير موجود' }, { status: 404 });
    }

    await sql`
      INSERT INTO income_payments (id, user_id, source_id, month, amount, date, notes)
      VALUES (${id}, ${auth.user.id}, ${sourceId}, ${month}, ${amount}, ${date}, ${notes})
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
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
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await sql`DELETE FROM income_payments WHERE id = ${id} AND user_id = ${auth.user.id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
