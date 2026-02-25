import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// POST /api/income/payment — add payment
export async function POST(req: Request) {
  try {
    const sql = getDB();
    const { id, source_id, month, amount, date, notes } = await req.json();
    await sql`
      INSERT INTO income_payments (id, source_id, month, amount, date, notes)
      VALUES (${id}, ${source_id}, ${month}, ${amount}, ${date || null}, ${notes || ''})
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/income/payment?id=xxx
export async function DELETE(req: Request) {
  try {
    const sql = getDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await sql`DELETE FROM income_payments WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
