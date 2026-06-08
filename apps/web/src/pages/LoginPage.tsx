import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Phone, Lock, ArrowRight, Zap, BarChart3, ShoppingBag, ChefHat, Smartphone, MousePointer2, Network, ExternalLink, Copy } from 'lucide-react';
import { login } from '../store/slices/authSlice';
import { RootState, AppDispatch } from '../store';
import api from '../services/api';

interface PublicCluster {
  id: string;
  name: string;
  publicCode: string;
  logoUrl: string | null;
  addressLine1: string | null;
  city: string | null;
  _count: { clusterMembers: number };
  owner: { id: string; name: string; phone: string } | null;
}

// Owner-phone → demo password lookup. Cluster Owner credentials live in
// the populator script and the seed; this mapping lets the login page
// surface the password alongside the phone returned by /clusters/public.
const CLUSTER_OWNER_PASSWORDS: Record<string, string> = {
  '9555555555': 'Cluster@123',
};

interface FormValues { phone: string; password: string; }

// Demo accounts — credentials live in /tmp/populate-cluster-demo.py and the
// seed.ts welcome banner. Kept here so users hitting the login page during
// dev / demo can pick a role and click to auto-fill the form without having
// to memorise or re-type the phone/password pairs.
const DEMO_ACCOUNTS: Array<{ role: string; phone: string; pass: string; scope: string }> = [
  { role: 'Platform Admin',  phone: '9000000000', pass: 'Admin@123',   scope: 'Manages all businesses + clusters' },
  { role: 'Business Owner',  phone: '9876543210', pass: 'Owner@123',   scope: 'Demo Restaurant (multi-outlet)' },
  { role: 'Cluster Owner',   phone: '9555555555', pass: 'Cluster@123', scope: 'Demo Food Court — manages member outlets' },
  { role: 'Outlet Admin',    phone: '9999000000', pass: 'Outlet@123',  scope: 'Koramangala outlet' },
  { role: 'Kitchen Chef',    phone: '9111000001', pass: 'Chef@123',    scope: 'Ramesh Chef — kitchen station' },
  { role: 'Kitchen Chef',    phone: '9111000004', pass: 'Chef@123',    scope: 'Vinod Chef — kitchen station' },
  { role: 'Cashier',         phone: '9111000002', pass: 'Cash@123',    scope: 'Counter — payments + service' },
  { role: 'Store Manager',   phone: '9111000003', pass: 'Store@123',   scope: 'Inventory + procurement' },
];

const FEATURES = [
  { icon: ShoppingBag, label: 'Smart Ordering',   desc: 'QR-based table ordering with real-time kitchen sync' },
  { icon: ChefHat,     label: 'Kitchen Display',   desc: 'Live KDS with priority queues and preparation timers' },
  { icon: BarChart3,   label: 'Business Analytics',desc: 'Revenue, peak hours, menu insights at a glance' },
  { icon: Zap,         label: 'Instant Payments',  desc: 'UPI, cards and wallets — fully integrated' },
];

