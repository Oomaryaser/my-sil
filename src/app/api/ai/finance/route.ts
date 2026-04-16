import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';
import { parseVoiceFinanceInput, VoiceFinanceAction, VoiceFinanceParseResult } from '@/lib/voice-finance';
import { decryptUserSecret } from '@/lib/user-secrets';

const GROQ_MODEL = process.env.GROQ_FINANCE_MODEL || 'openai/gpt-oss-20b';
const EXPENSE_CATEGORIES = ['food', 'transport', 'bills', 'shopping', 'health', 'entertainment', 'gift', 'charity', 'savings', 'family', 'other'] as const;
const INCOME_TYPES = ['salary', 'freelance', 'side'] as const;
const FREELANCE_STATUSES = ['pending_payment', 'paid'] as const;
const MAX_HISTORY_MESSAGES = 10;

interface FinanceConversationMessage {
  role: 'user' | 'assistant';
  text: string;
  actions?: VoiceFinanceAction[];
  warnings?: string[];
}

interface FinanceContextPayload {
  text: string;
  history: FinanceConversationMessage[];
  pendingActions: VoiceFinanceAction[];
  pendingOriginalText?: string;
}

function buildSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      originalText: {
        type: 'string',
        description: 'The exact original user input, unchanged.',
      },
      normalizedText: {
        type: 'string',
        description: 'A cleaned-up Arabic version of the user input.',
      },
      actions: {
        type: 'array',
        description: 'List of financial actions extracted from the message.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            kind: {
              type: 'string',
              enum: ['expense', 'income', 'freelance'],
            },
            amount: {
              type: 'integer',
              minimum: 1,
            },
            description: {
              type: 'string',
            },
            category: {
              type: 'string',
              enum: [...EXPENSE_CATEGORIES],
            },
            incomeType: {
              type: 'string',
              enum: [...INCOME_TYPES],
            },
            freelance_client: {
              type: 'string',
              description: 'اسم العميل أو الشركة — فقط لـ freelance kind',
            },
            freelance_status: {
              type: 'string',
              enum: [...FREELANCE_STATUSES],
              description: 'paid إذا استلمت الفلوس، pending_payment إذا لم تستلم بعد',
            },
          },
          required: ['kind', 'amount', 'description', 'category', 'incomeType', 'freelance_client', 'freelance_status'],
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['originalText', 'normalizedText', 'actions', 'warnings'],
  };
}

function buildSystemPrompt() {
  return `
You are an Arabic financial extraction engine for an Iraqi salary tracker app that also tracks freelance work.
You read Iraqi Arabic or standard Arabic and convert the user's finance conversation into final structured financial actions.

Rules:
- Extract the final intended financial actions after considering the full unresolved conversation context.
- If money was spent, set kind to "expense".
- If money was received (salary, side income), set kind to "income".
- If the user mentions working FOR a client/company (freelance work), set kind to "freelance".
  - Freelance signals: "اشتغلت لـ", "شغلة لـ", "عملت لـ", "اكملت مشروع لـ", "سلمت شغل لـ", "اشتغلت وي", "عملت مع"
  - freelance_client: the client or company name (extract carefully)
  - description: the work title (e.g. تصميم شعار, برمجة موقع)
  - freelance_status: "paid" if user says they received payment, "pending_payment" if not paid yet or no mention
  - Payment indicators for paid: "استلمت", "دفعوا", "وصلت الفلوس", "دفع لي"
  - Payment indicators for pending: "ما دفعت", "بعد ما استلمت", "ما وصل", no mention of receiving
- Amount must be a positive integer only.
- Description must be short, clear, and in Arabic.
- Resolve context and references such as: هاي، هذي، هذا، همين، الأولى، الثانية, later clarifications, repeated amounts, and named people.
- If the same amount is mentioned again later with a clearer description or owner, treat it as the same transaction and enrich it instead of duplicating it.
- The latest user message may clarify, split, merge, replace, or correct previously mentioned transactions. Reflect the latest intent.
- If the user is refining previously suggested actions, return the revised final list to apply now, not a delta unless the latest message clearly adds a new separate transaction.
- If the user refers to previous candidate actions with phrases like "هاي", "هذي", "الثانية", "نفسها", "همين", bind those references to the existing unresolved actions or previous user messages.
- Do not emit generic descriptions like "حصلت" or "صرفت على" when a later phrase clarifies what that amount was for or from whom.
- For expense actions choose category from:
  food, transport, bills, shopping, health, entertainment, gift, charity, savings, family, other
- For income actions choose incomeType from:
  salary, freelance, side
- For expense actions set incomeType to "side", freelance_client to "", freelance_status to "pending_payment".
- For income actions set category to "other", freelance_client to "", freelance_status to "pending_payment".
- For freelance actions set category to "other", incomeType to "freelance".
- If text is ambiguous, add a warning and do not invent missing amounts.
- If a phrase has no valid amount, do not create an action for it.
- Return only valid JSON matching the schema.
  `.trim();
}

