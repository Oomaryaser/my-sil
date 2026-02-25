import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// POST { fromMonth, toMonth } — copies planned_expenses from one month to another
export async function POST(req: Request) {
  try {
    const { fromMonth, toMonth } = await req.json();
    if (!fromMonth || !toMonth) {
      return NextResponse.json({ error: 'fromMonth and toMonth required' }, { status: 400 });
    }

    const sql = getDB();

    // Fetch source expenses
    const rows = await sql`
      SELECT name, amount, category, notes FROM planned_expenses WHERE month = ${fromMonth}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, copied: 0 });
    }

    // Insert into target month (skip if already exists with same name+category)
    let copied = 0;
    for (const row of rows) {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await sql`
        INSERT INTO planned_expenses (id, month, name, amount, category, notes)
        VALUES (${id}, ${toMonth}, ${row.name}, ${row.amount}, ${row.category}, ${row.notes || ''})
        ON CONFLICT DO NOTHING
      `;
      copied++;
    }

    return NextResponse.json({ ok: true, copied });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
