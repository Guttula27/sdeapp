import { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  Building2, Phone, MapPin, FileText, IndianRupee, ImagePlus, X as XIcon,
  Lock, Eye, EyeOff, Save,
} from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { downloadQrCard } from '../../utils/qrCard';
import { getCustomerOrigin } from '../../utils/customerOrigin';

async function fileToDataUrl(file: File, maxSize = 400, quality = 0.70): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
    // (defaults match the menu page now — 600px / q=0.72)
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
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
    {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
  </div>
);

export default function BusinessProfilePage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId;

  const [biz, setBiz] = useState<any>(null);
  const [admin, setAdmin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [form, setForm] = useState({
    name: '', description: '',
    address: '',
    addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', country: 'India', mapsLocation: '',
    gstNumber: '', upiId: '',
    aggregatorEnabled: false,
  });
  const [primary, setPrimary] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ id?: string; url: string; isNew?: boolean }[]>([]);
  const primaryRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // password reset modal
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwShow, setPwShow] = useState<Record<string, boolean>>({});
  const [pwSaving, setPwSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!businessId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [b, a] = await Promise.all([
        api.get(`/businesses/${businessId}`),
        api.get(`/businesses/${businessId}/admin`),
      ]);
      setBiz(b.data.data);
      setAdmin(a.data.data);
      const d = b.data.data;
      setForm({
        name: d.name || '',
        description: d.description || '',
        address: d.address || '',
        addressLine1: d.addressLine1 || '',
        addressLine2: d.addressLine2 || '',
        city: d.city || '',
        state: d.state || '',
        pincode: d.pincode || '',
        country: d.country || 'India',
        mapsLocation: d.mapsLocation || '',
        gstNumber: d.gstNumber || '',
        upiId: d.upiId || '',
        aggregatorEnabled: !!d.aggregatorEnabled,
      });
      setPrimary(d.primaryImageUrl || null);
      setGallery((d.images || []).map((g: any) => ({ id: g.id, url: g.url })));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Image pickers ────────────────────────────────────────
  const pick = async (
    e: React.ChangeEvent<HTMLInputElement>,
    opts: { maxSize?: number; sizeLimitKB?: number },
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return null;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPG, PNG or WebP'); return null;
    }
    const limit = (opts.sizeLimitKB ?? 1024) * 1024;
    if (file.size > limit) { toast.error(`Image too large (>${opts.sizeLimitKB ?? 1024} KB)`); return null; }
    try { return await fileToDataUrl(file, opts.maxSize); }
    catch { toast.error('Could not read image'); return null; }
  };

  const onPickPrimary = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = await pick(e, { maxSize: 400, sizeLimitKB: 4096 });
    if (url) setPrimary(url);
  };
  const onPickGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = await pick(e, { maxSize: 400, sizeLimitKB: 4096 });
    if (url) setGallery(p => [...p, { url, isNew: true }]);
  };

  // ── Save ─────────────────────────────────────────────────
  const save = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      // Compose legacy single-line address from the structured pieces
      const composed = [form.addressLine1, form.addressLine2, form.city, form.state, form.pincode, form.country]
        .map(s => s?.trim()).filter(Boolean).join(', ') || undefined;
      await api.patch(`/businesses/${businessId}`, {
        name: form.name.trim(),
        description: form.description.slice(0, 250) || undefined,
        address: composed,
        addressLine1: form.addressLine1.trim() || undefined,
        addressLine2: form.addressLine2.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
        country: form.country.trim() || undefined,
        mapsLocation: form.mapsLocation.trim() || undefined,
        gstNumber: form.gstNumber.trim() || undefined,
        upiId: form.upiId.trim() || undefined,
        aggregatorEnabled: form.aggregatorEnabled,
        primaryImageUrl: primary,
      });

      // Sync gallery: delete removed + add new
      const existingIds = new Set((biz?.images || []).map((g: any) => g.id) as string[]);
      const keptIds = new Set(gallery.filter(g => g.id).map(g => g.id as string));
      const removed = [...existingIds].filter(id => !keptIds.has(id));
      const additions = gallery.filter(g => g.isNew);
      await Promise.all([
        ...removed.map(id => api.delete(`/businesses/${businessId}/images/${id}`)),
        ...additions.map(g => api.post(`/businesses/${businessId}/images`, { url: g.url })),
      ]);

      toast.success('Business profile saved');
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Password reset ───────────────────────────────────────
  const resetPassword = async () => {
    if (!pw.current || !pw.next || pw.next !== pw.confirm) {
      toast.error('Fill all fields and make sure passwords match');
      return;
    }
    if (pw.next.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    setPwSaving(true);
    try {
      await api.patch(`/users/${user.id}`, { currentPassword: pw.current, newPassword: pw.next });
      toast.success('Password updated');
      setPwOpen(false);
      setPw({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update password');
    } finally {
      setPwSaving(false);
    }
  };

  if (!businessId) {
    return <p className="text-sm text-slate-500">This page is for business admins.</p>;
  }
  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-24 animate-pulse" />)}</div>;
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Business Profile</h1>
          <p className="page-subtitle">Identity, contact, branding and admin access</p>
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          <Save size={14} /> Save changes
        </button>
      </div>

      {/* Identity */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-slate-400" />
          <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Identity</p>
        </div>

        <Field label="Business name">
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" required />
        </Field>

        <Field label="Description (≤ 250 chars)" hint={`${form.description.length}/250`}>
          <textarea
            rows={3}
            maxLength={250}
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="input resize-none"
            placeholder="Short description of the business shown to customers"
          />
        </Field>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Address</p>
          <Field label="Address line 1">
            <input value={form.addressLine1} onChange={e => setForm(p => ({ ...p, addressLine1: e.target.value }))} className="input" placeholder="Building, street" />
          </Field>
          <Field label="Address line 2">
            <input value={form.addressLine2} onChange={e => setForm(p => ({ ...p, addressLine2: e.target.value }))} className="input" placeholder="Landmark / locality (optional)" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="input" />
            </Field>
            <Field label="State">
              <input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className="input" />
            </Field>
            <Field label="PIN / ZIP">
              <input value={form.pincode} onChange={e => setForm(p => ({ ...p, pincode: e.target.value }))} className="input" />
            </Field>
            <Field label="Country">
              <input value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} className="input" />
            </Field>
          </div>
          <Field label="Google Maps location" hint="Paste a Maps share link or `lat,lng` coordinates.">
            <input
              value={form.mapsLocation}
              onChange={e => setForm(p => ({ ...p, mapsLocation: e.target.value }))}
              className="input"
              placeholder="https://maps.app.goo.gl/… or 12.9716,77.5946"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="GST number">
            <input value={form.gstNumber} onChange={e => setForm(p => ({ ...p, gstNumber: e.target.value }))} className="input" placeholder="22ABCDE1234F1Z5" />
          </Field>
          <Field label="UPI ID">
            <input value={form.upiId} onChange={e => setForm(p => ({ ...p, upiId: e.target.value }))} className="input" placeholder="business@upi" />
          </Field>
        </div>
      </div>

      {/* Features */}
      <div className="card p-5 space-y-3">
        <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Features</p>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.aggregatorEnabled}
            onChange={e => setForm(p => ({ ...p, aggregatorEnabled: e.target.checked }))}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-800">Marketplace aggregators</span>
            <span className="block text-[11px] text-slate-500 leading-relaxed">
              Zomato / Swiggy / Uber Eats. When off, the Aggregators settings sub-page is hidden for every outlet under this business.
              Individual outlets can still be opted out from their per-outlet toggle in Outlets.
            </span>
          </span>
        </label>
      </div>

      {/* Imagery */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ImagePlus size={15} className="text-slate-400" />
          <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Imagery</p>
        </div>

        <Field label="Primary picture" hint="JPG / PNG / WebP. ≤1 MB. Auto-resized to 1000px.">
          <input ref={primaryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickPrimary} />
          {primary ? (
            <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-slate-200">
              <img src={primary} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setPrimary(null)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md" title="Remove">
                <XIcon size={11} />
              </button>
            </div>
          ) : (
            <button onClick={() => primaryRef.current?.click()}
              className="w-40 h-40 rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50/30 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-brand-600 transition-colors">
              <ImagePlus size={20} />
              <span className="text-[10px] font-semibold">Primary</span>
            </button>
          )}
        </Field>

        <Field label="Gallery" hint="0+ additional images. JPG / PNG / WebP. ≤1 MB each.">
          <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickGallery} />
          <div className="flex items-center gap-2 flex-wrap">
            {gallery.map((g, idx) => (
              <div key={g.id || idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200">
                <img src={g.url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setGallery(p => p.filter((_, i) => i !== idx))}
                  className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded" title="Remove">
                  <XIcon size={11} />
                </button>
              </div>
            ))}
            <button onClick={() => galleryRef.current?.click()}
              className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50/30 flex flex-col items-center justify-center gap-0.5 text-slate-400 hover:text-brand-600 transition-colors">
              <ImagePlus size={16} />
              <span className="text-[10px] font-semibold">Add</span>
            </button>
          </div>
        </Field>
      </div>

      {/* QR */}
      <div className="card p-5 space-y-3">
        <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Business QR</p>
        <p className="text-[11px] text-slate-500">
          Customers scan this to land on your business page (lists all outlets). Downloaded file includes business name + address.
        </p>
        <button
          className="btn-secondary"
          onClick={async () => {
            if (!businessId) return;
            const origin = getCustomerOrigin();
            await downloadQrCard({
              outletName: biz?.name,
              outletAddress: biz?.address,
              caption: 'Scan to visit',
              label: 'BUSINESS',
              detail: biz?.name,
              url: `${origin}/business/${businessId}`,
              filename: `qr-business-${biz?.name || ''}.png`,
            });
          }}
        >
          Download Business QR
        </button>
      </div>

      {/* Admin access */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lock size={15} className="text-slate-400" />
          <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Business admin</p>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">{admin?.name || '—'}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <Phone size={11} /> {admin?.phone || '—'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              The phone tied to this business is the admin's login. Use the button to reset the admin password.
            </p>
          </div>
          <button onClick={() => setPwOpen(true)} className="btn-secondary">
            <Lock size={13} /> Reset password
          </button>
        </div>
      </div>

      {/* Password reset modal */}
      <Modal
        open={pwOpen}
        onClose={() => !pwSaving && setPwOpen(false)}
        title="Reset password"
        subtitle="Enter your current password to set a new one"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPwOpen(false)} disabled={pwSaving}>Cancel</button>
            <button onClick={resetPassword} className="btn-primary" disabled={pwSaving || !pw.current || !pw.next || pw.next !== pw.confirm}>
              {pwSaving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Update password
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {(['current', 'next', 'confirm'] as const).map(k => (
            <Field key={k} label={k === 'current' ? 'Current password' : k === 'next' ? 'New password' : 'Confirm new password'}>
              <div className="relative">
                <input
                  type={pwShow[k] ? 'text' : 'password'}
                  value={pw[k]}
                  onChange={e => setPw(p => ({ ...p, [k]: e.target.value }))}
                  className="input pr-10"
                  placeholder="••••••"
                />
                <button type="button"
                  onClick={() => setPwShow(p => ({ ...p, [k]: !p[k] }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {pwShow[k] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          ))}
          {pw.next && pw.confirm && pw.next !== pw.confirm && (
            <p className="text-xs text-red-500">Passwords don't match</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
