import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Phone, ArrowLeft, UtensilsCrossed, User, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { useCustomerAuth } from '../context/CustomerAuthContext';

type Step = 'phone' | 'otp';

const OTP_LENGTH = 6;

export default function AuthPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useCustomerAuth();

  const [step, setStep]       = useState<Step>('phone');
  const [phone, setPhone]     = useState('');
  const [name, setName]       = useState('');
  const [otp, setOtp]         = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const from = (location.state as any)?.from || '/';
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  /* ── Resend cooldown ────────────────────────────────── */
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  /* ── Step 1: request OTP ────────────────────────────── */
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) {
      toast.error('Enter a valid 10-digit number');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/customer/request-otp', { phone });
      toast.success('OTP sent to your phone');
      setStep('otp');
      setOtp(Array(OTP_LENGTH).fill(''));
      setResendIn(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 2: verify OTP ─────────────────────────────── */
  const handleVerifyOtp = async (code: string) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/customer/verify-otp', {
        phone,
        otp: code,
        name: name.trim() || undefined,
      });
      const { user, accessToken } = res.data.data;
      login(user, accessToken);
      toast.success(`Welcome${user.name ? `, ${user.name.split(' ')[0]}` : ''}!`);
      // Prefer the pending-scan target if the customer was sent here
      // by a QR scan (ScanResolverPage stashes it before redirecting).
      // Falls back to location.state.from for non-scan auth flows.
      let dest = from;
      try {
        const pending = localStorage.getItem('paynpik-pending-scan');
        if (pending) {
          localStorage.removeItem('paynpik-pending-scan');
          dest = pending;
        }
      } catch { /* ignore — private mode etc. */ }
      navigate(dest, { replace: true });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Invalid OTP');
      setOtp(Array(OTP_LENGTH).fill(''));
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const onOtpChange = (i: number, v: string) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus();
    if (next.every(d => d) && next.join('').length === OTP_LENGTH) {
      handleVerifyOtp(next.join(''));
    }
  };

  const onOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  };

  const onOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!text) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setOtp(next);
    if (text.length === OTP_LENGTH) handleVerifyOtp(text);
    else otpRefs.current[text.length]?.focus();
  };

  const resend = async () => {
    if (resendIn > 0) return;
    try {
      await api.post('/auth/customer/request-otp', { phone });
      toast.success('OTP resent');
      setResendIn(30);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to resend OTP');
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-5 pt-10 pb-16 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-brand-500/20 rounded-full blur-3xl" />
        <button
          onClick={() => (step === 'otp' ? setStep('phone') : navigate(-1))}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm mb-6"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-400 rounded-xl flex items-center justify-center shadow-lg">
            <UtensilsCrossed size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black text-lg leading-tight">PayNPik</p>
            <p className="text-slate-400 text-xs">
              {step === 'phone' ? 'Sign in with your phone' : 'Enter the OTP we just sent'}
            </p>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 px-4 -mt-8 relative z-10 pb-8">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-6">
            {step === 'phone' && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <FormField label="Your Name (optional)">
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="So we know what to call you"
                      className="input pl-10"
                      autoComplete="name"
                    />
                  </div>
                </FormField>

                <FormField label="Phone Number">
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      type="tel"
                      placeholder="9876543210"
                      className="input pl-10"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={10}
                    />
                  </div>
                </FormField>

                <SubmitBtn loading={loading} label="Send OTP" />

                <p className="text-center text-[11px] text-slate-400">
                  We'll text you a 6-digit code to confirm it's you. New numbers create a new account automatically.
                </p>
              </form>
            )}

            {step === 'otp' && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 bg-brand-50 border border-brand-100 rounded-2xl px-3 py-2.5">
                  <ShieldCheck size={18} className="text-brand-600" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">OTP sent to</p>
                    <p className="text-sm font-semibold text-slate-900">+91 {phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('phone')}
                    className="text-xs font-semibold text-brand-600 hover:underline"
                  >
                    Change
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                    Enter 6-digit OTP
                  </label>
                  <div className="flex gap-2 justify-between">
                    {otp.map((d, i) => (
                      <input
                        key={i}
                        ref={el => (otpRefs.current[i] = el)}
                        value={d}
                        onChange={e => onOtpChange(i, e.target.value)}
                        onKeyDown={e => onOtpKeyDown(i, e)}
                        onPaste={onOtpPaste}
                        inputMode="numeric"
                        maxLength={1}
                        className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-200 rounded-2xl focus:border-brand-500 focus:outline-none transition-colors"
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Testing mode — the default OTP is{' '}
                    <span className="font-mono font-bold text-slate-600">123789</span>.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={loading || otp.join('').length !== OTP_LENGTH}
                  onClick={() => handleVerifyOtp(otp.join(''))}
                  className="w-full bg-gradient-to-r from-brand-500 to-brand-400 text-white font-bold py-4 rounded-2xl shadow-md disabled:opacity-50 transition-all active:scale-[.98] flex items-center justify-center gap-2"
                >
                  {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  Verify & Sign In
                </button>

                <p className="text-center text-sm text-slate-500">
                  Didn't get it?{' '}
                  <button
                    type="button"
                    onClick={resend}
                    disabled={resendIn > 0}
                    className="text-brand-600 font-semibold hover:underline disabled:text-slate-400 disabled:no-underline"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend OTP'}
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4 px-4">
          You can also browse and order as a guest — signing in links your orders to your account.
        </p>
      </div>
    </div>
  );
}

/* ── Shared sub-components ───────────────────────────────── */
function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-gradient-to-r from-brand-500 to-brand-400 text-white font-bold py-4 rounded-2xl shadow-md disabled:opacity-60 transition-all active:scale-[.98] flex items-center justify-center gap-2 mt-2"
    >
      {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
      {label}
    </button>
  );
}
