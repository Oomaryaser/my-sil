'use client';

import { useEffect, useRef, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import { VoiceFinanceAction, VoiceFinanceParseResult } from '@/lib/voice-finance';

interface Props {
  month: string;
  hasGroqApiKey: boolean;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onApplied: () => Promise<unknown>;
  onFreelanceJobAdded?: () => void;
}

interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

interface FinanceAiResponse extends VoiceFinanceParseResult {
  provider?: string;
  model?: string;
  error?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tone?: 'default' | 'warning' | 'success' | 'confirm';
  actions?: VoiceFinanceAction[];
  warnings?: string[];
}

interface AnalyzeRequestMessage {
  role: 'user' | 'assistant';
  text: string;
  actions?: VoiceFinanceAction[];
  warnings?: string[];
}

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getTodayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function buildNotes(action: VoiceFinanceAction, sourceText: string) {
  const prefix = action.kind === 'expense' ? 'أضيف عبر المساعد الصوتي' : 'دخل مضاف عبر المساعد الصوتي';
  return `${prefix} · ${sourceText}`.slice(0, 250);
}

function makeUid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function VoiceFinanceAssistant({ month, hasGroqApiKey, showToast, onApplied, onFreelanceJobAdded }: Props) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const keepListeningRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const recognitionBaseTextRef = useRef('');
  const restartTimerRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState('');
  const [hasStartedConversation, setHasStartedConversation] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingResult, setPendingResult] = useState<FinanceAiResponse | null>(null);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);

  useEffect(() => {
    setSupported(Boolean(getRecognitionConstructor()));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, listening, pendingMessageId]);

  useEffect(() => {
    if (open) return;

    keepListeningRef.current = false;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    setListening(false);
  }, [open]);

  useEffect(() => {
    if (!open || !supported) return undefined;

    const SpeechRecognitionCtor = getRecognitionConstructor();
    if (!SpeechRecognitionCtor) return undefined;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'ar-IQ';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalized = finalTranscriptRef.current;
      let interim = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const segment = event.results[index][0].transcript.trim();
        if (!segment) continue;

        if (event.results[index].isFinal) {
          finalized = `${finalized} ${segment}`.trim();
        } else {
          interim = `${interim} ${segment}`.trim();
        }
      }

      finalTranscriptRef.current = finalized;
      setDraft(`${recognitionBaseTextRef.current} ${finalized} ${interim}`.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;
      if (event.error === 'no-speech' && keepListeningRef.current) return;

      keepListeningRef.current = false;
      setListening(false);
      showToast('تعذر التقاط الصوت. جرب الكتابة اليدوية أو أعد المحاولة.', 'error');
    };

    recognition.onend = () => {
      if (!keepListeningRef.current) {
        setListening(false);
        return;
      }

      restartTimerRef.current = window.setTimeout(() => {
        try {
          recognition.start();
          setListening(true);
        } catch {
          keepListeningRef.current = false;
          setListening(false);
          showToast('تعذر استئناف التسجيل الصوتي. أعد المحاولة.', 'error');
        }
      }, 120);
    };

    recognitionRef.current = recognition;

    return () => {
      keepListeningRef.current = false;
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
  }, [open, showToast, supported]);

  const appendMessage = (message: Omit<ChatMessage, 'id'>) => {
    const id = makeId('voice_msg');
    setMessages((current) => [...current, { id, ...message }]);
    return id;
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      showToast('المتصفح لا يدعم التعرف على الصوت هنا. استخدم الإدخال اليدوي.', 'error');
      return;
    }

    try {
      setHasStartedConversation(true);
      keepListeningRef.current = true;
      recognitionBaseTextRef.current = draft.trim();
      finalTranscriptRef.current = '';

      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }

      setListening(true);
      recognitionRef.current.start();
    } catch {
      keepListeningRef.current = false;
      setListening(false);
      showToast('تعذر بدء التسجيل الصوتي حالياً.', 'error');
    }
  };

  const stopListening = () => {
    keepListeningRef.current = false;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    setListening(false);
  };

  const analyzeMessage = async (
    text: string,
    history: AnalyzeRequestMessage[],
    currentPendingResult: FinanceAiResponse | null,
  ) => {
    const response = await fetch('/api/ai/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        history,
        pendingActions: currentPendingResult?.actions || [],
        pendingOriginalText: currentPendingResult?.originalText || '',
      }),
    });

    const data = (await response.json().catch(() => null)) as FinanceAiResponse | { error?: string } | null;
    if (!response.ok) {
      throw new Error((data && 'error' in data && data.error) || 'تعذر تحليل الطلب عبر Groq');
    }

    return data as FinanceAiResponse;
  };

  const handleAnalyzeAndConfirm = async () => {
    const text = draft.trim();
    const isRevision = Boolean(pendingResult);

    if (!text) {
      showToast('اكتب أو قل الجملة أولاً حتى يتم تحليلها.', 'error');
      return;
    }

    setHasStartedConversation(true);

    if (listening) {
      stopListening();
    }

    appendMessage({
      role: 'user',
      text,
    });

    setDraft('');
    recognitionBaseTextRef.current = '';
    finalTranscriptRef.current = '';

    if (!hasGroqApiKey) {
      appendMessage({
        role: 'assistant',
        text: 'هذه الميزة تحتاج مفتاح Groq من المستخدم نفسه. أضف المفتاح من بطاقة الحساب في الشريط الجانبي ثم أرسل طلبك من جديد.',
        tone: 'warning',
      });
      return;
    }

    setAnalyzing(true);

    try {
      const history = messages.map((message) => ({
        role: message.role,
        text: message.text,
        actions: message.actions,
        warnings: message.warnings,
      }));
      const parsed = await analyzeMessage(text, history, pendingResult);

      if (parsed.actions.length === 0) {
        appendMessage({
          role: 'assistant',
          text: parsed.warnings[0] || 'ما قدرت أفهم العملية المالية من الرسالة.',
          tone: 'warning',
          warnings: parsed.warnings,
        });
        return;
      }

      const confirmId = appendMessage({
        role: 'assistant',
        text: isRevision
          ? parsed.actions.length === 1
            ? 'حدّثت التحليل حسب توضيحك. أطبّق العملية التالية؟'
            : 'حدّثت التحليل حسب توضيحك. أطبّق العمليات التالية؟'
          : parsed.actions.length === 1
            ? 'حللت طلبك. أطبّق العملية التالية؟'
            : 'حللت طلبك. أطبّق العمليات التالية؟',
        tone: 'confirm',
        actions: parsed.actions,
        warnings: parsed.warnings,
      });

      setPendingResult(parsed);
      setPendingMessageId(confirmId);
      showToast(`تم تحليل ${parsed.actions.length} عملية عبر Groq AI`);
    } catch (error) {
      appendMessage({
        role: 'assistant',
        text: error instanceof Error ? error.message : 'تعذر تحليل الطلب عبر Groq',
        tone: 'warning',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const executeActions = async () => {
    if (!pendingResult || pendingResult.actions.length === 0) {
      showToast('ماكو عمليات جاهزة للتنفيذ', 'error');
      return;
    }

    setSubmitting(true);
    const today = getTodayIso();

    let freelanceAdded = false;

    try {
      for (const action of pendingResult.actions) {
        if (action.kind === 'expense') {
          const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: makeId('voice_expense'),
              month,
              name: action.description,
              amount: action.amount,
              category: action.category,
              notes: buildNotes(action, pendingResult.originalText),
              date: today,
              type: 'actual',
            }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({ error: 'تعذر حفظ المصروف' }));
            throw new Error(data.error || 'تعذر حفظ المصروف');
          }
          continue;
        }

        if (action.kind === 'freelance') {
          // Find or create the client, then save the job
          const clientName = action.freelance_client?.trim() || 'عميل غير محدد';

          // Try to find existing client
          const clientsRes = await fetch('/api/freelance/clients');
          let clientId = '';
          if (clientsRes.ok) {
            const clientsData = await clientsRes.json() as Array<{ id: string; name: string; children?: unknown[] }>;
            const flatten = (list: Array<{ id: string; name: string; children?: unknown[] }>): Array<{ id: string; name: string }> =>
              list.flatMap(c => [{ id: c.id, name: c.name }, ...flatten((c.children || []) as Array<{ id: string; name: string; children?: unknown[] }>)]);
            const allClients = flatten(clientsData);
            const match = allClients.find(c =>
              c.name.toLowerCase() === clientName.toLowerCase() ||
              c.name.includes(clientName) ||
              clientName.includes(c.name)
            );
            if (match) clientId = match.id;
          }

          // Create client if not found
          if (!clientId) {
            const createRes = await fetch('/api/freelance/clients', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: clientName }),
            });
            if (!createRes.ok) {
              const data = await createRes.json().catch(() => ({ error: 'تعذر إنشاء العميل' }));
              throw new Error(data.error || 'تعذر إنشاء العميل');
            }
            const created = await createRes.json() as { id: string };
            clientId = created.id;
          }

          // Save the job
          const jobRes = await fetch('/api/freelance/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: clientId,
              title: action.description,
              amount: action.amount,
              month,
              work_date: today,
              status: action.freelance_status || 'pending_payment',
              notes: `أضيف عبر المساعد الذكي · ${pendingResult.originalText}`.slice(0, 250),
            }),
          });

          if (!jobRes.ok) {
            const data = await jobRes.json().catch(() => ({ error: 'تعذر حفظ العمل الحر' }));
            throw new Error(data.error || 'تعذر حفظ العمل الحر');
          }

          freelanceAdded = true;
          continue;
        }

        const sourceId = makeId('voice_income');
        const createSourceRes = await fetch('/api/income', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: sourceId,
            month,
            name: action.description,
            type: action.incomeType,
            expected_amount: action.amount,
            notes: buildNotes(action, pendingResult.originalText),
          }),
        });

        if (!createSourceRes.ok) {
          const data = await createSourceRes.json().catch(() => ({ error: 'تعذر حفظ مصدر الدخل' }));
          throw new Error(data.error || 'تعذر حفظ مصدر الدخل');
        }

        const createPaymentRes = await fetch('/api/income/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: makeId('voice_payment'),
            source_id: sourceId,
            month,
            amount: action.amount,
            date: today,
            notes: buildNotes(action, pendingResult.originalText),
          }),
        });

        if (!createPaymentRes.ok) {
          const data = await createPaymentRes.json().catch(() => ({ error: 'تعذر تسجيل الدفعة' }));
          throw new Error(data.error || 'تعذر تسجيل الدفعة');
        }
      }

      await onApplied();
      if (freelanceAdded && onFreelanceJobAdded) onFreelanceJobAdded();
      appendMessage({
        role: 'assistant',
        text: `تم تنفيذ ${pendingResult.actions.length} عملية بنجاح.`,
        tone: 'success',
      });
      setPendingResult(null);
      setPendingMessageId(null);
      showToast(`تم تنفيذ ${pendingResult.actions.length} عملية بنجاح`);
    } catch (error) {
      appendMessage({
        role: 'assistant',
        text: error instanceof Error ? error.message : 'تعذر تنفيذ العمليات',
        tone: 'warning',
      });
      showToast(error instanceof Error ? error.message : 'تعذر تنفيذ العمليات', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelPendingActions = () => {
    if (!pendingResult) return;

    setDraft(pendingResult.originalText);
    setPendingResult(null);
    setPendingMessageId(null);
    appendMessage({
      role: 'assistant',
      text: 'تم إلغاء التنفيذ. عدّل الرسالة أو أرسل طلباً جديداً.',
    });
  };

  const removePendingAction = (actionIndex: number) => {
    if (!pendingResult || !pendingMessageId) return;

    const nextActions = pendingResult.actions.filter((_, index) => index !== actionIndex);

    if (nextActions.length === 0) {
      setPendingResult(null);
      setPendingMessageId(null);
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingMessageId
            ? {
                ...message,
                text: 'تم حذف كل العمليات المقترحة. اكتب توضيحاً جديداً أو أرسل طلباً آخر.',
                tone: 'warning',
                actions: [],
              }
            : message,
        ),
      );
      showToast('تم حذف كل العمليات المقترحة');
      return;
    }

    const nextResult: FinanceAiResponse = {
      ...pendingResult,
      actions: nextActions,
    };

    setPendingResult(nextResult);
    setMessages((current) =>
      current.map((message) =>
        message.id === pendingMessageId
          ? {
              ...message,
              actions: nextActions,
              text: nextActions.length === 1 ? 'حللت طلبك. أطبّق العملية التالية؟' : 'حللت طلبك. أطبّق العمليات التالية؟',
            }
          : message,
      ),
    );
    showToast('تم حذف العملية من القائمة');
  };

  const composerDisabled = analyzing || submitting;
  const hasDraft = draft.trim().length > 0;

  return (
    <>
      <button
        className={`voice-assistant-fab${open ? ' active' : ''}`}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="فتح المساعد الصوتي"
      >
        <AppIcon name="mic" size={20} />
        <span>المساعد الصوتي</span>
      </button>

      {open && <div className="voice-assistant-backdrop" onClick={() => setOpen(false)} />}

      <div className={`voice-assistant-sheet${open ? ' open' : ''}`}>
        <div className="voice-assistant-head">
          <div>
            <h3 className="title-with-icon">
              <AppIcon name="mic" size={18} />
              <span>المساعد المالي</span>
            </h3>
            <p>اكتب أو احكِ طلبك، وبعد التحليل راح أطلب منك التأكيد قبل التنفيذ.</p>
          </div>
          <button className="close-btn" type="button" onClick={() => setOpen(false)}>
            <AppIcon name="close" size={16} />
          </button>
        </div>

        <div className="voice-assistant-body">
          <div className="voice-chat">
            {!hasStartedConversation && (
              <article className="voice-message assistant">
                <div className="voice-bubble voice-bubble-helper">
                  <strong>جرّب هكذا</strong>
                  <p>اكتب أو احكِ طلبك ثم اضغط تنفيذ.</p>
                  <div className="voice-example-list">
                    <span>اليوم صرفت 500 غداء و 200 تكسي و 100 قهوة</span>
                    <span>استلمت 300000 راتب</span>
                    <span>اشتغلت لشركة الأمل على تصميم موقع بسعر 150 دولار وبعد ما دفعوا</span>
                    <span>سلمت مشروع برمجة لعميل الفلاني بـ 200000 واستلمت الفلوس</span>
                  </div>
                </div>
              </article>
            )}

            {messages.map((message) => (
              <article key={message.id} className={`voice-message ${message.role}`}>
                <div className={`voice-bubble voice-bubble-${message.tone || 'default'}`}>
                  <p>{message.text}</p>

                  {message.warnings && message.warnings.length > 0 && (
                    <div className="voice-warning-list">
                      {message.warnings.map((warning) => (
                        <div key={`${message.id}-${warning}`} className="voice-assistant-warning">
                          <AppIcon name="warning" size={14} />
                          <span>{warning}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {message.actions && message.actions.length > 0 && (
                    <div className="voice-action-list">
                      {message.actions.map((action, index) => (
                        <article key={`${message.id}-${action.kind}-${action.description}-${index}`} className="voice-action-card">
                          <div className="voice-action-icon">
                            <AppIcon name={action.kind === 'expense' ? 'receipt' : action.kind === 'freelance' ? 'briefcase' : 'wallet'} size={16} />
                          </div>
                          <div className="voice-action-content">
                            <strong>
                              {action.kind === 'expense' ? 'مصروف فعلي' : action.kind === 'freelance' ? `عمل حر — ${action.freelance_client || 'عميل'}` : 'دخل مستلم'}
                            </strong>
                            <span>{action.description}</span>
                            {action.kind === 'freelance' && (
                              <span style={{ fontSize: 11, marginTop: 2, display: 'block', color: action.freelance_status === 'paid' ? 'var(--green)' : 'var(--orange)' }}>
                                {action.freelance_status === 'paid' ? '✓ تم الاستلام' : '⏳ لم يُستلم بعد'}
                              </span>
                            )}
                          </div>
                          <div className="voice-action-meta">
                            <div className="voice-action-amount">{action.amount.toLocaleString('en-US')}</div>
                            {pendingResult && pendingMessageId === message.id && (
                              <button
                                className="voice-action-remove"
                                type="button"
                                onClick={() => removePendingAction(index)}
                                disabled={submitting || analyzing}
                                aria-label={`حذف العملية ${index + 1}`}
                                title="حذف العملية"
                              >
                                <AppIcon name="trash" size={15} />
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  {pendingResult && pendingMessageId === message.id && (
                    <div className="voice-confirm-actions">
                      <button
                        className="btn btn-primary btn-with-icon"
                        type="button"
                        onClick={executeActions}
                        disabled={submitting || analyzing}
                      >
                        <AppIcon name={submitting ? 'clock' : 'check'} size={15} />
                        <span>{submitting ? 'جارٍ التنفيذ...' : 'تأكيد التنفيذ'}</span>
                      </button>

                      <button
                        className="btn btn-ghost btn-with-icon"
                        type="button"
                        onClick={cancelPendingActions}
                        disabled={submitting || analyzing}
                      >
                        <AppIcon name="close" size={15} />
                        <span>إلغاء</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}

            <div ref={messagesEndRef} />
          </div>

          <div className="voice-assistant-footer">
            {listening && (
              <div className="voice-listening-indicator">
                <span className="voice-pulse" />
                <span>أسمعك الآن... التسجيل لن يتوقف إلا إذا ضغطت إيقاف.</span>
              </div>
            )}

            <div className="voice-composer">
              <textarea
                className="form-control voice-textarea voice-chat-input"
                value={draft}
                onChange={(event) => {
                  setHasStartedConversation(true);
                  setDraft(event.target.value);
                }}
                disabled={composerDisabled}
                placeholder={
                  pendingResult
                    ? 'اكتب توضيحاً أو تعديلاً للعمليات الحالية، أو أكّد التنفيذ من الأعلى'
                    : 'اكتب طلبك هنا... مثال: صرفت 10000 بنزين واستلمت 250000 راتب'
                }
              />

              <div className="voice-composer-actions">
                {supported ? (
                  <button
                    className={`voice-round-btn${listening ? ' danger' : ''}`}
                    type="button"
                    onClick={listening ? stopListening : startListening}
                    disabled={composerDisabled}
                    aria-label={listening ? 'إيقاف التسجيل' : 'بدء التسجيل'}
                  >
                    <AppIcon name={listening ? 'close' : 'mic'} size={18} />
                  </button>
                ) : null}

                <button
                  className="btn btn-primary btn-with-icon voice-submit-btn"
                  type="button"
                  onClick={handleAnalyzeAndConfirm}
                  disabled={composerDisabled || !hasDraft}
                >
                  <AppIcon name={analyzing ? 'clock' : 'send'} size={16} />
                  <span>{analyzing ? 'جارٍ التحليل...' : pendingResult ? 'تحديث التحليل' : 'تنفيذ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
