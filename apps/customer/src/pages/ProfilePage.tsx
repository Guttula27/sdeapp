import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  LogOut, User, Phone, Mail, Camera, X as XIcon,
  Volume2, Bell, QrCode, CreditCard, Save, Languages, Vibrate,
} from 'lucide-react';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import api from '../services/api';
import { playRingtone, isVibrateEnabled, setVibrateEnabled } from '../utils/ringtones';
import { invalidateAllCache } from '../utils/cachedGet';

const UPI_APPS = [
  { id: 'GPAY',    name: 'Google Pay' },
  { id: 'PHONEPE', name: 'PhonePe' },
  { id: 'PAYTM',   name: 'Paytm' },
  { id: 'BHIM',    name: 'BHIM' },
  { id: 'OTHER',   name: 'Other UPI' },
];

// Keep this list in sync with the catalogue in utils/ringtones.ts —
// every id here must exist there or preview falls back to "chime".
const RINGTONES = [
  { id: 'chime', name: 'Chime' },
  { id: 'bell',  name: 'Bell' },
  { id: 'ping',  name: 'Ping' },
  { id: 'buzz',  name: 'Buzz' },
  { id: 'ding',  name: 'Ding' },
  { id: 'pop',   name: 'Pop' },
  { id: 'soft',  name: 'Soft' },
];

async function fileToDataUrl(file: File, maxSize = 512, quality = 0.85): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Invalid image'));
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

