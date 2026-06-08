import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Plus, Trash2, Edit2, Check, X, ConciergeBell, Users as UsersIcon,
  LayoutGrid, Package,
} from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

type StaffLite = { id: string; name: string; phone: string; role?: { name: string } };
type TableTypeLite = { id: string; name: string; color: string };
type TableLite = {
  id: string;
  number: string;
  sectionId?: string | null;
  tableTypeId?: string | null;
  section?: { id: string; name: string } | null;
};
type ServiceStation = {
  id: string;
  name: string;
  tableType?: TableTypeLite | null;
  isParcelStation?: boolean;
  workers: { id: string; user: StaffLite }[];
  tables: { id: string; table: TableLite }[];
};

export default function ServiceStationsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const outletId = user?.outletId || 'demo-outlet';

  const [stations, setStations]   = useState<ServiceStation[]>([]);
  const [staff, setStaff]         = useState<StaffLite[]>([]);
  const [tableTypes, setTypes]    = useState<TableTypeLite[]>([]);
  const [loading, setLoading]     = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName]       = useState('');
  const [newTableType, setNewTT]    = useState<string>('');
  const [newIsParcel, setNewIsParcel] = useState(false);
  const [saving, setSaving]         = useState(false);

  const [editingName, setEditingName]   = useState<{ id: string; value: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceStation | null>(null);
  const [workerPicker, setWorkerPicker] = useState<ServiceStation | null>(null);
  const [tablePicker, setTablePicker]   = useState<ServiceStation | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, st, tt] = await Promise.all([
        api.get(`/outlets/${outletId}/service-stations`),
        api.get(`/outlets/${outletId}/service-stations/staff`),
        api.get(`/outlets/${outletId}/table-types`),
      ]);
      setStations(s.data.data || []);
      setStaff(st.data.data || []);
      setTypes(tt.data.data || []);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api.post(`/outlets/${outletId}/service-stations`, {
        name: newName.trim(),
        tableTypeId: newIsParcel ? null : (newTableType || null),
        isParcelStation: newIsParcel,
      });
      toast.success('Service station created');
      setCreateOpen(false);
      setNewName('');
      setNewTT('');
      setNewIsParcel(false);
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const rename = async (id: string, name: string) => {
    if (!name.trim()) return setEditingName(null);
    try {
      await api.patch(`/outlets/${outletId}/service-stations/${id}`, { name: name.trim() });
      setEditingName(null);
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  const setStationTableType = async (stationId: string, tableTypeId: string | null) => {
    try {
      await api.patch(`/outlets/${outletId}/service-stations/${stationId}`, { tableTypeId });
      toast.success(tableTypeId ? 'Section set' : 'Section cleared');
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  const setParcelFlag = async (stationId: string, isParcelStation: boolean) => {
    try {
      await api.patch(`/outlets/${outletId}/service-stations/${stationId}`, { isParcelStation });
      toast.success(isParcelStation ? 'Marked as parcel station' : 'Parcel mode off');
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/outlets/${outletId}/service-stations/${deleteTarget.id}`);
      toast.success('Removed');
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
            <ConciergeBell size={18} />
          </div>
          <div>
            <h1 className="page-title">Service Stations</h1>
            <p className="page-subtitle">Group floor staff by dine-in section and assign the tables they serve</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> New Station
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-48 skeleton" />)}
        </div>
      ) : stations.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon"><ConciergeBell size={22} className="text-slate-400" /></div>
          <p className="text-sm font-semibold text-slate-600">No service stations yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Set one up if your outlet serves orders to seated tables. Each station pins service staff to a dine-in section and a set of tables.
          </p>
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
                        if (e.key === 'Enter') rename(station.id, editingName.value);
                        if (e.key === 'Escape') setEditingName(null);
                      }}
                      className="input text-sm py-1"
                    />
                    <button onClick={() => rename(station.id, editingName.value)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md">
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
                      {station.isParcelStation && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                          <Package size={9} /> PARCEL
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {station.workers.length} worker{station.workers.length === 1 ? '' : 's'}
                      {!station.isParcelStation && ` · ${station.tables.length} table${station.tables.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                )}
                {editingName?.id !== station.id && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditingName({ id: station.id, value: station.name })} className="btn-ghost p-1.5"><Edit2 size={12} /></button>
                    <button onClick={() => setDeleteTarget(station)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-50"><Trash2 size={12} /></button>
                  </div>
                )}
              </div>

              <div className="px-4 py-3 space-y-3">
                <label className="flex items-start justify-between gap-2 cursor-pointer p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1">
                      <Package size={11} /> Parcel station
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Handles every parcel order. Falls back to regular stations if unstaffed.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!station.isParcelStation}
                    onChange={(e) => setParcelFlag(station.id, e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-blue-500 rounded"
                  />
                </label>

                {!station.isParcelStation && (
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1 mb-1.5">
                      <LayoutGrid size={11} /> Section
                    </label>
                    <select
                      value={station.tableType?.id || ''}
                      onChange={(e) => setStationTableType(station.id, e.target.value || null)}
                      className="input text-xs"
                    >
                      <option value="">— None —</option>
                      {tableTypes.map((tt) => (
                        <option key={tt.id} value={tt.id}>{tt.name}</option>
                      ))}
                    </select>
                    {station.tableType && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white px-2 py-0.5 rounded-full mt-1.5" style={{ background: station.tableType.color }}>
                        🪑 {station.tableType.name}
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1">
                      <UsersIcon size={11} /> Service Staff
                    </label>
                    <button onClick={() => setWorkerPicker(station)} className="text-[10px] font-semibold text-brand-800 hover:text-brand-900">Manage</button>
                  </div>
                  {station.workers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No staff assigned.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {station.workers.slice(0, 6).map((w) => (
                        <span key={w.id} className="badge badge-slate text-[10px]">{w.user.name}</span>
                      ))}
                      {station.workers.length > 6 && (
                        <span className="badge badge-slate text-[10px]">+{station.workers.length - 6}</span>
                      )}
                    </div>
                  )}
                </div>

                {!station.isParcelStation && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Tables</label>
                      <button
                        onClick={() => setTablePicker(station)}
                        disabled={!station.tableType}
                        className={clsx(
                          'text-[10px] font-semibold',
                          station.tableType ? 'text-brand-800 hover:text-brand-900' : 'text-slate-300 cursor-not-allowed',
                        )}
                        title={!station.tableType ? 'Pick a section first' : ''}
                      >
                        Manage
                      </button>
                    </div>
                    {!station.tableType ? (
                      <p className="text-[11px] text-slate-400 italic">Set a section to assign tables.</p>
                    ) : station.tables.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No tables assigned.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {station.tables.slice(0, 10).map((t) => (
                          <span key={t.id} className="badge badge-slate text-[10px]">#{t.table.number}</span>
                        ))}
                        {station.tables.length > 10 && (
                          <span className="badge badge-slate text-[10px]">+{station.tables.length - 10}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Service Station"
        subtitle="e.g. AC Section · Floor 1 · Garden"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={create} disabled={saving || !newName.trim()}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Station name"
            className="input"
          />
          <label className="flex items-start justify-between gap-2 cursor-pointer p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50">
            <div>
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1"><Package size={12} /> Parcel station</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Handles parcel orders instead of a dine-in section.</p>
            </div>
            <input
              type="checkbox"
              checked={newIsParcel}
              onChange={(e) => setNewIsParcel(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-blue-500 rounded"
            />
          </label>
          {!newIsParcel && (
            <select value={newTableType} onChange={(e) => setNewTT(e.target.value)} className="input">
              <option value="">— Pick a section (optional) —</option>
              {tableTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>{tt.name}</option>
              ))}
            </select>
          )}
        </div>
      </Modal>

      {workerPicker && (
        <WorkerPicker
          station={workerPicker}
          staff={staff}
          outletId={outletId}
          onClose={() => setWorkerPicker(null)}
          onSaved={() => { setWorkerPicker(null); fetchAll(); }}
        />
      )}

      {tablePicker && (
        <TablePicker
          station={tablePicker}
          outletId={outletId}
          onClose={() => setTablePicker(null)}
          onSaved={() => { setTablePicker(null); fetchAll(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Remove service station"
        message={`Remove "${deleteTarget?.name}"? Assigned staff and tables will be unlinked.`}
        confirmLabel="Remove"
      />
    </div>
  );
}

/* ── Worker picker ─────────────────────────────────────── */
function WorkerPicker({
  station, staff, outletId, onClose, onSaved,
}: {
  station: ServiceStation;
  staff: StaffLite[];
  outletId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(station.workers.map((w) => w.user.id)));
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/outlets/${outletId}/service-stations/${station.id}/workers`, {
        userIds: Array.from(selected),
      });
      toast.success('Staff updated');
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} size="md"
      title={`Staff in ${station.name}`}
      subtitle={`${selected.size} selected`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      {staff.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">No outlet staff yet.</p>
      ) : (
        <div className="space-y-1 max-h-[55vh] overflow-y-auto">
          {staff.map((u) => {
            const checked = selected.has(u.id);
            return (
              <label key={u.id} className={clsx(
                'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border cursor-pointer',
                checked ? 'border-brand-200 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50',
              )}>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-800">{u.name}</span>
                  <span className="text-[10px] text-slate-400">{u.phone}{u.role?.name ? ` · ${u.role.name}` : ''}</span>
                </div>
                <input type="checkbox" checked={checked} onChange={() => toggle(u.id)} className="rounded shrink-0" />
              </label>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ── Table picker ──────────────────────────────────────── */
function TablePicker({
  station, outletId, onClose, onSaved,
}: {
  station: ServiceStation;
  outletId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tables, setTables] = useState<TableLite[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(station.tables.map((t) => t.table.id)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!station.tableType?.id) return;
    api.get(`/outlets/${outletId}/service-stations/tables-by-type`, {
      params: { tableTypeId: station.tableType.id },
    }).then(({ data }) => setTables(data.data || []))
      .finally(() => setLoading(false));
  }, [outletId, station.tableType?.id]);

  const grouped = useMemo(() => {
    const map: Record<string, { sectionName: string; tables: TableLite[] }> = {};
    tables.forEach((t) => {
      const k = t.section?.id || 'no-section';
      const name = t.section?.name || 'Unassigned';
      if (!map[k]) map[k] = { sectionName: name, tables: [] };
      map[k].tables.push(t);
    });
    return Object.values(map);
  }, [tables]);

  const toggle = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/outlets/${outletId}/service-stations/${station.id}/tables`, {
        tableIds: Array.from(selected),
      });
      toast.success('Tables updated');
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const selectAll = () => setSelected(new Set(tables.map((t) => t.id)));
  const clearAll  = () => setSelected(new Set());

  return (
    <Modal
      open onClose={onClose} size="md"
      title={`Tables in ${station.name}`}
      subtitle={`${station.tableType?.name || 'No section'} · ${selected.size} of ${tables.length} selected`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      {loading ? (
        <div className="space-y-2 py-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : tables.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">No tables of this type. Create some under Outlet → Tables first.</p>
      ) : (
        <>
          <div className="flex gap-2 mb-3 text-[11px] font-semibold">
            <button onClick={selectAll} className="text-brand-800 hover:text-brand-900">Select all</button>
            <span className="text-slate-300">·</span>
            <button onClick={clearAll} className="text-slate-500 hover:text-red-500">Clear</button>
          </div>
          <div className="space-y-3 max-h-[55vh] overflow-y-auto">
            {grouped.map((grp) => (
              <div key={grp.sectionName}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{grp.sectionName}</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {grp.tables.map((t) => {
                    const checked = selected.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggle(t.id)}
                        className={clsx(
                          'px-3 py-2 rounded-lg border text-xs font-bold transition-colors',
                          checked
                            ? 'border-brand-300 bg-brand-50 text-brand-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200',
                        )}
                      >
                        #{t.number}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
