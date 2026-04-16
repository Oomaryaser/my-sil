import { IncomeType } from '@/lib/types';

export interface VoiceFinanceAction {
  kind: 'expense' | 'income' | 'freelance';
  amount: number;
  description: string;
  category: string;
  incomeType: IncomeType;
  freelance_client?: string;
  freelance_status?: 'pending_payment' | 'paid';
}

export interface VoiceFinanceParseResult {
  originalText: string;
  normalizedText: string;
  actions: VoiceFinanceAction[];
  warnings: string[];
}

const INCOME_VERBS = new Set([
  'استلمت',
  'استلم',
  'حصلت',
  'حصل',
  'قبضت',
  'قبض',
  'دخل',
  'دخلت',
  'دخلني',
  'وصلني',
  'وصل',
  'جاني',
  'اجاني',
  'اخذت',
  'اخذ',
]);

const EXPENSE_VERBS = new Set([
  'صرفت',
  'صرف',
  'دفعت',
  'دفع',
  'اشتريت',
  'اشتري',
  'شريت',
  'سددت',
  'سدد',
  'حطيت',
  'حولت',
  'صرفت',
]);

const CURRENCY_WORDS = new Set([
  'دينار',
  'دينارًا',
  'دينارر',
  'دولار',
  'الفلوس',
  'فلوس',
]);

const FILLER_WORDS = new Set([
  'اليوم',
  'هسه',
  'هسة',
  'الان',
  'الحين',
  'اني',
  'انا',
  'تم',
  'لقد',
  'صار',
  'صارلي',
  'بعدين',
  'بعد',
  'ثم',
  'وكذلك',
]);

const SCALE_WORDS: Record<string, number> = {
  الف: 1000,
  الاف: 1000,
  الفين: 2000,
  مليون: 1000000,
  ملايين: 1000000,
  مليونين: 2000000,
};

const NUMBER_WORDS: Record<string, number> = {
  صفر: 0,
  واحد: 1,
  وحده: 1,
  وحدة: 1,
  اثنين: 2,
  اثنان: 2,
  ثنين: 2,
  ثلاثه: 3,
  ثلاثة: 3,
  اربعه: 4,
  اربعة: 4,
  خمسه: 5,
  خمسة: 5,
  سته: 6,
  ستة: 6,
  سبعه: 7,
  سبعة: 7,
  ثمنيه: 8,
  ثمانيه: 8,
  ثمانية: 8,
  تسعه: 9,
  تسعة: 9,
  عشره: 10,
  عشرة: 10,
  احدعش: 11,
  احدىعش: 11,
  احدىعشر: 11,
  اثنعش: 12,
  اثناعش: 12,
  ثلاثطعش: 13,
  اربعطعش: 14,
  خمسطعش: 15,
  ستطعش: 16,
  سبعطعش: 17,
  ثمنطعش: 18,
  ثمانطعش: 18,
  تسعطعش: 19,
  عشرين: 20,
  ثلاثين: 30,
  اربعين: 40,
  خمسين: 50,
  ستين: 60,
  سبعين: 70,
  ثمانين: 80,
  تسعين: 90,
  ميه: 100,
  مية: 100,
  مئه: 100,
  ميتين: 200,
  ميتان: 200,
  ثلاثميه: 300,
  ثلاثمية: 300,
  اربعمية: 400,
  اربعميه: 400,
  خمسمية: 500,
  ستمية: 600,
  سبعمية: 700,
  ثمانمية: 800,
  ثمنمية: 800,
  تسعمية: 900,
};

