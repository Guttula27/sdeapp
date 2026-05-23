import { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Shield, Trash2, Lock, Users } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useUserRole } from '../../hooks/useUserRole';

interface Responsibility {
  id: string;
  name: string;
  module: string;
  description: string | null;
  grantable: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  businessId: string | null;
  outletId: string | null;
  userCount: number;
  responsibilities: string[];
  editable: boolean;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

function scopeLabel(role: Role): string {
  if (role.isSystem) return 'System';
  if (role.outletId) return 'Outlet';
  if (role.businessId) return 'Business';
  return 'Platform';
}

function scopeBadgeClass(role: Role): string {
  if (role.isSystem) return 'bg-violet-100 text-violet-700';
  if (role.outletId) return 'bg-orange-100 text-orange-700';
  if (role.businessId) return 'bg-sky-100 text-sky-700';
  return 'bg-slate-200 text-slate-700';
}

export default function RolesPage() {
  const { tier, user } = useUserRole();
  const canCreateBusinessScope = tier === 'platform' || tier === 'business';
  const canCreateOutletScope   = tier !== 'kitchen' && tier !== 'counter' && tier !== 'store';

  const [roles, setRoles] = useState<Role[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, respRes] = await Promise.all([
        api.get('/roles'),
        api.get('/roles/responsibilities'),
      ]);
      setRoles(rolesRes.data.data || []);
      setResponsibilities(respRes.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  useEffect(() => {
    if (tier === 'platform') {
      api.get('/businesses').then(({ data }) => setBusinesses(data.data?.businesses || data.data || [])).catch(() => {});
    }
  }, [tier]);

  useEffect(() => {
    if (!user?.businessId) return;
    api.get(`/outlets/business/${user.businessId}`).then(({ data }) => setOutlets(data.data || [])).catch(() => {});
  }, [user?.businessId]);

  const selected = useMemo(() => roles.find((r) => r.id === selectedId) || null, [roles, selectedId]);

  useEffect(() => {
    if (!selected && roles.length) setSelectedId(roles[0].id);
  }, [roles, selected]);

  const byModule = useMemo(() => {
    const map = new Map<string, Responsibility[]>();
    for (const r of responsibilities) {
      const list = map.get(r.module) ?? [];
      list.push(r);
      map.set(r.module, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [responsibilities]);

  const toggle = async (role: Role, perm: string, enabled: boolean) => {
    try {
      const { data } = await api.patch(`/roles/${role.id}/responsibilities`, {
        responsibilityName: perm,
        enabled,
      });
      const updated: Role = data.data;
      setRoles((rs) => rs.map((r) => (r.id === role.id ? updated : r)));
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update permission');
    }
  };

  const createRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const scope = form.get('scope') as string;
    const payload: any = {
      name: form.get('name'),
      description: form.get('description') || undefined,
      responsibilityNames: form.getAll('perms'),
    };
    if (scope === 'business') {
      payload.businessId = (form.get('businessId') as string) || user?.businessId;
    } else if (scope === 'outlet') {
      payload.outletId = form.get('outletId');
    }
    try {
      const { data } = await api.post('/roles', payload);
      toast.success('Role created');
      setCreateOpen(false);
      setRoles((rs) => [...rs, data.data]);
      setSelectedId(data.data.id);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to create role');
    }
  };

  const removeRole = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/roles/${deleteTarget.id}`);
      toast.success('Role deleted');
      setRoles((rs) => rs.filter((r) => r.id !== deleteTarget.id));
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete role');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Roles & Permissions</h1>
          <p className="page-subtitle">Create roles and enable the permissions each role can use.</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">
          <Plus size={15} /> New Role
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Roles list */}
        <div className="card p-2">
          {loading ? (
            <p className="text-sm text-slate-400 p-4">Loading…</p>
          ) : roles.length === 0 ? (
            <p className="text-sm text-slate-400 p-4">No roles in this scope yet.</p>
          ) : (
            <ul className="space-y-1">
              {roles.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl transition-colors flex items-start gap-2 ${
                      selectedId === r.id ? 'bg-orange-50 ring-1 ring-orange-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <Shield size={14} className={r.isSystem ? 'text-violet-500 mt-0.5' : 'text-slate-400 mt-0.5'} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-800 truncate">{r.name}</span>
                        {r.isSystem && <Lock size={11} className="text-slate-400" />}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scopeBadgeClass(r)}`}>
                          {scopeLabel(r).toUpperCase()}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Users size={10} /> {r.userCount}
                        </span>
                        <span className="text-[11px] text-slate-400">{r.responsibilities.length} perms</span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Permissions matrix */}
        <div className="card p-5">
          {!selected ? (
            <p className="text-sm text-slate-400">Select a role to view its permissions.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">{selected.name}</h2>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scopeBadgeClass(selected)}`}>
                      {scopeLabel(selected).toUpperCase()}
                    </span>
                    {selected.isSystem && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 flex items-center gap-1">
                        <Lock size={9} /> SYSTEM
                      </span>
                    )}
                    {!selected.editable && !selected.isSystem && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 flex items-center gap-1">
                        <Lock size={9} /> READ-ONLY
                      </span>
                    )}
                  </div>
                  {selected.description && <p className="text-xs text-slate-500 mt-1">{selected.description}</p>}
                </div>
                {selected.editable && !selected.isSystem && (
                  <button
                    onClick={() => setDeleteTarget(selected)}
                    className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>

              <div className="space-y-5">
                {byModule.map(([module, perms]) => (
                  <div key={module}>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{module}</p>
                    <div className="space-y-1.5">
                      {perms.map((p) => {
                        const enabled = selected.responsibilities.includes(p.name);
                        const lockedByScope = !p.grantable;
                        const disabled = !selected.editable || selected.isSystem || lockedByScope;
                        return (
                          <label
                            key={p.id}
                            className={`flex items-start gap-3 px-3 py-2 rounded-xl border ${
                              enabled ? 'bg-orange-50/50 border-orange-100' : 'bg-white border-slate-100'
                            } ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-slate-50'}`}
                          >
                            <input
                              type="checkbox"
                              checked={enabled}
                              disabled={disabled}
                              onChange={(e) => toggle(selected, p.name, e.target.checked)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-semibold text-slate-800">{p.name}</span>
                                {lockedByScope && (
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <Lock size={9} /> not grantable at your scope
                                  </span>
                                )}
                              </div>
                              {p.description && <p className="text-[11px] text-slate-500 mt-0.5">{p.description}</p>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create role modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create role"
        subtitle="Pick a scope and starting permissions. You can change permissions later."
        size="lg"
      >
        <form onSubmit={createRole} className="px-6 py-5 space-y-4 overflow-y-auto">
          <Field label="Role name">
            <input name="name" required className="input" placeholder="e.g. Floor Manager" />
          </Field>
          <Field label="Description (optional)">
            <input name="description" className="input" placeholder="What this role is responsible for" />
          </Field>

          <Field label="Scope">
            <select name="scope" required className="input" defaultValue={tier === 'outlet' ? 'outlet' : 'business'}>
              {tier === 'platform' && <option value="platform">Platform (system-wide)</option>}
              {canCreateBusinessScope && <option value="business">Business</option>}
              {canCreateOutletScope && <option value="outlet">Outlet</option>}
            </select>
          </Field>

          {tier === 'platform' && businesses.length > 0 && (
            <Field label="Business (for business/outlet scope)">
              <select name="businessId" className="input" defaultValue="">
                <option value="">— None (platform) —</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
          )}

          {outlets.length > 0 && tier !== 'outlet' && (
            <Field label="Outlet (for outlet scope)">
              <select name="outletId" className="input" defaultValue="">
                <option value="">— None —</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </Field>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Permissions</p>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {byModule.map(([module, perms]) => (
                <div key={module} className="p-3">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{module}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {perms.map((p) => (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2 text-xs ${p.grantable ? '' : 'opacity-50'}`}
                      >
                        <input type="checkbox" name="perms" value={p.name} disabled={!p.grantable} />
                        <span className="font-mono">{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create role</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete role?"
        message={`This permanently removes "${deleteTarget?.name}". Users assigned to it must be reassigned first.`}
        confirmLabel="Delete"
        onConfirm={removeRole}
        onClose={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
