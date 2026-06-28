import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BellRing, ChevronLeft, CheckCheck, Package, CreditCard, Utensils, Clock,
  AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useCustomerAlerts, CustomerAlert } from '../context/CustomerAlertsContext';

const ICONS: Record<string, any> = {
  ORDER_PLACED:     Package,
  PAYMENT_RECEIVED: CreditCard,
  ITEM_READY:       Utensils,
  ORDER_READY:      BellRing,
  ORDER_SERVED:     CheckCheck,
};

// Pure helper — keeps the relative-time formatter out of the
// component render path. Takes the i18n t() so the unit suffix
// translates ("5m ago" vs "5 मिनट पहले") cleanly.
function formatTime(iso: string, t: (k: string, opts?: any) => string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return t('alerts.justNow');
  if (diff < 3600) return t('alerts.minutesAgo', { minutes: Math.floor(diff / 60) });
  if (diff < 86400) return t('alerts.hoursAgo', { hours: Math.floor(diff / 3600) });
  return d.toLocaleDateString();
}

export default function AlertsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { alerts, unreadCount, markRead, markAllRead, refresh } = useCustomerAlerts();

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-dvh">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-10 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <p className="text-base font-black text-slate-900">{t('alerts.title')}</p>
          <p className="text-[11px] text-slate-500">
            {unreadCount > 0 ? t('alerts.unread', { count: unreadCount }) : t('alerts.allCaughtUp')}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs font-bold text-brand-600">
            {t('alerts.markAllRead')}
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-24 text-center px-6">
          <Bell size={40} className="text-slate-200 mb-3" />
          <p className="text-sm font-bold text-slate-700">{t('alerts.empty')}</p>
          <p className="text-xs text-slate-500 mt-1">
            {t('alerts.emptyHint')}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {alerts.map((a) => <Row key={a.id} a={a} onRead={markRead} onOpen={(orderId) => navigate(`/track/${orderId}`)} />)}
        </ul>
      )}
    </div>
  );
}

function Row({ a, onRead, onOpen }: {
  a: CustomerAlert; onRead: (id: string) => void; onOpen: (orderId: string) => void;
}) {
  const { t } = useTranslation();
  const Icon = ICONS[a.trigger] || Bell;
  return (
    <li
      onClick={() => {
        if (!a.isRead) onRead(a.id);
        if (a.orderId) onOpen(a.orderId);
      }}
      className={clsx(
        'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
        a.isRead ? 'bg-white hover:bg-slate-50' : 'bg-brand-50/70 hover:bg-brand-50',
      )}
    >
      <div className={clsx(
        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
        a.isRead ? 'bg-slate-100 text-slate-500' : 'bg-brand-500/15 text-brand-600',
      )}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={clsx('text-sm truncate', a.isRead ? 'text-slate-700 font-semibold' : 'text-slate-900 font-bold')}>{a.title}</p>
          {!a.isRead && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />}
        </div>
        <p className="text-xs text-slate-600 mt-0.5 line-clamp-3">{a.body}</p>
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
          <Clock size={10} /> {formatTime(a.createdAt, t)}
          {a.sentVia === 'WHATSAPP' && <span className="text-emerald-600 font-bold">{t('alerts.whatsapp')}</span>}
          {a.sentVia === 'BOTH' && <span className="text-emerald-600 font-bold">{t('alerts.whatsappAndInApp')}</span>}
          {a.sentVia === 'IN_APP' && a.whatsappError && (
            <span className="text-amber-600 font-bold flex items-center gap-1">
              <AlertCircle size={10} /> {t('alerts.whatsappFailed')}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
