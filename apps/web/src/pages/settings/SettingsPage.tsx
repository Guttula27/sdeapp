import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  User, Phone, Mail, Shield, Building2, Lock, Eye, EyeOff, Languages,
  Tag, Sandwich, Flame, LayoutGrid, ChevronRight, ConciergeBell,
  Plug, MessageCircle, ClipboardCheck, Copy,
} from 'lucide-react';
import { RootState } from '../../store';
import { useUserRole, UserTier } from '../../hooks/useUserRole';
import api from '../../services/api';

type Section = { to: string; icon: any; label: string; description: string };
const SECTIONS_BY_TIER: Record<UserTier, Section[]> = {
  platform: [
    { to: '/roles',              icon: Shield,         label: 'Roles',             description: 'Define roles and grant permissions' },
    { to: '/languages',          icon: Languages,      label: 'Languages',         description: 'Enable supported platform languages' },
    { to: '/integrations',       icon: Plug,           label: 'Integrations',      description: 'WhatsApp, SMS, Email and payment gateway providers' },
    { to: '/template-approvals', icon: ClipboardCheck, label: 'Template Approvals', description: 'Review and approve templates from businesses & outlets' },
  ],
  business: [
    { to: '/roles',     icon: Shield,        label: 'Roles',     description: 'Roles for your business and outlets' },
    { to: '/messaging', icon: MessageCircle, label: 'Messaging', description: 'WhatsApp, SMS and Email templates for customers' },
  ],
  outlet: [
    { to: '/roles',       icon: Shield,     label: 'Roles',       description: 'Adjust permissions for outlet roles' },
    { to: '/tags',        icon: Tag,        label: 'Tags',        description: 'Customer tags and tag-based pricing' },
    { to: '/table-types', icon: LayoutGrid, label: 'Dine In Sections', description: 'Per-section pricing, menu availability and tables' },
    { to: '/stations',    icon: Flame,      label: 'Stations',    description: 'Kitchen stations for item routing' },
    { to: '/service-stations', icon: ConciergeBell, label: 'Service Stations', description: 'Floor staff grouped by dine-in section for table service' },
    { to: '/toppings',    icon: Sandwich,   label: 'Toppings',    description: 'Topping groups and option pricing' },
    { to: '/messaging',   icon: MessageCircle, label: 'Messaging', description: 'WhatsApp, SMS and Email templates for customers' },
  ],
  kitchen: [],
  counter: [],
  store:   [],
};

function InfoRow({ label, value, icon: Icon }: { label: string; value?: string | null; icon: any }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="icon-wrap w-8 h-8 bg-slate-100 text-slate-500 shrink-0"><Icon size={14} /></div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{value || '—'}</p>
      </div>
    </div>
  );
}

interface PwForm { current: string; next: string; confirm: string; }

