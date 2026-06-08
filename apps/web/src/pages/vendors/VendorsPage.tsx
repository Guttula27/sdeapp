import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  Truck, Plus, Search, Phone, Mail, MapPin, FileText,
  Edit2, Trash2, ToggleLeft, ToggleRight, Eye,
  IndianRupee, ShoppingCart, TrendingUp, CheckCircle2,
  ArrowLeft, Clock, Package,
} from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

/* ── types ───────────────────────────────────────────────── */
interface Vendor {
  id: string;
  name: string;
  gstNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { purchaseOrders: number };
}

interface VendorDetail extends Vendor {
  purchaseOrders: Array<{
    id: string;
    poNumber: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
    material: { id: string; name: string; unit: string };
  }>;
}

interface Stats {
  totalVendors: number;
  activeVendors: number;
  totalPOs: number;
  totalSpend: number;
}

/* ── constants ───────────────────────────────────────────── */
const PO_STATUS_STYLE: Record<string, string> = {
  PENDING:   'badge-yellow',
  APPROVED:  'badge-blue',
  RECEIVED:  'badge-green',
  CANCELLED: 'badge-red',
};

const PAY_STATUS_STYLE: Record<string, string> = {
  UNPAID:  'badge-red',
  PARTIAL: 'badge-yellow',
  PAID:    'badge-green',
};

/* ── form field helper ───────────────────────────────────── */
const Field = ({
  label, required, children,
}: {
  label: string; required?: boolean; children: React.ReactNode;
}) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

