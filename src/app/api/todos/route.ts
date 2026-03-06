import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const rows = await sql`
      SELECT id, user_id, title, notes, due_date, completed, created_at, updated_at
      FROM todos
      WHERE user_id = ${auth.user.id}
      ORDER BY completed ASC, due_date ASC NULLS LAST, created_at DESC
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
    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const dueDate = typeof body.due_date === 'string' && body.due_date ? body.due_date : null;

    if (title.length < 2) {
      return NextResponse.json({ error: 'عنوان المهمة قصير جداً' }, { status: 400 });
    }

    const id = randomUUID();
    const rows = await sql`
      INSERT INTO todos (id, user_id, title, notes, due_date, completed, updated_at)
      VALUES (${id}, ${auth.user.id}, ${title}, ${notes}, ${dueDate}, FALSE, NOW())
      RETURNING id, user_id, title, notes, due_date, completed, created_at, updated_at
    `;

    return NextResponse.json(rows[0]);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const body = await req.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const title = typeof body.title === 'string' ? body.title.trim() : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const dueDate = typeof body.due_date === 'string' ? body.due_date : null;
    const completed = typeof body.completed === 'boolean' ? body.completed : null;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    if (title !== null && title.length < 2) {
      return NextResponse.json({ error: 'عنوان المهمة قصير جداً' }, { status: 400 });
    }

    const existing = await sql`
      SELECT id, user_id, title, notes, due_date, completed, created_at, updated_at
      FROM todos
      WHERE id = ${id} AND user_id = ${auth.user.id}
      LIMIT 1
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'المهمة غير موجودة' }, { status: 404 });
    }

    const current = existing[0];
    const nextTitle = title ?? String(current.title || '');
    const nextNotes = notes ?? String(current.notes || '');
    const nextDueDate = dueDate === null ? current.due_date : dueDate || null;
    const nextCompleted = completed ?? Boolean(current.completed);

    const updated = await sql`
      UPDATE todos
      SET
        title = ${nextTitle},
        notes = ${nextNotes},
        due_date = ${nextDueDate},
        completed = ${nextCompleted},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${auth.user.id}
      RETURNING id, user_id, title, notes, due_date, completed, created_at, updated_at
    `;

    return NextResponse.json(updated[0]);
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

    await sql`DELETE FROM todos WHERE id = ${id} AND user_id = ${auth.user.id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
