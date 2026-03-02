'use client';

import { FormEvent, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import { FeatureRequest } from '@/lib/types';

interface Props {
  requests: FeatureRequest[];
  loading: boolean;
  canUseProduct: boolean;
  onSubmit: (payload: { title: string; details: string }) => Promise<boolean>;
}

const STATUS_LABEL: Record<FeatureRequest['status'], string> = {
  pending: 'بانتظار المراجعة',
  planned: 'مجدولة',
  in_progress: 'قيد التطوير',
  done: 'مكتملة',
};

export default function RequestsBoard({ requests, loading, canUseProduct, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const ok = await onSubmit({ title, details });
      if (ok) {
        setTitle('');
        setDetails('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="requests-layout">
      <div className="panel">
        <div className="panel-header">
          <h3 className="title-with-icon">
            <AppIcon name="note" size={18} />
            <span>اكتب تطويرات او ملاحظات</span>
          </h3>
        </div>
        <div className="panel-body">
          <form className="requests-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>عنوان التطوير</label>
              <input
                className="form-control"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="مثل: إضافة فلترة للمصاريف حسب الأسبوع"
              />
            </div>

            <div className="form-group">
              <label>التفاصيل</label>
              <textarea
                className="form-control requests-textarea"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="اكتب المطلوب بالتفصيل حتى يظهر للمطور بشكل واضح"
              />
            </div>

            <button className="btn btn-primary btn-with-icon" type="submit" disabled={submitting}>
              <AppIcon name={submitting ? 'clock' : 'send'} size={16} />
              <span>{submitting ? 'جارٍ الإرسال...' : 'إرسال الملاحظة'}</span>
            </button>
          </form>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="title-with-icon">
            <AppIcon name="requests" size={18} />
            <span>سجل التطويرات المرسلة</span>
          </h3>
          <span className={`status-chip ${canUseProduct ? 'active' : 'suspended'}`}>
            {canUseProduct ? 'اشتراكك فعال' : 'اشتراكك موقوف حالياً'}
          </span>
        </div>
        <div className="panel-body">
          {loading ? (
            <div className="empty-state">
              <div className="icon"><AppIcon name="clock" size={28} /></div>
              <p>جارٍ تحميل طلباتك...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><AppIcon name="tools" size={28} /></div>
              <p>ماكو طلبات تطوير بعد. اكتب أول ملاحظة حتى تظهر هنا.</p>
            </div>
          ) : (
            <div className="request-list">
              {requests.map((request) => (
                <article key={request.id} className="request-card">
                  <div className="request-head">
                    <div>
                      <h4>{request.title}</h4>
                      <span>{STATUS_LABEL[request.status]}</span>
                    </div>
                    <span className={`status-chip status-${request.status}`}>{STATUS_LABEL[request.status]}</span>
                  </div>
                  <p className="request-details">{request.details}</p>
                  <div className="request-note">
                    <strong>ملاحظة الإدارة</strong>
                    <p>{request.admin_note || 'راح تصير هاي الخاصية خلال أقل من يوم.'}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
