import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const clientId = searchParams.get('client_id');

    const rows = await sql`
      SELECT
        j.*,
        c.name AS client_name,
        c.color AS client_color
      FROM freelance_jobs j
      LEFT JOIN freelance_clients c ON c.id = j.client_id
      WHERE j.user_id = ${auth.user.id}
        ${month ? sql`AND j.month = ${month}` : sql``}
        ${clientId ? sql`AND j.client_id = ${clientId}` : sql``}
      ORDER BY j.created_at DESC
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
    const body = await req.json() as {
      client_id?: string;
      title?: string;
      amount?: number;
      month?: string;
      work_date?: string | null;
      status?: string;
      notes?: string;
    };

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const clientId = body.client_id || '';
    if (!title) return NextResponse.json({ error: 'عنوان العمل مطلوب' }, { status: 400 });
    if (!clientId) return NextResponse.json({ error: 'العميل مطلوب' }, { status: 400 });

    const amount = Math.max(0, Number(body.amount || 0));
    const month = body.month || new Date().toISOString().slice(0, 7);
    const workDate = body.work_date || new Date().toISOString().slice(0, 10);
    const status = body.status === 'paid' ? 'paid' : 'pending_payment';
    const paymentDate = status === 'paid' ? workDate : null;
    const notes = body.notes || null;

    // Verify client belongs to user
    const clientRows = await sql`SELECT id, name, color FROM freelance_clients WHERE id = ${clientId} AND user_id = ${auth.user.id} LIMIT 1`;
    if (!clientRows.length) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 400 });

    const id = uid();
    await sql`
      INSERT INTO freelance_jobs (id, user_id, client_id, title, amount, month, work_date, status, payment_date, notes)
      VALUES (${id}, ${auth.user.id}, ${clientId}, ${title}, ${amount}, ${month}, ${workDate}, ${status}, ${paymentDate}, ${notes})
    `;

    return NextResponse.json({
      id, client_id: clientId, client_name: clientRows[0].name, client_color: clientRows[0].color,
      title, amount, month, work_date: workDate, status, payment_date: paymentDate, notes,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

    const body = await req.json() as { status?: string; payment_date?: string | null };
    const status = body.status === 'paid' ? 'paid' : 'pending_payment';
    const paymentDate = status === 'paid' ? (body.payment_date || new Date().toISOString().slice(0, 10)) : null;

    await sql`
      UPDATE freelance_jobs
      SET status = ${status}, payment_date = ${paymentDate}
      WHERE id = ${id} AND user_id = ${auth.user.id}
    `;

    return NextResponse.json({ ok: true, status, payment_date: paymentDate });
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
    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

    await sql`DELETE FROM freelance_jobs WHERE id = ${id} AND user_id = ${auth.user.id}`;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
