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
    if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 });

    const sources = await sql`
      SELECT s.*, COALESCE(SUM(p.amount), 0) AS paid_total
      FROM income_sources s
      LEFT JOIN income_payments p ON p.source_id = s.id AND p.user_id = s.user_id
      WHERE s.user_id = ${auth.user.id} AND s.month = ${month}
      GROUP BY s.id
      ORDER BY s.created_at ASC
    `;

    const payments = await sql`
      SELECT *
      FROM income_payments
      WHERE user_id = ${auth.user.id} AND month = ${month}
      ORDER BY date DESC, created_at DESC
    `;

    const result = sources.map((source: Record<string, unknown>) => ({
      ...source,
      payments: payments.filter((payment: Record<string, unknown>) => payment.source_id === source.id),
    }));

    return NextResponse.json(result);
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
    const id = typeof body.id === 'string' ? body.id : '';
    const month = typeof body.month === 'string' ? body.month : '';
    const name = typeof body.name === 'string' ? body.name : '';
    const type = typeof body.type === 'string' ? body.type : 'salary';
    const expectedAmount = Number(body.expected_amount || 0);
    const notes = typeof body.notes === 'string' ? body.notes : '';

    if (!id || !month || !name || expectedAmount <= 0) {
      return NextResponse.json({ error: 'بيانات الدخل غير مكتملة' }, { status: 400 });
    }

    await sql`
      INSERT INTO income_sources (id, user_id, month, name, type, expected_amount, notes)
      VALUES (${id}, ${auth.user.id}, ${month}, ${name}, ${type}, ${expectedAmount}, ${notes})
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

    await sql`DELETE FROM income_payments WHERE source_id = ${id} AND user_id = ${auth.user.id}`;
    await sql`DELETE FROM income_sources WHERE id = ${id} AND user_id = ${auth.user.id}`;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
