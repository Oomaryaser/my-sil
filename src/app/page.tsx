'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminPanel from '@/components/AdminPanel';
import AppIcon from '@/components/AppIcon';
import AuthScreen from '@/components/AuthScreen';
import CopyPlannedDialog from '@/components/CopyPlannedDialog';
import ExpenseModal from '@/components/ExpenseModal';
import HabitsSection from '@/components/HabitsSection';
import IncomePage from '@/components/IncomePage';
import RequestsBoard from '@/components/RequestsBoard';
import TodoBoard from '@/components/TodoBoard';
import Toast from '@/components/Toast';
import { buildHabitSummary } from '@/lib/habits';
import { AppIconName, normalizeIconName } from '@/lib/icons';
import {
  AdminUser,
  AppUser,
  CAT_ICONS,
  CAT_NAMES,
  Expense,
  ExpenseType,
  FeatureRequest,
  Habit,
  IncomeSource,
  Salary,
  TodoItem,
  formatDate,
  formatNum,
  getDayName,
  getMonthName,
  todayFormatted,
} from '@/lib/types';

type Page = 'dashboard' | 'income' | 'todo' | 'habits' | 'planned' | 'actual' | 'history' | 'telegram' | 'requests' | 'admin';

interface MonthData {
  salary: Salary | null;
  planned: Expense[];
  actual: Expense[];
  income_sources: IncomeSource[];
  habits: Habit[];
}

interface AuthPayload {
  authenticated: boolean;
  user: AppUser | null;
  showTodoAnnouncement?: boolean;
}

function isSubscriptionActive(status: string, expiresAt: string) {
  return status === 'active' && new Date(expiresAt).getTime() > Date.now();
}