function summarizeAction(action: VoiceFinanceAction) {
  return [
    action.kind === 'expense' ? 'expense' : 'income',
    `amount=${action.amount}`,
    `description=${action.description}`,
    `category=${action.category}`,
    `incomeType=${action.incomeType}`,
  ].join(' | ');
}

function sanitizeConversationMessages(raw: unknown): FinanceConversationMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => {
      const role: FinanceConversationMessage['role'] = item.role === 'assistant' ? 'assistant' : 'user';
      const text = typeof item.text === 'string' ? item.text.trim() : '';
      const actions = Array.isArray(item.actions)
        ? sanitizeAiResult({ actions: item.actions, warnings: [], normalizedText: text }, text).actions
        : undefined;
      const warnings = Array.isArray(item.warnings)
        ? item.warnings.filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0).slice(0, 4)
        : undefined;

      return {
        role,
        text: text.slice(0, 800),
        actions,
        warnings,
      };
    })
    .filter((message) => message.text.length > 0 || (message.actions && message.actions.length > 0))
    .slice(-MAX_HISTORY_MESSAGES);
}

function sanitizeActionList(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return sanitizeAiResult({ actions: raw, warnings: [], normalizedText: '' }, '').actions;
}

function buildConversationMessages(context: FinanceContextPayload) {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: buildSystemPrompt() },
  ];

  if (context.history.length > 0) {
    messages.push({
      role: 'system',
      content: [
        'Previous unresolved conversation context:',
        ...context.history.map((message, index) => {
          const lines = [`${index + 1}. ${message.role}: ${message.text}`];
          if (message.actions && message.actions.length > 0) {
            lines.push(`   Parsed actions: ${message.actions.map(summarizeAction).join(' || ')}`);
          }
          if (message.warnings && message.warnings.length > 0) {
            lines.push(`   Warnings: ${message.warnings.join(' | ')}`);
          }
          return lines.join('\n');
        }),
      ].join('\n'),
    });
  }

  if (context.pendingActions.length > 0) {
    messages.push({
      role: 'system',
      content: [
        'Current unresolved candidate actions from the previous analysis:',
        ...context.pendingActions.map((action, index) => `${index + 1}. ${summarizeAction(action)}`),
        context.pendingOriginalText ? `Previous analyzed text: ${context.pendingOriginalText}` : '',
        'The latest user message may revise this list. Return the final consolidated actions to apply now.',
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  messages.push({
    role: 'user',
    content: [
      'Latest user message:',
      context.text,
      '',
      'Task:',
      '- Understand this latest message in light of the previous unresolved conversation and candidate actions.',
      '- If it clarifies previous amounts, update those actions instead of duplicating them.',
      '- If it clearly adds new transactions, include them too.',
      '- Return the final consolidated actions to execute now.',
    ].join('\n'),
  });

  return messages;
}

function buildFallbackText(context: FinanceContextPayload) {
  const uniqueTexts: string[] = [];

  for (const value of [
    ...context.history.filter((message) => message.role === 'user').map((message) => message.text),
    context.pendingOriginalText || '',
    context.text,
  ]) {
    const normalized = value.trim();
    if (!normalized || uniqueTexts.includes(normalized)) continue;
    uniqueTexts.push(normalized);
  }

  return uniqueTexts.join(' ').trim();
}

function amountPattern(amount: number) {
  return amount
    .toString()
    .split('')
    .join('[,،\\s]*');
}

function extractAmountClarification(text: string, amount: number) {
  const pattern = new RegExp(amountPattern(amount), 'g');
  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0) return '';

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const start = (match.index || 0) + match[0].length;
    const rest = text.slice(start);
    const nextAmount = /\d[\d,،]*/.exec(rest);
    const segment = (nextAmount ? rest.slice(0, nextAmount.index) : rest).trim();
    if (segment) return segment;
  }

  return '';
}

function cleanClarificationSegment(segment: string) {
  const cleaned = segment
    .replace(/^[\s,،.:;\-]+/g, '')
    .replace(/^(هاي من|هذي من|هذا من|هاي|هذي|هذا|هي|همين|نفسها|نفسه)\s+/u, '')
    .replace(/^(هي|هاي|هذي|هذا)\s+/u, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned
    .replace(/[\s,،.:;\-]+$/g, '')
    .replace(/[\s,،.:;\-]*(والـ|وال|الـ|و)\s*$/u, '')
    .trim();
}

function inferExpenseCategory(description: string): VoiceFinanceAction['category'] {
  const normalized = normalizeArabicText(description);

  if (/(غدا|غداء|اكل|فطور|عشا|عشاء|مطعم|قهوه|قهوة|بقاله|بقالة|سوبرماركت)/.test(normalized)) return 'food';
  if (/(تكسي|تاكسي|اوبر|كريم|بنزين|وقود|مواصلات|نقل)/.test(normalized)) return 'transport';
  if (/(فاتوره|فاتورة|كهرباء|ماء|ماي|ايجار|إيجار|نت|انترنت|خط)/.test(normalized)) return 'bills';
  if (/(ملابس|تسوق|مشتريات|شراء|شنطه|شنطة|حذاء)/.test(normalized)) return 'shopping';
  if (/(دواء|صيدليه|صيدلية|طبيب|مستشفى|علاج|تحاليل)/.test(normalized)) return 'health';
  if (/(سينما|العاب|العاب|لعبه|لعبة|ترفيه|كافيه|لعب)/.test(normalized)) return 'entertainment';
  if (/(هديه|هدية)/.test(normalized)) return 'gift';
  if (/(صدقه|صدقة|تبرع|زكاة)/.test(normalized)) return 'charity';
  if (/(ادخار|توفير|تحويش)/.test(normalized)) return 'savings';
  if (/(اهلي|اهل|عائله|عائلة|البيت)/.test(normalized)) return 'family';

  return 'other';
}

function inferIncomeType(description: string): VoiceFinanceAction['incomeType'] {
  const normalized = normalizeArabicText(description);

  if (/(راتب|معاش)/.test(normalized)) return 'salary';
  if (/(عميل|كلاينت|مشروع|تصميم|جرافيك|فريلانس|برمجه|برمجة)/.test(normalized)) return 'freelance';

  return 'side';
}

function refinePendingActionsFromText(actions: VoiceFinanceAction[], latestText: string) {
  return actions.map((action) => {
    const rawSegment = extractAmountClarification(latestText, action.amount);
    if (!rawSegment) return action;

    const description = cleanClarificationSegment(rawSegment);
    if (!description || isGenericDescription({ ...action, description })) {
      return action;
    }

    if (action.kind === 'expense') {
      return {
        ...action,
        description,
        category: inferExpenseCategory(description),
      };
    }

    return {
      ...action,
      description,
      incomeType: inferIncomeType(description),
    };
  });
}

function normalizeArabicText(value: string) {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenericDescription(action: VoiceFinanceAction) {
  const normalized = normalizeArabicText(action.description);
  if (!normalized) return true;

  const genericPhrases = new Set([
    'حصلت',
    'استلمت',
    'دخل',
    'من عميل',
    'حصلت من عميل',
    'استلمت من عميل',
    'دخل من عميل',
    'صرفت',
    'صرفت على',
    'دفعت',
    'اشتريت',
    'مصروف صوتي',
    'دخل صوتي',
  ]);

  return genericPhrases.has(normalized) || normalized.length <= 6;
}

function descriptionsOverlap(first: string, second: string) {
  const a = normalizeArabicText(first);
  const b = normalizeArabicText(second);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function scoreActionSpecificity(action: VoiceFinanceAction) {
  const normalized = normalizeArabicText(action.description);
  const tokenCount = normalized ? normalized.split(' ').filter(Boolean).length : 0;
  let score = tokenCount * 3 + normalized.length;

  if (action.kind === 'expense' && action.category !== 'other') score += 8;
  if (action.kind === 'income' && action.incomeType !== 'side') score += 6;
  if (isGenericDescription(action)) score -= 12;

  return score;
}

function mergeActions(actions: VoiceFinanceAction[]) {
  const merged: VoiceFinanceAction[] = [];

  for (const action of actions) {
    const existingIndex = merged.findIndex((existing) => {
      if (existing.kind !== action.kind || existing.amount !== action.amount) return false;

      if (descriptionsOverlap(existing.description, action.description)) return true;
      if (isGenericDescription(existing) || isGenericDescription(action)) return true;

      if (action.kind === 'expense') {
        return existing.category === action.category || existing.category === 'other' || action.category === 'other';
      }

      return existing.incomeType === action.incomeType || existing.incomeType === 'side' || action.incomeType === 'side';
    });

    if (existingIndex === -1) {
      merged.push(action);
      continue;
    }

    const existing = merged[existingIndex];
    const keepAction = scoreActionSpecificity(action) >= scoreActionSpecificity(existing) ? action : existing;
    const secondary = keepAction === action ? existing : action;

    merged[existingIndex] = {
      ...keepAction,
      description:
        scoreActionSpecificity(keepAction) >= scoreActionSpecificity(secondary)
          ? keepAction.description
          : secondary.description,
      category:
        keepAction.kind === 'expense'
          ? keepAction.category !== 'other'
            ? keepAction.category
            : secondary.category
          : 'other',
      incomeType:
        keepAction.kind === 'income'
          ? keepAction.incomeType !== 'side'
            ? keepAction.incomeType
            : secondary.incomeType
          : 'side',
    };
  }

  return merged;
}

function sanitizeAiResult(raw: unknown, originalText: string): VoiceFinanceParseResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid AI response payload');
  }

  const source = raw as Record<string, unknown>;
  const warnings = Array.isArray(source.warnings)
    ? source.warnings.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const actions = Array.isArray(source.actions) ? source.actions : [];

  return {
    originalText,
    normalizedText: typeof source.normalizedText === 'string' ? source.normalizedText.trim() : originalText.trim(),
    warnings,
    actions: mergeActions(
      actions
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item): VoiceFinanceAction => {
        const kind: VoiceFinanceAction['kind'] =
          item.kind === 'income' ? 'income' : item.kind === 'freelance' ? 'freelance' : 'expense';
        const category = typeof item.category === 'string' && EXPENSE_CATEGORIES.includes(item.category as (typeof EXPENSE_CATEGORIES)[number])
          ? item.category
          : 'other';
        const incomeType: VoiceFinanceAction['incomeType'] =
          typeof item.incomeType === 'string' && INCOME_TYPES.includes(item.incomeType as (typeof INCOME_TYPES)[number])
            ? (item.incomeType as VoiceFinanceAction['incomeType'])
            : 'side';
        const freelanceClient = typeof item.freelance_client === 'string' ? item.freelance_client.trim() : '';
        const freelanceStatus: VoiceFinanceAction['freelance_status'] =
          item.freelance_status === 'paid' ? 'paid' : 'pending_payment';

        return {
          kind,
          amount: Math.max(1, Math.round(Number(item.amount || 0))),
          description:
            typeof item.description === 'string' && item.description.trim()
              ? item.description.trim()
              : kind === 'income'
                ? 'دخل صوتي'
                : kind === 'freelance'
                  ? 'عمل حر'
                  : 'مصروف صوتي',
          category: kind === 'income' || kind === 'freelance' ? 'other' : category,
          incomeType: kind === 'expense' ? 'side' : incomeType,
          freelance_client: freelanceClient,
          freelance_status: freelanceStatus,
        };
        })
        .filter((action) => Number.isFinite(action.amount) && action.amount > 0),
    ),
  };
}

