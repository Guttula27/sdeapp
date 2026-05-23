import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, LayoutGrid, QrCode, ChevronDown, ChevronRight, Download, Users as UsersIcon } from 'lucide-react';
import { downloadQrCard } from '../../utils/qrCard';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { allowsSeating } from '../../utils/outletType';

const SWATCHES = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#a855f7', '#ec4899', '#14b8a6', '#84cc16',
  '#6366f1', '#64748b',
];

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

export default function TableTypesPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId;
  const userOutletId = user?.outletId || '';

  const [outlets, setOutlets] = useState<any[]>([]);
  const [outletId, setOutletId] = useState<string>(userOutletId);

  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<{ open: boolean; editing?: any }>({ open: false });
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Table add modal
  const [tableModal, setTableModal] = useState<{ open: boolean; type?: any }>({ open: false });
  const [tableNumber, setTableNumber] = useState('');
  const [tableCap, setTableCap] = useState('4');

  // QR display modal
  const [qrModal, setQrModal] = useState<{ open: boolean; qr?: any; table?: any }>({ open: false });

  // Outlet meta (for QR card)
  const [outlet, setOutlet] = useState<any>(null);
  useEffect(() => {
    if (!outletId) { setOutlet(null); return; }
    api.get(`/outlets/${outletId}`).then(({ data }) => setOutlet(data.data)).catch(() => {});
  }, [outletId]);

  // Expanded type sections
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const fetchTypes = useCallback(async () => {
    if (!outletId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/outlets/${outletId}/table-types`);
      setTypes(data.data || []);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const openCreate = () => {
    setName('');
    setColor(SWATCHES[0]);
    setModal({ open: true });
  };
  const openEdit = (t: any) => {
    setName(t.name);
    setColor(t.color);
    setModal({ open: true, editing: t });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (modal.editing) {
        await api.patch(`/outlets/${outletId}/table-types/${modal.editing.id}`, { name: name.trim(), color });
        toast.success('Table type updated');
      } else {
        await api.post(`/outlets/${outletId}/table-types`, { name: name.trim(), color });
        toast.success('Table type created');
      }
      setModal({ open: false });
      fetchTypes();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Table CRUD ──────────────────────────────────────────
  const openAddTable = (t: any) => {
    setTableModal({ open: true, type: t });
    setTableNumber('');
    setTableCap('4');
  };

  const saveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableModal.type || !tableNumber.trim()) return;
    setSaving(true);
    try {
      await api.post(`/outlets/${outletId}/table-types/${tableModal.type.id}/tables`, {
        number: tableNumber.trim(),
        capacity: Number(tableCap) || 4,
      });
      toast.success(`Table ${tableNumber} added`);
      setTableModal({ open: false });
      fetchTypes();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const removeTable = async (tableId: string) => {
    if (!confirm('Remove this table?')) return;
    try {
      await api.delete(`/outlets/${outletId}/table-types/tables/${tableId}`);
      toast.success('Table removed');
      fetchTypes();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  const showQR = async (table: any) => {
    try {
      const { data } = await api.post(`/qr/table/${table.id}?outletId=${outletId}`);
      setQrModal({ open: true, qr: data.data, table });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'QR generation failed');
    }
  };

  const downloadQR = async () => {
    if (!qrModal.qr?.url) return;
    await downloadQrCard({
      outletName: outlet?.name,
      outletAddress: outlet?.address,
      caption: 'Scan to view menu',
      label: 'TABLE',
      detail: qrModal.table?.number || '—',
      url: qrModal.qr.url,
      filename: `qr-${outlet?.name || 'outlet'}-table-${qrModal.table?.number || 'x'}.png`,
    });
  };

  const toggleExpand = (id: string) =>
    setExpanded(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/outlets/${outletId}/table-types/${deleteTarget.id}`);
      toast.success('Table type deleted');
      setDeleteTarget(null);
      fetchTypes();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const isMultiOutlet = outlets.length > 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Table Types</h1>
          <p className="page-subtitle">
            Define service contexts (AC / Non-AC / Outdoor…) — each can carry its own item pricing.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isMultiOutlet && (
            <select
              value={outletId}
              onChange={e => setOutletId(e.target.value)}
              className="input py-2 px-3 text-sm font-medium min-w-[180px]"
            >
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <button
            className="btn-primary"
            onClick={openCreate}
            disabled={!outletId || !allowsSeating(outlet?.outletType)}
            title={!allowsSeating(outlet?.outletType) ? 'Not available for self-service outlets' : undefined}
          >
            <Plus size={15} /> Add Table Type
          </button>
        </div>
      </div>

      {!allowsSeating(outlet?.outletType) ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <LayoutGrid size={40} className="text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">Table types don't apply here</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md">
            This outlet is self-service, so guests don't sit. Change the outlet type to Hybrid or Dine-in on the Outlets page to enable seating.
          </p>
        </div>
      ) : loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}</div>
      ) : types.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <LayoutGrid size={40} className="text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No table types yet</p>
          <p className="text-xs text-slate-400 mt-1">Add AC, Non-AC, Garden, etc., then assign tables to each.</p>
          <button className="btn-primary mt-4" onClick={openCreate}><Plus size={14} /> First type</button>
        </div>
      ) : (
        <div className="space-y-3">
          {types.map(t => {
            const isOpen = expanded.has(t.id);
            return (
              <div key={t.id} className="card overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleExpand(t.id)} className="flex items-center gap-3 flex-1 text-left">
                    {isOpen ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: t.color }}>
                      <LayoutGrid size={17} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{t.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {t.tables?.length || 0} table{(t.tables?.length || 0) !== 1 ? 's' : ''} · {t._count?.prices || 0} prices
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openAddTable(t)} className="btn-ghost text-xs py-1.5 px-2 text-brand-600 hover:bg-brand-50"><Plus size={13} /> Table</button>
                    <button onClick={() => openEdit(t)} className="btn-ghost p-1.5"><Edit2 size={13} /></button>
                    <button onClick={() => setDeleteTarget(t)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/40 p-3">
                    {!t.tables?.length ? (
                      <p className="text-xs text-slate-400 italic px-2 py-2">
                        No tables yet. Click <span className="font-semibold text-brand-600">+ Table</span> to add the first one.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {t.tables.map((table: any) => (
                          <div key={table.id} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center gap-1.5">
                            <p className="text-sm font-black text-slate-900">{table.number}</p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1"><UsersIcon size={9} /> {table.capacity} seats</p>
                            <div className="flex items-center gap-1 mt-1">
                              <button onClick={() => showQR(table)} className="btn-ghost text-[11px] py-1 px-2 text-brand-600 hover:bg-brand-50"><QrCode size={12} /> QR</button>
                              <button onClick={() => removeTable(table.id)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-50"><Trash2 size={11} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.editing ? 'Edit Table Type' : 'New Table Type'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal({ open: false })}>Cancel</button>
            <button form="tt-form" type="submit" className="btn-primary" disabled={saving || !name.trim()}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {modal.editing ? 'Save Changes' : 'Create'}
            </button>
          </>
        }
      >
        <form id="tt-form" onSubmit={save} className="space-y-4">
          <Field label="Name">
            <input value={name} onChange={e => setName(e.target.value)} required className="input" placeholder="e.g. AC, Outdoor, Family lounge" />
          </Field>
          <Field label="Color">
            <div className="flex items-center gap-2 flex-wrap">
              {SWATCHES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{ background: c, borderColor: color === c ? '#0f172a' : 'transparent' }}
                />
              ))}
            </div>
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete table type"
        message={`Delete "${deleteTarget?.name}"? Linked tables will lose this assignment and their special prices will be removed.`}
        confirmLabel="Delete"
        danger
        loading={saving}
      />

      {/* Add Table modal */}
      <Modal
        open={tableModal.open}
        onClose={() => setTableModal({ open: false })}
        title={`Add table under ${tableModal.type?.name || ''}`}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setTableModal({ open: false })}>Cancel</button>
            <button form="add-table-form" type="submit" className="btn-primary" disabled={saving || !tableNumber.trim()}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Add Table
            </button>
          </>
        }
      >
        <form id="add-table-form" onSubmit={saveTable} className="grid grid-cols-2 gap-3">
          <Field label="Table number">
            <input value={tableNumber} onChange={e => setTableNumber(e.target.value)} required className="input" placeholder="e.g. T-04" />
          </Field>
          <Field label="Capacity">
            <input type="number" min={1} max={50} value={tableCap} onChange={e => setTableCap(e.target.value)} className="input" />
          </Field>
        </form>
      </Modal>

      {/* QR modal */}
      <Modal
        open={qrModal.open}
        onClose={() => setQrModal({ open: false })}
        title={`Table ${qrModal.table?.number || ''} — QR`}
        subtitle="Place this at the table. Scanning opens the menu and pre-selects this table."
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setQrModal({ open: false })}>Close</button>
            <button className="btn-primary" onClick={downloadQR}><Download size={14} /> Download</button>
          </>
        }
      >
        {qrModal.qr?.imageUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img src={qrModal.qr.imageUrl} alt="QR" className="w-64 h-64 rounded-xl border border-slate-200" />
            <p className="text-[11px] text-slate-400 break-all px-3 text-center">{qrModal.qr.url || ''}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-6 text-center">Generating QR…</p>
        )}
      </Modal>
    </div>
  );
}
