import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Network, Store, ChevronLeft, Plus, Trash2, MapPin, Building2,
  QrCode, Download, ImagePlus, X as XIcon, Save, Link2,
} from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { downloadQrCard } from '../../utils/qrCard';

// Compresses image to ~1000px max dim, JPEG q=.85 — same helper the
// business-profile page uses to keep the data URLs Prisma-Text-safe.
async function fileToDataUrl(file: File, maxSize = 1000, quality = 0.85): Promise<string> {
  const reader = new FileReader();
  const dataUrl: string = await new Promise((res, rej) => {
    reader.onload = () => res(reader.result as string);
    reader.onerror = () => rej(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image();
    el.onload = () => res(el);
    el.onerror = () => rej(new Error('Invalid image'));
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

export default function ClusterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cluster, setCluster] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [gallery, setGallery] = useState<{ id?: string; url: string; isNew?: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Branding/address form mirrors the cluster's editable fields.
  const [form, setForm] = useState({
    name: '', description: '', address: '',
    addressLine1: '', addressLine2: '', city: '', state: '', pincode: '',
    logoUrl: '' as string | null, thumbnailUrl: '' as string | null, primaryImageUrl: '' as string | null,
  });

  // Add-member modal state
  const [addOpen, setAddOpen] = useState(false);
  const [outletCode, setOutletCode] = useState('');

  // QR modal state
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState<{ url: string; imageUrl: string; publicCode: string } | null>(null);

  // Confirm-remove dialog target (avoid native confirm boxes for parity with the rest of the app).
  const [removeTarget, setRemoveTarget] = useState<any>(null);

  // File-input refs for the upload buttons.
  const logoRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const primaryRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/clusters/${id}`);
      const c = data.data ?? data;
      setCluster(c);
      setMembers(c.members ?? []);
      setGallery((c.images ?? []).map((i: any) => ({ id: i.id, url: i.url })));
      setForm({
        name: c.name ?? '',
        description: c.description ?? '',
        address: c.address ?? '',
        addressLine1: c.addressLine1 ?? '',
        addressLine2: c.addressLine2 ?? '',
        city: c.city ?? '',
        state: c.state ?? '',
        pincode: c.pincode ?? '',
        logoUrl: c.logoUrl ?? null,
        thumbnailUrl: c.thumbnailUrl ?? null,
        primaryImageUrl: c.primaryImageUrl ?? null,
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not load cluster');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveBranding = async () => {
    if (!id) return;
    setSaving(true);
    try {
      // The standard businesses endpoint accepts the same fields — we just
      // PATCH against the cluster's businessId.
      await api.patch(`/businesses/${id}`, form);
      // New gallery additions only — existing images are persisted on the
      // server already. Send each new one through the images endpoint.
      for (const g of gallery.filter((x) => x.isNew)) {
        await api.post(`/businesses/${id}/images`, { url: g.url });
      }
      toast.success('Cluster updated');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    if (!id || !outletCode.trim()) return;
    setSaving(true);
    try {
      await api.post(`/clusters/${id}/members`, { outletCode: outletCode.trim() });
      toast.success('Outlet added');
      setOutletCode('');
      setAddOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not add outlet');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async () => {
    if (!id || !removeTarget) return;
    setSaving(true);
    try {
      await api.delete(`/clusters/${id}/members/${removeTarget.outletId}`);
      toast.success(`${removeTarget.outlet?.name || 'Outlet'} removed`);
      setRemoveTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not remove outlet');
    } finally {
      setSaving(false);
    }
  };

  const generateQr = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/clusters/${id}/qr`);
      setQrData(data.data ?? data);
      setQrOpen(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'QR generation failed');
    } finally {
      setSaving(false);
    }
  };

  const downloadQr = async () => {
    if (!qrData) return;
    await downloadQrCard({
      outletName: cluster?.name,
      outletAddress: cluster?.address || [cluster?.addressLine1, cluster?.city].filter(Boolean).join(', '),
      label: 'CLUSTER',
      detail: cluster?.publicCode,
      caption: 'Scan to view all outlets',
      url: qrData.url,
      filename: `cluster-${cluster?.publicCode || id}.png`,
    });
  };

  if (loading || !cluster) {
    return (
      <div className="space-y-3">
        <div className="h-8 bg-slate-100 rounded animate-pulse w-1/3" />
        <div className="h-32 bg-slate-100 rounded animate-pulse" />
        <div className="h-48 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header / breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => navigate('/platform/businesses')} className="hover:text-slate-800 inline-flex items-center gap-1">
          <ChevronLeft size={14} /> Businesses
        </button>
      </div>

      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-100 text-indigo-700">
          <Network size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="page-title m-0">{cluster.name}</h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
              <Network size={10} /> CLUSTER
            </span>
            {cluster.publicCode && (
              <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {cluster.publicCode}
              </span>
            )}
          </div>
          <p className="page-subtitle">{members.length} member outlet{members.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generateQr} className="btn-secondary" disabled={saving}>
            <QrCode size={14} /> Cluster QR
          </button>
        </div>
      </div>

      {/* ── Branding + address card ────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 size={14} className="text-slate-400" />
          <p className="text-sm font-bold text-slate-700">Branding & Address</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Logo */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Logo</label>
            <div className="aspect-square rounded-xl border border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 relative group">
              {form.logoUrl ? (
                <>
                  <img src={form.logoUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setForm((f) => ({ ...f, logoUrl: null }))}
                    className="absolute top-1 right-1 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XIcon size={12} />
                  </button>
                </>
              ) : (
                <button onClick={() => logoRef.current?.click()} className="text-xs text-slate-500 flex flex-col items-center gap-1">
                  <ImagePlus size={20} /> Upload
                </button>
              )}
            </div>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = await fileToDataUrl(f, 400);
                setForm((s) => ({ ...s, logoUrl: url }));
              }}
            />
          </div>

          {/* Thumbnail */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Thumbnail</label>
            <div className="aspect-square rounded-xl border border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 relative group">
              {form.thumbnailUrl ? (
                <>
                  <img src={form.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setForm((f) => ({ ...f, thumbnailUrl: null }))}
                    className="absolute top-1 right-1 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XIcon size={12} />
                  </button>
                </>
              ) : (
                <button onClick={() => thumbRef.current?.click()} className="text-xs text-slate-500 flex flex-col items-center gap-1">
                  <ImagePlus size={20} /> Upload
                </button>
              )}
            </div>
            <input
              ref={thumbRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = await fileToDataUrl(f, 600);
                setForm((s) => ({ ...s, thumbnailUrl: url }));
              }}
            />
          </div>

          {/* Hero / primary image */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Hero Image</label>
            <div className="aspect-square rounded-xl border border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 relative group">
              {form.primaryImageUrl ? (
                <>
                  <img src={form.primaryImageUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setForm((f) => ({ ...f, primaryImageUrl: null }))}
                    className="absolute top-1 right-1 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XIcon size={12} />
                  </button>
                </>
              ) : (
                <button onClick={() => primaryRef.current?.click()} className="text-xs text-slate-500 flex flex-col items-center gap-1">
                  <ImagePlus size={20} /> Upload
                </button>
              )}
            </div>
            <input
              ref={primaryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = await fileToDataUrl(f, 1200);
                setForm((s) => ({ ...s, primaryImageUrl: url }));
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name">
            <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} className="input" />
          </Field>
          <Field label="Description">
            <input value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} className="input" />
          </Field>
          <Field label="Address line 1">
            <input value={form.addressLine1} onChange={(e) => setForm((s) => ({ ...s, addressLine1: e.target.value }))} className="input" />
          </Field>
          <Field label="Address line 2">
            <input value={form.addressLine2} onChange={(e) => setForm((s) => ({ ...s, addressLine2: e.target.value }))} className="input" />
          </Field>
          <Field label="City">
            <input value={form.city} onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))} className="input" />
          </Field>
          <Field label="State">
            <input value={form.state} onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))} className="input" />
          </Field>
          <Field label="Pincode">
            <input value={form.pincode} onChange={(e) => setForm((s) => ({ ...s, pincode: e.target.value }))} className="input" />
          </Field>
        </div>

        <div className="flex justify-end">
          <button onClick={saveBranding} className="btn-primary" disabled={saving}>
            <Save size={14} /> Save
          </button>
        </div>
      </div>

      {/* ── Gallery ────────────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImagePlus size={14} className="text-slate-400" />
            <p className="text-sm font-bold text-slate-700">Gallery</p>
            <span className="text-xs text-slate-400">{gallery.length} photo{gallery.length !== 1 ? 's' : ''}</span>
          </div>
          <button onClick={() => galleryRef.current?.click()} className="btn-secondary text-xs">
            <Plus size={12} /> Add photo
          </button>
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              if (!files.length) return;
              const additions = await Promise.all(files.map((f) => fileToDataUrl(f, 1200)));
              setGallery((prev) => [...prev, ...additions.map((url) => ({ url, isNew: true }))]);
              e.target.value = '';
            }}
          />
        </div>
        {gallery.length === 0 ? (
          <div className="text-sm text-slate-400 italic text-center py-6">No photos yet — add a few to show off the cluster.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {gallery.map((g, idx) => (
              <div key={g.id ?? `new-${idx}`} className="aspect-square rounded-lg overflow-hidden bg-slate-100 relative group">
                <img src={g.url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={async () => {
                    if (g.id) {
                      try {
                        await api.delete(`/businesses/${id}/images/${g.id}`);
                      } catch (e: any) {
                        toast.error(e?.response?.data?.message || 'Could not delete');
                        return;
                      }
                    }
                    setGallery((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  className="absolute top-1 right-1 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <XIcon size={12} />
                </button>
                {g.isNew && (
                  <span className="absolute bottom-1 left-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    UNSAVED
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Members ────────────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Store size={14} className="text-slate-400" />
            <p className="text-sm font-bold text-slate-700">Member Outlets</p>
            <span className="text-xs text-slate-400">{members.length}</span>
          </div>
          <button onClick={() => setAddOpen(true)} className="btn-primary text-xs">
            <Plus size={12} /> Add outlet
          </button>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Network size={32} className="text-slate-200 mb-2" />
            <p className="text-sm text-slate-500 font-medium">No outlets yet</p>
            <p className="text-xs text-slate-400 mt-1">Add member outlets by their Outlet ID (e.g. <span className="font-mono">OL-A4F23C81</span>).</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto">
              <thead>
                <tr>
                  <th>Outlet</th>
                  <th>From business</th>
                  <th>Outlet ID</th>
                  <th>Razorpay LA</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        {m.outlet?.logoUrl ? (
                          <img src={m.outlet.logoUrl} alt="" className="w-6 h-6 rounded-md object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-brand-100 text-brand-800 flex items-center justify-center">
                            <Store size={12} />
                          </div>
                        )}
                        <span>{m.outlet?.name}</span>
                      </div>
                    </td>
                    <td className="text-slate-500 text-xs">{m.outlet?.business?.name || '—'}</td>
                    <td className="font-mono text-xs text-slate-500">{m.outlet?.publicCode || '—'}</td>
                    <td className="text-xs">
                      {m.outlet?.razorpayLinkedAccountId ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono text-[10px]">
                          <Link2 size={10} /> {m.outlet.razorpayLinkedAccountId}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">not set</span>
                      )}
                    </td>
                    <td>
                      <span className={'badge ' + (m.outlet?.isActive ? 'badge-green' : 'badge-red')}>
                        {m.outlet?.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => setRemoveTarget(m)}
                        className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg inline-flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add-member modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add member outlet" size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={addMember} disabled={saving || !outletCode.trim()}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Link outlet
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Outlets keep their original business but operate exclusively through this cluster while linked.
            They still need a Razorpay Linked Account ID for the payment split.
          </p>
          <Field label="Outlet ID">
            <input
              value={outletCode}
              onChange={(e) => setOutletCode(e.target.value.toUpperCase())}
              placeholder="OL-A4F23C81"
              autoFocus
              className="input font-mono"
              onKeyDown={(e) => { if (e.key === 'Enter') addMember(); }}
            />
          </Field>
        </div>
      </Modal>

      {/* Confirm remove */}
      <Modal open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Remove outlet?" size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRemoveTarget(null)} disabled={saving}>Cancel</button>
            <button className="btn-danger" onClick={removeMember} disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Remove
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {removeTarget?.outlet?.name} will be released back to standalone operation under its original business.
          Existing cluster orders for this outlet are unaffected.
        </p>
      </Modal>

      {/* QR modal */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="Cluster QR code" size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setQrOpen(false)}>Close</button>
            <button className="btn-primary" onClick={downloadQr} disabled={!qrData}>
              <Download size={14} /> Download
            </button>
          </>
        }
      >
        {qrData ? (
          <div className="text-center space-y-3">
            <img src={qrData.imageUrl} alt="Cluster QR" className="mx-auto w-56 h-56 border border-slate-200 rounded-xl" />
            <p className="font-mono text-xs text-slate-500 break-all">{qrData.url}</p>
            <p className="text-[11px] text-slate-400">Scanning this QR opens the cluster shell at <span className="font-mono">{qrData.publicCode}</span> — customers see the outlet picker + unified cart.</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
