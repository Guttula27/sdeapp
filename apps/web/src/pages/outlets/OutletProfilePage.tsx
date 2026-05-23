import { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  Building2, Phone, Clock, ImagePlus, X as XIcon, Lock, Eye, EyeOff, Save,
  Plus, Trash2, Store, QrCode, Download, Hash, RotateCcw,
} from 'lucide-react';
import { RootState } from '../../store';
import { downloadQrCard } from '../../utils/qrCard';
import api from '../../services/api';
import Modal from '../../components/common/Modal';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Range = { id: string; openTime: string; closeTime: string };
type DayCfg = { closed: boolean; ranges: Range[] };

async function fileToDataUrl(file: File, maxSize = 1000, quality = 0.85): Promise<string> {
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

// QR display with a logo overlay drawn on canvas — keeps the QR scannable
function QRWithLogo({ qrDataUrl, logoUrl, size = 240 }: { qrDataUrl: string; logoUrl?: string | null; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);

    const qr = new Image();
    qr.onload = () => {
      ctx.drawImage(qr, 0, 0, size, size);
      if (!logoUrl) return;
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.onload = () => {
        const lw = size * 0.22;
        const lh = lw;
        const x = (size - lw) / 2;
        const y = (size - lh) / 2;
        // white pad behind logo to keep QR scannable
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 6, y - 6, lw + 12, lh + 12);
        ctx.drawImage(logo, x, y, lw, lh);
      };
      logo.src = logoUrl;
    };
    qr.src = qrDataUrl;
  }, [qrDataUrl, logoUrl, size]);

  return <canvas ref={canvasRef} className="rounded-xl border border-slate-200 bg-white" />;
}

