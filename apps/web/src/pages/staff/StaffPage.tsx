import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Users, Plus, Phone, Mail, Shield, ToggleLeft, ToggleRight, Search, Pencil, Lock } from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  responsibilities: string[];
}

interface PermissionRow {
  id: string;
  name: string;
  module: string;
  description: string | null;
  inRole: boolean;
  granted: boolean;   // user override: explicitly added
  revoked: boolean;   // user override: explicitly removed
  effective: boolean;
  grantable: boolean;
}

interface PermissionsResponse {
  userId: string;
  userName: string;
  role: { id: string; name: string; isSystem: boolean } | null;
  effective: string[];
  permissions: PermissionRow[];
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

export default function StaffPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId || 'demo-business';

  const [staff, setStaff]     = useState<any[]>([]);
  const [roles, setRoles]     = useState<Role[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [responsibilities, setResponsibilities] = useState<{ id: string; name: string; module: string; description: string | null; grantable: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [search, setSearch]   = useState('');

  const [modal, setModal] = useState<{ open: boolean; editing?: any }>({ open: false });
  const [toggleTarget, setToggleTarget] = useState<any>(null);

  // Form state
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', roleId: '', outletId: '' });
  // Selected effective permission names (everything checked in the UI)
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, o, resp] = await Promise.all([
        api.get(`/users?businessId=${businessId}`),
        api.get('/roles'),
        api.get(`/outlets/business/${businessId}`),
        api.get('/roles/responsibilities'),
      ]);
      setStaff(s.data.data.users || []);
      setRoles(r.data.data || []);
      setOutlets(o.data.data || []);
      setResponsibilities(resp.data.data || []);
    } finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === form.roleId) || null,
    [roles, form.roleId],
  );

  const byModule = useMemo(() => {
    const map = new Map<string, typeof responsibilities>();
    for (const r of responsibilities) {
      const list = map.get(r.module) ?? [];
      list.push(r);
      map.set(r.module, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [responsibilities]);

  const openCreate = () => {
    setForm({ name: '', phone: '', email: '', password: '', roleId: '', outletId: '' });
    setSelectedPerms(new Set());
    setModal({ open: true });
  };

  const openEdit = async (member: any) => {
    setForm({
      name: member.name || '',
      phone: member.phone || '',
      email: member.email || '',
      password: '',
      roleId: member.role?.id || '',
      outletId: member.outlet?.id || '',
    });
    setModal({ open: true, editing: member });
    // Load effective permissions for the existing user.
    try {
      const { data } = await api.get(`/users/${member.id}/permissions`);
      const perms: PermissionsResponse = data.data;
      setSelectedPerms(new Set(perms.effective));
    } catch {
      setSelectedPerms(new Set());
    }
  };

  // When the role changes (in *create* mode), preselect that role's permissions.
  useEffect(() => {
    if (modal.editing) return; // edit mode preserves whatever was loaded
    if (!selectedRole) { setSelectedPerms(new Set()); return; }
    setSelectedPerms(new Set(selectedRole.responsibilities));
  }, [selectedRole, modal.editing]);

  // Compute grants / revokes vs the currently selected role.
  const overrides = useMemo(() => {
    const rolePerms = new Set(selectedRole?.responsibilities ?? []);
    const grants: string[]  = [];
    const revokes: string[] = [];
    for (const name of selectedPerms) {
      if (!rolePerms.has(name)) grants.push(name);
    }
    for (const name of rolePerms) {
      if (!selectedPerms.has(name)) revokes.push(name);
    }
    return { grants, revokes };
  }, [selectedPerms, selectedRole]);

  const togglePerm = (name: string, on: boolean, grantable: boolean) => {
    if (!grantable) return;
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (on) next.add(name); else next.delete(name);
      return next;
    });
  };

  const saveStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      let userId: string;
      if (modal.editing) {
        const { data } = await api.patch(`/users/${modal.editing.id}`, {
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          roleId: form.roleId || null,
          outletId: form.outletId || null,
        });
        userId = data.data.id;
      } else {
        const { data } = await api.post('/users', {
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          password: form.password,
          roleId: form.roleId || undefined,
          outletId: form.outletId || undefined,
          businessId,
        });
        userId = data.data.id;
      }

      // Persist overrides
      await api.put(`/users/${userId}/permissions`, {
        grants: overrides.grants,
        revokes: overrides.revokes,
      });

      toast.success(modal.editing ? 'Staff updated' : 'Staff member added');
      setModal({ open: false });
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const toggleStatus = async () => {
    if (!toggleTarget) return;
    setSaving(true);
    try {
      await api.patch(`/users/${toggleTarget.id}/toggle-status`);
      toast.success(`${toggleTarget.name} ${toggleTarget.status === 'ACTIVE' ? 'deactivated' : 'activated'}`);
      setToggleTarget(null);
      fetchAll();
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const filtered = staff.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="page-subtitle">{staff.length} team member{staff.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus size={15} /> Add Staff</button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, email…"
            className="input pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-32 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <Users size={40} className="text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">{search ? 'No results found' : 'No staff yet'}</p>
          {!search && <button className="btn-primary mt-4" onClick={openCreate}><Plus size={14} /> Add first staff member</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(member => (
            <div key={member.id} className="card card-hover p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-orange-400 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0">
                  {member.name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{member.name}</p>
                  {member.role && <span className="badge badge-orange text-[10px]">{member.role.name}</span>}
                </div>
                <span className={clsx('badge shrink-0', member.status === 'ACTIVE' ? 'badge-green' : 'badge-red')}>
                  {member.status}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Phone size={12} className="text-slate-400 shrink-0" />
                  <span className="font-mono">{member.phone}</span>
                </div>
                {member.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Mail size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>
                )}
                {member.outlet && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Shield size={12} className="text-slate-400 shrink-0" />
                    <span>{member.outlet.name}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  onClick={() => openEdit(member)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => setToggleTarget(member)}
                  className={clsx(
                    'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
                    member.status === 'ACTIVE'
                      ? 'text-red-600 bg-red-50 hover:bg-red-100'
                      : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100',
                  )}
                >
                  {member.status === 'ACTIVE' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {member.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / Edit staff modal ────────────────────────────── */}
      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.editing ? 'Edit Staff Member' : 'Add Staff Member'}
        size="xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal({ open: false })}>Cancel</button>
            <button form="staff-form" type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {modal.editing ? 'Save Changes' : 'Add Staff'}
            </button>
          </>
        }
      >
        <form id="staff-form" onSubmit={saveStaff} className="space-y-5 px-6 py-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="input" placeholder="John Doe" />
            </Field>
            <Field label="Phone Number">
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} type="tel" required className="input" placeholder="9876543210" />
            </Field>
          </div>
          <Field label="Email (optional)">
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" className="input" placeholder="john@example.com" />
          </Field>
          {!modal.editing && (
            <Field label="Password">
              <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} type="password" required minLength={6} className="input" placeholder="Min 6 characters" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <select value={form.roleId} onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))} className="input">
                <option value="">No role</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Assigned Outlet">
              <select value={form.outletId} onChange={e => setForm(f => ({ ...f, outletId: e.target.value }))} className="input">
                <option value="">All outlets</option>
                {outlets.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
          </div>

          {/* Permissions matrix */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Permissions</p>
              <p className="text-[11px] text-slate-500">
                {overrides.grants.length} extra · {overrides.revokes.length} revoked from role
              </p>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Defaults follow the selected role. Untick to revoke a role perm for this staff member, or tick a perm outside the role to grant it as an exception.
            </p>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
              {byModule.map(([module, perms]) => (
                <div key={module} className="p-3">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{module}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {perms.map((p) => {
                      const inRole   = selectedRole?.responsibilities.includes(p.name) ?? false;
                      const checked  = selectedPerms.has(p.name);
                      const isGrant  = checked && !inRole;
                      const isRevoke = !checked && inRole;
                      const disabled = !p.grantable;
                      return (
                        <label
                          key={p.id}
                          className={clsx(
                            'flex items-start gap-2 text-xs rounded-lg px-2 py-1.5 border',
                            disabled ? 'opacity-50 border-slate-100' :
                            isGrant  ? 'border-emerald-200 bg-emerald-50/70' :
                            isRevoke ? 'border-red-200 bg-red-50/70' :
                            checked  ? 'border-slate-100 bg-white' : 'border-transparent bg-white',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={e => togglePerm(p.name, e.target.checked, p.grantable)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-semibold text-slate-800">{p.name}</span>
                              {isGrant   && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded">EXTRA</span>}
                              {isRevoke  && <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1 py-0.5 rounded">REVOKED</span>}
                              {inRole && checked && !isGrant && <span className="text-[9px] font-medium text-slate-500">from role</span>}
                              {disabled  && <span className="text-[9px] text-slate-500 inline-flex items-center gap-0.5"><Lock size={9} /> not grantable</span>}
                            </div>
                            {p.description && <p className="text-[10px] text-slate-500 mt-0.5">{p.description}</p>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={toggleStatus}
        title={toggleTarget?.status === 'ACTIVE' ? 'Deactivate Staff' : 'Activate Staff'}
        message={`${toggleTarget?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${toggleTarget?.name}? They ${toggleTarget?.status === 'ACTIVE' ? 'will no longer be able to log in' : 'will regain access'}.`}
        confirmLabel={toggleTarget?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        danger={toggleTarget?.status === 'ACTIVE'}
        loading={saving}
      />
    </div>
  );
}
