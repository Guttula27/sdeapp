import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Users, Phone, Mail, Tag as TagIcon, Plus, User as UserIcon, ShoppingBag, ChevronRight, ArrowLeft, Clock } from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { useUserRole } from '../../hooks/useUserRole';

dayjs.extend(relativeTime);

export default function CustomersPage() {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId;
  const userOutletId = user?.outletId || '';

  const [outlets, setOutlets] = useState<any[]>([]);
  const [outletId, setOutletId] = useState<string>(userOutletId);

  const [tags, setTags] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Filters
  const [nameFilter, setNameFilter]     = useState('');
  const [phoneFilter, setPhoneFilter]   = useState('');
  const [tagFilter, setTagFilter]       = useState<'ALL' | 'NONE' | string>('ALL');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'WITH' | 'NONE'>('ALL');
  const [spendFilter, setSpendFilter]   = useState<'ALL' | 'GT500' | 'GT2000'>('ALL');
  const [sortBy, setSortBy]             = useState<'RECENT' | 'NAME' | 'ORDERS' | 'SPEND'>('RECENT');

  // Add-customer modal
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [adding, setAdding] = useState(false);

  // Orders + detail modals stacked
  const [ordersFor, setOrdersFor] = useState<any | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderDetail, setOrderDetail] = useState<any | null>(null);

  const openCustomerOrders = useCallback(async (customer: any) => {
    setOrdersFor(customer);
    setCustomerOrders([]);
    setLoadingOrders(true);
    try {
      const { data } = await api.get(`/outlets/${outletId}/customers/${customer.id}/orders`);
      const payload = data.data ?? data;
      const list = Array.isArray(payload) ? payload : (payload?.items ?? []);
      setCustomerOrders(Array.isArray(list) ? list : []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('customers.toastLoadOrdersFail'));
    } finally {
      setLoadingOrders(false);
    }
  }, [outletId, t]);

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

  const [duesByUser, setDuesByUser] = useState<Record<string, number>>({});

  const fetchAll = useCallback(async () => {
    if (!outletId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [c, tagsRes, d] = await Promise.all([
        api.get(`/outlets/${outletId}/customers`),
        api.get(`/outlets/${outletId}/customer-tags`),
        api.get(`/outlets/${outletId}/dues/receivable`).catch(() => ({ data: { data: [] } })),
      ]);
      setCustomers(c.data.data || []);
      setTags(tagsRes.data.data || []);
      const map: Record<string, number> = {};
      for (const row of (d.data.data || d.data || []) as Array<{ userId: string; currentBalance: number }>) {
        map[row.userId] = row.currentBalance;
      }
      setDuesByUser(map);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim()) { toast.error(t('customers.toastPhoneRequired')); return; }
    setAdding(true);
    try {
      await api.post(`/outlets/${outletId}/customers`, {
        name: newName.trim() || undefined,
        phone: newPhone.trim(),
      });
      toast.success(t('customers.toastAdded'));
      setAddOpen(false);
      setNewName('');
      setNewPhone('');
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('customers.toastAddFail'));
    } finally {
      setAdding(false);
    }
  };

  const setTag = async (userId: string, tagId: string | null) => {
    setSavingFor(userId);
    try {
      const { data } = await api.put(`/outlets/${outletId}/customers/${userId}/tag`, { tagId });
      setCustomers(prev => prev.map(c => c.id === userId ? { ...c, tag: data.data.tag } : c));
      toast.success(tagId ? t('customers.toastTagAssigned') : t('customers.toastTagCleared'));
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('customers.toastTagFail'));
    } finally {
      setSavingFor(null);
    }
  };

  const { tier } = useUserRole();
  const isMultiOutlet = tier !== 'outlet' && outlets.length > 1;
  const filtered = customers
    .filter(c => {
      if (search) {
        const q = search.toLowerCase();
        const hit = c.name?.toLowerCase().includes(q) || c.phone?.includes(search);
        if (!hit) return false;
      }
      if (nameFilter && !c.name?.toLowerCase().includes(nameFilter.toLowerCase())) return false;
      if (phoneFilter && !c.phone?.includes(phoneFilter)) return false;
      if (tagFilter === 'NONE' && c.tag) return false;
      if (tagFilter !== 'ALL' && tagFilter !== 'NONE' && c.tag?.id !== tagFilter) return false;
      if (activityFilter === 'WITH' && c.orderCount === 0) return false;
      if (activityFilter === 'NONE' && c.orderCount > 0) return false;
      if (spendFilter === 'GT500' && Number(c.totalSpend) < 500) return false;
      if (spendFilter === 'GT2000' && Number(c.totalSpend) < 2000) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'NAME':   return (a.name || '').localeCompare(b.name || '');
        case 'ORDERS': return (b.orderCount || 0) - (a.orderCount || 0);
        case 'SPEND':  return Number(b.totalSpend) - Number(a.totalSpend);
        case 'RECENT':
        default:
          return (b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0)
               - (a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0);
      }
    });

  const clearFilters = () => {
    setSearch('');
    setNameFilter('');
    setPhoneFilter('');
    setTagFilter('ALL');
    setActivityFilter('ALL');
    setSpendFilter('ALL');
    setSortBy('RECENT');
  };
  const isFiltered = !!search || !!nameFilter || !!phoneFilter
    || tagFilter !== 'ALL' || activityFilter !== 'ALL' || spendFilter !== 'ALL' || sortBy !== 'RECENT';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t('customers.title')}</h1>
          <p className="page-subtitle">
            {isFiltered
              ? t('customers.countFiltered', { filtered: filtered.length, total: customers.length, count: customers.length })
              : t('customers.countTotal', { count: customers.length })}
          </p>
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
          <button className="btn-primary" onClick={() => setAddOpen(true)} disabled={!outletId}>
            <Plus size={15} /> {t('customers.addCustomer')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <Users size={40} className="text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">{search ? t('customers.noMatches') : t('customers.emptyTitle')}</p>
          <p className="text-xs text-slate-400 mt-1">
            {search ? t('customers.noMatchesHint') : t('customers.emptyHint')}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 pt-3 pb-1 text-left font-semibold">
                  <button
                    onClick={() => setSortBy(sortBy === 'NAME' ? 'RECENT' : 'NAME')}
                    className={`inline-flex items-center gap-1 ${sortBy === 'NAME' ? 'text-brand-600' : ''}`}
                  >
                    {t('customers.colCustomer')} {sortBy === 'NAME' && '↑'}
                  </button>
                </th>
                <th className="px-4 pt-3 pb-1 text-left font-semibold">{t('customers.colContact')}</th>
                <th className="px-4 pt-3 pb-1 text-right font-semibold">
                  <button
                    onClick={() => setSortBy(sortBy === 'ORDERS' ? 'RECENT' : 'ORDERS')}
                    className={`inline-flex items-center gap-1 ${sortBy === 'ORDERS' ? 'text-brand-600' : ''}`}
                  >
                    {t('customers.colOrders')} {sortBy === 'ORDERS' && '↓'}
                  </button>
                </th>
                <th className="px-4 pt-3 pb-1 text-right font-semibold">
                  <button
                    onClick={() => setSortBy(sortBy === 'SPEND' ? 'RECENT' : 'SPEND')}
                    className={`inline-flex items-center gap-1 ${sortBy === 'SPEND' ? 'text-brand-600' : ''}`}
                  >
                    {t('customers.colSpend')} {sortBy === 'SPEND' && '↓'}
                  </button>
                </th>
                <th className="px-4 pt-3 pb-1 text-left font-semibold">
                  <button
                    onClick={() => setSortBy(sortBy === 'RECENT' ? 'NAME' : 'RECENT')}
                    className={`inline-flex items-center gap-1 ${sortBy === 'RECENT' ? 'text-brand-600' : ''}`}
                  >
                    {t('customers.colLastOrder')} {sortBy === 'RECENT' && '↓'}
                  </button>
                </th>
                <th className="px-4 pt-3 pb-1 text-right font-semibold">{t('customers.colDues')}</th>
                <th className="px-4 pt-3 pb-1 text-left font-semibold">{t('customers.colTag')}</th>
              </tr>
              {/* Inline filter row inside the header */}
              <tr className="border-b border-slate-200">
                <th className="px-4 pb-2 normal-case font-normal">
                  <input
                    value={nameFilter}
                    onChange={e => setNameFilter(e.target.value)}
                    placeholder={t('customers.filterName')}
                    className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs"
                  />
                </th>
                <th className="px-4 pb-2 normal-case font-normal">
                  <input
                    value={phoneFilter}
                    onChange={e => setPhoneFilter(e.target.value)}
                    placeholder={t('customers.filterPhone')}
                    className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs"
                  />
                </th>
                <th className="px-4 pb-2 normal-case font-normal">
                  <select
                    value={activityFilter}
                    onChange={e => setActivityFilter(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-md px-1.5 py-1 text-xs"
                  >
                    <option value="ALL">{t('customers.filterAny')}</option>
                    <option value="WITH">{t('customers.filterWith')}</option>
                    <option value="NONE">{t('customers.filterNone')}</option>
                  </select>
                </th>
                <th className="px-4 pb-2 normal-case font-normal">
                  <select
                    value={spendFilter}
                    onChange={e => setSpendFilter(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-md px-1.5 py-1 text-xs"
                  >
                    <option value="ALL">{t('customers.filterAny')}</option>
                    <option value="GT500">{t('customers.filterSpendGT500')}</option>
                    <option value="GT2000">{t('customers.filterSpendGT2000')}</option>
                  </select>
                </th>
                <th className="px-4 pb-2 normal-case font-normal">
                  {isFiltered && (
                    <button onClick={clearFilters} className="text-[11px] font-semibold text-slate-500 hover:text-red-500">
                      {t('customers.clearFilters')}
                    </button>
                  )}
                </th>
                <th className="px-4 pb-2 normal-case font-normal" />
                <th className="px-4 pb-2 normal-case font-normal">
                  <select
                    value={tagFilter}
                    onChange={e => setTagFilter(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-md px-1.5 py-1 text-xs"
                  >
                    <option value="ALL">{t('customers.filterAny')}</option>
                    <option value="NONE">{t('customers.filterNoTag')}</option>
                    {tags.map(tg => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
                  </select>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => (
                <tr
                  key={c.id}
                  className={clsx(
                    'hover:bg-slate-50/60',
                    c.orderCount > 0 && 'cursor-pointer',
                  )}
                  onClick={() => c.orderCount > 0 && openCustomerOrders(c)}
                  title={c.orderCount > 0 ? t('customers.viewOrders') : ''}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      {c.name}
                      {c.orderCount > 0 && <ChevronRight size={13} className="text-slate-300" />}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 text-xs"><Phone size={11} className="text-slate-400" /> {c.phone || '—'}</span>
                      {c.email && <span className="flex items-center gap-1.5 text-xs text-slate-400"><Mail size={11} /> {c.email}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{c.orderCount}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">₹{c.totalSpend.toFixed(0)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {c.lastOrderAt ? dayjs(c.lastOrderAt).fromNow() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {duesByUser[c.id] > 0 ? (
                      <span className="font-bold text-rose-700">₹{duesByUser[c.id].toFixed(2)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      {c.tag && (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-white px-2 py-0.5 rounded-full"
                          style={{ background: c.tag.color }}
                        >
                          <TagIcon size={9} /> {c.tag.name}
                        </span>
                      )}
                      <select
                        value={c.tag?.id || ''}
                        disabled={savingFor === c.id}
                        onChange={e => setTag(c.id, e.target.value || null)}
                        className="input py-1.5 px-2 text-xs min-w-[130px]"
                      >
                        <option value="">{t('customers.filterNoTag')}</option>
                        {tags.map(tg => (
                          <option key={tg.id} value={tg.id}>{tg.name}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Customer orders modal ─── */}
      <Modal
        open={!!ordersFor && !orderDetail}
        onClose={() => setOrdersFor(null)}
        title={ordersFor
          ? t('customers.modalOrdersTitle', { name: ordersFor.name || ordersFor.phone || t('customers.customerFallback') })
          : t('customers.modalOrdersTitleFallback')}
        subtitle={
          ordersFor
            ? t('customers.ordersSubtitle', {
                count: ordersFor.orderCount,
                total: Number(ordersFor.totalSpend || 0).toFixed(0),
              })
            : ''
        }
        size="md"
        footer={<button className="btn-secondary" onClick={() => setOrdersFor(null)}>{t('customers.close')}</button>}
      >
        {loadingOrders ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : customerOrders.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">{t('customers.noOrdersYet')}</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {customerOrders.map((o) => (
              <button
                key={o.id}
                onClick={() => setOrderDetail(o)}
                className="w-full text-left bg-slate-50 hover:bg-brand-50 border border-slate-100 hover:border-brand-200 rounded-xl px-3 py-2.5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="icon-wrap w-9 h-9 bg-white text-brand-600 rounded-lg border border-slate-100 shrink-0">
                    <ShoppingBag size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        #{o.orderNumber}{o.tokenNumber != null && <span className="text-slate-400 font-normal"> · {t('customers.tokenPrefix', { n: o.tokenNumber })}</span>}
                      </p>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {o.status}
                      </span>
                      <PaymentChip order={o} />
                    </div>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {dayjs(o.createdAt).format('DD MMM YYYY, h:mm A')}
                      {o.table && <span className="ml-2">· {t('customers.tableSuffix', { n: o.table.number })}</span>}
                      {o.isParcel && <span className="ml-2">· {t('customers.parcelSuffix')}</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900">₹{Number(o.totalAmount).toFixed(0)}</p>
                    <p className="text-[10px] text-slate-400">{t('customers.itemsCount', { count: o.items?.length || 0 })}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300" />
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* ─── Order detail modal (read-only) ─── */}
      <Modal
        open={!!orderDetail}
        onClose={() => setOrderDetail(null)}
        title={orderDetail ? t('customers.modalOrderTitle', { number: orderDetail.orderNumber }) : t('customers.modalOrderTitleFallback')}
        subtitle={
          orderDetail
            ? `${dayjs(orderDetail.createdAt).format('DD MMM YYYY, h:mm A')}${orderDetail.table ? ` · ${t('customers.tableSuffix', { n: orderDetail.table.number })}` : orderDetail.isParcel ? ` · ${t('customers.parcelSuffix')}` : ''}`
            : ''
        }
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button className="btn-secondary" onClick={() => setOrderDetail(null)}>
              <ArrowLeft size={13} /> {t('customers.back')}
            </button>
          </div>
        }
      >
        {orderDetail && (
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span className="text-xs font-semibold text-slate-700">{orderDetail.status}</span>
              <PaymentChip order={orderDetail} />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t('customers.itemsHeading')}</p>
              {orderDetail.items?.map((it: any) => (
                <div key={it.id} className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center gap-3">
                  <span className="w-7 h-7 bg-brand-100 text-brand-900 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
                    {it.quantity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {it.itemNameSnapshot ?? it.item?.name ?? '—'}
                    </p>
                    {(it.variantNameSnapshot || it.variant?.name) && (
                      <p className="text-xs text-slate-400">{it.variantNameSnapshot ?? it.variant?.name}</p>
                    )}
                    {it.notes && <p className="text-[11px] text-slate-400 italic mt-0.5">{it.notes}</p>}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 whitespace-nowrap">
                    {it.status}
                  </span>
                  <p className="text-sm font-bold text-slate-900 ml-1">₹{Number(it.totalPrice).toFixed(2)}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500"><span>{t('customers.subtotal')}</span><span>₹{Number(orderDetail.subtotal).toFixed(2)}</span></div>
              {Number(orderDetail.taxAmount) > 0 && (
                <>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{t('customers.sgst')}</span>
                    <span>₹{Number(orderDetail.sgstAmount ?? Number(orderDetail.taxAmount) / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{t('customers.cgst')}</span>
                    <span>₹{Number(orderDetail.cgstAmount ?? Number(orderDetail.taxAmount) / 2).toFixed(2)}</span>
                  </div>
                </>
              )}
              {Number(orderDetail.parcelAmount) > 0 && (
                <div className="flex justify-between text-xs text-slate-500"><span>{t('customers.parcel')}</span><span>₹{Number(orderDetail.parcelAmount).toFixed(2)}</span></div>
              )}
              {Number(orderDetail.discountAmount) > 0 && (
                <div className="flex justify-between text-xs text-emerald-600"><span>{t('customers.discount')}</span><span>− ₹{Number(orderDetail.discountAmount).toFixed(2)}</span></div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-100">
                <span>{t('customers.total')}</span><span>₹{Number(orderDetail.totalAmount).toFixed(2)}</span>
              </div>
            </div>

            {orderDetail.payments?.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{t('customers.paymentsHeading')}</p>
                <div className="space-y-1">
                  {orderDetail.payments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{p.mode} · {p.status}</span>
                      <span className="font-semibold text-slate-700">₹{Number(p.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add customer modal */}
      <Modal
        open={addOpen}
        onClose={() => !adding && setAddOpen(false)}
        title={t('customers.modalAddTitle')}
        subtitle={t('customers.modalAddSubtitle')}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAddOpen(false)} disabled={adding}>{t('customers.cancel')}</button>
            <button form="add-cust-form" type="submit" className="btn-primary" disabled={adding || !newPhone.trim()}>
              {adding && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {t('customers.addBtn')}
            </button>
          </>
        }
      >
        <form id="add-cust-form" onSubmit={addCustomer} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide flex items-center gap-1.5">
              <UserIcon size={11} /> {t('customers.nameLabel')} <span className="text-slate-400 font-normal normal-case ml-1">{t('customers.optional')}</span>
            </label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="input"
              placeholder={t('customers.namePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide flex items-center gap-1.5">
              <Phone size={11} /> {t('customers.phoneLabel')} <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              required
              className="input"
              placeholder={t('customers.phonePlaceholder')}
              autoFocus
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

function PaymentChip({ order }: { order: any }) {
  const { t } = useTranslation();
  const duesLive = (order?.duesLedger ?? []).some((d: any) => !d.voidedAt);
  if (duesLive) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-amber-100 text-amber-800 border border-amber-200">
        {t('customers.chipDues')}
      </span>
    );
  }
  const settledPayment = (order?.payments ?? []).find(
    (p: any) => p.status === 'SUCCESS' && !p.isRefund,
  );
  if (settledPayment) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-emerald-100 text-emerald-800 border border-emerald-200">
        {t('customers.chipPaid', { mode: settledPayment.mode })}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-slate-100 text-slate-600 border border-slate-200">
      {t('customers.chipUnpaid')}
    </span>
  );
}