export default function OutletProfilePage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId;
  const userOutletId = user?.outletId || '';

  const [outlets, setOutlets] = useState<any[]>([]);
  const [outletId, setOutletId] = useState<string>(userOutletId);

  const [outlet, setOutlet] = useState<any>(null);
  const [admin, setAdmin] = useState<any>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [form, setForm] = useState({
    name: '', description: '',
    address: '',
    addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', country: 'India', mapsLocation: '',
    phone: '',
    gstNumber: '', upiId: '',
  });
  const [gst, setGst] = useState({
    applicable: false,
    percent: '5',
    includesGst: false,
  });
  const [tokenCounter, setTokenCounter] = useState({ startNumber: '1', nextNumber: 1, nextOrderSequence: 1 });
  const [savingToken, setSavingToken] = useState(false);
  const [primary, setPrimary] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ id?: string; url: string; isNew?: boolean }[]>([]);
  const primaryRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Hours: 7 days, each with closed + ranges
  const [week, setWeek] = useState<DayCfg[]>(Array.from({ length: 7 }, () => ({ closed: true, ranges: [] })));

  // password reset
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwShow, setPwShow] = useState<Record<string, boolean>>({});
  const [pwSaving, setPwSaving] = useState(false);

  // Fetch sibling outlets for the picker (business admin manages multiple)
  useEffect(() => {
    if (!businessId) return;
    api.get(`/outlets/business/${businessId}`)
      .then(({ data }) => {
        const list = data.data || [];
        setOutlets(list);
        if (!outletId && list.length) setOutletId(list[0].id);
      })
      .catch(() => {});
  }, [businessId]);

  const fetchAll = useCallback(async () => {
    if (!outletId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [oRes, aRes, tcRes] = await Promise.all([
        api.get(`/outlets/${outletId}`),
        api.get(`/outlets/${outletId}/admin`),
        api.get(`/outlets/${outletId}/token-counter`).catch(() => null),
      ]);
      if (tcRes) {
        setTokenCounter({
          startNumber: String(tcRes.data.data.tokenStartNumber ?? 1),
          nextNumber: Number(tcRes.data.data.nextTokenNumber ?? 1),
          nextOrderSequence: Number(tcRes.data.data.nextOrderSequence ?? 1),
        });
      }
      const o = oRes.data.data;
      setOutlet(o);
      setAdmin(aRes.data.data);
      setForm({
        name: o.name || '',
        description: o.description || '',
        address: o.address || '',
        addressLine1: o.addressLine1 || '',
        addressLine2: o.addressLine2 || '',
        city: o.city || '',
        state: o.state || '',
        pincode: o.pincode || '',
        country: o.country || 'India',
        mapsLocation: o.mapsLocation || '',
        phone: o.phone || '',
        gstNumber: o.gstNumber || '',
        upiId: o.upiId || '',
      });
      setGst({
        applicable: !!o.gstApplicable,
        percent: String(o.gstPercent ?? 5),
        includesGst: !!o.priceIncludesGst,
      });
      setPrimary(o.primaryImageUrl || null);
      setLogo(o.logoUrl || null);
      setGallery((o.images || []).map((g: any) => ({ id: g.id, url: g.url })));

      // Hours: collapse rows into 7 day buckets
      const next: DayCfg[] = Array.from({ length: 7 }, () => ({ closed: true, ranges: [] }));
      for (const r of o.hours || []) {
        next[r.dayOfWeek] = {
          closed: false,
          ranges: [...next[r.dayOfWeek].ranges, { id: r.id, openTime: r.openTime, closeTime: r.closeTime }],
        };
      }
      setWeek(next);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Token counter actions ────────────────────────────────
  const saveTokenStart = async () => {
    const start = Number(tokenCounter.startNumber);
    if (!Number.isInteger(start) || start < 1) {
      toast.error('Start number must be a positive integer');
      return;
    }
    setSavingToken(true);
    try {
      const { data } = await api.patch(`/outlets/${outletId}/token-counter`, { startNumber: start });
      setTokenCounter((tc) => ({
        ...tc,
        startNumber: String(data.data.tokenStartNumber),
        nextNumber: data.data.nextTokenNumber,
      }));
      toast.success('Token start saved');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setSavingToken(false);
    }
  };

  const resetTokens = async () => {
    if (!window.confirm('Reset token counter to start number? Next order will use the start number as its token.')) return;
    setSavingToken(true);
    try {
      const { data } = await api.post(`/outlets/${outletId}/token-counter/reset`);
      setTokenCounter((tc) => ({ ...tc, nextNumber: data.data.nextTokenNumber }));
      toast.success('Token counter reset');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setSavingToken(false);
    }
  };

  // ── Generate QR on demand ────────────────────────────────
  const generateQR = async () => {
    if (!outletId) return;
    try {
      const { data } = await api.post(`/qr/outlet/${outletId}?outletId=${outletId}`);
      setQr(data.data.imageUrl);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'QR generation failed');
    }
  };
  useEffect(() => { if (outletId) generateQR(); /* eslint-disable-next-line */ }, [outletId]);

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
    const url = await pick(e, { maxSize: 1000, sizeLimitKB: 1024 });
    if (url) setPrimary(url);
  };
  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = await pick(e, { maxSize: 320, sizeLimitKB: 300 });
    if (url) setLogo(url);
  };
  const onPickGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = await pick(e, { maxSize: 1000, sizeLimitKB: 1024 });
    if (url) setGallery(p => [...p, { url, isNew: true }]);
  };

  // ── Hours editing ────────────────────────────────────────
  // Hours auto-save on every change so users don't lose their work when
  // navigating away (the rest of the page is saved via the explicit Save
  // button; only hours persist immediately).
  const persistHours = async (next: DayCfg[]) => {
    if (!outletId) return;
    const ranges: { dayOfWeek: number; openTime: string; closeTime: string }[] = [];
    next.forEach((day, dayIdx) => {
      if (day.closed) return;
      day.ranges.forEach((r) => {
        if (r.openTime && r.closeTime && r.closeTime > r.openTime) {
          ranges.push({ dayOfWeek: dayIdx, openTime: r.openTime, closeTime: r.closeTime });
        }
      });
    });
    try {
      await api.put(`/outlets/${outletId}/hours`, { ranges });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save hours');
    }
  };

  const applyWeekChange = (next: DayCfg[]) => {
    setWeek(next);
    void persistHours(next);
  };

  const toggleDayClosed = (day: number) => {
    const next = week.map((d, i) =>
      i === day
        ? {
            closed: !d.closed,
            ranges: !d.closed
              ? []
              : d.ranges.length
                ? d.ranges
                : [{ id: `tmp-${day}`, openTime: '09:00', closeTime: '21:00' }],
          }
        : d,
    );
    applyWeekChange(next);
  };

  const addRange = (day: number) => {
    const next = week.map((d, i) => i === day
      ? { ...d, closed: false, ranges: [...d.ranges, { id: `tmp-${Date.now()}`, openTime: '09:00', closeTime: '21:00' }] }
      : d);
    applyWeekChange(next);
  };

  const removeRange = (day: number, idx: number) => {
    const next = week.map((d, i) => i === day ? { ...d, ranges: d.ranges.filter((_, j) => j !== idx) } : d);
    applyWeekChange(next);
  };

  const updateRange = (day: number, idx: number, key: 'openTime' | 'closeTime', value: string) => {
    const next = week.map((d, i) => i === day
      ? { ...d, ranges: d.ranges.map((r, j) => j === idx ? { ...r, [key]: value } : r) }
      : d);
    applyWeekChange(next);
  };

  // Copy first day with ranges to every other day — handy when all days share hours.
  const applyToAllDays = (sourceDay: number) => {
    const src = week[sourceDay];
    if (src.closed || src.ranges.length === 0) return;
    const next = week.map((d, i) => i === sourceDay ? d : ({
      closed: false,
      ranges: src.ranges.map((r, j) => ({
        id: `tmp-${i}-${j}-${Date.now()}`,
        openTime: r.openTime,
        closeTime: r.closeTime,
      })),
    }));
    applyWeekChange(next);
  };

  // ── Save ─────────────────────────────────────────────────
  const save = async () => {
    if (!outletId) return;
    setSaving(true);
    try {
      const composed = [form.addressLine1, form.addressLine2, form.city, form.state, form.pincode, form.country]
        .map(s => s?.trim()).filter(Boolean).join(', ') || undefined;
      await api.patch(`/outlets/${outletId}`, {
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
        phone: form.phone.trim() || undefined,
        gstNumber: gst.applicable ? (form.gstNumber.trim() || undefined) : null,
        gstApplicable: gst.applicable,
        gstPercent: gst.applicable ? Number(gst.percent) || 0 : 0,
        priceIncludesGst: gst.applicable ? gst.includesGst : false,
        upiId: form.upiId.trim() || undefined,
        primaryImageUrl: primary,
        logoUrl: logo,
      });

      // Gallery sync
      const existingIds = new Set((outlet?.images || []).map((g: any) => g.id) as string[]);
      const keptIds = new Set(gallery.filter(g => g.id).map(g => g.id as string));
      const removed = [...existingIds].filter(id => !keptIds.has(id));
      const additions = gallery.filter(g => g.isNew);
      await Promise.all([
        ...removed.map(id => api.delete(`/outlets/${outletId}/images/${id}`)),
        ...additions.map(g => api.post(`/outlets/${outletId}/images`, { url: g.url })),
      ]);

      // Hours sync — flatten + skip closed days
      const ranges: any[] = [];
      week.forEach((day, dayIdx) => {
        if (day.closed) return;
        day.ranges.forEach(r => {
          ranges.push({ dayOfWeek: dayIdx, openTime: r.openTime, closeTime: r.closeTime });
        });
      });
      await api.put(`/outlets/${outletId}/hours`, { ranges });

      toast.success('Outlet profile saved');
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Password reset ───────────────────────────────────────
  const resetPassword = async () => {
    if (!admin) return;
    if (!pw.current || !pw.next || pw.next !== pw.confirm) {
      toast.error('Fill all fields and make sure passwords match'); return;
    }
    if (pw.next.length < 6) { toast.error('At least 6 characters'); return; }
    setPwSaving(true);
    try {
      await api.patch(`/users/${admin.id}`, { currentPassword: pw.current, newPassword: pw.next });
      toast.success('Password updated');
      setPwOpen(false);
      setPw({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setPwSaving(false);
    }
  };

  const downloadQR = async () => {
    if (!outlet?.id) return;
    const origin = (window as any).VITE_CUSTOMER_URL || window.location.origin.replace(':5173', ':5174');
    await downloadQrCard({
      outletName: outlet?.name,
      outletAddress: outlet?.address,
      caption: 'Scan to view menu',
      label: 'OUTLET',
      detail: outlet?.name,
      url: `${origin}/order?outlet=${outlet.id}`,
      filename: `qr-${outlet?.name || 'outlet'}.png`,
    });
  };

  const isMultiOutlet = outlets.length > 1;

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-24 animate-pulse" />)}</div>;
  if (!outletId) return <p className="text-sm text-slate-500">No outlet selected.</p>;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Outlet Profile</h1>
          <p className="page-subtitle">Identity, branding, hours and admin access</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isMultiOutlet && (
            <select value={outletId} onChange={e => setOutletId(e.target.value)} className="input py-2 px-3 text-sm font-medium min-w-[180px]">
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            <Save size={14} /> Save changes
          </button>
        </div>
      </div>

      {/* Identity */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Store size={15} className="text-slate-400" />
          <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Identity</p>
        </div>

        <Field label="Outlet name">
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" required />
        </Field>

        <Field label="Description (≤ 250 chars)" hint={`${form.description.length}/250`}>
          <textarea rows={3} maxLength={250}
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="input resize-none"
            placeholder="Short description shown to customers" />
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
          <Field label="Phone">
            <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="input" placeholder="+91 …" />
          </Field>
          <Field label="UPI ID">
            <input value={form.upiId} onChange={e => setForm(p => ({ ...p, upiId: e.target.value }))} className="input" placeholder="outlet@upi" />
          </Field>
        </div>
      </div>

      {/* GST / Tax */}
      <div className="card p-5 space-y-4">
        <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">GST / Tax</p>

        <Field label="GST applicable">
          <div className="flex gap-2">
            {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(o => (
              <label key={String(o.v)} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border cursor-pointer ${gst.applicable === o.v ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200'}`}>
                <input
                  type="radio"
                  checked={gst.applicable === o.v}
                  onChange={() => setGst(p => ({ ...p, applicable: o.v }))}
                  className="accent-brand-500"
                />
                <span className="text-sm font-semibold">{o.l}</span>
              </label>
            ))}
          </div>
        </Field>

        {gst.applicable && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="GST number">
                <input
                  value={form.gstNumber}
                  onChange={e => setForm(p => ({ ...p, gstNumber: e.target.value }))}
                  className="input"
                  placeholder="22ABCDE1234F1Z5"
                />
              </Field>
              <Field label="GST %">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={gst.percent}
                  onChange={e => setGst(p => ({ ...p, percent: e.target.value }))}
                  className="input"
                />
              </Field>
            </div>

            <Field label="Item prices include GST?">
              <div className="flex gap-2">
                {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(o => (
                  <label key={String(o.v)} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border cursor-pointer ${gst.includesGst === o.v ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200'}`}>
                    <input
                      type="radio"
                      checked={gst.includesGst === o.v}
                      onChange={() => setGst(p => ({ ...p, includesGst: o.v }))}
                      className="accent-brand-500"
                    />
                    <span className="text-sm font-semibold">{o.l}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {gst.includesGst
                  ? `Item prices are tax-inclusive. On bills we'll back-out the tax — pre-tax = price ÷ (1 + ${gst.percent || 0}%).`
                  : `Item prices are pre-tax. GST will be added on top at billing.`}
              </p>
            </Field>
          </>
        )}
      </div>

      {/* Token counter */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Hash size={15} className="text-slate-400" />
          <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Token & Order Sequence</p>
        </div>
        <p className="text-[11px] text-slate-400">
          Token number is shown to the customer on every order. Set the starting value (e.g. 101 for "T-101") and use Reset to snap it back to the start. Order ID maintains its own continuous sequence and never resets.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Token start number">
            <input
              type="number"
              min={1}
              value={tokenCounter.startNumber}
              onChange={(e) => setTokenCounter((tc) => ({ ...tc, startNumber: e.target.value }))}
              className="input"
              placeholder="1"
            />
          </Field>
          <Field label="Next token #">
            <div className="input bg-slate-50 text-slate-700 font-bold tabular-nums">
              {tokenCounter.nextNumber}
            </div>
          </Field>
          <Field label="Next order #">
            <div className="input bg-slate-50 text-slate-700 font-bold tabular-nums">
              {tokenCounter.nextOrderSequence}
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={saveTokenStart} disabled={savingToken} className="btn-primary text-xs">
            <Save size={13} /> Save start
          </button>
          <button onClick={resetTokens} disabled={savingToken} className="btn-secondary text-xs">
            <RotateCcw size={13} /> Reset token counter
          </button>
        </div>
      </div>

      {/* Imagery */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ImagePlus size={15} className="text-slate-400" />
          <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Imagery</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Logo" hint="JPG / PNG / WebP. ≤300 KB. Square.">
            <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickLogo} />
            {logo ? (
              <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-slate-200 bg-white">
                <img src={logo} alt="" className="w-full h-full object-contain" />
                <button onClick={() => setLogo(null)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md"><XIcon size={11} /></button>
              </div>
            ) : (
              <button onClick={() => logoRef.current?.click()}
                className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-400 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-brand-600">
                <ImagePlus size={18} />
                <span className="text-[10px] font-semibold">Logo</span>
              </button>
            )}
          </Field>
          <Field label="Primary picture" hint="JPG / PNG / WebP. ≤1 MB.">
            <input ref={primaryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickPrimary} />
            {primary ? (
              <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-slate-200">
                <img src={primary} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setPrimary(null)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md"><XIcon size={11} /></button>
              </div>
            ) : (
              <button onClick={() => primaryRef.current?.click()}
                className="w-40 h-40 rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-400 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-brand-600">
                <ImagePlus size={20} />
                <span className="text-[10px] font-semibold">Primary</span>
              </button>
            )}
          </Field>
        </div>

        <Field label="Gallery" hint="0+ images. JPG / PNG / WebP. ≤1 MB each.">
          <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickGallery} />
          <div className="flex items-center gap-2 flex-wrap">
            {gallery.map((g, idx) => (
              <div key={g.id || idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                <img src={g.url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setGallery(p => p.filter((_, i) => i !== idx))} className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded"><XIcon size={10} /></button>
              </div>
            ))}
            <button onClick={() => galleryRef.current?.click()}
              className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 hover:border-brand-400 flex flex-col items-center justify-center gap-0.5 text-slate-400 hover:text-brand-600">
              <ImagePlus size={14} />
              <span className="text-[9px] font-semibold">Add</span>
            </button>
          </div>
        </Field>
      </div>

      {/* Hours */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-slate-400" />
          <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Business hours</p>
        </div>
        <p className="text-[11px] text-slate-400 mb-1">Add multiple ranges per day for split timings (e.g. lunch + dinner). Days with no ranges are treated as closed.</p>
        <div className="space-y-2">
          {DAYS.map((d, i) => {
            const day = week[i];
            const firstOpenDay = week.findIndex((w) => !w.closed && w.ranges.length);
            const canCopyFromHere = !day.closed && day.ranges.length > 0 && firstOpenDay === i;
            return (
              <div key={d} className="bg-slate-50 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700 w-9">{d}</span>
                    {day.closed
                      ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">CLOSED</span>
                      : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">OPEN</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {day.closed ? (
                      <button
                        type="button"
                        onClick={() => toggleDayClosed(i)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-brand-500 hover:bg-brand-600 text-white"
                      >
                        Open this day
                      </button>
                    ) : (
                      <>
                        <button onClick={() => addRange(i)} className="text-[11px] font-semibold text-brand-600 hover:text-brand-700">
                          + Range
                        </button>
                        {canCopyFromHere && (
                          <button onClick={() => applyToAllDays(i)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-700">
                            Copy to all
                          </button>
                        )}
                        <button onClick={() => toggleDayClosed(i)} className="text-[11px] font-semibold text-slate-400 hover:text-red-500">
                          Mark closed
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {!day.closed && (
                  <div className="space-y-1.5">
                    {day.ranges.length === 0 && <p className="text-xs text-slate-400 italic">Click + Range to add hours</p>}
                    {day.ranges.map((r, j) => (
                      <div key={r.id} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={r.openTime}
                          onChange={e => updateRange(i, j, 'openTime', e.target.value)}
                          className="input py-1.5 text-xs w-32"
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <input
                          type="time"
                          value={r.closeTime}
                          onChange={e => updateRange(i, j, 'closeTime', e.target.value)}
                          className="input py-1.5 text-xs w-32"
                        />
                        <button onClick={() => removeRange(i, j)} className="btn-ghost p-1.5 text-slate-400 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* QR */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <QrCode size={15} className="text-slate-400" />
            <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Customer Menu QR</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={generateQR} className="btn-secondary text-xs"><QrCode size={12} /> Regenerate</button>
            <button onClick={downloadQR} className="btn-primary text-xs" disabled={!qr}><Download size={12} /> Download</button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">Customers can scan this QR to open the menu for this outlet directly. Logo is overlaid in the centre.</p>
        <div className="flex items-center justify-center bg-slate-50 rounded-xl p-6">
          {qr ? (
            <QRWithLogo qrDataUrl={qr} logoUrl={logo} size={240} />
          ) : (
            <p className="text-sm text-slate-500">Generating QR…</p>
          )}
        </div>
      </div>

      {/* Admin */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lock size={15} className="text-slate-400" />
          <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Outlet admin</p>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">{admin?.name || '—'}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5"><Phone size={11} /> {admin?.phone || '—'}</p>
            <p className="text-[11px] text-slate-400 mt-1">The phone tied to this outlet is the outlet admin's login. Reset their password here.</p>
          </div>
          <button onClick={() => setPwOpen(true)} className="btn-secondary" disabled={!admin}>
            <Lock size={13} /> Reset password
          </button>
        </div>
      </div>

      {/* Password reset modal */}
      <Modal
        open={pwOpen}
        onClose={() => !pwSaving && setPwOpen(false)}
        title="Reset password"
        subtitle={admin ? `For ${admin.name} · ${admin.phone}` : ''}
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
                <button type="button" onClick={() => setPwShow(p => ({ ...p, [k]: !p[k] }))}
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
