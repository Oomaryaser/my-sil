import { NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

export async function GET(req: Request) {
  try {
    await initDB();
    const sql = getDB();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');

    if (!month) {
      return NextResponse.json({ error: 'month required' }, { status: 400 });
    }

    const habits = await sql`
      SELECT * FROM habits
      WHERE month = ${month}
      ORDER BY created_at ASC
    `;

    const entries = await sql`
      SELECT * FROM habit_entries
      WHERE month = ${month}
      ORDER BY date ASC, created_at ASC
    `;

    return NextResponse.json(
      habits.map((habit: Record<string, unknown>) => ({
        ...habit,
        entries: entries.filter((entry: Record<string, unknown>) => entry.habit_id === habit.id),
      })),
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDB();
    const sql = getDB();
    const { id, month, name, icon, color, notes } = await req.json();

    await sql`
      INSERT INTO habits (id, month, name, icon, color, notes)
      VALUES (${id}, ${month}, ${name}, ${icon || '✨'}, ${color || '#4f9cf9'}, ${notes || ''})
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await initDB();
    const sql = getDB();
    const { habitId, month, date } = await req.json();

    const existing = await sql`
      SELECT id
      FROM habit_entries
      WHERE habit_id = ${habitId} AND date = ${date}
      LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`DELETE FROM habit_entries WHERE habit_id = ${habitId} AND date = ${date}`;
      return NextResponse.json({ ok: true, completed: false });
    }

    const id = `${habitId}_${date}`;
    await sql`
      INSERT INTO habit_entries (id, habit_id, month, date)
      VALUES (${id}, ${habitId}, ${month}, ${date})
    `;

    return NextResponse.json({ ok: true, completed: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await initDB();
    const sql = getDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    await sql`DELETE FROM habits WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
