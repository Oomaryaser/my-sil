'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildHabitSummary } from '@/lib/habits';
import { CAT_ICONS, CAT_NAMES, Expense, ExpenseType, Habit, IncomeSource, Salary, formatNum, formatDate, getDayName, getMonthName, todayFormatted } from '@/lib/types';
import ExpenseModal from '@/components/ExpenseModal';
import Toast from '@/components/Toast';
import PinLock from '@/components/PinLock';
import IncomePage from '@/components/IncomePage';
import CopyPlannedDialog from '@/components/CopyPlannedDialog';
import HabitsSection from '@/components/HabitsSection';

type Page = 'dashboard' | 'income' | 'habits' | 'planned' | 'actual' | 'history' | 'telegram';

interface MonthData {
  salary: Salary | null;
  planned: Expense[];
  actual: Expense[];
  income_sources: IncomeSource[];
  habits: Habit[];
}

export default function Home() {
  const [page, setPage] = useState<Page>('dashboard');
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [months, setMonths] = useState<Record<string, MonthData>>({});
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ExpenseType>('planned');

  // Toast
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });

  // Copy planned dialog
  const [copyDialog, setCopyDialog] = useState<{ fromMonth: string; toMonth: string; expenses: Expense[] } | null>(null);

  // ── HELPERS ────────────────────────────────────────────────
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  const getMonthData = useCallback((): MonthData => {
    return months[currentMonth] || { salary: null, planned: [], actual: [], income_sources: [], habits: [] };
  }, [months, currentMonth]);

  // ── LOAD ALL DATA ─────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/months');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMonths(data);
      return data as Record<string, MonthData>;
    } catch {
      showToast('خطأ في تحميل البيانات', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── CHECK: prompt to copy planned from previous month ─────
  // Runs when currentMonth changes (or data loads) — only if current month has no planned
  useEffect(() => {
    if (!months || Object.keys(months).length === 0) return;

    const current = months[currentMonth];
    const currentPlanned = current?.planned ?? [];
    if (currentPlanned.length > 0) return; // already has planned expenses

    // Find previous month
    const [y, m] = currentMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1); // m-2 because months are 0-indexed
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const prevData = months[prevMonth];
    const prevPlanned = prevData?.planned ?? [];
    if (prevPlanned.length === 0) return; // nothing to copy

    // Check we haven't already asked for this month this session
    const askedKey = `copy_asked_${currentMonth}`;
    if (sessionStorage.getItem(askedKey)) return;
    sessionStorage.setItem(askedKey, '1');

    // Show dialog
    setCopyDialog({ fromMonth: prevMonth, toMonth: currentMonth, expenses: prevPlanned });
  }, [currentMonth, months]);

  // ── COPY PLANNED: confirm handler ─────────────────────────
  const handleCopyConfirm = async (items: Expense[]) => {
    try {
      for (const e of items) {
        await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            month: currentMonth,
            name: e.name,
            amount: e.amount,
            category: e.category,
            notes: e.notes || '',
            type: 'planned',
          }),
        });
      }
      setCopyDialog(null);
      showToast(`✅ تم نسخ ${items.length} مصروف متوقع`);
      await loadAll();
    } catch {
      showToast('خطأ في النسخ', 'error');
    }
  };

  // ── THEME ──────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // ── EXPENSES ───────────────────────────────────────────────
  const handleAddExpense = async (data: {
    id: string; name: string; amount: number; category: string; notes: string; date?: string; type: ExpenseType;
  }) => {
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, month: currentMonth }),
      });
      if (!res.ok) throw new Error();
      setModalOpen(false);
      showToast('✅ تم الحفظ');
      await loadAll();
    } catch {
      showToast('خطأ في الحفظ', 'error');
    }
  };

  const deleteExpense = async (id: string, type: ExpenseType) => {
    try {
      const res = await fetch(`/api/expenses?id=${id}&type=${type}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('🗑️ تم الحذف');
      await loadAll();
    } catch {
      showToast('خطأ في الحذف', 'error');
    }
  };

  // ── DERIVED DATA ───────────────────────────────────────────
  const d = getMonthData();
  const incomeSources: IncomeSource[] = d.income_sources || [];
  const habits: Habit[] = d.habits || [];
  const totalIncome = incomeSources.reduce((s, src) => s + Number(src.paid_total ?? 0), 0);
  const totalExpectedIncome = incomeSources.reduce((s, src) => s + Number(src.expected_amount), 0);
  const sal = totalIncome || (d.salary ? Number(d.salary.total) : 0);
  const plannedTotal = d.planned.reduce((s, e) => s + Number(e.amount), 0);
  const actualTotal = d.actual.reduce((s, e) => s + Number(e.amount), 0);
  const balance = sal - actualTotal;
  const pct = sal > 0 ? Math.min(100, Math.round(actualTotal / sal * 100)) : 0;
  const habitSummary = buildHabitSummary(currentMonth, habits);

  // ── RENDER ─────────────────────────────────────────────────
  const navItems: { id: Page; icon: string; label: string }[] = [
    { id: 'dashboard', icon: '📊', label: 'لوحة التحكم' },
    { id: 'income',    icon: '💵', label: 'الدخل' },
    { id: 'habits',    icon: '✅', label: 'العادات' },
    { id: 'planned',   icon: '📋', label: 'المصاريف المتوقعة' },
    { id: 'actual',    icon: '🧾', label: 'المصاريف الفعلية' },
    { id: 'history',   icon: '📅', label: 'السجل الشهري' },
    { id: 'telegram',  icon: '✈️', label: 'بوت تليغرام' },
  ];

  return (
    <>
      {!unlocked && <PinLock onUnlocked={() => setUnlocked(true)} />}

      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
        <span className="mobile-title">💰 مدير الراتب</span>
        <span className="mobile-date">{todayFormatted()}</span>
        <button className="theme-toggle-mini" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="logo">
          <h1>💰 مدير الراتب</h1>
          <p>تتبع دخلك ومصاريفك</p>
        </div>

        <nav className="nav">
          {navItems.map(item => (
            <div
              key={item.id}
              className={`nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => { setPage(item.id); setSidebarOpen(false); }}
            >
              <span className="icon">{item.icon}</span> {item.label}
            </div>
          ))}
        </nav>

        <div className="month-selector">
          <label>الشهر الحالي</label>
          <input
            type="month"
            className="form-control"
            value={currentMonth}
            onChange={e => setCurrentMonth(e.target.value)}
          />
          <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️' : '🌙'}
            <span>{theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        {loading && (
          <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 300 }}>
            <span className="spinner" />
          </div>
        )}

        {/* Dashboard */}
        <div className={`page${page === 'dashboard' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2>لوحة التحكم 📊</h2>
            <p>{getMonthName(currentMonth)} — نظرة عامة &nbsp;·&nbsp; <span style={{ color: 'var(--accent)', fontWeight: 600 }}>اليوم: {todayFormatted()}</span></p>
          </div>

          <div className="cards-grid">
            <div className="stat-card blue">
              <div className="stat-label">الدخل المحصّل</div>
              <div className="stat-value blue">{formatNum(sal)}</div>
              <div className="stat-sub">من أصل {formatNum(totalExpectedIncome)}</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-label">المصاريف المتوقعة</div>
              <div className="stat-value purple">{formatNum(plannedTotal)}</div>
              <div className="stat-sub">{d.planned.length} مصروف مخطط</div>
            </div>
            <div className="stat-card red">
              <div className="stat-label">المصاريف الفعلية</div>
              <div className="stat-value red">{formatNum(actualTotal)}</div>
              <div className="stat-sub">{d.actual.length} معاملة</div>
              <div className="progress-wrap">
                <div className="progress-bar" style={{ width: `${pct}%`, background: pct > 80 ? 'var(--red)' : pct > 60 ? 'var(--orange)' : 'var(--accent)' }} />
              </div>
            </div>
            <div className={`stat-card ${balance >= 0 ? 'green' : 'red'}`}>
              <div className="stat-label">الرصيد المتبقي</div>
              <div className={`stat-value ${balance >= 0 ? 'green' : 'red'}`}>{formatNum(balance)}</div>
              <div className="stat-sub">{pct}% من الدخل صُرف</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>ملخص العادات لهذا الشهر</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage('habits')}>فتح المتابعة</button>
            </div>
            <div className="panel-body">
              {habits.length === 0 ? (
                <div className="empty-state"><div className="icon">✅</div><p>لا توجد عادات مضافة بعد. افتح قسم العادات لبدء التتبع الأسبوعي والشهري.</p></div>
              ) : (
                <>
                  <div className="summary-bar">
                    <div className="summary-item">
                      <div className="label">العادات النشطة</div>
                      <div className="val" style={{ color: 'var(--accent)' }}>{habits.length}</div>
                    </div>
                    <div className="summary-divider" />
                    <div className="summary-item">
                      <div className="label">التزام الشهر</div>
                      <div className="val" style={{ color: 'var(--green)' }}>{habitSummary.completionRate}%</div>
                    </div>
                    <div className="summary-divider" />
                    <div className="summary-item">
                      <div className="label">أفضل عادة</div>
                      <div className="val">{habitSummary.bestHabit ? `${habitSummary.bestHabit.icon} ${habitSummary.bestHabit.name}` : '—'}</div>
                    </div>
                    <div className="summary-divider" />
                    <div className="summary-item">
                      <div className="label">أفضل أسبوع</div>
                      <div className="val" style={{ color: 'var(--orange)' }}>{habitSummary.bestWeek ? `${habitSummary.bestWeek.rate}%` : '0%'}</div>
                    </div>
                  </div>

                  <div className="habit-dashboard-grid">
                    {habitSummary.weeklyStats.map((week) => (
                      <div key={week.label} className={`habit-dashboard-card ${week.status}`}>
                        <div className="habit-dashboard-head">
                          <strong>{week.label}</strong>
                          <span>{week.startDay}-{week.endDay}</span>
                        </div>
                        <div className="habit-dashboard-rate">{week.total > 0 ? `${week.rate}%` : '0%'}</div>
                        <div className="habit-dashboard-sub">{week.completed} / {week.total} إنجاز</div>
                        <div className="progress-wrap">
                          <div className="progress-bar" style={{ width: `${week.rate}%`, background: week.rate >= 80 ? 'var(--green)' : week.rate >= 50 ? 'var(--orange)' : 'var(--accent)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Category breakdown */}
          <div className="panel">
            <div className="panel-header"><h3>توزيع المصاريف الفعلية</h3></div>
            <div className="panel-body">
              {d.actual.length === 0 ? (
                <div className="empty-state"><div className="icon">📊</div><p>لا توجد مصاريف مسجلة هذا الشهر</p></div>
              ) : (() => {
                const cats: Record<string, number> = {};
                d.actual.forEach(e => { cats[e.category] = (cats[e.category] || 0) + Number(e.amount); });
                const maxVal = Math.max(...Object.values(cats));
                return Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13 }}>{CAT_ICONS[cat] || '📦'} {CAT_NAMES[cat] || cat}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{formatNum(amt)}</span>
                    </div>
                    <div className="progress-wrap">
                      <div className="progress-bar" style={{ width: `${Math.round(amt / maxVal * 100)}%`, background: 'var(--accent)' }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Recent */}
          <div className="panel">
            <div className="panel-header"><h3>آخر المصاريف</h3></div>
            <div className="panel-body">
              {d.actual.length === 0 ? (
                <div className="empty-state"><div className="icon">🧾</div><p>لا توجد مصاريف بعد</p></div>
              ) : [...d.actual].slice(0, 5).map(e => (
                <div key={e.id} className="expense-item">
                  <div className="expense-left">
                    <div className={`expense-icon cat-${e.category}`}>{CAT_ICONS[e.category] || '📦'}</div>
                    <div>
                      <div className="expense-name">{e.name}</div>
                      <div className="expense-cat">{CAT_NAMES[e.category] || 'أخرى'}{e.date ? ` · ${formatDate(e.date)}` : ''}</div>
                    </div>
                  </div>
                  <span className="expense-amount" style={{ color: 'var(--red)' }}>{formatNum(Number(e.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Income */}
        <div className={`page${page === 'income' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2>الدخل 💵</h2>
            <p>راتب · فريلانس · دخل جانبي</p>
          </div>
          <IncomePage
            month={currentMonth}
            sources={incomeSources}
            onRefresh={loadAll}
            showToast={showToast}
          />
        </div>

        {/* Habits */}
        <div className={`page${page === 'habits' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2>العادات ✅</h2>
            <p>متابعة يومية مع إحصائيات احترافية بنهاية كل أسبوع وشهر</p>
          </div>
          <HabitsSection
            month={currentMonth}
            habits={habits}
            onRefresh={loadAll}
            showToast={showToast}
          />
        </div>

        {/* Planned */}
        <div className={`page${page === 'planned' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2>المصاريف المتوقعة 📋</h2>
            <p>خطط مصاريفك قبل الشهر</p>
          </div>
          <div className="panel">
            <div className="panel-header">
              <h3>المصاريف المتوقعة</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setModalType('planned'); setModalOpen(true); }}>+ إضافة</button>
            </div>
            <div className="panel-body">
              {d.planned.length === 0 ? (
                <div className="empty-state"><div className="icon">📋</div><p>لا توجد مصاريف متوقعة — أضف واحدة!</p></div>
              ) : (
                <>
                  <div className="summary-bar">
                    <div className="summary-item"><div className="label">إجمالي المتوقع</div><div className="val" style={{ color: 'var(--accent)' }}>{formatNum(plannedTotal)}</div></div>
                    <div className="summary-divider" />
                    <div className="summary-item"><div className="label">عدد المصاريف</div><div className="val">{d.planned.length}</div></div>
                  </div>
                  {d.planned.map(e => (
                    <div key={e.id} className="expense-item">
                      <div className="expense-left">
                        <div className={`expense-icon cat-${e.category}`}>{CAT_ICONS[e.category] || '📦'}</div>
                        <div>
                          <div className="expense-name">{e.name}</div>
                          <div className="expense-cat">{CAT_NAMES[e.category] || 'أخرى'}{e.notes ? ` · ${e.notes}` : ''}</div>
                        </div>
                      </div>
                      <div className="expense-right">
                        <span className="expense-amount" style={{ color: 'var(--accent)' }}>{formatNum(Number(e.amount))}</span>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteExpense(e.id, 'planned')}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actual */}
        <div className={`page${page === 'actual' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2>المصاريف الفعلية 🧾</h2>
            <p>سجل مصاريفك اليومية</p>
          </div>
          <div className="panel">
            <div className="panel-header">
              <h3>المصاريف الفعلية</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setModalType('actual'); setModalOpen(true); }}>+ إضافة مصروف</button>
            </div>

            {/* Quick-add from planned */}
            {d.planned.length > 0 && (
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>📋 من المتوقعة:</span>
                <select
                  className="form-control"
                  style={{ flex: 1, minWidth: 160, fontSize: 13, padding: '7px 10px' }}
                  defaultValue=""
                  onChange={async e => {
                    const id = e.target.value;
                    if (!id) return;
                    e.target.value = '';
                    const src = d.planned.find(p => p.id === id);
                    if (!src) return;
                    try {
                      const res = await fetch('/api/expenses', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          id: Date.now().toString(),
                          month: currentMonth,
                          name: src.name,
                          amount: src.amount,
                          category: src.category,
                          notes: src.notes || '',
                          date: new Date().toISOString().slice(0, 10),
                          type: 'actual',
                        }),
                      });
                      if (!res.ok) throw new Error();
                      showToast(`✅ تم تسجيل "${src.name}" كمصروف فعلي`);
                      await loadAll();
                    } catch {
                      showToast('خطأ في التسجيل', 'error');
                    }
                  }}
                >
                  <option value="">اختر مصروفاً متوقعاً…</option>
                  {d.planned.map(p => (
                    <option key={p.id} value={p.id}>
                      {CAT_ICONS[p.category] || '📦'} {p.name} — {formatNum(Number(p.amount))}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="panel-body">
              {d.actual.length === 0 ? (
                <div className="empty-state"><div className="icon">🧾</div><p>لا توجد مصاريف — سجل أول مصروف!</p></div>
              ) : (
                <>
                  <div className="summary-bar">
                    <div className="summary-item"><div className="label">إجمالي الفعلي</div><div className="val" style={{ color: 'var(--red)' }}>{formatNum(actualTotal)}</div></div>
                    <div className="summary-divider" />
                    <div className="summary-item"><div className="label">الباقي</div><div className="val" style={{ color: balance >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatNum(balance)}</div></div>
                    <div className="summary-divider" />
                    <div className="summary-item"><div className="label">عدد المصاريف</div><div className="val">{d.actual.length}</div></div>
                  </div>
                  {(() => {
                    const byDate: Record<string, Expense[]> = {};
                    [...d.actual].forEach(e => {
                      const dt = e.date || 'غير محدد';
                      if (!byDate[dt]) byDate[dt] = [];
                      byDate[dt].push(e);
                    });
                    return Object.entries(byDate).map(([date, expenses]) => {
                      const dayTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
                      const dayLabel = date !== 'غير محدد'
                        ? `${getDayName(date)} · ${formatDate(date)}`
                        : 'غير محدد';
                      return (
                        <div key={date} style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
                            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{dayLabel}</span>
                            <span style={{ fontSize: 12, color: 'var(--red)' }}>{formatNum(dayTotal)}</span>
                          </div>
                          {expenses.map(e => (
                            <div key={e.id} className="expense-item">
                              <div className="expense-left">
                                <div className={`expense-icon cat-${e.category}`}>{CAT_ICONS[e.category] || '📦'}</div>
                                <div>
                                  <div className="expense-name">{e.name}</div>
                                  <div className="expense-cat">{CAT_NAMES[e.category] || 'أخرى'}{e.notes ? ` · ${e.notes}` : ''}</div>
                                </div>
                              </div>
                              <div className="expense-right">
                                <span className="expense-amount" style={{ color: 'var(--red)' }}>{formatNum(Number(e.amount))}</span>
                                <button className="btn btn-danger btn-sm" onClick={() => deleteExpense(e.id, 'actual')}>🗑️</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    });
                  })()}
                </>
              )}
            </div>
          </div>
        </div>

        {/* History */}
        <div className={`page${page === 'history' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2>السجل الشهري 📅</h2>
            <p>مراجعة كل شهر سابق</p>
          </div>
          <div className="panel">
            <div className="panel-header"><h3>الأشهر السابقة</h3></div>
            <div className="panel-body">
              {Object.keys(months).length === 0 ? (
                <div className="empty-state"><div className="icon">📅</div><p>لا يوجد سجل بعد</p></div>
              ) : Object.entries(months).sort((a, b) => b[0].localeCompare(a[0])).map(([m, md]) => {
                const mIncome = (md.income_sources || []).reduce((s: number, src: IncomeSource) => s + Number(src.paid_total ?? 0), 0);
                const mSal = mIncome || (md.salary ? Number(md.salary.total) : 0);
                const mActual = md.actual.reduce((s, e) => s + Number(e.amount), 0);
                const mBal = mSal - mActual;
                const mHabits = md.habits?.length || 0;
                return (
                  <div key={m} className="history-month" onClick={() => { setCurrentMonth(m); setPage('dashboard'); }}>
                    <div>
                      <div className="name">{getMonthName(m)}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>💵 {formatNum(mSal)} دخل · {md.actual.length} مصروف · {mHabits} عادات</div>
                    </div>
                    <div className="stats">
                      <span style={{ color: 'var(--red)' }}>صُرف {formatNum(mActual)}</span>
                      <span style={{ color: mBal >= 0 ? 'var(--green)' : 'var(--red)' }}>متبقي {formatNum(mBal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Telegram */}
        <div className={`page${page === 'telegram' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2>بوت تليغرام ✈️</h2>
            <p>تحكم في مصاريفك من تليغرام</p>
          </div>

          <div className="telegram-card">
            <h3>🤖 كيف تربط البوت؟</h3>
            <p>اتبع الخطوات التالية لإعداد بوت تليغرام يتصل بنظام إدارة راتبك:</p>
          </div>

          <div className="panel">
            <div className="panel-header"><h3>الخطوة 1: إنشاء البوت</h3></div>
            <div className="panel-body">
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.8 }}>
                1. افتح تليغرام وابحث عن <strong style={{ color: 'var(--accent)' }}>@BotFather</strong><br />
                2. اكتب <code style={{ background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>/newbot</code><br />
                3. أعطه اسم للبوت مثل &quot;Salary Manager Bot&quot;<br />
                4. احفظ الـ <strong style={{ color: 'var(--accent)' }}>API Token</strong> الذي سيعطيك إياه
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h3>أوامر البوت</h3></div>
            <div className="panel-body">
              {[
                { icon: '📝', cmd: '/salary 5000', desc: 'تسجيل راتب الشهر', cat: 'cat-food' },
                { icon: '💸', cmd: '/spend 50 غداء', desc: 'تسجيل مصروف فعلي', cat: 'cat-transport' },
                { icon: '📋', cmd: '/plan 300 ايجار', desc: 'إضافة مصروف متوقع', cat: 'cat-bills' },
                { icon: '📊', cmd: '/summary', desc: 'ملخص الشهر كاملاً', cat: 'cat-health' },
                { icon: '💰', cmd: '/balance', desc: 'الرصيد المتبقي', cat: 'cat-entertainment' },
                { icon: '🗓️', cmd: '/today', desc: 'مصاريف اليوم فقط', cat: 'cat-other' },
              ].map(item => (
                <div key={item.cmd} className="expense-item">
                  <div className="expense-left">
                    <div className={`expense-icon ${item.cat}`}>{item.icon}</div>
                    <div>
                      <div className="expense-name">{item.cmd}</div>
                      <div className="expense-cat">{item.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Copy Planned Dialog */}
      {copyDialog && (
        <CopyPlannedDialog
          fromMonth={copyDialog.fromMonth}
          toMonth={copyDialog.toMonth}
          expenses={copyDialog.expenses}
          onConfirm={handleCopyConfirm}
          onSkip={() => setCopyDialog(null)}
        />
      )}

      {/* Modal */}
      <ExpenseModal
        isOpen={modalOpen}
        type={modalType}
        onClose={() => setModalOpen(false)}
        onSave={handleAddExpense}
      />

      {/* Toast */}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </>
  );
}
