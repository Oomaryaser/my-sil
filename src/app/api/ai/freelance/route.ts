import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';
import { decryptUserSecret } from '@/lib/user-secrets';

const GROQ_MODEL = process.env.GROQ_FINANCE_MODEL || 'openai/gpt-oss-20b';

interface FreelanceParseResult {
  client: string;
  title: string;
  amount: number;
  status: 'pending_payment' | 'paid';
  notes: string;
}

function buildSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      client: { type: 'string', description: 'اسم العميل أو الشركة' },
      title: { type: 'string', description: 'عنوان العمل أو المهمة' },
      amount: { type: 'integer', minimum: 0, description: 'المبلغ' },
      status: { type: 'string', enum: ['pending_payment', 'paid'], description: 'paid إذا استلمت الفلوس، وإلا pending_payment' },
      notes: { type: 'string', description: 'ملاحظات اضافية إن وجدت' },
    },
    required: ['client', 'title', 'amount', 'status', 'notes'],
  };
}

function buildSystemPrompt(clientNames: string[]) {
  const clientHint = clientNames.length ? `\nالعملاء الموجودون عندك: ${clientNames.join(', ')}` : '';
  return `
أنت مساعد لاستخراج بيانات عمل حر من نص بالعربي.
استخرج: اسم العميل، عنوان العمل، المبلغ، وحالة الدفع.
إذا النص يقول "ما دفع" أو "لسه" أو "بعد ما استلمت" → status = pending_payment.
إذا النص يقول "استلمت" أو "دفع" أو "تم الدفع" → status = paid.
إذا لا يذكر الدفع → status = pending_payment.
المبلغ يجب أن يكون رقم صحيح موجب.
العنوان يكون وصف قصير للعمل.
${clientHint}
إذا ذكر اسم عميل قريب من الأسماء الموجودة، استخدم الاسم الموجود بالضبط.
  `.trim();
}

async function loadUserGroqKey(userId: string) {
  await initDB();
  const sql = getDB();
  const rows = await sql`SELECT groq_api_key_encrypted FROM users WHERE id = ${userId} LIMIT 1`;
  const encrypted = rows[0]?.groq_api_key_encrypted as string | null | undefined;
  if (!encrypted) throw new Error('NO_GROQ_KEY');
  return decryptUserSecret(encrypted);
}

function fallbackParse(text: string): FreelanceParseResult {
  // Simple regex-based fallback
  const amountMatch = /(\d[\d,،.]*)/.exec(text);
  const amount = amountMatch ? parseInt(amountMatch[1].replace(/[,،.]/g, ''), 10) : 0;
  const paid = /(استلمت|دفع لي|تم الدفع|وصلت الفلوس|وصل الحساب)/.test(text);
  return {
    client: '',
    title: text.slice(0, 60),
    amount: isNaN(amount) ? 0 : amount,
    status: paid ? 'paid' : 'pending_payment',
    notes: '',
  };
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const body = await req.json() as { text?: string };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (text.length < 3) return NextResponse.json({ error: 'اكتب جملة أوضح' }, { status: 400 });

    // Load client names for hint
    const clientRows = await sql`SELECT name FROM freelance_clients WHERE user_id = ${auth.user.id} ORDER BY created_at ASC`;
    const clientNames = clientRows.map((r) => r.name as string);

    let apiKey: string;
    try {
      apiKey = await loadUserGroqKey(auth.user.id);
    } catch {
      return NextResponse.json({ error: 'أضف مفتاح Groq من حسابك أولاً' }, { status: 400 });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.1,
        messages: [
          { role: 'system', content: buildSystemPrompt(clientNames) },
          { role: 'user', content: text },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'freelance_entry', strict: true, schema: buildSchema() },
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`GROQ_FAILED:${response.status}:${errBody}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('GROQ_EMPTY');

    const parsed = JSON.parse(content) as FreelanceParseResult;
    return NextResponse.json({ ...parsed, provider: 'groq' });
  } catch (error) {
    const msg = String(error);
    if (msg.includes('NO_GROQ_KEY')) return NextResponse.json({ error: 'أضف مفتاح Groq من حسابك أولاً' }, { status: 400 });
    if (msg.includes('401') || msg.includes('invalid_api_key')) return NextResponse.json({ error: 'مفتاح Groq غير صالح' }, { status: 400 });

    // Fallback
    try {
      const body = await req.clone().json() as { text?: string };
      const fallback = fallbackParse(typeof body.text === 'string' ? body.text : '');
      return NextResponse.json({ ...fallback, provider: 'fallback' });
    } catch {
      return NextResponse.json({ error: 'تعذر تحليل الطلب' }, { status: 502 });
    }
  }
}
