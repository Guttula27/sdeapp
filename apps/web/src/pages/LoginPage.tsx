import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Trans, useTranslation } from 'react-i18next';
import { Phone, Lock, ArrowRight, Zap, BarChart3, ShoppingBag, ChefHat, Smartphone, MousePointer2, Network, ExternalLink, Copy } from 'lucide-react';
import { login } from '../store/slices/authSlice';
import { RootState, AppDispatch } from '../store';
import api from '../services/api';
import LanguageSwitcher from '../components/common/LanguageSwitcher';

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
// to memorise or re-type the phone/password pairs. `roleKey` / `scopeKey`
// are i18n key stems (login.demoRole*, login.demoScope*) resolved at render.
const DEMO_ACCOUNTS: Array<{ roleKey: string; scopeKey: string; phone: string; pass: string }> = [
  { roleKey: 'demoRolePlatformAdmin', phone: '9000000000', pass: 'Admin@123',   scopeKey: 'demoScopePlatformAdmin' },
  { roleKey: 'demoRoleBusinessOwner', phone: '9876543210', pass: 'Owner@123',   scopeKey: 'demoScopeBusinessOwner' },
  { roleKey: 'demoRoleClusterOwner',  phone: '9555555555', pass: 'Cluster@123', scopeKey: 'demoScopeClusterOwner' },
  { roleKey: 'demoRoleOutletAdmin',   phone: '9999000000', pass: 'Outlet@123',  scopeKey: 'demoScopeOutletAdmin' },
  { roleKey: 'demoRoleKitchenChef',   phone: '9111000001', pass: 'Chef@123',    scopeKey: 'demoScopeKitchenChefRamesh' },
  { roleKey: 'demoRoleKitchenChef',   phone: '9111000004', pass: 'Chef@123',    scopeKey: 'demoScopeKitchenChefVinod' },
  { roleKey: 'demoRoleCashier',       phone: '9111000002', pass: 'Cash@123',    scopeKey: 'demoScopeCashier' },
  { roleKey: 'demoRoleStoreManager',  phone: '9111000003', pass: 'Store@123',   scopeKey: 'demoScopeStoreManager' },
];

const FEATURES = [
  { icon: ShoppingBag, labelKey: 'featureOrderingLabel',  descKey: 'featureOrderingDesc' },
  { icon: ChefHat,     labelKey: 'featureKitchenLabel',   descKey: 'featureKitchenDesc' },
  { icon: BarChart3,   labelKey: 'featureAnalyticsLabel', descKey: 'featureAnalyticsDesc' },
  { icon: Zap,         labelKey: 'featurePaymentsLabel',  descKey: 'featurePaymentsDesc' },
];