function CustomerQR({ userId, name, profileImageUrl }: { userId: string; name: string; profileImageUrl?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const link = `${window.location.origin}/customer/${userId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=2&data=${encodeURIComponent(link)}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = 240;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);

    const qr = new Image();
    qr.crossOrigin = 'anonymous';
    qr.onload = () => {
      ctx.drawImage(qr, 0, 0, size, size);
      const lw = size * 0.24;
      const x = (size - lw) / 2;
      const y = x;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 6, y - 6, lw + 12, lw + 12);

      if (profileImageUrl) {
        const pic = new Image();
        pic.crossOrigin = 'anonymous';
        pic.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x + lw / 2, y + lw / 2, lw / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(pic, x, y, lw, lw);
          ctx.restore();
        };
        pic.src = profileImageUrl;
      } else {
        // initial letter circle
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(x + lw / 2, y + lw / 2, lw / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${lw * 0.5}px ui-sans-serif, system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((name || '?')[0].toUpperCase(), x + lw / 2, y + lw / 2 + 2);
      }
    };
    qr.src = qrUrl;
  }, [qrUrl, profileImageUrl, name]);

  return <canvas ref={canvasRef} className="rounded-xl border border-slate-200 bg-white" />;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, logout, login, token } = useCustomerAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>((user as any)?.profileImageUrl || null);
  const [ringtone, setRingtone] = useState((user as any)?.alertRingtone || 'chime');
  const [volume, setVolume] = useState<number>((user as any)?.alertVolume ?? 70);
  // Vibration is a per-device preference (different devices have different
  // hardware support and user expectations) so it lives in localStorage,
  // not on the user record.
  const [vibrate, setVibrate] = useState<boolean>(isVibrateEnabled());
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  const [pref, setPref] = useState<string>(user?.preferredUpiApp || 'GPAY');
  const [language, setLanguage] = useState<string>((user as any)?.preferredLanguage || 'en');
  const [languages, setLanguages] = useState<{ code: string; name: string; nativeName: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const picRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/languages').then(({ data }) => setLanguages(data.data || [])).catch(() => {});
  }, []);

  const saveLanguage = async (code: string) => {
    setLanguage(code);
    try {
      await api.patch('/users/me/language', { preferredLanguage: code });
      localStorage.setItem('preferredLanguage', code);
      await i18n.changeLanguage(code);
      // Menu/cluster responses are cached per-language. Drop everything
      // so the next visit fetches fresh in the new language; otherwise
      // the user sees the previous-language menu until the 1h TTL expires.
      invalidateAllCache();
      toast.success('Language updated');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update language');
    }
  };

  // Refetch full profile on mount so we have all fields
  useEffect(() => {
    api.get('/users/me').then(({ data }) => {
      const u = data.data;
      setName(u.name || '');
      setEmail(u.email || '');
      setPhone(u.phone || '');
      setProfileImageUrl(u.profileImageUrl || null);
      setRingtone(u.alertRingtone || 'chime');
      setVolume(u.alertVolume ?? 70);
      setPref(u.preferredUpiApp || 'GPAY');
      if (token) login(u, token);
    }).catch(() => {});
    // eslint-disable-next-line
  }, []);

  const handleLogout = () => {
    logout();
    toast('Signed out', { icon: '👋' });
    navigate('/auth');
  };

  const onPickPic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPG / PNG / WebP'); return;
    }
    if (file.size > 1024 * 1024) { toast.error('Image too large (>1 MB)'); return; }
    try {
      const url = await fileToDataUrl(file, 320, 0.85);
      setProfileImageUrl(url);
    } catch { toast.error('Could not read image'); }
  };

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/users/${user.id}`, {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim(),
        profileImageUrl,
        alertRingtone: ringtone,
        alertVolume: Number(volume),
        preferredUpiApp: pref,
      });
      if (token) login({ ...user, ...data.data }, token);
      toast.success('Profile saved');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Preview uses the shared ringtone util so the user hears exactly what
  // a real alert will play, including their volume + vibrate preference.
  const playPreview = () => {
    playRingtone(ringtone, { volume, vibrate });
  };

  const toggleVibrate = () => {
    const next = !vibrate;
    setVibrate(next);
    setVibrateEnabled(next);
  };

  return (
    <div className="max-w-md mx-auto pb-2">
      {/* Hero with avatar */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 pt-8 pb-12 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-brand-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-8 w-32 h-32 bg-orange-400/10 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-4">
          <button onClick={() => picRef.current?.click()} className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-lg ring-4 ring-white/10">
            {profileImageUrl ? (
              <img src={profileImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-brand-500 to-orange-400 flex items-center justify-center text-white font-black text-3xl">
                {name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] font-bold text-center py-1 flex items-center justify-center gap-1">
              <Camera size={10} /> Change
            </div>
          </button>
          <input ref={picRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickPic} />
          <div className="min-w-0">
            <p className="text-xl font-black text-white truncate">{name || 'You'}</p>
            <div className="flex items-center gap-1.5 text-slate-400 text-sm mt-0.5">
              <Phone size={12} />
              <span className="font-mono">{phone}</span>
            </div>
            {profileImageUrl && (
              <button
                onClick={() => setProfileImageUrl(null)}
                className="text-[10px] text-red-300 hover:text-red-400 mt-1 inline-flex items-center gap-1"
              >
                <XIcon size={10} /> Remove photo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-7 relative z-10 space-y-4">
        {/* Customer QR */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <QrCode size={14} className="text-slate-400" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Your customer QR</p>
          </div>
          <div className="flex justify-center bg-slate-50 rounded-xl p-4">
            {user?.id ? (
              <CustomerQR userId={user.id} name={name} profileImageUrl={profileImageUrl} />
            ) : (
              <p className="text-xs text-slate-400">Sign in to see your QR</p>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 text-center">Outlets can scan this to identify you and apply tags.</p>
        </div>

        {/* Identity */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Identity</p>
          <Field label="Name" icon={User}>
            <input value={name} onChange={e => setName(e.target.value)} className="input" />
          </Field>
          <Field label="Phone" icon={Phone}>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="input" />
            <p className="text-[10px] text-slate-400 mt-1">This is your login phone.</p>
          </Field>
          <Field label="Email" icon={Mail}>
            <input value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="optional" />
          </Field>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-slate-400" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Alerts</p>
          </div>
          <Field label="Ringtone">
            <div className="flex items-center gap-2">
              <select
                value={ringtone}
                onChange={e => setRingtone(e.target.value)}
                className="input flex-1"
              >
                {RINGTONES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button onClick={playPreview} className="btn-secondary text-xs"><Volume2 size={12} /> Preview</button>
            </div>
          </Field>
          <Field label={`Volume — ${volume}%`}>
            <input
              type="range" min={0} max={100} step={5}
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
          </Field>
          {/* Vibration toggle — only meaningful when the device supports it.
              On desktop / non-vibrating hardware navigator.vibrate is missing,
              so we surface a disabled hint instead of a non-functioning toggle. */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Vibrate size={14} className="text-slate-400" />
              <span className="text-sm text-slate-700">Vibrate on alert</span>
            </div>
            {canVibrate ? (
              <button
                type="button"
                onClick={toggleVibrate}
                aria-pressed={vibrate}
                className={
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' +
                  (vibrate ? 'bg-brand-500' : 'bg-slate-300')
                }
              >
                <span
                  className={
                    'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ' +
                    (vibrate ? 'translate-x-5' : 'translate-x-1')
                  }
                />
              </button>
            ) : (
              <span className="text-[10px] text-slate-400">Not supported on this device</span>
            )}
          </div>
        </div>

        {/* Language */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Languages size={14} className="text-slate-400" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('profile.preferredLanguage')}</p>
          </div>
          <p className="text-[11px] text-slate-500">{t('profile.preferredLanguageHint')}</p>
          <select
            value={language}
            onChange={e => saveLanguage(e.target.value)}
            className="input"
          >
            {languages.map(l => (
              <option key={l.code} value={l.code}>{l.nativeName} ({l.name})</option>
            ))}
          </select>
        </div>

        {/* UPI */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard size={14} className="text-slate-400" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Preferred UPI app</p>
          </div>
          <p className="text-[11px] text-slate-500">Used as the default at checkout.</p>
          <div className="space-y-1.5">
            {UPI_APPS.map(a => {
              const checked = pref === a.id;
              return (
                <label key={a.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer ${checked ? 'border-brand-300 bg-brand-50/40' : 'border-slate-100'}`}>
                  <span className="flex items-center gap-2">
                    <input type="radio" name="upi" checked={checked} onChange={() => setPref(a.id)} className="accent-brand-500" />
                    <span className="text-sm font-semibold text-slate-800">{a.name}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Save + Sign out */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-gradient-to-r from-brand-500 to-orange-400 text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          <Save size={14} /> Save changes
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold py-3 rounded-2xl text-sm"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon?: any; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon size={11} className="text-slate-400" />}
        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
      </div>
      {children}
    </div>
  );
}
