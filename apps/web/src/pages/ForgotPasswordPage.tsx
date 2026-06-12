import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Phone, Lock, ArrowRight, ArrowLeft, KeyRound, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';

type Step = 'phone' | 'verify';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone.trim())) {
      toast.error('Enter a 10-digit phone number');
      return;
    }
    setSending(true);
    try {
      const { data } = await api.post('/auth/admin/forgot-password/request', { phone: phone.trim() });
      // Same message regardless of whether the phone is on file — server
      // deliberately returns a generic success to prevent enumeration.
      toast.success(data?.data?.message || 'If this phone is registered, an OTP has been sent.');
      setStep('verify');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Could not send OTP');
    } finally {
      setSending(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { toast.error('OTP is 6 digits'); return; }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (newPassword !== confirm) { toast.error('Passwords do not match'); return; }
    setResetting(true);
    try {
      await api.post('/auth/admin/forgot-password/reset', {
        phone: phone.trim(),
        otp: otp.trim(),
        newPassword,
      });
      toast.success('Password reset. Please sign in.');
      navigate('/login', { replace: true });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#f0f2f8' }}>
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-2.5 mb-8">
          <img src="/logo.png" alt="VEZEOR" className="w-9 h-9 object-contain" />
          <span className="text-slate-900 font-bold text-lg">VEZEOR</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={18} className="text-brand-500" />
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Forgot password</h2>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {step === 'phone'
              ? 'Enter your registered phone number to receive a one-time code.'
              : `We sent a 6-digit code to ${phone}. Enter it below along with your new password.`}
          </p>

          {step === 'phone' && (
            <form onSubmit={requestOtp} className="space-y-5 mt-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Phone Number</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    type="tel"
                    placeholder="9876543210"
                    className="input pl-10"
                    autoFocus
                  />
                </div>
              </div>
              <button type="submit" disabled={sending} className="btn-primary btn-lg w-full">
                {sending ? 'Sending OTP…' : (<span className="flex items-center gap-2">Send OTP <ArrowRight size={16} /></span>)}
              </button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={reset} className="space-y-4 mt-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">OTP</label>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input font-mono tracking-[0.4em] text-center text-lg"
                  placeholder="••••••"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">New password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input pl-10 pr-10"
                    placeholder="At least 8 characters"
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Confirm new password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="input pl-10"
                    placeholder="Re-enter the new password"
                  />
                </div>
              </div>

              <button type="submit" disabled={resetting} className="btn-primary btn-lg w-full mt-2">
                {resetting ? 'Resetting…' : 'Reset password'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('phone'); setOtp(''); setNewPassword(''); setConfirm(''); }}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 mt-1"
              >
                <ArrowLeft size={12} /> Use a different phone number
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link to="/login" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
