import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Building2, ChevronLeft, Store, IndianRupee, Users, Phone, MapPin,
  Mail, ToggleRight, ToggleLeft, CreditCard, Percent, Edit2,
} from 'lucide-react';
import api from '../../services/api';
import { useUserRole } from '../../hooks/useUserRole';

type Outlet = {
  id: string;
  name: string;
  publicCode?: string | null;
  outletType?: string | null;
  isActive: boolean;
  address?: string | null;
  city?: string | null;
};

type Business = {
  id: string;
  name: string;
  publicCode?: string | null;
  description?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstNumber?: string | null;
  upiId?: string | null;
  businessType: string;
  status: string;
  isCluster?: boolean;
  aggregatorEnabled?: boolean;
  platformFeePercent?: string | number | null;
  platformFeeMinimum?: string | number | null;
  subscription?: { id: string; status: string; plan: { name: string; monthlyCost: number } } | null;
  outlets?: Outlet[];
  _count?: { outlets: number; users: number };
};

type AdminUser = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
} | null;

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tier } = useUserRole();

  // Platform admins land here; business owners get redirected to their
  // own profile page (which is the existing /business route).
  if (tier !== 'platform') return <Navigate to="/business" replace />;

  const [business, setBusiness] = useState<Business | null>(null);
  const [admin, setAdmin] = useState<AdminUser>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [b, a] = await Promise.all([
        api.get(`/businesses/${id}`),
        api.get(`/businesses/${id}/admin`).catch(() => ({ data: { data: null } })),
      ]);
      setBusiness(b.data.data);
      setAdmin(a.data.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load business');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  const toggleStatus = async () => {
    if (!business) return;
    setSaving(true);
    try {
      await api.patch(`/businesses/${business.id}/toggle-status`);
      toast.success(business.status === 'ACTIVE' ? 'Deactivated' : 'Activated');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleAggregator = async () => {
    if (!business) return;
    const next = !business.aggregatorEnabled;
    setSaving(true);
    try {
      await api.patch(`/businesses/${business.id}`, { aggregatorEnabled: next });
      setBusiness({ ...business, aggregatorEnabled: next });
      toast.success(next ? 'Aggregators enabled' : 'Aggregators disabled');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }
  if (!business) {
    return (
      <div className="p-6 text-sm text-slate-500">Business not found.</div>
    );
  }

  // Friendly address line — fall back to legacy single-field address if
  // the breakdown columns are empty.
  const fullAddress = [
    business.addressLine1, business.addressLine2,
    [business.city, business.state, business.pincode].filter(Boolean).join(', '),
  ].filter(Boolean).join(' · ') || business.address || '—';

  const feePct = business.platformFeePercent != null ? Number(business.platformFeePercent) : null;
  const feeMin = business.platformFeeMinimum != null ? Number(business.platformFeeMinimum) : null;
  const hasFeeOverride = feePct != null || feeMin != null;

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-6 space-y-5">
      {/* Header / breadcrumb */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => navigate('/platform/businesses')}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft size={16} /> Businesses
        </button>
        <button
          onClick={toggleStatus}
          disabled={saving}
          className={clsx(
            'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
            business.status === 'ACTIVE'
              ? 'text-red-700 bg-red-50 hover:bg-red-100'
              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100',
          )}
        >
          {business.status === 'ACTIVE' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {business.status === 'ACTIVE' ? 'Deactivate business' : 'Activate business'}
        </button>
      </div>

      {/* Title card */}
      <section className="card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{business.name}</h1>
              <span className={clsx(
                'inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                business.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700',
              )}>
                {business.status}
              </span>
              {business.isCluster && (
                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  CLUSTER
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {business.businessType.replace(/_/g, ' ')}
              {business.publicCode && <span className="font-mono ml-2">· {business.publicCode}</span>}
            </p>
            {business.description && (
              <p className="text-sm text-slate-600 mt-3 max-w-prose">{business.description}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Stat icon={Store} label="Outlets" value={business._count?.outlets ?? business.outlets?.length ?? 0} />
            <Stat icon={Users} label="Users" value={business._count?.users ?? 0} />
          </div>
        </div>
      </section>

      {/* Identity + contact */}
      <section className="card p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Identity & contact</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field icon={MapPin} label="Address" value={fullAddress} />
          <Field icon={Mail}   label="GST number" value={business.gstNumber || '—'} mono />
          <Field icon={Phone}  label="Owner phone" value={admin?.phone || '—'} mono />
          <Field icon={Mail}   label="Owner email" value={admin?.email || '—'} />
          <Field icon={Mail}   label="Owner name"  value={admin?.name  || '—'} />
          <Field icon={IndianRupee} label="UPI ID" value={business.upiId || '—'} mono />
        </dl>
      </section>

      {/* Subscription */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Subscription</h2>
        </div>
        {business.subscription ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
              <CreditCard size={14} className="text-slate-500" />
              <span className="text-sm font-semibold text-slate-800">{business.subscription.plan.name}</span>
              <span className="text-xs text-slate-500">· ₹{Number(business.subscription.plan.monthlyCost).toLocaleString('en-IN')}/mo</span>
            </div>
            <span className={clsx(
              'inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
              business.subscription.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
            )}>
              {business.subscription.status}
            </span>
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">No subscription on file.</p>
        )}
      </section>

      {/* Platform fee */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Platform fee</h2>
          <button
            onClick={() => navigate('/platform-settings')}
            className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
          >
            <Edit2 size={11} /> Manage on Fees page
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Percent</p>
            <p className="text-base font-semibold text-slate-900 mt-0.5">
              {feePct != null ? `${feePct.toFixed(2)}%` : <span className="text-slate-400 text-xs italic">Platform default</span>}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Minimum</p>
            <p className="text-base font-semibold text-slate-900 mt-0.5">
              {feeMin != null ? `₹${feeMin.toFixed(2)}` : <span className="text-slate-400 text-xs italic">Platform default</span>}
            </p>
          </div>
        </div>
        {!hasFeeOverride && (
          <p className="text-[11px] text-slate-400 mt-2">
            Inheriting platform-wide defaults. Override via the Fees page.
          </p>
        )}
      </section>

      {/* Features */}
      <section className="card p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Features</h2>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Marketplace aggregators</p>
            <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5 max-w-prose">
              Zomato / Swiggy / Uber Eats. When off, the Aggregators settings sub-page is hidden for every outlet under this business.
            </p>
          </div>
          <button
            onClick={toggleAggregator}
            disabled={saving}
            className={clsx(
              'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap',
              business.aggregatorEnabled
                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                : 'text-slate-600 bg-slate-100 hover:bg-slate-200',
            )}
          >
            {business.aggregatorEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            {business.aggregatorEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </section>

      {/* Outlets list */}
      <section className="card overflow-hidden">
        <div className="p-5 pb-3 flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Outlets ({business.outlets?.length ?? 0})
          </h2>
        </div>
        {business.outlets && business.outlets.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {business.outlets.map((o) => (
              <div key={o.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Store size={14} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{o.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {o.outletType ? o.outletType.replace(/_/g, ' ') : 'Outlet'}
                    {o.publicCode && <span className="font-mono ml-2">· {o.publicCode}</span>}
                    {o.address && <span> · {o.address}</span>}
                  </p>
                </div>
                <span className={clsx(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap',
                  o.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
                )}>
                  {o.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-slate-400 italic">
            No outlets yet.
          </div>
        )}
      </section>
    </div>
  );
}

/* ── helpers ────────────────────────────────────────────── */
function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-slate-400" />
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, mono }: {
  icon: any; label: string; value: string; mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
        <Icon size={11} /> {label}
      </dt>
      <dd className={clsx('text-sm text-slate-800 mt-0.5', mono && 'font-mono')}>{value}</dd>
    </div>
  );
}
