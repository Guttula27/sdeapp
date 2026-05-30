import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Tag as TagIcon, Users } from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useUserRole } from '../../hooks/useUserRole';

const SWATCHES = [
  '#f97316', '#ef4444', '#ec4899', '#a855f7',
  '#6366f1', '#0ea5e9', '#10b981', '#facc15',
  '#64748b', '#84cc16',
];

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

export default function TagsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId;
  const userOutletId = user?.outletId || '';

  const [outlets, setOutlets] = useState<any[]>([]);
  const [outletId, setOutletId] = useState<string>(userOutletId);

  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<{ open: boolean; editing?: any }>({ open: false });
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<any>(null);

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

  const fetchTags = useCallback(async () => {
    if (!outletId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/outlets/${outletId}/customer-tags`);
      setTags(data.data || []);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

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
        await api.patch(`/outlets/${outletId}/customer-tags/${modal.editing.id}`, { name: name.trim(), color });
        toast.success('Tag updated');
      } else {
        await api.post(`/outlets/${outletId}/customer-tags`, { name: name.trim(), color });
        toast.success('Tag created');
      }
      setModal({ open: false });
      fetchTags();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/outlets/${outletId}/customer-tags/${deleteTarget.id}`);
      toast.success('Tag deleted');
      setDeleteTarget(null);
      fetchTags();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  // Outlet-tier admins are pinned to their own outlet — hide the cross-outlet
  // switcher entirely so they don't accidentally edit another outlet's data.
  const { tier } = useUserRole();
  const isMultiOutlet = tier !== 'outlet' && outlets.length > 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Customer Tags</h1>
          <p className="page-subtitle">{tags.length} tag{tags.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isMultiOutlet && (
            <select
              value={outletId}
              onChange={e => setOutletId(e.target.value)}
              className="input py-2 px-3 text-sm font-medium min-w-[180px]"
            >
              {outlets.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          <button className="btn-primary" onClick={openCreate} disabled={!outletId}>
            <Plus size={15} /> Add Tag
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}</div>
      ) : tags.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <TagIcon size={40} className="text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No tags yet</p>
          <p className="text-xs text-slate-400 mt-1">Create tags like VIP, Corporate or Staff to apply special pricing.</p>
          <button className="btn-primary mt-4" onClick={openCreate}><Plus size={14} /> Create first tag</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tags.map(t => (
            <div key={t.id} className="card p-4 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ background: t.color }}
              >
                <TagIcon size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{t.name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1"><Users size={11} /> {t._count?.assignments || 0}</span>
                  <span>{t._count?.itemPrices || 0} prices</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(t)} className="btn-ghost p-1.5"><Edit2 size={13} /></button>
                <button onClick={() => setDeleteTarget(t)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.editing ? 'Edit Tag' : 'New Tag'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal({ open: false })}>Cancel</button>
            <button form="tag-form" type="submit" className="btn-primary" disabled={saving || !name.trim()}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {modal.editing ? 'Save Changes' : 'Create'}
            </button>
          </>
        }
      >
        <form id="tag-form" onSubmit={save} className="space-y-4">
          <Field label="Tag Name">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="input"
              placeholder="e.g. VIP"
            />
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
                  title={c}
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
        title="Delete tag"
        message={`Delete "${deleteTarget?.name}"? Any per-item prices and customer assignments will be removed.`}
        confirmLabel="Delete"
        danger
        loading={saving}
      />
    </div>
  );
}