async function loadUserGroqKey(userId: string) {
  await initDB();
  const sql = getDB();
  const rows = await sql`
    SELECT groq_api_key_encrypted
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  const encrypted = rows[0]?.groq_api_key_encrypted as string | null | undefined;
  if (!encrypted) {
    throw new Error('NO_GROQ_KEY');
  }

  return decryptUserSecret(encrypted);
}

async function parseWithGroq(context: FinanceContextPayload, apiKey: string) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.1,
      messages: buildConversationMessages(context),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'finance_actions',
          strict: true,
          schema: buildSchema(),
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GROQ_REQUEST_FAILED:${response.status}:${body}`);
  }

  const data = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('GROQ_EMPTY_RESPONSE');
  }

  return sanitizeAiResult(JSON.parse(content), context.text);
}

async function parseWithGroqJsonMode(context: FinanceContextPayload, apiKey: string) {
  const messages = buildConversationMessages(context);
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `${buildSystemPrompt()}

Return JSON only.
Use this exact shape:
{
  "originalText": "string",
  "normalizedText": "string",
  "actions": [
    {
      "kind": "expense|income",
      "amount": 123,
      "description": "string in Arabic",
      "category": "food|transport|bills|shopping|health|entertainment|gift|charity|savings|family|other",
      "incomeType": "salary|freelance|side"
    }
  ],
  "warnings": ["string"]
}`,
        },
        ...messages.slice(1),
      ],
      response_format: {
        type: 'json_object',
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GROQ_JSON_MODE_FAILED:${response.status}:${body}`);
  }

  const data = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('GROQ_JSON_MODE_EMPTY_RESPONSE');
  }

  return sanitizeAiResult(JSON.parse(content), context.text);
}

function mapRouteError(error: unknown) {
  const message = String(error);

  if (message.includes('NO_GROQ_KEY')) {
    return { status: 400, error: 'أضف مفتاح Groq من حسابك أولاً حتى تستخدم المساعد الذكي.' };
  }

  if (message.includes('401') || message.includes('invalid_api_key')) {
    return { status: 400, error: 'مفتاح Groq غير صالح. حدّث المفتاح من إعدادات حسابك.' };
  }

  if (message.includes('429')) {
    return { status: 429, error: 'وصلت حد استخدام Groq لهذا المفتاح حالياً. جرّب بعد قليل.' };
  }

  return { status: 502, error: 'تعذر تحليل الطلب عبر Groq حالياً. جرّب مرة ثانية.' };
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  try {
    const body = await req.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const history = sanitizeConversationMessages(body.history);
    const pendingActions = sanitizeActionList(body.pendingActions);
    const pendingOriginalText = typeof body.pendingOriginalText === 'string' ? body.pendingOriginalText.trim().slice(0, 800) : undefined;

    if (text.length < 3) {
      return NextResponse.json({ error: 'اكتب أو قل جملة أوضح حتى أفهم العملية.' }, { status: 400 });
    }

    const context: FinanceContextPayload = {
      text,
      history,
      pendingActions,
      pendingOriginalText,
    };

    const apiKey = await loadUserGroqKey(auth.user.id);
    try {
      const result = await parseWithGroq(context, apiKey);
      return NextResponse.json({
        ...result,
        provider: 'groq',
        model: GROQ_MODEL,
      });
    } catch (schemaError) {
      console.error('[ai/finance] structured parse failed', schemaError);

      try {
        const result = await parseWithGroqJsonMode(context, apiKey);
        result.warnings = [
          ...result.warnings,
          'تم استخدام وضع احتياطي لتحليل الرسالة بسبب تعثر الاستجابة المنظمة.',
        ];

        return NextResponse.json({
          ...result,
          provider: 'groq',
          model: GROQ_MODEL,
        });
      } catch (jsonModeError) {
        console.error('[ai/finance] json-mode parse failed', jsonModeError);

        const fallbackSourceText = pendingActions.length > 0 ? text : buildFallbackText(context) || text;
        const fallback = parseVoiceFinanceInput(fallbackSourceText);
        const refinedPendingActions = pendingActions.length > 0 ? refinePendingActionsFromText(pendingActions, text) : pendingActions;
        fallback.actions = mergeActions([...refinedPendingActions, ...fallback.actions]);
        fallback.warnings = [
          ...(pendingActions.length > 0 ? [] : fallback.warnings),
          'تعذر تحليل Groq لهذه الرسالة في هذه المحاولة، فتم استخدام المحلل الاحتياطي داخل التطبيق.',
        ];

        return NextResponse.json({
          ...fallback,
          provider: 'fallback',
          model: GROQ_MODEL,
        });
      }
    }
  } catch (error) {
    const mapped = mapRouteError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