export default function SettingsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const { tier } = useUserRole();
  const sections = SECTIONS_BY_TIER[tier] ?? [];
  const { t, i18n } = useTranslation();
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [languages, setLanguages] = useState<{ code: string; name: string; nativeName: string }[]>([]);
  const [lang, setLang] = useState<string>(user?.preferredLanguage || 'en');
  // Outlet reference code for outlet-tier admins. Shown as a copyable badge
  // near the top of the settings page since this is the place admins land
  // when they need their outlet identifier (support tickets, integrations, etc.).
  const [outletCode, setOutletCode] = useState<string | null>(null);
  const [outletName, setOutletName] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors }, watch } = useForm<PwForm>();
  const nextPw = watch('next');

  useEffect(() => {
    api.get('/languages')
      .then(({ data }) => setLanguages(data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.outletId) { setOutletCode(null); setOutletName(null); return; }
    api.get(`/outlets/${user.outletId}`)
      .then(({ data }) => {
        setOutletCode(data?.data?.publicCode ?? null);
        setOutletName(data?.data?.name ?? null);
      })
      .catch(() => {});
  }, [user?.outletId]);

  const copyOutletCode = () => {
    if (!outletCode) return;
    navigator.clipboard?.writeText(outletCode);
    toast.success(`Copied ${outletCode}`);
  };

  const saveLanguage = async (code: string) => {
    setLang(code);
    try {
      await api.patch('/users/me/language', { preferredLanguage: code });
      localStorage.setItem('preferredLanguage', code);
      await i18n.changeLanguage(code);
      toast.success('Language updated');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update language');
    }
  };

  const togglePw = (field: string) => setShowPw(p => ({ ...p, [field]: !p[field] }));

  const changePassword = async (data: PwForm) => {
    setSaving(true);
    try {
      await api.patch(`/users/${user.id}`, { currentPassword: data.current, newPassword: data.next });
      toast.success('Password updated');
      reset();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update password');
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="page-title">{t('settings.title')}</h1>
        <p className="page-subtitle">{t('settings.subtitle')}</p>
      </div>

      {/* Outlet reference code — shown for outlet-tier users so they always
          know their outlet's short identifier (used in support, invoices, etc.). */}
      {outletCode && (
        <div className="card p-4 flex items-center justify-between gap-3 border-l-4 border-brand-500">
          <div className="flex items-center gap-3 min-w-0">
            <div className="icon-wrap w-10 h-10 bg-brand-50 text-brand-600 shrink-0"><Building2 size={18} /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outlet Reference Code</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="font-mono font-black text-lg text-slate-900 tracking-wider">{outletCode}</p>
                <button
                  type="button"
                  onClick={copyOutletCode}
                  className="btn-ghost p-1 text-slate-400 hover:text-brand-600"
                  title="Copy code"
                >
                  <Copy size={14} />
                </button>
              </div>
              {outletName && <p className="text-xs text-slate-500 truncate">{outletName}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Settings subsections — appears for tiers that have admin areas. */}
      {sections.length > 0 && (
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Configuration</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.to}
                  to={s.to}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-brand-200 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-50 text-brand-600 shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{s.label}</p>
                    <p className="text-[11px] text-slate-500 truncate">{s.description}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-500 shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Profile card */}
      <div className="card overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 relative">
          <div className="absolute -bottom-8 left-6">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-400 rounded-2xl border-4 border-white flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-2xl">{user?.name?.[0]}</span>
            </div>
          </div>
        </div>
        <div className="px-6 pt-12 pb-6">
          <p className="text-xl font-black text-slate-900">{user?.name}</p>
          {user?.role && <span className="badge badge-orange mt-1">{user.role.name}</span>}
          <div className="mt-4">
            <InfoRow label="Phone"       value={user?.phone}      icon={Phone} />
            <InfoRow label="Email"       value={user?.email}      icon={Mail} />
            <InfoRow label="Role"        value={user?.role?.name} icon={Shield} />
            {user?.businessId && <InfoRow label="Business ID" value={user.businessId} icon={Building2} />}
          </div>
        </div>
      </div>

      {/* Preferred language */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Languages size={15} className="text-brand-500" />
          <h2 className="text-sm font-bold text-slate-800">{t('settings.preferredLanguage')}</h2>
        </div>
        <p className="text-xs text-slate-500 mb-3">{t('settings.preferredLanguageHint')}</p>
        <select
          value={lang}
          onChange={(e) => saveLanguage(e.target.value)}
          className="input"
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName} ({l.name})
            </option>
          ))}
        </select>
      </div>

      {/* Permissions */}
      {user?.role?.responsibilities?.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={15} className="text-brand-500" />
            <h2 className="text-sm font-bold text-slate-800">Permissions</h2>
            <span className="badge badge-orange ml-auto">{user.role.responsibilities.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.role.responsibilities.map((r: any) => (
              <span key={r.responsibility.id} className="badge badge-slate text-xs">
                {r.responsibility.name.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Change password */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock size={15} className="text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800">Change Password</h2>
        </div>
        <form onSubmit={handleSubmit(changePassword)} className="space-y-4">
          {(['current', 'next', 'confirm'] as const).map(field => {
            const labels = { current: 'Current Password', next: 'New Password', confirm: 'Confirm New Password' };
            return (
              <div key={field}>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{labels[field]}</label>
                <div className="relative">
                  <input
                    {...register(field, {
                      required: 'Required',
                      minLength: field !== 'current' ? { value: 6, message: 'Min 6 characters' } : undefined,
                      validate: field === 'confirm' ? v => v === nextPw || 'Passwords do not match' : undefined,
                    })}
                    type={showPw[field] ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => togglePw(field)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw[field] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors[field] && <p className="text-red-500 text-xs mt-1">{errors[field].message}</p>}
              </div>
            );
          })}
          <button type="submit" disabled={saving} className="btn-primary w-full mt-2">
            {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}
