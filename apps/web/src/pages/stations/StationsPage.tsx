import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Plus, UserCog, Trash2, Edit2, Check, X, ChefHat, Search, Crown, Printer as PrinterIcon,
} from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

type StaffLite = { id: string; name: string; phone: string; role?: { name: string } };
type StationItem = { id: string; name: string };
type PrinterLite = { id: string; name: string; address: string | null; connection: string };
type Station = {
  id: string;
  name: string;
  isMaster?: boolean;
  currentWorker?: { id: string; name: string; phone: string } | null;
  items: StationItem[];
  printerId?: string | null;
  printer?: PrinterLite | null;
};

type MenuItem = { id: string; name: string };
type MenuSub = { id: string; name: string; items: MenuItem[] };
type MenuCat = { id: string; name: string; subcategories: MenuSub[] };

export default function StationsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const outletId = user?.outletId || 'demo-outlet';

  const [stations, setStations] = useState<Station[]>([]);
  const [staff, setStaff] = useState<StaffLite[]>([]);
  const [menu, setMenu] = useState<MenuCat[]>([]);
  const [printers, setPrinters] = useState<PrinterLite[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingName, setEditingName] = useState<{ id: string; value: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Station | null>(null);
  const [itemPicker, setItemPicker] = useState<Station | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, st, m, pr] = await Promise.all([
        api.get(`/outlets/${outletId}/kitchen-stations`),
        api.get(`/outlets/${outletId}/kitchen-stations/staff`),
        api.get(`/outlets/${outletId}/menu`),
        api.get(`/outlets/${outletId}/printers`).catch(() => null),
      ]);
      setStations(s.data.data || []);
      setStaff(st.data.data || []);
      setMenu(m.data.data || []);
      setPrinters(pr?.data.data || []);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api.post(`/outlets/${outletId}/kitchen-stations`, { name: newName.trim() });
      toast.success('Station created');
      setCreateOpen(false);
      setNewName('');
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const renameStation = async (id: string, name: string) => {
    if (!name.trim()) return setEditingName(null);
    try {
      await api.patch(`/outlets/${outletId}/kitchen-stations/${id}`, { name: name.trim() });
      toast.success('Renamed');
      setEditingName(null);
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  const assignWorker = async (stationId: string, workerId: string | null) => {
    try {
      await api.patch(`/outlets/${outletId}/kitchen-stations/${stationId}`, {
        currentWorkerId: workerId,
      });
      toast.success(workerId ? 'Worker assigned' : 'Worker unassigned');
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  const assignPrinter = async (stationId: string, printerId: string | null) => {
    try {
      await api.patch(`/outlets/${outletId}/kitchen-stations/${stationId}`, { printerId });
      toast.success(printerId ? 'Printer assigned' : 'Printer cleared');
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  const toggleMaster = async (stationId: string, isMaster: boolean) => {
    try {
      await api.patch(`/outlets/${outletId}/kitchen-stations/${stationId}`, { isMaster });
      toast.success(isMaster ? 'Marked as master station' : 'Master flag removed');
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/outlets/${outletId}/kitchen-stations/${deleteTarget.id}`);
      toast.success('Station removed');
      setDeleteTarget(null);
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center icon-gradient-orange">
            <ChefHat size={18} />
          </div>
          <div>
            <h1 className="page-title">Kitchen Stations</h1>
            <p className="page-subtitle">Group items by prep counter and assign today's worker</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> New Station
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-40 skeleton" />)}
        </div>
      ) : stations.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon"><ChefHat size={22} className="text-slate-400" /></div>
          <p className="text-sm font-semibold text-slate-600">No stations yet</p>
          <p className="text-xs text-slate-400 mt-1">Create one (e.g. Dosa, Idly, Drinks) and assign items.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {stations.map((station) => (
            <div key={station.id} className="card flex flex-col">
              <div className="px-4 pt-3.5 pb-3 border-b border-slate-100 flex items-start justify-between gap-2">
                {editingName?.id === station.id ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <input
                      autoFocus
                      value={editingName.value}
                      onChange={(e) => setEditingName({ id: station.id, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameStation(station.id, editingName.value);
                        if (e.key === 'Escape') setEditingName(null);
                      }}
                      className="input text-sm py-1"
                    />
                    <button
                      onClick={() => renameStation(station.id, editingName.value)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md"
                    >
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingName(null)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-md">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-slate-900 truncate">{station.name}</p>
                      {station.isMaster && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          <Crown size={9} /> MASTER
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {station.isMaster ? 'Sees all items' : `${station.items.length} item${station.items.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                )}

                {editingName?.id !== station.id && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setEditingName({ id: station.id, value: station.name })}
                      className="btn-ghost p-1.5"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(station)}
                      className="btn-ghost p-1.5 text-red-400 hover:bg-red-50"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              <div className="px-4 py-3 space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1 mb-1.5">
                    <UserCog size={11} /> Today's Worker
                  </label>
                  <select
                    value={station.currentWorker?.id || ''}
                    onChange={(e) => assignWorker(station.id, e.target.value || null)}
                    className="input text-xs"
                  >
                    <option value="">— Unassigned —</option>
                    {staff.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}{u.role?.name ? ` · ${u.role.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1 mb-1.5">
                    <PrinterIcon size={11} /> Receipt Printer
                  </label>
                  <select
                    value={station.printer?.id || station.printerId || ''}
                    onChange={(e) => assignPrinter(station.id, e.target.value || null)}
                    className="input text-xs"
                  >
                    <option value="">— No printer —</option>
                    {printers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {printers.length === 0 && (
                    <p className="text-[10px] text-slate-400 mt-1 italic">Add printers under Outlet Profile › Kitchen Printing.</p>
                  )}
                </div>

                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1">
                      <Crown size={11} /> Master station
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Worker sees & manages all items</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!station.isMaster}
                    onChange={(e) => toggleMaster(station.id, e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                </label>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Items</label>
                    {!station.isMaster && (
                      <button
                        onClick={() => setItemPicker(station)}
                        className="text-[10px] font-semibold text-brand-800 hover:text-brand-900"
                      >
                        Manage
                      </button>
                    )}
                  </div>
                  {station.isMaster ? (
                    <p className="text-xs text-amber-600 italic">All outlet items (master)</p>
                  ) : station.items.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No items assigned.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {station.items.slice(0, 6).map((i) => (
                        <span key={i.id} className="badge badge-slate text-[10px]">{i.name}</span>
                      ))}
                      {station.items.length > 6 && (
                        <span className="badge badge-slate text-[10px]">+{station.items.length - 6}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Station"
        subtitle="e.g. Dosa, Idly, Beverages"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={create} disabled={saving || !newName.trim()}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
          placeholder="Station name"
          className="input"
        />
      </Modal>

      {/* Item picker */}
      {itemPicker && (
        <ItemPickerModal
          station={itemPicker}
          menu={menu}
          outletId={outletId}
          onClose={() => setItemPicker(null)}
          onSaved={() => { setItemPicker(null); fetchAll(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete station"
        message={`Remove "${deleteTarget?.name}"? Its items will be unassigned.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

/* ── Item picker modal ──────────────────────────────────────── */
function ItemPickerModal({
  station, menu, outletId, onClose, onSaved,
}: {
  station: Station;
  menu: MenuCat[];
  outletId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(station.items.map((i) => i.id)));
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menu;
    return menu
      .map((cat) => ({
        ...cat,
        subcategories: cat.subcategories
          .map((sub) => ({ ...sub, items: sub.items.filter((i) => i.name.toLowerCase().includes(q)) }))
          .filter((sub) => sub.items.length > 0),
      }))
      .filter((cat) => cat.subcategories.length > 0);
  }, [menu, search]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/outlets/${outletId}/kitchen-stations/${station.id}/items`, {
        itemIds: Array.from(selected),
      });
      toast.success('Items updated');
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Items in ${station.name}`}
      subtitle={`${selected.size} selected`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          className="input pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No items match.</p>
      ) : (
        <div className="space-y-3 max-h-[55vh] overflow-y-auto">
          {filtered.map((cat) => (
            <div key={cat.id}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{cat.name}</p>
              {cat.subcategories.map((sub) => (
                <div key={sub.id} className="mb-2">
                  <p className="text-[10px] font-semibold text-slate-400 mb-1">{sub.name}</p>
                  <div className="space-y-1">
                    {sub.items.map((item) => {
                      const checked = selected.has(item.id);
                      return (
                        <label
                          key={item.id}
                          className={clsx(
                            'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                            checked
                              ? 'border-brand-200 bg-brand-50'
                              : 'border-slate-200 bg-white hover:bg-slate-50',
                          )}
                        >
                          <span className="text-xs font-semibold text-slate-800 truncate">{item.name}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(item.id)}
                            className="rounded shrink-0"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