export default function Home() {
  const [page, setPage] = useState<Page>('dashboard');
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [months, setMonths] = useState<Record<string, MonthData>>({});
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [featureLoading, setFeatureLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminRequests, setAdminRequests] = useState<FeatureRequest[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoLoading, setTodoLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ExpenseType>('planned');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [copyDialog, setCopyDialog] = useState<{ fromMonth: string; toMonth: string; expenses: Expense[] } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((current) => ({ ...current, visible: false })), 3000);
  }, []);

  const getErrorMessage = useCallback(async (res: Response, fallback: string) => {
    try {
      const data = await res.json() as { error?: string };
      return data.error || fallback;
    } catch {
      return fallback;
    }
  }, []);

  const canUseProduct = Boolean(user && (user.role === 'admin' || user.isSubscriptionActive));
  const isAdmin = user?.role === 'admin';

  const getMonthData = useCallback((): MonthData => {
    return months[currentMonth] || { salary: null, planned: [], actual: [], income_sources: [], habits: [] };
  }, [currentMonth, months]);

  const loadSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      const res = await fetch('/api/auth');
      const data = await res.json() as AuthPayload;
      setUser(data.authenticated ? data.user : null);
      if (data.authenticated && data.showTodoAnnouncement) {
        showToast('تم اضافة خاصية جديدة وهي todo');
      }
    } catch {
      setUser(null);
    } finally {
      setSessionLoading(false);
    }
  }, [showToast]);

  const loadAll = useCallback(async () => {
    if (!canUseProduct) {
      setMonths({});
      return null;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/months');
      if (res.status === 401) {
        setUser(null);
        setMonths({});
        return null;
      }
      if (res.status === 403) {
        setMonths({});
        return null;
      }
      if (!res.ok) {
        throw new Error(await getErrorMessage(res, 'خطأ في تحميل البيانات'));
      }
      const data = await res.json() as Record<string, MonthData>;
      setMonths(data);
      return data;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'خطأ في تحميل البيانات', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [canUseProduct, getErrorMessage, showToast]);

  const loadFeatureRequests = useCallback(async () => {
    if (!user) {
      setFeatureRequests([]);
      return;
    }

    setFeatureLoading(true);
    try {
      const res = await fetch('/api/feature-requests');
      if (res.status === 401) {
        setUser(null);
        setFeatureRequests([]);
        return;
      }
      if (!res.ok) {
        throw new Error(await getErrorMessage(res, 'تعذر تحميل طلبات التطوير'));
      }
      const data = await res.json() as FeatureRequest[];
      setFeatureRequests(data);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر تحميل طلبات التطوير', 'error');
    } finally {
      setFeatureLoading(false);
    }
  }, [getErrorMessage, showToast, user]);

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) {
      setAdminUsers([]);
      setAdminRequests([]);
      return;
    }

    setAdminLoading(true);
    try {
      const [usersRes, requestsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/feature-requests'),
      ]);

      if (!usersRes.ok) {
        throw new Error(await getErrorMessage(usersRes, 'تعذر تحميل المستخدمين'));
      }
      if (!requestsRes.ok) {
        throw new Error(await getErrorMessage(requestsRes, 'تعذر تحميل التطويرات'));
      }

      const usersData = await usersRes.json() as Array<Omit<AdminUser, 'isSubscriptionActive'>>;
      const requestsData = await requestsRes.json() as FeatureRequest[];

      setAdminUsers(
        usersData.map((item) => ({
          ...item,
          isSubscriptionActive: isSubscriptionActive(item.subscription_status, item.subscription_expires_at),
        })),
      );
      setAdminRequests(requestsData);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر تحميل لوحة الإدارة', 'error');
    } finally {
      setAdminLoading(false);
    }
  }, [getErrorMessage, isAdmin, showToast]);

  const loadTodos = useCallback(async () => {
    if (!canUseProduct) {
      setTodos([]);
      return;
    }

    setTodoLoading(true);
    try {
      const res = await fetch('/api/todos');
      if (res.status === 401) {
        setUser(null);
        setTodos([]);
        return;
      }
      if (res.status === 403) {
        setTodos([]);
        return;
      }
      if (!res.ok) {
        throw new Error(await getErrorMessage(res, 'تعذر تحميل المهام'));
      }
      const data = await res.json() as TodoItem[];
      setTodos(data);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر تحميل المهام', 'error');
    } finally {
      setTodoLoading(false);
    }
  }, [canUseProduct, getErrorMessage, showToast]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (user) {
      loadFeatureRequests();
    } else {
      setFeatureRequests([]);
      setAdminUsers([]);
      setAdminRequests([]);
      setMonths({});
      setTodos([]);
    }
  }, [loadFeatureRequests, user]);

  useEffect(() => {
    if (canUseProduct) {
      loadAll();
    } else {
      setMonths({});
    }
  }, [canUseProduct, loadAll]);

  useEffect(() => {
    if (canUseProduct) {
      loadTodos();
    } else {
      setTodos([]);
    }
  }, [canUseProduct, loadTodos]);

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin, loadAdminData]);

  useEffect(() => {
    if (!user) return;
    if (!canUseProduct && page !== 'requests') {
      setPage('requests');
    }
  }, [canUseProduct, page, user]);

  useEffect(() => {
    if (!canUseProduct || Object.keys(months).length === 0) return;

    const current = months[currentMonth];
    const currentPlanned = current?.planned ?? [];
    if (currentPlanned.length > 0) return;

    const [year, monthNumber] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, monthNumber - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prevData = months[prevMonth];
    const prevPlanned = prevData?.planned ?? [];
    if (prevPlanned.length === 0) return;

    const askedKey = `copy_asked_${currentMonth}`;
    if (sessionStorage.getItem(askedKey)) return;
    sessionStorage.setItem(askedKey, '1');
    setCopyDialog({ fromMonth: prevMonth, toMonth: currentMonth, expenses: prevPlanned });
  }, [canUseProduct, currentMonth, months]);

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleAuthenticated = useCallback((payload: { user: AppUser; showTodoAnnouncement?: boolean }) => {
    const nextUser = payload.user;
    setUser(nextUser);
    setPage(nextUser.role === 'admin' ? 'admin' : nextUser.isSubscriptionActive ? 'dashboard' : 'requests');
    if (payload.showTodoAnnouncement) {
      showToast('تم اضافة خاصية جديدة وهي todo');
    }
  }, [showToast]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } finally {
      setUser(null);
      setMonths({});
      setFeatureRequests([]);
      setAdminUsers([]);
      setAdminRequests([]);
      setTodos([]);
      setPage('dashboard');
      setSidebarOpen(false);
      showToast('تم تسجيل الخروج');
    }
  }, [showToast]);

  const handleCopyConfirm = async (items: Expense[]) => {
    try {
      for (const expense of items) {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            month: currentMonth,
            name: expense.name,
            amount: expense.amount,
            category: expense.category,
            notes: expense.notes || '',
            type: 'planned',
          }),
        });

        if (!res.ok) {
          throw new Error(await getErrorMessage(res, 'خطأ في النسخ'));
        }
      }

      setCopyDialog(null);
      showToast(`تم نسخ ${items.length} مصروف متوقع`);
      await loadAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'خطأ في النسخ', 'error');
    }
  };

  const handleAddExpense = async (data: {
    id: string;
    name: string;
    amount: number;
    category: string;
    notes: string;
    date?: string;
    type: ExpenseType;
  }) => {
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, month: currentMonth }),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, 'خطأ في الحفظ'));
      }

      setModalOpen(false);
      showToast('تم الحفظ');
      await loadAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'خطأ في الحفظ', 'error');
    }
  };

  const deleteExpense = async (id: string, type: ExpenseType) => {
    try {
      const res = await fetch(`/api/expenses?id=${id}&type=${type}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(await getErrorMessage(res, 'خطأ في الحذف'));
      }
      showToast('تم الحذف');
      await loadAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'خطأ في الحذف', 'error');
    }
  };

  const submitFeatureRequest = async (payload: { title: string; details: string }) => {
    try {
      const res = await fetch('/api/feature-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, 'تعذر إرسال الملاحظة'));
      }

      showToast('تم إرسال الملاحظة');
      await loadFeatureRequests();
      if (isAdmin) {
        await loadAdminData();
      }
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر إرسال الملاحظة', 'error');
      return false;
    }
  };

  const saveAdminUser = async (payload: { userId: string; subscriptionStatus: 'active' | 'suspended'; subscriptionExpiresAt: string }) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, 'تعذر حفظ الاشتراك'));
      }

      showToast('تم تحديث الاشتراك');
      await loadAdminData();
      if (user?.id === payload.userId) {
        await loadSession();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر حفظ الاشتراك', 'error');
    }
  };

  const saveAdminRequest = async (payload: { requestId: string; status: FeatureRequest['status']; adminNote: string }) => {
    try {
      const res = await fetch('/api/admin/feature-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, 'تعذر حفظ تحديث الطلب'));
      }

      showToast('تم تحديث الطلب');
      await loadAdminData();
      await loadFeatureRequests();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر حفظ تحديث الطلب', 'error');
    }
  };

  const d = getMonthData();
  const incomeSources: IncomeSource[] = d.income_sources || [];
  const habits: Habit[] = d.habits || [];
  const totalIncome = incomeSources.reduce((sum, src) => sum + Number(src.paid_total ?? 0), 0);
  const totalExpectedIncome = incomeSources.reduce((sum, src) => sum + Number(src.expected_amount), 0);
  const sal = totalIncome || (d.salary ? Number(d.salary.total) : 0);
  const plannedTotal = d.planned.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const actualTotal = d.actual.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const balance = sal - actualTotal;
  const pct = sal > 0 ? Math.min(100, Math.round((actualTotal / sal) * 100)) : 0;
  const habitSummary = buildHabitSummary(currentMonth, habits);
  const productNavItems: Array<{ id: Page; icon: AppIconName; label: string }> = [
    { id: 'dashboard', icon: 'dashboard', label: 'لوحة التحكم' },
    { id: 'income', icon: 'income', label: 'الدخل' },
    { id: 'todo', icon: 'todo', label: 'المهام' },
    { id: 'habits', icon: 'habits', label: 'العادات' },
    { id: 'planned', icon: 'planned', label: 'المصاريف المتوقعة' },
    { id: 'actual', icon: 'receipt', label: 'المصاريف الفعلية' },
    { id: 'history', icon: 'history', label: 'السجل الشهري' },
    { id: 'telegram', icon: 'telegram', label: 'بوت تليغرام' },
  ];
  const secondaryNavItems: Array<{ id: Page; icon: AppIconName; label: string }> = [
    { id: 'requests', icon: 'requests', label: 'اكتب تطويرات او ملاحظات' },
    ...(isAdmin ? [{ id: 'admin' as Page, icon: 'admin' as AppIconName, label: 'إدارة SaaS' }] : []),
  ];
  const navItems: Array<{ id: Page; icon: AppIconName; label: string }> = [
    ...(canUseProduct ? productNavItems : []),
    ...secondaryNavItems,
  ];

  if (sessionLoading) {
    return (
      <>
        <div className="auth-shell">
          <div className="auth-loading-card">
            <span className="spinner" />
            <p>جارٍ تحميل الجلسة...</p>
          </div>
        </div>
        <Toast message={toast.message} type={toast.type} visible={toast.visible} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen
          theme={theme}
          onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          onAuthenticated={handleAuthenticated}
          showToast={showToast}
        />
        <Toast message={toast.message} type={toast.type} visible={toast.visible} />
      </>
    );
  }

  return (
    <>
      <div className="mobile-topbar">
        <button className="hamburger" onClick={() => setSidebarOpen(true)}>
          <AppIcon name="menu" size={20} />
        </button>
        <span className="mobile-title">
          <AppIcon name="logo" size={18} />
          <span>مدير الراتب</span>
        </span>
        <span className="mobile-date">{todayFormatted()}</span>
        <button className="theme-toggle-mini" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>
          <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
      </div>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="logo">
          <h1 className="brand-title">
            <AppIcon name="logo" size={20} />
            <span>مدير الراتب</span>
          </h1>
          <p>نسخة SaaS متعددة المستخدمين</p>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => { setPage(item.id); setSidebarOpen(false); }}
            >
              <span className="icon"><AppIcon name={item.icon} size={18} /></span> {item.label}
            </div>
          ))}
        </nav>

        <div className="account-card">
          <div className="account-card-head">
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <span className={`status-chip ${user.role === 'admin' ? 'admin' : canUseProduct ? 'active' : 'suspended'}`}>
              {user.role === 'admin' ? 'مشرف' : canUseProduct ? 'اشتراك فعال' : 'اشتراك موقوف'}
            </span>
          </div>

          <p className="account-expiry">
            ينتهي الاشتراك في {formatDate(String(user.subscription_expires_at).slice(0, 10))}
          </p>

          {canUseProduct && (
            <div className="month-selector account-month-selector">
              <label>الشهر الحالي</label>
              <input
                type="month"
                className="form-control"
                value={currentMonth}
                onChange={(event) => setCurrentMonth(event.target.value)}
              />
            </div>
          )}

          <button className="theme-toggle btn-with-icon" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>
            <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            <span>{theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
          </button>

          <button className="btn btn-ghost account-logout btn-with-icon" onClick={handleLogout}>
            <AppIcon name="close" size={16} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      <main className="main">
        {loading && (
          <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 300 }}>
            <span className="spinner" />
          </div>
        )}

        {!canUseProduct && (
          <div className="subscription-banner">
            اشتراكك موقوف حالياً. تقدر تتابع طلبات التطوير من هنا، وبمجرد التفعيل ترجع كل صفحات النظام.
          </div>
        )}

        {canUseProduct && (
          <>
            <div className={`page${page === 'dashboard' ? ' active fade-in' : ''}`}>
              <div className="page-header">
                <h2 className="title-with-icon"><AppIcon name="dashboard" size={22} /><span>لوحة التحكم</span></h2>
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
                  <h3 className="title-with-icon"><AppIcon name="habits" size={18} /><span>ملخص العادات لهذا الشهر</span></h3>
                  <button className="btn btn-ghost btn-sm btn-with-icon" onClick={() => setPage('habits')}>
                    <AppIcon name="habits" size={14} />
                    <span>فتح المتابعة</span>
                  </button>
                </div>
                <div className="panel-body">
                  {habits.length === 0 ? (
                    <div className="empty-state"><div className="icon"><AppIcon name="habits" size={28} /></div><p>لا توجد عادات مضافة بعد. افتح قسم العادات لبدء التتبع الأسبوعي والشهري.</p></div>
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
                          <div className="val inline-icon-value">
                            {habitSummary.bestHabit ? (
                              <>
                                <AppIcon name={normalizeIconName(habitSummary.bestHabit.icon, 'sparkles')} size={16} />
                                <span>{habitSummary.bestHabit.name}</span>
                              </>
                            ) : '—'}
                          </div>
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

              <div className="panel">
                <div className="panel-header"><h3 className="title-with-icon"><AppIcon name="chart" size={18} /><span>توزيع المصاريف الفعلية</span></h3></div>
                <div className="panel-body">
                  {d.actual.length === 0 ? (
                    <div className="empty-state"><div className="icon"><AppIcon name="chart" size={28} /></div><p>لا توجد مصاريف مسجلة هذا الشهر</p></div>
                  ) : (() => {
                    const cats: Record<string, number> = {};
                    d.actual.forEach((expense) => {
                      cats[expense.category] = (cats[expense.category] || 0) + Number(expense.amount);
                    });
                    const maxVal = Math.max(...Object.values(cats));
                    return Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                      <div key={cat} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span className="inline-icon-value" style={{ fontSize: 13 }}>
                            <AppIcon name={CAT_ICONS[cat] || 'other'} size={14} />
                            <span>{CAT_NAMES[cat] || cat}</span>
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{formatNum(amt)}</span>
                        </div>
                        <div className="progress-wrap">
                          <div className="progress-bar" style={{ width: `${Math.round((amt / maxVal) * 100)}%`, background: 'var(--accent)' }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header"><h3 className="title-with-icon"><AppIcon name="receipt" size={18} /><span>آخر المصاريف</span></h3></div>
                <div className="panel-body">
                  {d.actual.length === 0 ? (
                    <div className="empty-state"><div className="icon"><AppIcon name="receipt" size={28} /></div><p>لا توجد مصاريف بعد</p></div>
                  ) : [...d.actual].slice(0, 5).map((expense) => (
                    <div key={expense.id} className="expense-item">
                      <div className="expense-left">
                        <div className={`expense-icon cat-${expense.category}`}><AppIcon name={CAT_ICONS[expense.category] || 'other'} size={18} /></div>
                        <div>
                          <div className="expense-name">{expense.name}</div>
                          <div className="expense-cat">{CAT_NAMES[expense.category] || 'أخرى'}{expense.date ? ` · ${formatDate(expense.date)}` : ''}</div>
                        </div>
                      </div>
                      <span className="expense-amount" style={{ color: 'var(--red)' }}>{formatNum(Number(expense.amount))}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`page${page === 'income' ? ' active fade-in' : ''}`}>
              <div className="page-header">
                <h2 className="title-with-icon"><AppIcon name="income" size={22} /><span>الدخل</span></h2>
                <p>راتب · فريلانس · دخل جانبي</p>
              </div>
              <IncomePage
                month={currentMonth}
                sources={incomeSources}
                onRefresh={loadAll}
                showToast={showToast}
              />
            </div>

            <div className={`page${page === 'todo' ? ' active fade-in' : ''}`}>
              <div className="page-header">
                <h2 className="title-with-icon"><AppIcon name="todo" size={22} /><span>المهام اليومية</span></h2>
                <p>تابع مهامك اليومية وأنجزها خطوة بخطوة</p>
              </div>
              <TodoBoard
                todos={todos}
                loading={todoLoading}
                onRefresh={loadTodos}
                showToast={showToast}
              />
            </div>

            <div className={`page${page === 'habits' ? ' active fade-in' : ''}`}>
              <div className="page-header">
                <h2 className="title-with-icon"><AppIcon name="habits" size={22} /><span>العادات</span></h2>
                <p>متابعة يومية مع إحصائيات احترافية بنهاية كل أسبوع وشهر</p>
              </div>
              <HabitsSection
                month={currentMonth}
                habits={habits}
                onRefresh={loadAll}
                showToast={showToast}
              />
            </div>

            <div className={`page${page === 'planned' ? ' active fade-in' : ''}`}>
              <div className="page-header">
                <h2 className="title-with-icon"><AppIcon name="planned" size={22} /><span>المصاريف المتوقعة</span></h2>
                <p>خطط مصاريفك قبل الشهر</p>
              </div>
              <div className="panel">
                <div className="panel-header">
                  <h3 className="title-with-icon"><AppIcon name="planned" size={18} /><span>المصاريف المتوقعة</span></h3>
                  <button className="btn btn-primary btn-sm btn-with-icon" onClick={() => { setModalType('planned'); setModalOpen(true); }}>
                    <AppIcon name="plus" size={14} />
                    <span>إضافة</span>
                  </button>
                </div>
                <div className="panel-body">
                  {d.planned.length === 0 ? (
                    <div className="empty-state"><div className="icon"><AppIcon name="planned" size={28} /></div><p>لا توجد مصاريف متوقعة — أضف واحدة!</p></div>
                  ) : (
                    <>
                      <div className="summary-bar">
                        <div className="summary-item"><div className="label">إجمالي المتوقع</div><div className="val" style={{ color: 'var(--accent)' }}>{formatNum(plannedTotal)}</div></div>
                        <div className="summary-divider" />
                        <div className="summary-item"><div className="label">عدد المصاريف</div><div className="val">{d.planned.length}</div></div>
                      </div>
                      {d.planned.map((expense) => (
                        <div key={expense.id} className="expense-item">
                          <div className="expense-left">
                            <div className={`expense-icon cat-${expense.category}`}><AppIcon name={CAT_ICONS[expense.category] || 'other'} size={18} /></div>
                            <div>
                              <div className="expense-name">{expense.name}</div>
                              <div className="expense-cat">{CAT_NAMES[expense.category] || 'أخرى'}{expense.notes ? ` · ${expense.notes}` : ''}</div>
                            </div>
                          </div>
                          <div className="expense-right">
                            <span className="expense-amount" style={{ color: 'var(--accent)' }}>{formatNum(Number(expense.amount))}</span>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteExpense(expense.id, 'planned')}><AppIcon name="trash" size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className={`page${page === 'actual' ? ' active fade-in' : ''}`}>
              <div className="page-header">
                <h2 className="title-with-icon"><AppIcon name="receipt" size={22} /><span>المصاريف الفعلية</span></h2>
                <p>سجل مصاريفك اليومية</p>
              </div>
              <div className="panel">
                <div className="panel-header">
                  <h3 className="title-with-icon"><AppIcon name="receipt" size={18} /><span>المصاريف الفعلية</span></h3>
                  <button className="btn btn-primary btn-sm btn-with-icon" onClick={() => { setModalType('actual'); setModalOpen(true); }}>
                    <AppIcon name="plus" size={14} />
                    <span>إضافة مصروف</span>
                  </button>
                </div>

                {d.planned.length > 0 && (
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="inline-icon-value" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>
                      <AppIcon name="planned" size={14} />
                      <span>من المتوقعة:</span>
                    </span>
                    <select
                      className="form-control"
                      style={{ flex: 1, minWidth: 160, fontSize: 13, padding: '7px 10px' }}
                      defaultValue=""
                      onChange={async (event) => {
                        const id = event.target.value;
                        if (!id) return;
                        event.target.value = '';
                        const src = d.planned.find((plannedExpense) => plannedExpense.id === id);
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
                          if (!res.ok) {
                            throw new Error(await getErrorMessage(res, 'خطأ في التسجيل'));
                          }
                          showToast(`تم تسجيل "${src.name}" كمصروف فعلي`);
                          await loadAll();
                        } catch (error) {
                          showToast(error instanceof Error ? error.message : 'خطأ في التسجيل', 'error');
                        }
                      }}
                    >
                      <option value="">اختر مصروفاً متوقعاً…</option>
                      {d.planned.map((plannedExpense) => (
                        <option key={plannedExpense.id} value={plannedExpense.id}>
                          {plannedExpense.name} — {formatNum(Number(plannedExpense.amount))}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="panel-body">
                  {d.actual.length === 0 ? (
                    <div className="empty-state"><div className="icon"><AppIcon name="receipt" size={28} /></div><p>لا توجد مصاريف — سجل أول مصروف!</p></div>
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
                        [...d.actual].forEach((expense) => {
                          const date = expense.date || 'غير محدد';
                          if (!byDate[date]) byDate[date] = [];
                          byDate[date].push(expense);
                        });
                        return Object.entries(byDate).map(([date, expenses]) => {
                          const dayTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
                          const dayLabel = date !== 'غير محدد' ? `${getDayName(date)} · ${formatDate(date)}` : 'غير محدد';
                          return (
                            <div key={date} style={{ marginBottom: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
                                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{dayLabel}</span>
                                <span style={{ fontSize: 12, color: 'var(--red)' }}>{formatNum(dayTotal)}</span>
                              </div>
                              {expenses.map((expense) => (
                                <div key={expense.id} className="expense-item">
                                  <div className="expense-left">
                                    <div className={`expense-icon cat-${expense.category}`}><AppIcon name={CAT_ICONS[expense.category] || 'other'} size={18} /></div>
                                    <div>
                                      <div className="expense-name">{expense.name}</div>
                                      <div className="expense-cat">{CAT_NAMES[expense.category] || 'أخرى'}{expense.notes ? ` · ${expense.notes}` : ''}</div>
                                    </div>
                                  </div>
                                  <div className="expense-right">
                                    <span className="expense-amount" style={{ color: 'var(--red)' }}>{formatNum(Number(expense.amount))}</span>
                                    <button className="btn btn-danger btn-sm" onClick={() => deleteExpense(expense.id, 'actual')}><AppIcon name="trash" size={14} /></button>
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

            <div className={`page${page === 'history' ? ' active fade-in' : ''}`}>
              <div className="page-header">
                <h2 className="title-with-icon"><AppIcon name="history" size={22} /><span>السجل الشهري</span></h2>
                <p>مراجعة كل شهر سابق</p>
              </div>
              <div className="panel">
                <div className="panel-header"><h3 className="title-with-icon"><AppIcon name="calendar" size={18} /><span>الأشهر السابقة</span></h3></div>
                <div className="panel-body">
                  {Object.keys(months).length === 0 ? (
                    <div className="empty-state"><div className="icon"><AppIcon name="calendar" size={28} /></div><p>لا يوجد سجل بعد</p></div>
                  ) : Object.entries(months).sort((a, b) => b[0].localeCompare(a[0])).map(([month, monthData]) => {
                    const monthIncome = (monthData.income_sources || []).reduce((sum: number, src: IncomeSource) => sum + Number(src.paid_total ?? 0), 0);
                    const monthSalary = monthIncome || (monthData.salary ? Number(monthData.salary.total) : 0);
                    const monthActual = monthData.actual.reduce((sum, expense) => sum + Number(expense.amount), 0);
                    const monthBalance = monthSalary - monthActual;
                    const monthHabits = monthData.habits?.length || 0;
                    return (
                      <div key={month} className="history-month" onClick={() => { setCurrentMonth(month); setPage('dashboard'); }}>
                        <div>
                          <div className="name">{getMonthName(month)}</div>
                          <div className="inline-icon-value" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                            <AppIcon name="wallet" size={14} />
                            <span>{formatNum(monthSalary)} دخل · {monthData.actual.length} مصروف · {monthHabits} عادات</span>
                          </div>
                        </div>
                        <div className="stats">
                          <span style={{ color: 'var(--red)' }}>صُرف {formatNum(monthActual)}</span>
                          <span style={{ color: monthBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>متبقي {formatNum(monthBalance)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={`page${page === 'telegram' ? ' active fade-in' : ''}`}>
              <div className="page-header">
                <h2 className="title-with-icon"><AppIcon name="telegram" size={22} /><span>بوت تليغرام</span></h2>
                <p>تحكم في مصاريفك من تليغرام</p>
              </div>

              <div className="telegram-card">
                <h3 className="title-with-icon"><AppIcon name="telegram" size={18} /><span>كيف تربط البوت؟</span></h3>
                <p>اتبع الخطوات التالية لإعداد بوت تليغرام يتصل بنظام إدارة راتبك:</p>
              </div>

              <div className="panel">
                <div className="panel-header"><h3 className="title-with-icon"><AppIcon name="plus" size={18} /><span>الخطوة 1: إنشاء البوت</span></h3></div>
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
                <div className="panel-header"><h3 className="title-with-icon"><AppIcon name="send" size={18} /><span>أوامر البوت</span></h3></div>
                <div className="panel-body">
                  {[
                    { icon: 'note' as AppIconName, cmd: '/salary 5000', desc: 'تسجيل راتب الشهر', cat: 'cat-food' },
                    { icon: 'receipt' as AppIconName, cmd: '/spend 50 غداء', desc: 'تسجيل مصروف فعلي', cat: 'cat-transport' },
                    { icon: 'planned' as AppIconName, cmd: '/plan 300 ايجار', desc: 'إضافة مصروف متوقع', cat: 'cat-bills' },
                    { icon: 'chart' as AppIconName, cmd: '/summary', desc: 'ملخص الشهر كاملاً', cat: 'cat-health' },
                    { icon: 'wallet' as AppIconName, cmd: '/balance', desc: 'الرصيد المتبقي', cat: 'cat-entertainment' },
                    { icon: 'calendar' as AppIconName, cmd: '/today', desc: 'مصاريف اليوم فقط', cat: 'cat-other' },
                  ].map((item) => (
                    <div key={item.cmd} className="expense-item">
                      <div className="expense-left">
                        <div className={`expense-icon ${item.cat}`}><AppIcon name={item.icon} size={18} /></div>
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
          </>
        )}

        <div className={`page${page === 'requests' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2 className="title-with-icon"><AppIcon name="requests" size={22} /><span>التطويرات والملاحظات</span></h2>
            <p>أي طلب تكتبه هنا يوصلك مباشرة للوحة الإدارة مع متابعة الحالة والملاحظات</p>
          </div>
          <RequestsBoard
            requests={featureRequests}
            loading={featureLoading}
            canUseProduct={canUseProduct}
            onSubmit={submitFeatureRequest}
          />
        </div>

        {isAdmin && (
          <div className={`page${page === 'admin' ? ' active fade-in' : ''}`}>
            <div className="page-header">
              <h2 className="title-with-icon"><AppIcon name="admin" size={22} /><span>إدارة SaaS</span></h2>
              <p>مستخدمون، اشتراكات، وقائمة التطويرات من مكان واحد</p>
            </div>
            <AdminPanel
              users={adminUsers}
              requests={adminRequests}
              loading={adminLoading}
              onSaveUser={saveAdminUser}
              onSaveRequest={saveAdminRequest}
            />
          </div>
        )}
      </main>

      {canUseProduct && copyDialog && (
        <CopyPlannedDialog
          fromMonth={copyDialog.fromMonth}
          toMonth={copyDialog.toMonth}
          expenses={copyDialog.expenses}
          onConfirm={handleCopyConfirm}
          onSkip={() => setCopyDialog(null)}
        />
      )}

      {canUseProduct && (
        <ExpenseModal
          key={`${modalType}-${modalOpen ? 'open' : 'closed'}-${currentMonth}`}
          isOpen={modalOpen}
          type={modalType}
          onClose={() => setModalOpen(false)}
          onSave={handleAddExpense}
        />
      )}

      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </>
  );
}