export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
      toast.success(t('common.copied', { label }));
    } catch {
      toast.error(t('common.copyFailed'));
    }
  };

  useEffect(() => { if (token) navigate('/dashboard', { replace: true }); }, [token]);

  const onSubmit = async (data: FormValues) => {
    const result = await dispatch(login(data));
    if (login.fulfilled.match(result)) {
      toast.success(t('login.welcomeBack'));
    } else {
      toast.error(result.payload as string || t('login.invalidCredentials'));
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
            style={{ background: 'radial-gradient(circle, #0B4245 0%, transparent 70%)' }} />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #0B4245 0%, transparent 70%)' }} />
          {/* Grid lines */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
          {/* Brand pyramid watermark — sits behind the marketing copy
              with a slow drift animation so it reads as a living
              visual rather than a stamped graphic. Low opacity keeps
              the headline + features readable. */}
          <img
            src="/vezeor-hero.png"
            alt=""
            aria-hidden="true"
            className="absolute opacity-[0.18] mix-blend-screen select-none"
            style={{
              right: -90, bottom: -60, width: 720, maxWidth: 'none',
              animation: 'vezeor-login-drift 12s ease-in-out infinite',
              filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.4))',
            }}
          />
          <style>{`
            @keyframes vezeor-login-drift {
              0%, 100% { transform: translateY(0) scale(1); }
              50%      { transform: translateY(-10px) scale(1.015); }
            }
          `}</style>
        </div>

        {/* Content */}
        <div className="relative flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="VEZEOR" className="w-10 h-10 object-contain" />
            <div>
              <p className="text-white font-bold text-lg leading-none">{t('login.brand')}</p>
              <p className="text-slate-500 text-xs mt-0.5">{t('login.brandTagline')}</p>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-16 flex-1">
            <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
              {t('login.heroTitleTop')}<br />
              <span style={{ WebkitTextFillColor: 'transparent', background: 'linear-gradient(135deg,#0B4245,#477f82)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
                {t('login.heroTitleBottom')}
              </span>
            </h1>
            <p className="text-slate-400 mt-4 text-base leading-relaxed max-w-xs">
              {t('login.heroDescription')}
            </p>

            {/* Feature list */}
            <div className="mt-10 space-y-5">
              {FEATURES.map(({ icon: Icon, labelKey, descKey }) => (
                <div key={labelKey} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(249,115,22,.15)', border: '1px solid rgba(249,115,22,.2)' }}>
                    <Icon size={16} className="text-brand-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{t(`login.${labelKey}`)}</p>
                    <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{t(`login.${descKey}`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              { v: t('login.statOrdersValue'),      l: t('login.statOrdersLabel') },
              { v: t('login.statRestaurantsValue'), l: t('login.statRestaurantsLabel') },
              { v: t('login.statUptimeValue'),      l: t('login.statUptimeLabel') },
            ].map(s => (
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
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        {/* Language switcher — sits above the form so a first-time user can
            pick their language before even entering credentials. */}
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <img src="/logo.png" alt="VEZEOR" className="w-9 h-9 object-contain" />
            <span className="text-slate-900 font-bold text-lg">{t('login.brand')}</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('login.signIn')}</h2>
            <p className="text-slate-500 text-sm mt-1.5">{t('login.signInSubtitle')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                {t('login.phoneLabel')}
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input {...register('phone', { required: t('login.phoneRequired') })}
                  type="tel" placeholder={t('login.phonePlaceholder')} className="input pl-10" />
              </div>
              {errors.phone && <p className="text-red-500 text-xs mt-1.5">{errors.phone.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {t('login.passwordLabel')}
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  {t('login.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input {...register('password', { required: t('login.passwordRequired') })}
                  type="password" placeholder="••••••••" className="input pl-10" />
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full mt-2">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('login.signingIn')}
                </span>
              ) : (
                <span className="flex items-center gap-2">{t('login.signInCta')} <ArrowRight size={16} /></span>
              )}
            </button>
          </form>

          {/* Demo credentials — click any row to auto-fill the form. */}
          <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50/60 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-blue-100 flex items-center justify-between">
              <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                <Zap size={11} /> {t('login.demoAccountsTitle')}
              </p>
              <p className="text-[10px] text-blue-500 flex items-center gap-1">
                <MousePointer2 size={9} /> {t('login.demoAccountsHint')}
              </p>
            </div>
            <div className="divide-y divide-blue-100">
              {DEMO_ACCOUNTS.map((c) => (
                <button
                  key={`${c.phone}-${c.scopeKey}`}
                  type="button"
                  onClick={() => fillDemo(c.phone, c.pass)}
                  className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-blue-100/60 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-blue-800 truncate">{t(`login.${c.roleKey}`)}</p>
                    <p className="text-[10px] text-blue-500 truncate">{t(`login.${c.scopeKey}`)}</p>
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
                <Trans
                  i18nKey="login.customerPwaLine"
                  values={{ url: customerAppUrl.replace(/^https?:\/\//, ''), otp: '123789' }}
                  components={{
                    link: <a href={customerAppUrl} target="_blank" rel="noreferrer" className="font-bold underline" />,
                    code: <span className="font-mono font-bold" />,
                  }}
                />
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
                  <Network size={11} /> {t('login.clustersTitle')}
                </p>
                <p className="text-[10px] text-indigo-500">{t('login.clustersSubtitle')}</p>
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
                            {[c.addressLine1, c.city].filter(Boolean).join(', ') || t('login.clusterFallback')} · {t('login.clusterOutlets', { count: c._count.clusterMembers })}
                          </p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(c.publicCode, t('login.clusterCodeLabel'))}
                          className="font-mono text-[10px] text-indigo-700 bg-white/70 border border-indigo-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1 hover:bg-white"
                          title={t('login.copyClusterCode')}
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
                          title={t('login.clusterOwnerAutofillTitle')}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-indigo-500 leading-tight">{t('login.clusterOwnerLoginLabel')}</p>
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
                          <Smartphone size={10} /> {t('login.customerShell')} <ExternalLink size={9} />
                        </a>
                        <button
                          onClick={() => navigate(adminPath)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-white border border-indigo-200 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50"
                          title={t('login.adminViewTitle')}
                        >
                          <Lock size={10} /> {t('login.adminView')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-2 border-t border-indigo-100 bg-indigo-100/30 text-[10px] text-indigo-700 leading-relaxed space-y-0.5">
                <p>
                  <Trans
                    i18nKey="login.clusterAdminCopyHint"
                    components={{ bold: <span className="font-bold" /> }}
                  />
                </p>
                <p>
                  <Trans
                    i18nKey="login.outletOwnersLine"
                    components={{ mono: <span className="font-mono font-bold" /> }}
                  />
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
