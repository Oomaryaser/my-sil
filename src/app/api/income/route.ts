import { NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

// GET /api/income?month=2026-02
export async function GET(req: Request) {
  try {
    await initDB();
    const sql = getDB();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 });

    const sources = await sql`
      SELECT s.*,
        COALESCE(SUM(p.amount), 0) AS paid_total
      FROM income_sources s
      LEFT JOIN income_payments p ON p.source_id = s.id
      WHERE s.month = ${month}
      GROUP BY s.id
      ORDER BY s.created_at ASC
    `;

    const payments = await sql`
      SELECT * FROM income_payments WHERE month = ${month} ORDER BY date DESC, created_at DESC
    `;

    // Attach payments to sources
    const result = sources.map((s: Record<string, unknown>) => ({
      ...s,
      payments: payments.filter((p: Record<string, unknown>) => p.source_id === s.id),
    }));

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/income  — add source
export async function POST(req: Request) {
  try {
    await initDB();
    const sql = getDB();
    const { id, month, name, type, expected_amount, notes } = await req.json();
    await sql`
      INSERT INTO income_sources (id, month, name, type, expected_amount, notes)
      VALUES (${id}, ${month}, ${name}, ${type}, ${expected_amount}, ${notes || ''})
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/income?id=xxx
export async function DELETE(req: Request) {
  try {
    const sql = getDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await sql`DELETE FROM income_sources WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