export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { token, loading } = useSelector((s: RootState) => s.auth);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>();

  // Click-to-fill from the demo accounts table. Populates the form so the
  // user just hits Sign In — no copy/paste.
  const fillDemo = (phone: string, pass: string) => {
    setValue('phone', phone, { shouldValidate: true });
    setValue('password', pass, { shouldValidate: true });
  };

  // Surface any live cluster businesses so the demo's QR-shell URL is
  // discoverable without digging through the admin. Public endpoint —
  // no token required.
  const [clusters, setClusters] = useState<PublicCluster[]>([]);
  useEffect(() => {
    api.get<{ data: PublicCluster[] }>('/clusters/public')
      .then(({ data }) => setClusters(data.data || []))
      .catch(() => { /* silent — clusters block just stays hidden */ });
  }, []);

  // The customer PWA lives on a separate Vite dev server. We surface the
  // URL via env so prod / non-default-port setups still work.
  const customerAppUrl = (import.meta as any).env?.VITE_CUSTOMER_URL || 'http://localhost:5174';

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed');
    }
  };

  useEffect(() => { if (token) navigate('/dashboard', { replace: true }); }, [token]);

  const onSubmit = async (data: FormValues) => {
    const result = await dispatch(login(data));
    if (login.fulfilled.match(result)) {
      toast.success('Welcome back!');
    } else {
      toast.error(result.payload as string || 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#f0f2f8' }}>

      {/* ── Left panel ──────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[520px] shrink-0 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0a0f1e 0%, #0f172a 50%, #1a0a2e 100%)' }}>

        {/* Background mesh */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, #004D4D 0%, transparent 70%)' }} />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #004D4D 0%, transparent 70%)' }} />
          {/* Grid lines */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        {/* Content */}
        <div className="relative flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-lg"
              style={{ background: 'linear-gradient(135deg, #004D4D, #003939)' }}>P</div>
            <div>
              <p className="text-white font-bold text-lg leading-none">PayNPik</p>
              <p className="text-slate-500 text-xs mt-0.5">Restaurant Platform</p>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-16 flex-1">
            <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
              Run your restaurant<br />
              <span style={{ WebkitTextFillColor: 'transparent', background: 'linear-gradient(135deg,#004D4D,#339999)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
                with confidence.
              </span>
            </h1>
            <p className="text-slate-400 mt-4 text-base leading-relaxed max-w-xs">
              End-to-end restaurant management — from QR ordering to kitchen display, inventory to analytics.
            </p>

            {/* Feature list */}
            <div className="mt-10 space-y-5">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(249,115,22,.15)', border: '1px solid rgba(249,115,22,.2)' }}>
                    <Icon size={16} className="text-brand-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{label}</p>
                    <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            {[{ v: '50K+', l: 'Daily orders' }, { v: '2K+', l: 'Restaurants' }, { v: '99.9%', l: 'Uptime' }].map(s => (
              <div key={s.l} className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                <p className="text-xl font-black text-white">{s.v}</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel (form) ───────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm"
              style={{ background: 'linear-gradient(135deg,#004D4D,#003939)' }}>P</div>
            <span className="text-slate-900 font-bold text-lg">PayNPik</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sign in</h2>
            <p className="text-slate-500 text-sm mt-1.5">Enter your credentials to access your dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                Phone Number
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input {...register('phone', { required: 'Phone number is required' })}
                  type="tel" placeholder="9876543210" className="input pl-10" />
              </div>
              {errors.phone && <p className="text-red-500 text-xs mt-1.5">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input {...register('password', { required: 'Password is required' })}
                  type="password" placeholder="••••••••" className="input pl-10" />
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full mt-2">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">Sign In <ArrowRight size={16} /></span>
              )}
            </button>
          </form>

          {/* Demo credentials — click any row to auto-fill the form. */}
          <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50/60 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-blue-100 flex items-center justify-between">
              <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                <Zap size={11} /> Demo Accounts
              </p>
              <p className="text-[10px] text-blue-500 flex items-center gap-1">
                <MousePointer2 size={9} /> click a row to auto-fill
              </p>
            </div>
            <div className="divide-y divide-blue-100">
              {DEMO_ACCOUNTS.map((c) => (
                <button
                  key={`${c.phone}-${c.scope}`}
                  type="button"
                  onClick={() => fillDemo(c.phone, c.pass)}
                  className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-blue-100/60 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-blue-800 truncate">{c.role}</p>
                    <p className="text-[10px] text-blue-500 truncate">{c.scope}</p>
                  </div>
                  <div className="font-mono text-[11px] text-blue-700 whitespace-nowrap">
                    <span className="font-bold">{c.phone}</span>
                    <span className="text-blue-300 mx-1">/</span>
                    <span>{c.pass}</span>
                  </div>
                </button>
              ))}
            </div>
            {/* Customer-app pointer — customers use OTP, not phone/password,
                so they don't fit the form above. Surfacing it here so the
                whole demo's entry points are visible in one frame. */}
            <div className="px-4 py-2.5 border-t border-blue-100 bg-blue-100/30 text-[11px] text-blue-700 flex items-center gap-2">
              <Smartphone size={11} />
              <span>
                Customer PWA → <a href={customerAppUrl} target="_blank" rel="noreferrer" className="font-bold underline">{customerAppUrl.replace(/^https?:\/\//, '')}</a> · any phone · OTP <span className="font-mono font-bold">123789</span>
              </span>
            </div>
          </div>

          {/* ── Cluster demo entries ────────────────────────────
              Listed automatically — the populator script creates the
              "Demo Food Court" cluster; this block surfaces its
              customer URL + the admin deep-link. The Platform Admin row
              above is the credentials side of "manage this cluster". */}
          {clusters.length > 0 && (
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-indigo-100 flex items-center justify-between">
                <p className="text-xs font-bold text-indigo-700 flex items-center gap-1.5">
                  <Network size={11} /> Clusters
                </p>
                <p className="text-[10px] text-indigo-500">food-court demo</p>
              </div>
              <div className="divide-y divide-indigo-100">
                {clusters.map((c) => {
                  const customerUrl = `${customerAppUrl}/cluster/${c.publicCode}`;
                  const adminPath = `/platform/clusters/${c.id}`;
                  const ownerPass = c.owner ? CLUSTER_OWNER_PASSWORDS[c.owner.phone] : undefined;
                  return (
                    <div key={c.id} className="px-4 py-2.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {c.logoUrl ? (
                          <img src={c.logoUrl} alt="" className="w-6 h-6 rounded-md object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center">
                            <Network size={11} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-indigo-800 truncate">{c.name}</p>
                          <p className="text-[10px] text-indigo-500 truncate">
                            {[c.addressLine1, c.city].filter(Boolean).join(', ') || 'Cluster'} · {c._count.clusterMembers} outlets
                          </p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(c.publicCode, 'Cluster code')}
                          className="font-mono text-[10px] text-indigo-700 bg-white/70 border border-indigo-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1 hover:bg-white"
                          title="Copy cluster code"
                        >
                          {c.publicCode} <Copy size={9} />
                        </button>
                      </div>

                      {/* Owner credentials — click to auto-fill the login
                          form. Surfacing this in the cluster card so the
                          Cluster Owner sign-in is discoverable in context. */}
                      {c.owner && ownerPass && (
                        <button
                          type="button"
                          onClick={() => fillDemo(c.owner!.phone, ownerPass)}
                          className="w-full flex items-center gap-2 bg-white/70 hover:bg-white border border-indigo-200 rounded-lg px-2 py-1.5 text-left"
                          title="Click to auto-fill the login form"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-indigo-500 leading-tight">Cluster Owner login</p>
                            <p className="text-[11px] font-bold text-indigo-800 truncate">{c.owner.name}</p>
                          </div>
                          <div className="font-mono text-[11px] text-indigo-700 whitespace-nowrap text-right">
                            <div className="font-bold">{c.owner.phone}</div>
                            <div className="text-indigo-500 text-[10px]">{ownerPass}</div>
                          </div>
                          <MousePointer2 size={11} className="text-indigo-400 shrink-0" />
                        </button>
                      )}

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a
                          href={customerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-white border border-indigo-200 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50"
                        >
                          <Smartphone size={10} /> Customer shell <ExternalLink size={9} />
                        </a>
                        <button
                          onClick={() => navigate(adminPath)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-white border border-indigo-200 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50"
                          title="Cluster Owner or Platform Admin"
                        >
                          <Lock size={10} /> Admin view
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-2 border-t border-indigo-100 bg-indigo-100/30 text-[10px] text-indigo-700 leading-relaxed space-y-0.5">
                <p>Click the <span className="font-bold">Cluster Owner</span> credentials to auto-fill the form — signing in lands you straight on the cluster admin page.</p>
                <p>
                  Each brand outlet has its own owner —{' '}
                  <span className="font-mono font-bold">9111111101</span>…<span className="font-mono font-bold">5</span>{' '}
                  / <span className="font-mono font-bold">Owner@123</span>{' '}
                  (Lotus Tiffin, Saffron Wok, Pizza Junction, Burger Forge, Tandoor Tales).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
