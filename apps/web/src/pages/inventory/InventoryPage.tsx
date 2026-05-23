import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { AlertTriangle, Package, Plus, TrendingDown, ShoppingCart, CheckSquare, RefreshCw } from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const UNITS = ['KG', 'GRAM', 'LITRE', 'ML', 'UNIT', 'BOX', 'PACKET', 'DOZEN'];
const PO_STATUS_STYLE: Record<string, string> = {
  PENDING: 'badge-yellow', APPROVED: 'badge-blue',
  RECEIVED: 'badge-green', CANCELLED: 'badge-red',
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

type Tab = 'materials' | 'purchase-orders';

export default function InventoryPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId || 'demo-business';

  const [tab, setTab]             = useState<Tab>('materials');
  const [materials, setMaterials] = useState<any[]>([]);
  const [lowStock, setLowStock]   = useState<any[]>([]);
  const [pos, setPOs]             = useState<any[]>([]);
  const [vendors, setVendors]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  const [matModal, setMatModal]   = useState(false);
  const [poModal, setPoModal]     = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [m, ls, po, v] = await Promise.all([
        api.get(`/inventory/materials?businessId=${businessId}`),
        api.get(`/inventory/materials/low-stock?businessId=${businessId}`),
        api.get(`/inventory/purchase-orders?businessId=${businessId}`),
        api.get(`/vendors?businessId=${businessId}`),
      ]);
      setMaterials(m.data.data);
      setLowStock(ls.data.data);
      setPOs(po.data.data);
      setVendors(v.data.data);
    } finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveMaterial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await api.post(`/inventory/materials?businessId=${businessId}`, {
        name: form.get('name'),
        unit: form.get('unit'),
        reorderLevel: Number(form.get('reorderLevel')) || undefined,
        costPerUnit: Number(form.get('costPerUnit')) || undefined,
        currentStock: Number(form.get('currentStock')) || 0,
      });
      toast.success('Material added');
      setMatModal(false);
      fetchAll();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const savePO = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await api.post('/inventory/purchase-orders', {
        vendorId: form.get('vendorId'),
        materialId: form.get('materialId'),
        quantity: Number(form.get('quantity')),
        unitPrice: Number(form.get('unitPrice')),
      });
      toast.success('Purchase order created');
      setPoModal(false);
      fetchAll();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const receivePO = async () => {
    if (!receiveTarget) return;
    setSaving(true);
    try {
      await api.patch(`/inventory/purchase-orders/${receiveTarget.id}/receive`);
      toast.success('Stock updated successfully');
      setReceiveTarget(null);
      fetchAll();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const stockPercent = (m: any) => {
    if (!m.reorderLevel) return 80;
    return Math.min(100, Math.round((Number(m.currentStock) / (Number(m.reorderLevel) * 3)) * 100));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">{materials.length} materials tracked</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setPoModal(true)} disabled={vendors.length === 0 || materials.length === 0}>
            <ShoppingCart size={15} /> New PO
          </button>
          <button className="btn-primary" onClick={() => setMatModal(true)}><Plus size={15} /> Add Material</button>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-red-600 shrink-0" />
            <p className="text-sm font-bold text-red-700">{lowStock.length} item{lowStock.length > 1 ? 's' : ''} running low</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(m => (
              <div key={m.id} className="flex items-center gap-1.5 bg-red-100 text-red-700 text-xs px-3 py-1.5 rounded-xl font-medium">
                <TrendingDown size={10} /> {m.name}: {Number(m.currentStock).toFixed(2)} {m.unit}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['materials', 'purchase-orders'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize', tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}
          >
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* ── Materials tab ─────────────────────────────────────── */}
      {tab === 'materials' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-auto">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Unit</th>
                  <th className="text-right">Current Stock</th>
                  <th className="text-right">Reorder At</th>
                  <th>Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j}><div className="h-3 bg-slate-100 rounded animate-pulse w-16" /></td>)}</tr>
                  ))
                ) : materials.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">No materials yet — add one above</td></tr>
                ) : materials.map(m => {
                  const isLow = m.reorderLevel && Number(m.currentStock) <= Number(m.reorderLevel);
                  const pct = stockPercent(m);
                  return (
                    <tr key={m.id}>
                      <td className="font-semibold text-slate-900">{m.name}</td>
                      <td className="text-slate-500 text-xs">{m.unit}</td>
                      <td className={clsx('text-right font-bold tabular-nums', isLow ? 'text-red-600' : 'text-slate-900')}>{Number(m.currentStock).toFixed(2)}</td>
                      <td className="text-right text-slate-500 tabular-nums">{m.reorderLevel ? Number(m.reorderLevel).toFixed(2) : '—'}</td>
                      <td className="w-36">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={clsx('h-full rounded-full', isLow ? 'bg-red-500' : pct > 60 ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td><span className={isLow ? 'badge badge-red' : 'badge badge-green'}>{isLow ? 'Low Stock' : 'OK'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Purchase Orders tab ───────────────────────────────── */}
      {tab === 'purchase-orders' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-auto">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Vendor</th>
                  <th>Material</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Total</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><div className="h-3 bg-slate-100 rounded animate-pulse w-16" /></td>)}</tr>
                  ))
                ) : pos.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">No purchase orders yet</td></tr>
                ) : pos.map(po => (
                  <tr key={po.id}>
                    <td className="font-mono text-xs font-semibold text-slate-700">{po.poNumber}</td>
                    <td className="text-slate-700">{po.vendor?.name}</td>
                    <td className="text-slate-700">{po.material?.name}</td>
                    <td className="text-right tabular-nums">{Number(po.quantity).toFixed(2)} {po.material?.unit}</td>
                    <td className="text-right font-bold text-slate-900 tabular-nums">₹{Number(po.totalAmount).toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${PO_STATUS_STYLE[po.status] || 'badge-slate'}`}>{po.status}</span></td>
                    <td>
                      {po.status === 'PENDING' && (
                        <button
                          onClick={() => setReceiveTarget(po)}
                          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                          <CheckSquare size={13} /> Receive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add Material modal ────────────────────────────────── */}
      <Modal open={matModal} onClose={() => setMatModal(false)} title="Add Material" size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setMatModal(false)}>Cancel</button>
            <button form="mat-form" type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Add Material
            </button>
          </>
        }
      >
        <form id="mat-form" onSubmit={saveMaterial} className="space-y-4">
          <Field label="Material Name">
            <input name="name" required className="input" placeholder="e.g. Basmati Rice" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit">
              <select name="unit" required className="input">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Opening Stock">
              <input name="currentStock" type="number" min="0" step="0.001" className="input" placeholder="0" defaultValue="0" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reorder Level">
              <input name="reorderLevel" type="number" min="0" step="0.001" className="input" placeholder="e.g. 5" />
            </Field>
            <Field label="Cost Per Unit (₹)">
              <input name="costPerUnit" type="number" min="0" step="0.01" className="input" placeholder="0.00" />
            </Field>
          </div>
        </form>
      </Modal>

      {/* ── Create PO modal ───────────────────────────────────── */}
      <Modal open={poModal} onClose={() => setPoModal(false)} title="New Purchase Order" size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPoModal(false)}>Cancel</button>
            <button form="po-form" type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Create PO
            </button>
          </>
        }
      >
        <form id="po-form" onSubmit={savePO} className="space-y-4">
          <Field label="Vendor">
            <select name="vendorId" required className="input">
              <option value="">Select vendor</option>
              {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
          <Field label="Material">
            <select name="materialId" required className="input">
              <option value="">Select material</option>
              {materials.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <input name="quantity" type="number" min="0.001" step="0.001" required className="input" placeholder="0" />
            </Field>
            <Field label="Unit Price (₹)">
              <input name="unitPrice" type="number" min="0" step="0.01" required className="input" placeholder="0.00" />
            </Field>
          </div>
        </form>
      </Modal>

      {/* ── Receive PO confirm ────────────────────────────────── */}
      <ConfirmDialog
        open={!!receiveTarget}
        onClose={() => setReceiveTarget(null)}
        onConfirm={receivePO}
        title="Receive Purchase Order"
        message={`Mark ${receiveTarget?.poNumber} as received? This will add ${Number(receiveTarget?.quantity).toFixed(2)} ${receiveTarget?.material?.unit} of "${receiveTarget?.material?.name}" to stock.`}
        confirmLabel="Receive & Update Stock"
        loading={saving}
      />
    </div>
  );
}
