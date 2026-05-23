import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ShoppingBag, Store, ChevronRight, Filter } from 'lucide-react';
import api from '../services/api';

const STATUS_LABEL: Record<string, string> = {
  CREATED: 'Created', QUEUED: 'Queued', PREPARING: 'Preparing', READY: 'Ready',
  OUT_FOR_SERVICE: 'On its way', SERVED: 'Served',
  CANCELLED: 'Cancelled', DISPUTED: 'Disputed', RESOLVED: 'Resolved',
  FOR_REFUND: 'Refund pending', REFUND_COMPLETE: 'Refunded',
};
const STATUS_TONE: Record<string, string> = {
  CREATED: 'bg-blue-100 text-blue-700',
  QUEUED: 'bg-yellow-100 text-yellow-700',
  PREPARING: 'bg-orange-100 text-orange-700',
  READY: 'bg-emerald-100 text-emerald-700',
  OUT_FOR_SERVICE: 'bg-teal-100 text-teal-700',
  SERVED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-red-100 text-red-700',
  DISPUTED: 'bg-purple-100 text-purple-700',
  RESOLVED: 'bg-sky-100 text-sky-700',
  FOR_REFUND: 'bg-pink-100 text-pink-700',
  REFUND_COMPLETE: 'bg-purple-100 text-purple-700',
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'SERVED' | 'CANCELLED' | 'DISPUTED'>('ALL');

  useEffect(() => {
    api.get('/users/orders/history', { params: { limit: 50 } })
      .then(({ data }) => setOrders(data.data.orders || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? orders : orders.filter(o => {
    if (filter === 'SERVED') return ['SERVED', 'RESOLVED', 'REFUND_COMPLETE'].includes(o.status);
    if (filter === 'CANCELLED') return o.status === 'CANCELLED';
    if (filter === 'DISPUTED') return ['DISPUTED', 'FOR_REFUND'].includes(o.status);
    return true;
  });

  return (
    <div className="max-w-md mx-auto pb-4">
      <div className="px-5 pt-6 pb-3">
        <h1 className="text-2xl font-black text-slate-900">Order history</h1>
        <p className="text-xs text-slate-500 mt-0.5">All your past orders</p>
      </div>

      {/* Filter pills */}
      <div className="px-4 flex gap-2 overflow-x-auto scrollbar-hide pb-2">
        {(['ALL', 'SERVED', 'CANCELLED', 'DISPUTED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-semibold px-3.5 py-1.5 rounded-full whitespace-nowrap border ${
              filter === f
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {f === 'ALL' ? 'All' : f === 'SERVED' ? 'Completed' : f === 'CANCELLED' ? 'Cancelled' : 'Disputed'}
          </button>
        ))}
      </div>

      <div className="px-4 mt-2 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />)
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl py-16 text-center border border-slate-100">
            <ShoppingBag size={32} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500 font-medium">No orders yet</p>
            <p className="text-xs text-slate-400 mt-1">Scan an outlet QR to place your first order.</p>
          </div>
        ) : (
          filtered.map(o => (
            <button
              key={o.id}
              onClick={() => navigate(`/receipt/${o.id}`)}
              className="w-full bg-white rounded-2xl border border-slate-100 p-3 flex items-center gap-3 hover:border-brand-200"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                {o.outlet?.logoUrl
                  ? <img src={o.outlet.logoUrl} alt="" className="w-8 h-8 object-contain" />
                  : <Store size={16} className="text-slate-400" />}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800 truncate">{o.outlet?.name || 'Outlet'}</p>
                  {o.tokenNumber != null && (
                    <span className="inline-flex items-center text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                      Token #{o.tokenNumber}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {dayjs(o.createdAt).format('DD MMM, hh:mm A')}
                  {o.items?.length ? ` · ${o.items.length} items` : ''}
                </p>
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${STATUS_TONE[o.status] || 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_LABEL[o.status] || o.status}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">₹{Number(o.totalAmount).toFixed(0)}</p>
              </div>
              <ChevronRight size={14} className="text-slate-300 shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
