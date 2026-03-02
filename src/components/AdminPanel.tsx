'use client';

import { useEffect, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import { AdminUser, FeatureRequest, FeatureRequestStatus } from '@/lib/types';

interface Props {
  users: AdminUser[];
  requests: FeatureRequest[];
  loading: boolean;
  onSaveUser: (payload: { userId: string; subscriptionStatus: 'active' | 'suspended'; subscriptionExpiresAt: string }) => Promise<void>;
  onSaveRequest: (payload: { requestId: string; status: FeatureRequestStatus; adminNote: string }) => Promise<void>;
}

interface UserDraft {
  subscriptionStatus: 'active' | 'suspended';
  subscriptionExpiresAt: string;
}

interface RequestDraft {
  status: FeatureRequestStatus;
  adminNote: string;
}

const REQUEST_STATUS_LABEL: Record<FeatureRequestStatus, string> = {
  pending: 'بانتظار المراجعة',
  planned: 'مجدولة',
  in_progress: 'قيد التطوير',
  done: 'مكتملة',
};

export default function AdminPanel({ users, requests, loading, onSaveUser, onSaveRequest }: Props) {
  const [userDrafts, setUserDrafts] = useState<Record<string, UserDraft>>({});
  const [requestDrafts, setRequestDrafts] = useState<Record<string, RequestDraft>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingRequestId, setSavingRequestId] = useState<string | null>(null);

  useEffect(() => {
    const nextDrafts: Record<string, UserDraft> = {};
    for (const user of users) {
      nextDrafts[user.id] = {
        subscriptionStatus: user.subscription_status,
        subscriptionExpiresAt: String(user.subscription_expires_at).slice(0, 10),
      };
    }
    setUserDrafts(nextDrafts);
  }, [users]);

  useEffect(() => {
    const nextDrafts: Record<string, RequestDraft> = {};
    for (const request of requests) {
      nextDrafts[request.id] = {
        status: request.status,
        adminNote: request.admin_note || 'راح تصير هاي الخاصية خلال أقل من يوم.',
      };
    }
    setRequestDrafts(nextDrafts);
  }, [requests]);

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.isSubscriptionActive).length;
  const suspendedUsers = users.filter((user) => user.subscription_status === 'suspended').length;
  const openRequests = requests.filter((request) => request.status !== 'done').length;

  return (
    <div className="admin-layout">
      <div className="cards-grid admin-cards">
        <div className="stat-card blue">
          <div className="stat-label">إجمالي المستخدمين</div>
          <div className="stat-value blue">{totalUsers}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">اشتراكات فعالة</div>
          <div className="stat-value green">{activeUsers}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">موقوفون</div>
          <div className="stat-value red">{suspendedUsers}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">طلبات مفتوحة</div>
          <div className="stat-value purple">{openRequests}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="title-with-icon">
            <AppIcon name="users" size={18} />
            <span>إدارة المستخدمين والاشتراكات</span>
          </h3>
        </div>
        <div className="panel-body">
          {loading ? (
            <div className="empty-state">
              <div className="icon"><AppIcon name="clock" size={28} /></div>
              <p>جارٍ تحميل بيانات المستخدمين...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><AppIcon name="users" size={28} /></div>
              <p>لا يوجد مستخدمون بعد.</p>
            </div>
          ) : (
            <div className="admin-grid">
              {users.map((user) => {
                const draft = userDrafts[user.id];
                if (!draft) return null;

                return (
                  <article key={user.id} className="admin-user-card">
                    <div className="admin-user-head">
                      <div>
                        <h4>{user.name}</h4>
                        <p>{user.email}</p>
                      </div>
                      <span className={`status-chip ${user.role === 'admin' ? 'admin' : 'active'}`}>
                        {user.role === 'admin' ? 'مشرف' : 'مستخدم'}
                      </span>
                    </div>

                    <div className="admin-user-stats">
                      <span>طلبات التطوير: {user.feature_request_count || 0}</span>
                      <span>المصاريف المخططة: {user.planned_expenses_count || 0}</span>
                      <span>المصاريف الفعلية: {user.actual_expenses_count || 0}</span>
                      <span>مصادر الدخل: {user.income_sources_count || 0}</span>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>حالة الاشتراك</label>
                        <select
                          className="form-control"
                          value={draft.subscriptionStatus}
                          onChange={(event) => setUserDrafts((current) => ({
                            ...current,
                            [user.id]: {
                              ...(current[user.id] || draft),
                              subscriptionStatus: event.target.value as 'active' | 'suspended',
                            },
                          }))}
                        >
                          <option value="active">فعال</option>
                          <option value="suspended">موقوف</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>ينتهي في</label>
                        <input
                          className="form-control"
                          type="date"
                          value={draft.subscriptionExpiresAt}
                          onChange={(event) => setUserDrafts((current) => ({
                            ...current,
                            [user.id]: {
                              ...(current[user.id] || draft),
                              subscriptionExpiresAt: event.target.value,
                            },
                          }))}
                        />
                      </div>
                    </div>

                    <button
                      className="btn btn-primary btn-with-icon"
                      onClick={async () => {
                        setSavingUserId(user.id);
                        try {
                          await onSaveUser({
                            userId: user.id,
                            subscriptionStatus: draft.subscriptionStatus,
                            subscriptionExpiresAt: `${draft.subscriptionExpiresAt}T23:59:59`,
                          });
                        } finally {
                          setSavingUserId(null);
                        }
                      }}
                      disabled={savingUserId === user.id}
                    >
                      <AppIcon name={savingUserId === user.id ? 'clock' : 'save'} size={16} />
                      <span>{savingUserId === user.id ? 'جارٍ الحفظ...' : 'حفظ الاشتراك'}</span>
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="title-with-icon">
            <AppIcon name="tools" size={18} />
            <span>قائمة التطويرات والملاحظات</span>
          </h3>
        </div>
        <div className="panel-body">
          {loading ? (
            <div className="empty-state">
              <div className="icon"><AppIcon name="clock" size={28} /></div>
              <p>جارٍ تحميل طلبات التطوير...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><AppIcon name="tools" size={28} /></div>
              <p>لا توجد طلبات تطوير حالياً.</p>
            </div>
          ) : (
            <div className="request-list">
              {requests.map((request) => {
                const draft = requestDrafts[request.id];
                if (!draft) return null;

                return (
                  <article key={request.id} className="request-card admin-request-card">
                    <div className="request-head">
                      <div>
                        <h4>{request.title}</h4>
                        <span>{request.user_name} · {request.user_email}</span>
                      </div>
                      <span className={`status-chip status-${draft.status}`}>{REQUEST_STATUS_LABEL[draft.status]}</span>
                    </div>

                    <p className="request-details">{request.details}</p>

                    <div className="form-row">
                      <div className="form-group">
                        <label>حالة الطلب</label>
                        <select
                          className="form-control"
                          value={draft.status}
                          onChange={(event) => setRequestDrafts((current) => ({
                            ...current,
                            [request.id]: {
                              ...(current[request.id] || draft),
                              status: event.target.value as FeatureRequestStatus,
                            },
                          }))}
                        >
                          <option value="pending">بانتظار المراجعة</option>
                          <option value="planned">مجدولة</option>
                          <option value="in_progress">قيد التطوير</option>
                          <option value="done">مكتملة</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>ملاحظة الإدارة</label>
                        <textarea
                          className="form-control requests-textarea"
                          value={draft.adminNote}
                          onChange={(event) => setRequestDrafts((current) => ({
                            ...current,
                            [request.id]: {
                              ...(current[request.id] || draft),
                              adminNote: event.target.value,
                            },
                          }))}
                        />
                      </div>
                    </div>

                    <button
                      className="btn btn-primary btn-with-icon"
                      onClick={async () => {
                        setSavingRequestId(request.id);
                        try {
                          await onSaveRequest({
                            requestId: request.id,
                            status: draft.status,
                            adminNote: draft.adminNote,
                          });
                        } finally {
                          setSavingRequestId(null);
                        }
                      }}
                      disabled={savingRequestId === request.id}
                    >
                      <AppIcon name={savingRequestId === request.id ? 'clock' : 'save'} size={16} />
                      <span>{savingRequestId === request.id ? 'جارٍ الحفظ...' : 'حفظ التحديث'}</span>
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
