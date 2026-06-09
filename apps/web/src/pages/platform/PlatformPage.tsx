import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  Building2, Store, ShoppingBag, IndianRupee,
  CheckCircle2, Clock, XCircle, Plus, ToggleRight, ToggleLeft,
  CreditCard, Zap, Network, ChevronRight,
} from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';

/* ── types ───────────────────────────────────────────────── */
interface Business {
  id: string;
  name: string;
  publicCode?: string | null;
  gstNumber?: string | null;
  businessType: string;
  isCluster?: boolean;
  status: string;
  subscription?: { status: string; plan: { name: string; monthlyCost: number } } | null;
  _count: { outlets: number };
}

interface Plan {
  id: string;
  name: string;
  monthlyCost: number;
  annualCost: number;
  maxOutlets: number;
  maxUsers: number;
  features: Record<string, boolean>;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const BUSINESS_TYPES = ['RESTAURANT','QSR','FOOD_COURT','CAFETERIA','PARCEL_OUTLET','DINE_IN','HYBRID'];

/* ── component ───────────────────────────────────────────── */
export default function PlatformPage() {
  const { pathname } = useLocation();
  const view = pathname.includes('businesses') ? 'businesses'
             : pathname.includes('subscriptions') ? 'plans'
             : 'overview';

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [plans, setPlans]           = useState<Plan[]>([]);
  const [stats, setStats]           = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

  const [bizModal, setBizModal]   = useState(false);
  const [planModal, setPlanModal] = useState<{ open: boolean; plan?: Plan }>({ open: false });
  // Local flag so we can hide the (regular-business-only) owner-login block
  // when the admin is creating a Cluster. Clusters are platform-managed and
  // don't get a Business Owner user provisioned.
  const [isClusterForm, setIsClusterForm] = useState(false);
  const navigate = useNavigate();

  /* ── fetch ────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [bRes, pRes] = await Promise.all([
          api.get('/businesses'),
          api.get('/subscriptions/plans'),
        ]);
        const bizList: Business[] = bRes.data.data.businesses || [];
        setBusinesses(bizList);
        setPlans(pRes.data.data || []);

        // Derive platform stats
        const totalOutlets = bizList.reduce((s, b) => s + (b._count?.outlets ?? 0), 0);
        const active = bizList.filter(b => b.status === 'ACTIVE').length;
        setStats({ totalBusinesses: bizList.length, activeBusinesses: active, totalOutlets });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ── handlers ────────────────────────────────────────── */
  const createBusiness = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const isCluster = fd.get('isCluster') === 'on';
      await api.post('/businesses', {
        name: fd.get('name'),
        businessType: isCluster ? 'FOOD_COURT' : fd.get('businessType'),
        gstNumber: fd.get('gstNumber') || undefined,
        // Both standard and cluster businesses get an owner. For clusters
        // the owner manages members, branding, and the cluster QR (they
        // see ClusterDetailPage on login instead of the regular Business
        // Profile page).
        adminPhone: fd.get('adminPhone'),
        adminName: fd.get('adminName') || undefined,
        isCluster,
      });
      toast.success(isCluster ? 'Cluster business created' : 'Business created');
      setBizModal(false);
      setIsClusterForm(false);
      const { data } = await api.get('/businesses');
      setBusinesses(data.data.businesses || []);
    } catch (e: any) {
      // Surface the real reason. The API returns either:
      //   { message: "Phone X is already registered" }          ← BadRequest
      //   { message: ["name must be a string", ...] }           ← class-validator
      //   or no response at all (network error / timeout)
      // Render each shape clearly instead of collapsing to "Failed".
      const data = e?.response?.data;
      const msg = Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message;
      const detail = msg
        ? msg
        : e?.response
          ? `Request failed (${e.response.status})`
          : (e?.message || 'Network error — is the API running?');
      toast.error(`Could not create business: ${detail}`);
      // eslint-disable-next-line no-console
      console.error('createBusiness failed:', e);
    }
    finally { setSaving(false); }
  };

  const toggleBiz = async (id: string, currentStatus: string) => {
    try {
      await api.patch(`/businesses/${id}/toggle-status`);
      setBusinesses(prev => prev.map(b => b.id === id ? { ...b, status: b.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : b));
      toast.success(`Business ${currentStatus === 'ACTIVE' ? 'deactivated' : 'activated'}`);
    } catch { toast.error('Failed'); }
  };

  const savePlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get('name'), description: fd.get('description'),
      monthlyCost: Number(fd.get('monthlyCost')), annualCost: Number(fd.get('annualCost')),
      maxOutlets: Number(fd.get('maxOutlets')), maxUsers: Number(fd.get('maxUsers')),
      features: { qrOrdering: true, kds: true, pos: true,
        inventory: fd.get('inventory') === 'on',
        analytics:  fd.get('analytics')  === 'on',
        whatsapp:   fd.get('whatsapp')   === 'on',
      },
    };
    setSaving(true);
    try {
      await api.post('/subscriptions/plans', body);
      toast.success('Plan created');
      setPlanModal({ open: false });
      const { data } = await api.get('/subscriptions/plans');
      setPlans(data.data || []);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  /* ── render: overview ────────────────────────────────── */
  const renderOverview = () => (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Platform Overview</h1>
        <p className="page-subtitle">All businesses and activity on PayNPik</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Businesses', value: stats?.totalBusinesses ?? '—', icon: Building2, cls: 'bg-blue-50 text-blue-600' },
          { label: 'Active Businesses', value: stats?.activeBusinesses ?? '—', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600' },
          { label: 'Total Outlets',     value: stats?.totalOutlets ?? '—',    icon: Store,       cls: 'bg-brand-50 text-brand-800' },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <div className={`icon-wrap w-9 h-9 ${s.cls} rounded-xl mb-3`}><s.icon size={16} /></div>
            <p className="text-2xl font-black text-slate-900">{loading ? '…' : s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent businesses */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Registered Businesses</h2>
          <button className="btn-primary text-xs py-1.5 px-3" onClick={() => setBizModal(true)}>
            <Plus size={13} /> Add Business
          </button>
        </div>
        <BusinessTable
          businesses={businesses}
          loading={loading}
          onToggle={toggleBiz}
          onOpen={openBusiness}
        />
      </div>
    </div>
  );

  // Cluster businesses have their own dedicated admin shell; regular
  // businesses get the new /platform/businesses/:id detail page.
  const openBusiness = (b: Business) => {
    if (b.isCluster) navigate(`/platform/clusters/${b.id}`);
    else navigate(`/platform/businesses/${b.id}`);
  };

  /* ── render: businesses ──────────────────────────────── */
  const renderBusinesses = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Businesses</h1>
          <p className="page-subtitle">{businesses.length} registered</p>
        </div>
        <button className="btn-primary" onClick={() => setBizModal(true)}>
          <Plus size={15} /> Add Business
        </button>
      </div>
      <div className="card overflow-hidden">
        <BusinessTable
          businesses={businesses}
          loading={loading}
          onToggle={toggleBiz}
          onOpen={openBusiness}
        />
      </div>
    </div>
  );

  /* ── render: plans ───────────────────────────────────── */
  const renderPlans = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Subscription Plans</h1>
          <p className="page-subtitle">{plans.length} plans available</p>
        </div>
        <button className="btn-primary" onClick={() => setPlanModal({ open: true })}>
          <Plus size={15} /> New Plan
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-48 animate-pulse" />) :
          plans.map(plan => (
            <div key={plan.id} className="card p-6 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-black text-slate-900 text-lg">{plan.name}</p>
                  <p className="text-2xl font-black text-brand-600 mt-1">
                    ₹{Number(plan.monthlyCost).toLocaleString('en-IN')}
                    <span className="text-sm font-normal text-slate-400">/mo</span>
                  </p>
                </div>
                <div className="icon-wrap bg-brand-50 text-brand-600"><CreditCard size={18} /></div>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600 flex-1">
                <p>Up to <strong>{plan.maxOutlets}</strong> outlets</p>
                <p>Up to <strong>{plan.maxUsers}</strong> staff members</p>
                <p>Annual: <strong>₹{Number(plan.annualCost).toLocaleString('en-IN')}</strong></p>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-slate-100">
                {Object.entries(plan.features as Record<string, boolean>)
                  .filter(([, v]) => v)
                  .map(([k]) => (
                    <span key={k} className="badge badge-green text-[10px]">
                      <Zap size={8} /> {k}
                    </span>
                  ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <>
      {view === 'overview'    && renderOverview()}
      {view === 'businesses'  && renderBusinesses()}
      {view === 'plans'       && renderPlans()}

      {/* Add business modal */}
      <Modal open={bizModal} onClose={() => { setBizModal(false); setIsClusterForm(false); }} title="New Business" size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setBizModal(false); setIsClusterForm(false); }}>Cancel</button>
            <button form="biz-form" type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {isClusterForm ? 'Create Cluster' : 'Create Business'}
            </button>
          </>
        }
      >
        <form id="biz-form" onSubmit={createBusiness} className="space-y-4">
          {/* Category toggle — Standard business vs Cluster (food-court roof
              that aggregates outlets from other businesses). */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setIsClusterForm(false)}
              className={clsx('py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2',
                !isClusterForm ? 'bg-white text-slate-900 shadow' : 'text-slate-500')}
            >
              <Building2 size={14} /> Standard
            </button>
            <button
              type="button"
              onClick={() => setIsClusterForm(true)}
              className={clsx('py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2',
                isClusterForm ? 'bg-white text-slate-900 shadow' : 'text-slate-500')}
            >
              <Network size={14} /> Cluster
            </button>
          </div>
          {/* Hidden field — picked up by FormData in createBusiness. */}
          <input type="hidden" name="isCluster" value={isClusterForm ? 'on' : ''} />

          <Field label={isClusterForm ? 'Cluster Name' : 'Business Name'}>
            <input name="name" required className="input"
              placeholder={isClusterForm ? 'e.g. Phoenix Food Court' : 'e.g. The Spice Garden'} />
          </Field>
          {!isClusterForm && (
            <Field label="Business Type">
              <select name="businessType" required className="input">
                {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
          )}
          <Field label="GST Number">
            <input name="gstNumber" className="input font-mono" placeholder="29ABCDE1234F1Z5" />
          </Field>
          {isClusterForm && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-1">
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Cluster</p>
              <p className="text-[12px] text-indigo-700 leading-relaxed">
                A cluster aggregates outlets from <strong>other</strong> businesses (e.g. stalls in a food court, kiosks in a mall).
                Add member outlets by their Outlet ID after creating the cluster. Customers see a unified menu and pay once;
                payment is routed per outlet via Razorpay.
              </p>
            </div>
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              {isClusterForm ? 'Cluster Owner Login' : 'Business Owner Login'}
            </p>
            <Field label="Owner Name (optional)">
              <input name="adminName" className="input" placeholder={isClusterForm ? 'e.g. Phoenix Mall Mgmt' : 'e.g. Ramesh'} />
            </Field>
            <Field label="Owner Phone (required)">
              <input name="adminPhone" required className="input" placeholder="+91 …" />
            </Field>
            <p className="text-[11px] text-amber-700">
              We'll create the {isClusterForm ? 'Cluster' : 'Business'} Owner login with default password <span className="font-mono font-bold">abc@123</span>.
              The owner will be required to set a new password on first login.
            </p>
          </div>
        </form>
      </Modal>

      {/* Add plan modal */}
      <Modal open={planModal.open} onClose={() => setPlanModal({ open: false })} title="New Subscription Plan" size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPlanModal({ open: false })}>Cancel</button>
            <button form="plan-form" type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Create Plan
            </button>
          </>
        }
      >
        <form id="plan-form" onSubmit={savePlan} className="space-y-4">
          <Field label="Plan Name">
            <input name="name" required className="input" placeholder="e.g. Growth" />
          </Field>
          <Field label="Description">
            <input name="description" className="input" placeholder="Short description" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly Cost (₹)">
              <input name="monthlyCost" type="number" required className="input" placeholder="999" />
            </Field>
            <Field label="Annual Cost (₹)">
              <input name="annualCost" type="number" required className="input" placeholder="9999" />
            </Field>
            <Field label="Max Outlets">
              <input name="maxOutlets" type="number" required className="input" placeholder="5" />
            </Field>
            <Field label="Max Users">
              <input name="maxUsers" type="number" required className="input" placeholder="25" />
            </Field>
          </div>
          <Field label="Features included">
            <div className="flex flex-wrap gap-3 mt-1">
              {['inventory', 'analytics', 'whatsapp'].map(f => (
                <label key={f} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" name={f} className="accent-brand-500 w-4 h-4 rounded" />
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </label>
              ))}
            </div>
          </Field>
        </form>
      </Modal>
    </>
  );
}

/* ── Business table sub-component ────────────────────────── */
function BusinessTable({ businesses, loading, onToggle, onOpen }: {
  businesses: Business[];
  loading: boolean;
  onToggle: (id: string, status: string) => void;
  onOpen: (b: Business) => void;
}) {
  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <Building2 size={36} className="text-slate-200 mb-3" />
        <p className="text-slate-500 font-medium">No businesses yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="text-left  font-semibold px-4 py-2.5">Business</th>
            <th className="text-left  font-semibold px-4 py-2.5 hidden md:table-cell">Type</th>
            <th className="text-left  font-semibold px-4 py-2.5 hidden lg:table-cell">GST</th>
            <th className="text-right font-semibold px-4 py-2.5">Outlets</th>
            <th className="text-left  font-semibold px-4 py-2.5 hidden md:table-cell">Plan</th>
            <th className="text-left  font-semibold px-4 py-2.5">Status</th>
            <th className="text-right font-semibold px-4 py-2.5 w-[200px]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {businesses.map(b => (
            <tr
              key={b.id}
              onClick={() => onOpen(b)}
              className={clsx(
                'cursor-pointer hover:bg-slate-50 transition-colors',
                b.isCluster && 'bg-indigo-50/30 hover:bg-indigo-50/60',
              )}
              title={b.isCluster ? 'Open cluster admin' : 'Open business details'}
            >
              <td className="px-4 py-3 align-top">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900">{b.name}</span>
                  {b.isCluster && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                      <Network size={10} /> CLUSTER
                    </span>
                  )}
                </div>
                {b.publicCode && (
                  <div className="font-mono text-[10px] text-slate-400 mt-0.5">{b.publicCode}</div>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600 text-xs hidden md:table-cell">
                {b.isCluster ? '—' : b.businessType.replace(/_/g, ' ')}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500 hidden lg:table-cell">
                {b.gstNumber || '—'}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-700 tabular-nums">
                {b._count?.outlets ?? 0}
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                {b.subscription
                  ? <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{b.subscription.plan.name}</span>
                  : <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">No plan</span>}
              </td>
              <td className="px-4 py-3">
                <span className={clsx(
                  'inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                  b.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
                )}>
                  {b.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onToggle(b.id, b.status)}
                    className={clsx(
                      'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors',
                      b.status === 'ACTIVE'
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-emerald-600 hover:bg-emerald-50',
                    )}
                  >
                    {b.status === 'ACTIVE' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {b.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                  <ChevronRight size={14} className="text-slate-300 ml-1" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
