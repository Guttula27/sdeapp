import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Phone, Lock, ArrowRight, Zap, BarChart3, ShoppingBag, ChefHat } from 'lucide-react';
import { login } from '../store/slices/authSlice';
import { RootState, AppDispatch } from '../store';

interface FormValues { phone: string; password: string; }

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
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>();

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
            style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }} />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }} />
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
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>P</div>
            <div>
              <p className="text-white font-bold text-lg leading-none">PayNPik</p>
              <p className="text-slate-500 text-xs mt-0.5">Restaurant Platform</p>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-16 flex-1">
            <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
              Run your restaurant<br />
              <span style={{ WebkitTextFillColor: 'transparent', background: 'linear-gradient(135deg,#f97316,#fb923c)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
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
                    <Icon size={16} className="text-orange-400" />
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
              style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>P</div>
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

          {/* Demo credentials */}
          <div className="mt-8 rounded-xl p-4 border border-blue-100 bg-blue-50/60">
            <p className="text-xs font-bold text-blue-700 mb-2.5 flex items-center gap-1.5">
              <Zap size={11} /> Demo Accounts
            </p>
            <div className="space-y-1.5 text-xs font-mono">
              {[
                { role: 'Platform Admin',  phone: '9000000000', pass: 'Test@123' },
                { role: 'Business Owner',  phone: '9876543210', pass: 'Test@123' },
                { role: 'Outlet Admin',    phone: '9999000000', pass: 'Test@123' },
                { role: 'Kitchen Manager', phone: '9111000001', pass: 'Test@123' },
                { role: 'Cashier',         phone: '9111000002', pass: 'Test@123' },
              ].map(c => (
                <div key={c.phone} className="flex items-center gap-2 text-blue-700">
                  <span className="text-blue-400 font-sans font-medium not-italic w-32 shrink-0">{c.role}:</span>
                  <span className="font-bold">{c.phone}</span>
                  <span className="text-blue-400">/</span>
                  <span>{c.pass}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
