import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  Store, MapPin, ShoppingBag, LayoutGrid, Plus, QrCode,
  ChevronDown, ChevronRight, Edit2, Table2, ListChecks,
} from 'lucide-react';
import { RootState } from '../../store';
import { useUserRole } from '../../hooks/useUserRole';
import { allowsSeating } from '../../utils/outletType';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ListToolbar from '../../components/common/ListToolbar';

// SELF_SERVICE_PARCEL is intentionally absent — parcel is now available at
// every outlet by default, so the dedicated "Self Service + Parcel" option is
// retired. Historical rows still resolve their label via outletType.ts.
const OUTLET_TYPES = [
  { value: 'SELF_SERVICE', label: 'Self Service' },
  { value: 'DINE_IN_PREPAID', label: 'Dine-in Prepaid' },
  { value: 'DINE_IN_POSTPAID', label: 'Dine-in Postpaid' },
  { value: 'HYBRID', label: 'Hybrid' },
];

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

export default function OutletsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const { tier } = useUserRole();
  // Outlet admins don't manage outlets — only business owners do. Anything
  // they need lives on /outlet-profile.
  if (tier === 'outlet') return <Navigate to="/outlet-profile" replace />;
  const [outlets, setOutlets]       = useState<any[]>([]);
  const [outletSearch, setOutletSearch] = useState('');
  const [outletSort,   setOutletSort]   = useState<'name' | 'outletType' | 'status' | 'createdAt'>('name');
  const [outletSortDir, setOutletSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected]     = useState<any>(null);   // outlet with sections
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

  const [outletModal, setOutletModal]   = useState(false);
  const [sectionModal, setSectionModal] = useState<{ open: boolean; outletId?: string }>({ open: false });
  const [tableModal, setTableModal]     = useState<{ open: boolean; outletId?: string; sectionId?: string; editing?: any }>({ open: false });
  const [tableTypes, setTableTypes]     = useState<any[]>([]);
  const [qrModal, setQrModal]           = useState<{ open: boolean; qr?: any }>({ open: false });

  // Section × Menu availability. When the modal opens for a section we
  // fetch the full menu list with current isEnabled state; toggles patch
  // immediately and locally rollback on failure (same pattern as the
  // table-type page).
  type SectionMenu = { id: string; name: string; isDefault: boolean; isLocked: boolean; isEnabled: boolean };
  const [sectionMenusModal, setSectionMenusModal] = useState<{ open: boolean; sectionId?: string; sectionName?: string }>({ open: false });
  const [sectionMenus, setSectionMenus] = useState<SectionMenu[]>([]);
  const [sectionMenusLoading, setSectionMenusLoading] = useState(false);
  const openSectionMenus = async (sectionId: string, sectionName: string) => {
    setSectionMenusModal({ open: true, sectionId, sectionName });
    setSectionMenus([]);
    setSectionMenusLoading(true);
    try {
      const { data } = await api.get(`/outlets/sections/${sectionId}/menus`);
      setSectionMenus(data.data || []);
    } catch {
      setSectionMenus([]);
    } finally {
      setSectionMenusLoading(false);
    }
  };
  const toggleSectionMenu = async (menu: SectionMenu) => {
    if (menu.isLocked || !sectionMenusModal.sectionId) return;
    const next = !menu.isEnabled;
    setSectionMenus((all) => all.map((m) => (m.id === menu.id ? { ...m, isEnabled: next } : m)));
    try {
      await api.patch(`/outlets/sections/${sectionMenusModal.sectionId}/menus/${menu.id}`, { isEnabled: next });
    } catch {
      setSectionMenus((all) => all.map((m) => (m.id === menu.id ? { ...m, isEnabled: !next } : m)));
      toast.error('Could not update menu availability');
    }
  };

  const businessId = user?.businessId || 'demo-business';

  const fetchOutlets = useCallback(async () => {
    try {
      const { data } = await api.get(`/outlets/business/${businessId}`);
      setOutlets(data.data);
    } finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { fetchOutlets(); }, [fetchOutlets]);

  const selectOutlet = async (outlet: any) => {
    if (selected?.id === outlet.id) { setSelected(null); return; }
    const [{ data }, ttRes] = await Promise.all([
      api.get(`/outlets/${outlet.id}`),
      api.get(`/outlets/${outlet.id}/table-types`).catch(() => ({ data: { data: [] } })),
    ]);
    setSelected(data.data);
    setTableTypes(ttRes.data.data || []);
  };

  // ── Create outlet ────────────────────────────────────────
  const saveOutlet = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await api.post('/outlets', {
        name: form.get('name'),
        outletType: form.get('outletType'),
        address: form.get('address'),
        gstNumber: form.get('gstNumber'),
        businessId,
        adminPhone: form.get('adminPhone'),
        adminName: form.get('adminName') || undefined,
      });
      toast.success('Outlet created');
      setOutletModal(false);
      fetchOutlets();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── Create section ───────────────────────────────────────
  const saveSection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await api.post(`/outlets/${sectionModal.outletId}/sections`, { name: form.get('name') });
      toast.success('Section created');
      setSectionModal({ open: false });
      const { data } = await api.get(`/outlets/${sectionModal.outletId}`);
      setSelected(data.data);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── Create table ─────────────────────────────────────────
  const saveTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const body = {
        number: form.get('number'),
        capacity: Number(form.get('capacity')),
        sectionId: tableModal.sectionId ?? tableModal.editing?.sectionId ?? null,
        tableTypeId: (form.get('tableTypeId') as string) || null,
      };
      if (tableModal.editing) {
        await api.patch(`/outlets/${tableModal.outletId}/tables/${tableModal.editing.id}`, body);
        toast.success('Table updated');
      } else {
        await api.post(`/outlets/${tableModal.outletId}/tables`, body);
        toast.success('Table added');
      }
      setTableModal({ open: false });
      const { data } = await api.get(`/outlets/${tableModal.outletId}`);
      setSelected(data.data);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const deleteTable = async (outletId: string, tableId: string, label: string) => {
    if (!confirm(`Delete table "${label}"? Past orders for this table will keep working.`)) return;
    setSaving(true);
    try {
      await api.delete(`/outlets/${outletId}/tables/${tableId}`);
      toast.success('Table deleted');
      setTableModal({ open: false });
      const { data } = await api.get(`/outlets/${outletId}`);
      setSelected(data.data);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── Save operations defaults ─────────────────────────────
  const saveOps = async (outletId: string, body: any) => {
    setSaving(true);
    try {
      await api.patch(`/outlets/${outletId}`, body);
      toast.success('Saved');
      const { data } = await api.get(`/outlets/${outletId}`);
      setSelected(data.data);
      fetchOutlets();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── Generate QR ──────────────────────────────────────────
  const generateTableQR = async (tableId: string, outletId: string) => {
    try {
      const { data } = await api.post(`/qr/table/${tableId}?outletId=${outletId}`);
      setQrModal({ open: true, qr: data.data });
    } catch (e: any) { toast.error('QR generation failed'); }
  };

  // Local search + sort over the outlet list. List is small per
  // business (units to low hundreds) so client-side filter is plenty.
  // Search matches name, public code, address fields and outlet type.
  const visibleOutlets = (() => {
    const q = outletSearch.trim().toLowerCase();
    const matched = !q ? outlets : outlets.filter((o: any) => {
      const haystack = [
        o.name, o.publicCode,
        o.address, o.addressLine1, o.addressLine2, o.city, o.state, o.pincode,
        o.outletType?.replace(/_/g, ' '),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
    const dir = outletSortDir === 'asc' ? 1 : -1;
    return [...matched].sort((a: any, b: any) => {
      switch (outletSort) {
        case 'createdAt':  return dir * (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        case 'outletType': return dir * (a.outletType || '').localeCompare(b.outletType || '');
        case 'status':     return dir * ((a.isActive ? 'a' : 'b').localeCompare(b.isActive ? 'a' : 'b'));
        case 'name':
        default:           return dir * (a.name || '').localeCompare(b.name || '');
      }
    });
  })();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Outlets</h1>
          <p className="page-subtitle">
            {outletSearch
              ? `${visibleOutlets.length} of ${outlets.length} match "${outletSearch}"`
              : `${outlets.length} location${outlets.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setOutletModal(true)}><Plus size={15} /> Add Outlet</button>
      </div>

      <ListToolbar
        search={outletSearch}
        onSearchChange={setOutletSearch}
        searchPlaceholder="Search by name, code, address or type"
        sortBy={outletSort}
        onSortByChange={(v) => setOutletSort(v as typeof outletSort)}
        sortDir={outletSortDir}
        onSortDirChange={setOutletSortDir}
        sortOptions={[
          { value: 'name',       label: 'Name' },
          { value: 'outletType', label: 'Type' },
          { value: 'status',     label: 'Status' },
          { value: 'createdAt',  label: 'Created' },
        ]}
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-40 animate-pulse" />)}
        </div>
      ) : visibleOutlets.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <Store size={40} className="text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No outlets yet</p>
          <button className="btn-primary mt-4" onClick={() => setOutletModal(true)}><Plus size={14} /> Add Outlet</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleOutlets.map((outlet: any) => (
            <div key={outlet.id} className="card overflow-hidden card-hover">
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="icon-wrap bg-brand-50 text-brand-500 shrink-0"><Store size={18} /></div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{outlet.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="badge badge-blue">
                          {OUTLET_TYPES.find(t => t.value === outlet.outletType)?.label || outlet.outletType}
                        </span>
                        {outlet.publicCode && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard?.writeText(outlet.publicCode);
                              toast.success(`Copied ${outlet.publicCode}`);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-1.5 py-0.5"
                            title="Outlet reference code — click to copy"
                          >
                            {outlet.publicCode}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={clsx('badge shrink-0', outlet.isActive ? 'badge-green' : 'badge-slate')}>
                    {outlet.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {outlet.address && (
                  <div className="flex items-start gap-1.5 mt-3">
                    <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-500 leading-relaxed">{outlet.address}</p>
                  </div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <ShoppingBag size={12} className="text-slate-400" />{outlet._count?.orders ?? 0} orders
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <LayoutGrid size={12} className="text-slate-400" />{outlet._count?.tables ?? 0} tables
                </div>
                <button
                  onClick={() => selectOutlet(outlet)}
                  className="btn-ghost ml-auto text-xs py-1 px-2"
                >
                  {selected?.id === outlet.id ? 'Close' : 'Manage'}
                </button>
              </div>

              {/* Expanded section/table panel */}
              {selected?.id === outlet.id && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3">
                  {/* Outlet type — structural, set by the business when
                      provisioning the outlet. Prep time, parcel fee and
                      Razorpay Route ID now live on the per-outlet profile
                      so the outlet admin owns them. */}
                  <div className="bg-white rounded-xl border border-slate-100 p-3 space-y-2.5">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Operations</p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        saveOps(outlet.id, {
                          outletType: fd.get('outletType'),
                          // Checkbox returns 'on' when checked, null when not — coerce to bool.
                          aggregatorEnabled: fd.get('aggregatorEnabled') === 'on',
                        });
                      }}
                      className="grid grid-cols-1 gap-3"
                    >
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Outlet type</label>
                        <select
                          name="outletType"
                          defaultValue={selected.outletType}
                          className="input text-xs"
                        >
                          {OUTLET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="aggregatorEnabled"
                          defaultChecked={!!selected.aggregatorEnabled}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-xs font-semibold text-slate-700">Aggregator integration</span>
                          <span className="block text-[10px] text-slate-500">
                            When on, the outlet admin sees the Aggregators settings page (Zomato / Swiggy / Uber Eats). Off by default.
                          </span>
                        </span>
                      </label>
                      <p className="text-[10px] text-slate-400 -mt-1">
                        Prep time, parcel fee and Razorpay Route ID now live on the outlet's own profile.
                      </p>
                      <button type="submit" disabled={saving} className="btn-secondary text-xs py-1.5">
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </form>
                  </div>

                  {!allowsSeating(selected.outletType) && (
                    <div className="bg-white rounded-xl border border-slate-100 p-3">
                      <p className="text-xs font-semibold text-slate-500">
                        Self-service outlets don't have sections or tables. Switch the outlet type above to enable seating.
                      </p>
                    </div>
                  )}

                  {allowsSeating(selected.outletType) && <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Sections & Tables</p>
                    <button onClick={() => setSectionModal({ open: true, outletId: outlet.id })} className="btn-ghost text-xs py-1 px-2 text-brand-600">
                      <Plus size={12} /> Section
                    </button>
                  </div>

                  {selected.sections?.map((sec: any) => (
                    <div key={sec.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50">
                        <div className="flex items-center gap-2">
                          <Table2 size={14} className="text-slate-500" />
                          <p className="text-sm font-semibold text-slate-700">{sec.name}</p>
                          <span className="text-xs text-slate-400">({sec.tables?.length || 0} tables)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openSectionMenus(sec.id, sec.name)}
                            className="btn-ghost text-xs py-0.5 px-2 text-brand-600"
                            title="Manage which menus are available here"
                          >
                            <ListChecks size={11} /> Menus
                          </button>
                          <button
                            onClick={() => setTableModal({ open: true, outletId: outlet.id, sectionId: sec.id })}
                            className="btn-ghost text-xs py-0.5 px-2 text-brand-600"
                          >
                            <Plus size={11} /> Table
                          </button>
                        </div>
                      </div>
                      <div className="p-2 flex flex-wrap gap-2">
                        {sec.tables?.map((table: any) => (
                          <div key={table.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                            <span className="text-xs font-bold text-slate-700">{table.number}</span>
                            <span className="text-[10px] text-slate-400">({table.capacity}p)</span>
                            {(() => {
                              const tt = tableTypes.find(t => t.id === table.tableTypeId);
                              return tt ? (
                                <span
                                  className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full"
                                  style={{ background: tt.color }}
                                  title={tt.name}
                                >
                                  {tt.name}
                                </span>
                              ) : null;
                            })()}
                            <button
                              onClick={() => setTableModal({ open: true, outletId: outlet.id, sectionId: sec.id, editing: table })}
                              className="text-slate-400 hover:text-brand-500 transition-colors"
                              title="Edit table"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              onClick={() => generateTableQR(table.id, outlet.id)}
                              className="text-slate-400 hover:text-brand-500 transition-colors"
                              title="Generate QR"
                            >
                              <QrCode size={12} />
                            </button>
                          </div>
                        ))}
                        {!sec.tables?.length && (
                          <p className="text-xs text-slate-400 italic p-1">No tables yet</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {!selected.sections?.length && (
                    <p className="text-xs text-slate-400 italic text-center py-2">No sections yet — add one above</p>
                  )}
                  </>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Add outlet modal ─────────────────────────────────── */}
      <Modal open={outletModal} onClose={() => setOutletModal(false)} title="New Outlet" size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOutletModal(false)}>Cancel</button>
            <button form="outlet-form" type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Create Outlet
            </button>
          </>
        }
      >
        <form id="outlet-form" onSubmit={saveOutlet} className="space-y-4">
          <Field label="Outlet Name">
            <input name="name" required className="input" placeholder="e.g. Koramangala Branch" />
          </Field>
          <Field label="Outlet Type">
            <select name="outletType" required className="input">
              {OUTLET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Address">
            <textarea name="address" className="input resize-none" rows={2} placeholder="Full address" />
          </Field>
          <Field label="GST Number">
            <input name="gstNumber" className="input" placeholder="29ABCDE1234F1Z5" />
          </Field>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Outlet Admin Login</p>
            <Field label="Admin Name (optional)">
              <input name="adminName" className="input" placeholder="e.g. Ramesh" />
            </Field>
            <Field label="Admin Phone (required)">
              <input name="adminPhone" required className="input" placeholder="+91 …" />
            </Field>
            <p className="text-[11px] text-amber-700">
              We'll create the Outlet Admin login with default password <span className="font-mono font-bold">abc@123</span>.
              The admin will be required to set a new password on first login.
            </p>
          </div>
        </form>
      </Modal>

      {/* ── Add section modal ────────────────────────────────── */}
      <Modal open={sectionModal.open} onClose={() => setSectionModal({ open: false })} title="New Section"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setSectionModal({ open: false })}>Cancel</button>
            <button form="sec-form" type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Create
            </button>
          </>
        }
      >
        <form id="sec-form" onSubmit={saveSection}>
          <Field label="Section Name">
            <input name="name" required className="input" placeholder="e.g. Ground Floor, Terrace" />
          </Field>
        </form>
      </Modal>

      {/* ── Add / edit table modal ───────────────────────────── */}
      <Modal
        open={tableModal.open}
        onClose={() => setTableModal({ open: false })}
        title={tableModal.editing ? `Edit table ${tableModal.editing.number}` : 'Add Table'}
        footer={
          <div className="flex items-center justify-between w-full gap-2">
            {tableModal.editing && tableModal.outletId ? (
              <button
                className="text-xs font-semibold text-red-500 hover:text-red-600"
                onClick={() => deleteTable(tableModal.outletId!, tableModal.editing.id, tableModal.editing.number)}
                disabled={saving}
              >
                Delete table
              </button>
            ) : <span />}
            <div className="flex items-center gap-2">
              <button className="btn-secondary" onClick={() => setTableModal({ open: false })}>Cancel</button>
              <button form="table-form" type="submit" className="btn-primary" disabled={saving}>
                {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {tableModal.editing ? 'Save Changes' : 'Add Table'}
              </button>
            </div>
          </div>
        }
      >
        <form
          id="table-form"
          key={tableModal.editing?.id ?? 'new'}
          onSubmit={saveTable}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Table Number">
              <input name="number" required className="input" placeholder="e.g. T11" defaultValue={tableModal.editing?.number ?? ''} />
            </Field>
            <Field label="Capacity (persons)">
              <input name="capacity" type="number" min="1" max="20" required className="input" placeholder="4" defaultValue={tableModal.editing?.capacity ?? 4} />
            </Field>
          </div>
          <Field label="Section type">
            <select name="tableTypeId" className="input" defaultValue={tableModal.editing?.tableTypeId ?? ''}>
              <option value="">— Standard (no section) —</option>
              {tableTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">Special pricing tied to this type will apply when customers order from this table.</p>
          </Field>
        </form>
      </Modal>

      {/* ── Section × Menu availability modal ────────────────── */}
      <Modal
        open={sectionMenusModal.open}
        onClose={() => setSectionMenusModal({ open: false })}
        title={sectionMenusModal.sectionName ? `Menus for ${sectionMenusModal.sectionName}` : 'Menus'}
        size="sm"
        footer={<button className="btn-primary" onClick={() => setSectionMenusModal({ open: false })}>Done</button>}
      >
        {sectionMenusLoading ? (
          <p className="text-xs text-slate-400 italic">Loading menus…</p>
        ) : sectionMenus.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No menus defined for this business.</p>
        ) : (
          <div className="space-y-1.5">
            {sectionMenus.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-slate-800 truncate">{m.name}</span>
                  {m.isDefault && (
                    <span className="text-[10px] uppercase tracking-wide font-bold text-slate-400">always on</span>
                  )}
                </div>
                <label className={`inline-flex items-center ${m.isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={m.isEnabled}
                    onChange={() => toggleSectionMenu(m)}
                    disabled={m.isLocked}
                    className="sr-only peer"
                  />
                  <span className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-brand-500 relative transition-colors">
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${m.isEnabled ? 'translate-x-4' : ''}`} />
                  </span>
                </label>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-2">
          Disabled menus stay hidden from customers seated in this section. Changes save instantly.
        </p>
      </Modal>

      {/* ── QR modal ─────────────────────────────────────────── */}
      <Modal open={qrModal.open} onClose={() => setQrModal({ open: false })} title="Table QR Code" size="sm"
        footer={
          <a href={qrModal.qr?.imageUrl} download="table-qr.png" className="btn-primary">
            Download QR
          </a>
        }
      >
        {qrModal.qr && (
          <div className="text-center space-y-3">
            <img src={qrModal.qr.imageUrl} alt="QR Code" className="w-48 h-48 mx-auto rounded-xl border border-slate-100" />
            <p className="text-xs text-slate-500 font-mono break-all bg-slate-50 rounded-lg p-2">{qrModal.qr.code}</p>
            <p className="text-xs text-slate-400">Customers scan this to order from their phone</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
