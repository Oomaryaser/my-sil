import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';
import { FreelanceClient } from '@/lib/types';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();

    const rows = await sql`
      SELECT
        c.*,
        p.name AS parent_name,
        COALESCE(SUM(CASE WHEN j.status = 'pending_payment' THEN j.amount ELSE 0 END), 0) AS pending_total,
        COALESCE(SUM(CASE WHEN j.status = 'paid' THEN j.amount ELSE 0 END), 0) AS paid_total,
        COUNT(j.id) AS jobs_count
      FROM freelance_clients c
      LEFT JOIN freelance_clients p ON p.id = c.parent_id
      LEFT JOIN freelance_jobs j ON j.client_id = c.id AND j.user_id = c.user_id
      WHERE c.user_id = ${auth.user.id}
      GROUP BY c.id, p.name
      ORDER BY c.created_at ASC
    `;

    // Build tree
    const map: Record<string, FreelanceClient> = {};
    const roots: FreelanceClient[] = [];

    for (const row of rows) {
      map[row.id as string] = {
        id: row.id as string,
        name: row.name as string,
        parent_id: row.parent_id as string | null,
        parent_name: row.parent_name as string | null,
        color: row.color as string,
        notes: row.notes as string | null ?? undefined,
        children: [],
        jobs_count: Number(row.jobs_count),
        pending_total: Number(row.pending_total),
        paid_total: Number(row.paid_total),
      };
    }

    for (const client of Object.values(map)) {
      if (client.parent_id && map[client.parent_id]) {
        map[client.parent_id].children!.push(client);
      } else {
        roots.push(client);
      }
    }

    return NextResponse.json(roots);
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
    const body = await req.json() as { name?: string; parent_id?: string | null; color?: string; notes?: string };

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'اسم العميل مطلوب' }, { status: 400 });

    const parentId = body.parent_id || null;
    // Verify parent belongs to same user
    if (parentId) {
      const parentRows = await sql`SELECT id FROM freelance_clients WHERE id = ${parentId} AND user_id = ${auth.user.id} LIMIT 1`;
      if (!parentRows.length) return NextResponse.json({ error: 'العميل الأب غير موجود' }, { status: 400 });
    }

    const id = uid();
    const color = body.color || '#a78bfa';
    const notes = body.notes || null;

    await sql`
      INSERT INTO freelance_clients (id, user_id, name, parent_id, color, notes)
      VALUES (${id}, ${auth.user.id}, ${name}, ${parentId}, ${color}, ${notes})
    `;

    return NextResponse.json({ id, name, parent_id: parentId, color, notes, children: [], jobs_count: 0, pending_total: 0, paid_total: 0 });
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

    // Collect all descendant ids (recursive)
    const allIds: string[] = [id];
    let toCheck = [id];
    while (toCheck.length) {
      const children = await sql`SELECT id FROM freelance_clients WHERE parent_id = ANY(${toCheck}) AND user_id = ${auth.user.id}`;
      toCheck = children.map((r) => r.id as string);
      allIds.push(...toCheck);
    }

    await sql`DELETE FROM freelance_jobs WHERE client_id = ANY(${allIds}) AND user_id = ${auth.user.id}`;
    await sql`DELETE FROM freelance_clients WHERE id = ANY(${allIds}) AND user_id = ${auth.user.id}`;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