const EXPENSE_CATEGORY_KEYWORDS: Array<{ category: string; words: string[] }> = [
  { category: 'food', words: ['اكل', 'غدا', 'غداء', 'فطور', 'عشا', 'عشاء', 'مطعم', 'قهوة', 'قهوه', 'بقاله', 'بقالة', 'سوبرماركت'] },
  { category: 'transport', words: ['تكسي', 'تاكسي', 'اوبر', 'كريم', 'بنزين', 'وقود', 'مواصلات', 'نقل'] },
  { category: 'bills', words: ['فاتوره', 'فاتورة', 'كهرباء', 'ماء', 'ماي', 'ايجار', 'إيجار', 'نت', 'انترنت', 'خط'] },
  { category: 'shopping', words: ['ملابس', 'تسوق', 'مشتريات', 'شراء', 'شنطة', 'حذاء'] },
  { category: 'health', words: ['دواء', 'صيدليه', 'صيدلية', 'طبيب', 'مستشفى', 'علاج', 'تحاليل'] },
  { category: 'entertainment', words: ['سينما', 'العاب', 'لعبه', 'لعبة', 'ترفيه', 'كافيه'] },
  { category: 'gift', words: ['هديه', 'هدية'] },
  { category: 'charity', words: ['صدقه', 'صدقة', 'تبرع', 'زكاة'] },
  { category: 'savings', words: ['ادخار', 'توفير', 'تحويش'] },
  { category: 'family', words: ['اهلي', 'اهل', 'عائله', 'عائلة', 'البيت'] },
];

const INCOME_TYPE_KEYWORDS: Array<{ type: IncomeType; words: string[] }> = [
  { type: 'salary', words: ['راتب', 'معاش'] },
  { type: 'freelance', words: ['فريلانس', 'عميل', 'كلاينت', 'مشروع', 'تصميم', 'برمجه', 'برمجة'] },
  { type: 'side', words: ['هديه', 'هدية', 'تحويل', 'حواله', 'حوالة', 'مكافاه', 'مكافأة'] },
];

