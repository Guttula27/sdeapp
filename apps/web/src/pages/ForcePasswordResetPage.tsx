import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { AppDispatch, RootState } from '../store';
import { setUser } from '../store/slices/authSlice';
import api from '../services/api';

export default function ForcePasswordResetPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow]       = useState<Record<string, boolean>>({});
  const [saving, setSaving]   = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !next || next !== confirm) {
      toast.error('Fill all fields and make sure passwords match');
      return;
    }
    if (next.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (next === current) { toast.error('New password must be different from the current one'); return; }
    setSaving(true);
    try {
      await api.patch(`/users/${user.id}`, { currentPassword: current, newPassword: next });
      // Clear the flag locally so we don't bounce back here
      dispatch(setUser({ ...user, mustChangePassword: false }));
      toast.success('Password updated');
      navigate('/', { replace: true });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gold-500 hover:bg-gold-600 text-charcoal-900 px-6 py-5 text-white">
          <Shield size={28} className="mb-2" />
          <p className="text-lg font-black">Set a new password</p>
          <p className="text-xs text-white/80 mt-0.5">
            For security, you must change your password before continuing.
          </p>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {(['current', 'next', 'confirm'] as const).map(k => (
            <div key={k}>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                <Lock size={11} />
                {k === 'current' ? 'Current password' : k === 'next' ? 'New password' : 'Confirm new password'}
              </label>
              <div className="relative">
                <input
                  type={show[k] ? 'text' : 'password'}
                  value={k === 'current' ? current : k === 'next' ? next : confirm}
                  onChange={e => k === 'current' ? setCurrent(e.target.value) : k === 'next' ? setNext(e.target.value) : setConfirm(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••"
                  required
                />
                <button type="button" onClick={() => setShow(p => ({ ...p, [k]: !p[k] }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show[k] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          ))}
          {next && confirm && next !== confirm && (
            <p className="text-xs text-red-500">Passwords don't match</p>
          )}
          <button type="submit" disabled={saving} className="w-full btn-primary justify-center">
            {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Set new password
          </button>
        </form>
      </div>
    </div>
  );
}