/* ── main component ───────────────────────────────────────── */
export default function VendorsPage() {
  const user       = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId || 'demo-business';

  /* list state */
  const [vendors, setVendors]   = useState<Vendor[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [search, setSearch]     = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading]   = useState(true);

  /* detail drawer state */
  const [detail, setDetail]     = useState<VendorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* modal state */
  const [formModal, setFormModal]       = useState<{ open: boolean; vendor?: Vendor }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Vendor | null>(null);
  const [saving, setSaving]             = useState(false);

  /* ── data fetching ─────────────────────────────────────── */
  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, sRes] = await Promise.all([
        api.get(`/vendors?businessId=${businessId}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
        api.get(`/vendors/stats?businessId=${businessId}`),
      ]);
      setVendors(vRes.data.data.vendors ?? vRes.data.data);
      setStats(sRes.data.data);
    } finally {
      setLoading(false);
    }
  }, [businessId, search]);

  useEffect(() => {
    const t = setTimeout(fetchVendors, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchVendors]);

  const openDetail = async (v: Vendor) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const { data } = await api.get(`/vendors/${v.id}`);
      setDetail(data.data);
    } finally {
      setDetailLoading(false);
    }
  };

  /* ── CRUD handlers ─────────────────────────────────────── */
  const saveVendor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd   = new FormData(e.currentTarget);
    const body = {
      name:      (fd.get('name') as string).trim(),
      gstNumber: (fd.get('gstNumber') as string).trim() || undefined,
      phone:     (fd.get('phone') as string).trim()     || undefined,
      email:     (fd.get('email') as string).trim()     || undefined,
      address:   (fd.get('address') as string).trim()   || undefined,
    };

    setSaving(true);
    try {
      if (formModal.vendor) {
        await api.patch(`/vendors/${formModal.vendor.id}`, body);
        toast.success('Vendor updated');
        if (detail?.id === formModal.vendor.id) openDetail({ ...formModal.vendor, ...body } as Vendor);
      } else {
        await api.post(`/vendors?businessId=${businessId}`, body);
        toast.success('Vendor created');
      }
      setFormModal({ open: false });
      fetchVendors();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!toggleTarget) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/vendors/${toggleTarget.id}/toggle-status`);
      toast.success(`${toggleTarget.name} ${data.data.isActive ? 'activated' : 'deactivated'}`);
      setToggleTarget(null);
      fetchVendors();
      if (detail?.id === toggleTarget.id) setDetail(d => d ? { ...d, isActive: data.data.isActive } : d);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/vendors/${deleteTarget.id}`);
      toast.success('Vendor deleted');
      setDeleteTarget(null);
      if (detail?.id === deleteTarget.id) setDetail(null);
      fetchVendors();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  /* ── filtered list ─────────────────────────────────────── */
  const displayed = vendors.filter(v => {
    if (filterActive === 'active')   return v.isActive;
    if (filterActive === 'inactive') return !v.isActive;
    return true;
  });

  /* ── render ────────────────────────────────────────────── */
  return (
    <div className="space-y-5">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Vendor Management</h1>
          <p className="page-subtitle">{stats?.totalVendors ?? 0} vendor{stats?.totalVendors !== 1 ? 's' : ''} registered</p>
        </div>
        <button className="btn-primary" onClick={() => setFormModal({ open: true })}>
          <Plus size={15} /> Add Vendor
        </button>
      </div>

      {/* ── Stats row ─────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Vendors',  value: stats.totalVendors,  icon: Truck,         cls: 'bg-blue-50 text-blue-600' },
            { label: 'Active Vendors', value: stats.activeVendors, icon: CheckCircle2,  cls: 'bg-emerald-50 text-emerald-600' },
            { label: 'Total POs',      value: stats.totalPOs,       icon: ShoppingCart,  cls: 'bg-brand-50 text-brand-800' },
            { label: 'Total Spend',    value: `₹${Number(stats.totalSpend).toLocaleString('en-IN')}`, icon: IndianRupee, cls: 'bg-purple-50 text-purple-600' },
          ].map(s => (
            <div key={s.label} className="card p-5">
              <div className={`icon-wrap w-9 h-9 ${s.cls} rounded-xl mb-3`}><s.icon size={16} /></div>
              <p className="text-2xl font-black text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Search + filter bar ───────────────────────────── */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, email, GST…"
            className="input pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize',
                filterActive === f
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Vendor list ───────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-44 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <Truck size={40} className="text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">
            {search ? 'No vendors match your search' : 'No vendors yet'}
          </p>
          {!search && (
            <button className="btn-primary mt-4" onClick={() => setFormModal({ open: true })}>
              <Plus size={14} /> Add first vendor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayed.map(vendor => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              onView={openDetail}
              onEdit={v => setFormModal({ open: true, vendor: v })}
              onToggle={v => setToggleTarget(v)}
              onDelete={v => setDeleteTarget(v)}
            />
          ))}
        </div>
      )}

      {/* ── Detail drawer ─────────────────────────────────── */}
      {(detail || detailLoading) && (
        <VendorDetail
          vendor={detail}
          loading={detailLoading}
          onClose={() => setDetail(null)}
          onEdit={v => setFormModal({ open: true, vendor: v as Vendor })}
          onToggle={v => setToggleTarget(v as Vendor)}
          onDelete={v => setDeleteTarget(v as Vendor)}
        />
      )}

      {/* ── Create / Edit modal ───────────────────────────── */}
      <Modal
        open={formModal.open}
        onClose={() => setFormModal({ open: false })}
        title={formModal.vendor ? 'Edit Vendor' : 'New Vendor'}
        subtitle={formModal.vendor ? formModal.vendor.name : 'Add a new supplier to your business'}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setFormModal({ open: false })}>
              Cancel
            </button>
            <button form="vendor-form" type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {formModal.vendor ? 'Save Changes' : 'Create Vendor'}
            </button>
          </>
        }
      >
        <form id="vendor-form" onSubmit={saveVendor} className="space-y-4">
          <Field label="Vendor / Company Name" required>
            <input
              name="name"
              required
              defaultValue={formModal.vendor?.name}
              className="input"
              placeholder="e.g. Fresh Farms Co."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  name="phone"
                  type="tel"
                  defaultValue={formModal.vendor?.phone ?? ''}
                  className="input pl-9"
                  placeholder="9876543210"
                />
              </div>
            </Field>
            <Field label="Email">
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  name="email"
                  type="email"
                  defaultValue={formModal.vendor?.email ?? ''}
                  className="input pl-9"
                  placeholder="vendor@example.com"
                />
              </div>
            </Field>
          </div>

          <Field label="GST Number">
            <div className="relative">
              <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                name="gstNumber"
                defaultValue={formModal.vendor?.gstNumber ?? ''}
                className="input pl-9 font-mono"
                placeholder="29ABCDE1234F1Z5"
                maxLength={15}
              />
            </div>
          </Field>

          <Field label="Address">
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
              <textarea
                name="address"
                defaultValue={formModal.vendor?.address ?? ''}
                className="input pl-9 resize-none"
                rows={2}
                placeholder="Full delivery / billing address"
              />
            </div>
          </Field>
        </form>
      </Modal>

      {/* ── Delete confirm ────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Vendor"
        message={`Permanently delete "${deleteTarget?.name}"? Vendors with purchase orders cannot be deleted — deactivate them instead.`}
        confirmLabel="Delete"
        danger
        loading={saving}
      />

      {/* ── Toggle status confirm ─────────────────────────── */}
      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        title={toggleTarget?.isActive ? 'Deactivate Vendor' : 'Activate Vendor'}
        message={
          toggleTarget?.isActive
            ? `Deactivate "${toggleTarget.name}"? They will be hidden from new PO creation.`
            : `Reactivate "${toggleTarget?.name}"? They will appear in PO creation again.`
        }
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
        danger={toggleTarget?.isActive}
        loading={saving}
      />
    </div>
  );
}

/* ── Vendor card ─────────────────────────────────────────── */
function VendorCard({ vendor, onView, onEdit, onToggle, onDelete }: {
  vendor: Vendor;
  onView: (v: Vendor) => void;
  onEdit: (v: Vendor) => void;
  onToggle: (v: Vendor) => void;
  onDelete: (v: Vendor) => void;
}) {
  return (
    <div className="card card-hover flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0">
              {vendor.name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">{vendor.name}</p>
              {vendor.gstNumber && (
                <p className="text-xs font-mono text-slate-400 truncate">{vendor.gstNumber}</p>
              )}
            </div>
          </div>
          <span className={clsx('badge shrink-0', vendor.isActive ? 'badge-green' : 'badge-red')}>
            {vendor.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Contact info */}
        <div className="mt-3 space-y-1.5">
          {vendor.phone && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Phone size={12} className="text-slate-400 shrink-0" />
              <span className="font-mono">{vendor.phone}</span>
            </div>
          )}
          {vendor.email && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Mail size={12} className="text-slate-400 shrink-0" />
              <span className="truncate">{vendor.email}</span>
            </div>
          )}
          {vendor.address && (
            <div className="flex items-start gap-2 text-xs text-slate-500">
              <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
              <span className="line-clamp-1">{vendor.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* PO count */}
      <div className="px-5 py-2.5 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500">
        <ShoppingCart size={12} className="text-slate-400" />
        <span>{vendor._count.purchaseOrders} purchase order{vendor._count.purchaseOrders !== 1 ? 's' : ''}</span>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-1 mt-auto">
        <button
          onClick={() => onView(vendor)}
          className="btn-ghost flex-1 justify-center text-xs py-1.5 text-slate-600"
        >
          <Eye size={13} /> View
        </button>
        <div className="w-px h-5 bg-slate-100" />
        <button onClick={() => onEdit(vendor)} className="btn-ghost p-2" title="Edit">
          <Edit2 size={13} />
        </button>
        <button
          onClick={() => onToggle(vendor)}
          className={clsx('btn-ghost p-2', vendor.isActive ? 'text-red-400 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50')}
          title={vendor.isActive ? 'Deactivate' : 'Activate'}
        >
          {vendor.isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
        </button>
        <button
          onClick={() => onDelete(vendor)}
          className="btn-ghost p-2 text-red-400 hover:bg-red-50"
          title="Delete"
          disabled={vendor._count.purchaseOrders > 0}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/* ── Vendor detail panel ─────────────────────────────────── */
function VendorDetail({ vendor, loading, onClose, onEdit, onToggle, onDelete }: {
  vendor: VendorDetail | null;
  loading: boolean;
  onClose: () => void;
  onEdit: (v: VendorDetail) => void;
  onToggle: (v: VendorDetail) => void;
  onDelete: (v: VendorDetail) => void;
}) {
  const totalSpend = vendor?.purchaseOrders.reduce((s, po) => s + Number(po.totalAmount), 0) ?? 0;
  const paidPOs    = vendor?.purchaseOrders.filter(po => po.paymentStatus === 'PAID').length ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-white h-full flex flex-col shadow-2xl animate-slide-down overflow-hidden">
        {/* Drawer header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 shrink-0">
          <button onClick={onClose} className="text-slate-400 hover:text-white mb-3 flex items-center gap-1.5 text-xs transition-colors">
            <ArrowLeft size={14} /> Back to list
          </button>
          {loading ? (
            <div className="space-y-2">
              <div className="h-6 bg-white/10 rounded w-1/2 animate-pulse" />
              <div className="h-4 bg-white/10 rounded w-1/3 animate-pulse" />
            </div>
          ) : vendor ? (
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-white">{vendor.name}</h2>
                {vendor.gstNumber && (
                  <p className="text-xs font-mono text-slate-400 mt-0.5">{vendor.gstNumber}</p>
                )}
                <span className={clsx('badge mt-2', vendor.isActive ? 'badge-green' : 'badge-red')}>
                  {vendor.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onEdit(vendor)} className="p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-colors">
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => onToggle(vendor)}
                  className="p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {vendor.isActive ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                </button>
                {vendor._count.purchaseOrders === 0 && (
                  <button onClick={() => onDelete(vendor)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : vendor ? (
          <div className="flex-1 overflow-y-auto">
            {/* Contact details */}
            <div className="px-6 py-4 border-b border-slate-100 space-y-2.5">
              {vendor.phone && (
                <a href={`tel:${vendor.phone}`} className="flex items-center gap-3 text-sm text-slate-700 hover:text-brand-600 group">
                  <div className="icon-wrap w-8 h-8 bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <Phone size={14} />
                  </div>
                  <span className="font-mono">{vendor.phone}</span>
                </a>
              )}
              {vendor.email && (
                <a href={`mailto:${vendor.email}`} className="flex items-center gap-3 text-sm text-slate-700 hover:text-brand-600 group">
                  <div className="icon-wrap w-8 h-8 bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                    <Mail size={14} />
                  </div>
                  <span>{vendor.email}</span>
                </a>
              )}
              {vendor.address && (
                <div className="flex items-start gap-3 text-sm text-slate-700">
                  <div className="icon-wrap w-8 h-8 bg-emerald-50 text-emerald-600 shrink-0">
                    <MapPin size={14} />
                  </div>
                  <span className="leading-relaxed">{vendor.address}</span>
                </div>
              )}
            </div>

            {/* PO summary cards */}
            <div className="px-6 py-4 grid grid-cols-3 gap-3 border-b border-slate-100">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-slate-900">{vendor._count.purchaseOrders}</p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Total POs</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-emerald-700">{paidPOs}</p>
                <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Paid</p>
              </div>
              <div className="bg-brand-50 rounded-xl p-3 text-center">
                <p className="text-lg font-black text-brand-900">₹{Number(totalSpend).toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-brand-800 font-medium mt-0.5">Total Spend</p>
              </div>
            </div>

            {/* PO history */}
            <div className="px-6 pt-4 pb-6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Purchase Order History
              </p>

              {vendor.purchaseOrders.length === 0 ? (
                <div className="text-center py-10">
                  <Package size={28} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No purchase orders yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {vendor.purchaseOrders.map(po => (
                    <div key={po.id} className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs font-mono font-bold text-slate-700">{po.poNumber}</p>
                          <p className="text-sm font-semibold text-slate-900 mt-0.5">{po.material.name}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <span className={`badge ${PO_STATUS_STYLE[po.status] || 'badge-slate'}`}>
                            {po.status}
                          </span>
                          <span className={`badge ${PAY_STATUS_STYLE[po.paymentStatus] || 'badge-slate'}`}>
                            {po.paymentStatus}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-3">
                          <span>{Number(po.quantity).toFixed(2)} {po.material.unit}</span>
                          <span>@ ₹{Number(po.unitPrice).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">₹{Number(po.totalAmount).toLocaleString('en-IN')}</span>
                          <span className="flex items-center gap-0.5 text-slate-400">
                            <Clock size={10} />
                            {new Date(po.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