function normalizeDigits(text: string) {
  return text
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

function normalizeText(text: string) {
  return normalizeDigits(text)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s.,،/+-]/gu, ' ')
    .replace(/[.,،/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToken(rawToken: string) {
  let token = rawToken.trim().replace(/^[-+]+|[-+]+$/g, '');
  if (!token) return '';

  if (token.startsWith('و') && token.length > 1) {
    const withoutWaw = token.slice(1);
    if (
      withoutWaw in NUMBER_WORDS ||
      withoutWaw in SCALE_WORDS ||
      INCOME_VERBS.has(withoutWaw) ||
      EXPENSE_VERBS.has(withoutWaw) ||
      /^\d/.test(withoutWaw)
    ) {
      token = withoutWaw;
    }
  }

  return token;
}

function isConnectorToken(token: string) {
  return token === 'و' || token === 'وبعد' || token === 'بعد' || token === 'ثم';
}

function parseNumberWordSequence(tokens: string[], startIndex: number) {
  let index = startIndex;
  let total = 0;
  let current = 0;
  let consumed = 0;

  while (index < tokens.length) {
    const token = normalizeToken(tokens[index]);
    if (!token) {
      index += 1;
      consumed += 1;
      continue;
    }

    if (isConnectorToken(token)) {
      index += 1;
      consumed += 1;
      continue;
    }

    if (token in NUMBER_WORDS) {
      current += NUMBER_WORDS[token];
      index += 1;
      consumed += 1;
      continue;
    }

    if (token in SCALE_WORDS) {
      const scale = SCALE_WORDS[token];
      total += (current || 1) * scale;
      current = 0;
      index += 1;
      consumed += 1;
      continue;
    }

    break;
  }

  if (consumed === 0) {
    return null;
  }

  const value = total + current;
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return {
    amount: value,
    nextIndex: startIndex + consumed,
  };
}

function parseAmountTokens(tokens: string[], startIndex: number) {
  const token = normalizeToken(tokens[startIndex]);
  if (!token) return null;

  const compactMatch = token.match(/^(\d+(?:\.\d+)?)(الف|الاف|الفين|مليون|ملايين|مليونين)?$/);
  if (compactMatch) {
    const amount = Number(compactMatch[1]);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const scale = compactMatch[2] ? SCALE_WORDS[compactMatch[2]] : 1;
    return {
      amount: amount * scale,
      nextIndex: startIndex + 1,
    };
  }

  if (/^\d+(?:\.\d+)?$/.test(token)) {
    let amount = Number(token);
    let nextIndex = startIndex + 1;
    const scaleToken = normalizeToken(tokens[nextIndex] || '');
    if (scaleToken in SCALE_WORDS) {
      amount *= SCALE_WORDS[scaleToken];
      nextIndex += 1;
    }
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return { amount, nextIndex };
  }

  return parseNumberWordSequence(tokens, startIndex);
}

function cleanDescription(tokens: string[]) {
  const filtered = tokens
    .map((token) => normalizeToken(token))
    .filter(Boolean)
    .filter((token) => !isConnectorToken(token))
    .filter((token) => !CURRENCY_WORDS.has(token))
    .filter((token) => !FILLER_WORDS.has(token));

  return filtered.join(' ').trim();
}

function detectExpenseCategory(description: string) {
  const normalizedDescription = normalizeText(description);
  for (const entry of EXPENSE_CATEGORY_KEYWORDS) {
    if (entry.words.some((word) => normalizedDescription.includes(normalizeText(word)))) {
      return entry.category;
    }
  }
  return 'other';
}

function detectIncomeType(description: string): IncomeType {
  const normalizedDescription = normalizeText(description);
  for (const entry of INCOME_TYPE_KEYWORDS) {
    if (entry.words.some((word) => normalizedDescription.includes(normalizeText(word)))) {
      return entry.type;
    }
  }
  return 'side';
}

function splitIntoIntentSegments(tokens: string[]) {
  const segments: Array<{ kind: 'expense' | 'income'; tokens: string[] }> = [];
  let currentKind: 'expense' | 'income' | null = null;
  let currentTokens: string[] = [];

  for (const rawToken of tokens) {
    const token = normalizeToken(rawToken);
    if (!token) continue;

    if (INCOME_VERBS.has(token) || EXPENSE_VERBS.has(token)) {
      if (currentKind && currentTokens.length > 0) {
        segments.push({ kind: currentKind, tokens: currentTokens });
      }
      currentKind = INCOME_VERBS.has(token) ? 'income' : 'expense';
      currentTokens = [];
      continue;
    }

    if (currentKind) {
      currentTokens.push(rawToken);
    }
  }

  if (currentKind && currentTokens.length > 0) {
    segments.push({ kind: currentKind, tokens: currentTokens });
  }

  return segments;
}

function parseSegmentItems(kind: 'expense' | 'income', segmentTokens: string[]) {
  const actions: VoiceFinanceAction[] = [];
  let index = 0;

  while (index < segmentTokens.length) {
    const amountInfo = parseAmountTokens(segmentTokens, index);
    if (!amountInfo) {
      index += 1;
      continue;
    }

    let nextAmountIndex = segmentTokens.length;
    for (let cursor = amountInfo.nextIndex; cursor < segmentTokens.length; cursor += 1) {
      if (parseAmountTokens(segmentTokens, cursor)) {
        nextAmountIndex = cursor;
        break;
      }
    }

    const description = cleanDescription(segmentTokens.slice(amountInfo.nextIndex, nextAmountIndex));
    const finalDescription =
      description ||
      (kind === 'expense' ? 'مصروف صوتي' : 'دخل صوتي');

    actions.push({
      kind,
      amount: Math.round(amountInfo.amount),
      description: finalDescription,
      category: kind === 'expense' ? detectExpenseCategory(finalDescription) : 'other',
      incomeType: kind === 'income' ? detectIncomeType(finalDescription) : 'side',
    });

    index = nextAmountIndex;
  }

  return actions;
}

export function parseVoiceFinanceInput(text: string): VoiceFinanceParseResult {
  const normalizedText = normalizeText(text);
  const warnings: string[] = [];

  if (!normalizedText) {
    return {
      originalText: text,
      normalizedText,
      actions: [],
      warnings: ['اكتب أو قل جملة تحتوي على عملية مالية واضحة.'],
    };
  }

  const tokens = normalizedText.split(' ').filter(Boolean);
  const segments = splitIntoIntentSegments(tokens);

  if (segments.length === 0) {
    return {
      originalText: text,
      normalizedText,
      actions: [],
      warnings: ['استخدم كلمات مثل "صرفت" أو "استلمت" حتى أفهم العملية.'],
    };
  }

  const actions = segments.flatMap((segment) => parseSegmentItems(segment.kind, segment.tokens));
  if (actions.length === 0) {
    warnings.push('فهمت نوع العملية، لكن ما قدرت أستخرج مبالغ واضحة من الكلام.');
  }

  return {
    originalText: text,
    normalizedText,
    actions,
    warnings,
  };
}
