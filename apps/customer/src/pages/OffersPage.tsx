import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { Percent, Gift, Award, Store, Ticket, History, ChevronRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useCustomerAuth } from '../context/CustomerAuthContext';

type Tab = 'DISCOUNTS' | 'OFFERS' | 'REWARDS';

interface PromoCoupon {
  id: string; code: string; name: string; description?: string | null;
  discountType: 'PERCENT' | 'FIXED'; discountValue: string | number;
  minBillAmount?: string | number | null; maxDiscountAmount?: string | number | null;
  validFrom: string; validUntil: string;
}
interface PromoDiscount {
  id: string; name: string; targetType: string;
  discountType: 'PERCENT' | 'FIXED'; discountValue: string | number;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string } | null;
  item?: { id: string; name: string } | null;
  daysOfWeek?: string | null; startMinute?: number | null; endMinute?: number | null;
}
interface PromoOffer {
  id: string; name: string; description?: string | null;
  triggerType: string; minBillAmount?: string | number | null;
  buyItem?: { id: string; name: string } | null;
  buyQuantity?: number | null;
  getItem?: { id: string; name: string } | null;
  getQuantity?: number | null;
  daysOfWeek?: string | null; startMinute?: number | null; endMinute?: number | null;
}
interface OutletPromos {
  outlet: { id: string; name: string; logoUrl?: string | null; businessName?: string };
  coupons: PromoCoupon[];
  discounts: PromoDiscount[];
  offers: PromoOffer[];
}

// Pure helpers — translated text comes via t() at the call site. The
// schedule summary uses day-name keys under `days.*` so the same
// strings power the menu schedule rendering on OrderPage too.
const DOW_KEYS = ['', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const toHHMM = (m?: number | null) => {
  if (m == null) return '';
  return `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
};
const scheduleSummary = (
  row: { daysOfWeek?: string | null; startMinute?: number | null; endMinute?: number | null },
  t: (k: string) => string,
) => {
  const parts: string[] = [];
  if (row.daysOfWeek) {
    parts.push(
      row.daysOfWeek
        .split(',')
        .map((d) => t(`days.${DOW_KEYS[Number(d.trim())]}`))
        .filter(Boolean)
        .join(' '),
    );
  }
  if (row.startMinute != null && row.endMinute != null) {
    parts.push(`${toHHMM(row.startMinute)}–${toHHMM(row.endMinute)}`);
  }
  return parts.join(' · ');
};

const targetLabel = (d: PromoDiscount, t: (k: string) => string) => {
  if (d.targetType === 'BILL') return t('offers.wholeBill');
  if (d.targetType === 'CATEGORY') return d.category?.name ?? t('offers.categoryFallback');
  if (d.targetType === 'SUBCATEGORY') return d.subcategory?.name ?? t('offers.subcategoryFallback');
  if (d.targetType === 'ITEM') return d.item?.name ?? t('offers.itemFallback');
  return d.targetType;
};

const discountAmount = (
  row: { discountType: string; discountValue: string | number },
  t: (k: string, opts?: any) => string,
) =>
  row.discountType === 'PERCENT'
    ? t('offers.discountPercent', { value: row.discountValue })
    : t('offers.discountFixed', { value: row.discountValue });

export default function OffersPage() {
  const { t } = useTranslation();
  const { user } = useCustomerAuth();
  const [tab, setTab] = useState<Tab>('DISCOUNTS');
  const [data, setData] = useState<{ outlets: OutletPromos[] } | null>(null);
  const [reward, setReward] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  // Track which outlets are expanded. Empty set = all collapsed.
  // Per-tab so toggling DISCOUNTS↔OFFERS doesn't share open-state.
  const [openOutlets, setOpenOutlets] = useState<Record<Tab, Set<string>>>({
    DISCOUNTS: new Set(),
    OFFERS: new Set(),
    REWARDS: new Set(),
  });
  const toggleOutlet = (outletId: string) => {
    setOpenOutlets((prev) => {
      const next = new Set(prev[tab]);
      next.has(outletId) ? next.delete(outletId) : next.add(outletId);
      return { ...prev, [tab]: next };
    });
  };

  useEffect(() => {
    let cancelled = false;
    const calls: Promise<any>[] = [api.get('/users/me/promotions')];
    if (user?.id) calls.push(api.get(`/rewards/me/${user.id}`));
    Promise.all(calls)
      .then(([promo, rew]) => {
        if (cancelled) return;
        setData(promo.data.data || promo.data);
        if (rew) setReward(rew.data.data || rew.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const outlets = data?.outlets || [];
  const hasAny = useMemo(() => outlets.some(o =>
    (tab === 'DISCOUNTS' && o.discounts.length > 0) ||
    (tab === 'OFFERS' && (o.offers.length > 0 || o.coupons.length > 0)),
  ), [outlets, tab]);

  return (
    <div className="max-w-md mx-auto pb-4">
      {/* Header */}
      <div className="px-5 pt-6 pb-3">
        <h1 className="text-2xl font-black text-slate-900">{t('offers.title')}</h1>
        <p className="text-xs text-slate-500 mt-0.5">{t('offers.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="px-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-1 grid grid-cols-3 gap-1">
          {(['DISCOUNTS', 'OFFERS', 'REWARDS'] as Tab[]).map(tk => {
            const active = tab === tk;
            const Icon = tk === 'DISCOUNTS' ? Percent : tk === 'OFFERS' ? Gift : Award;
            return (
              <button
                key={tk}
                onClick={() => setTab(tk)}
                className={clsx(
                  'flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl transition-colors',
                  active ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                <Icon size={13} />
                <span>{tk === 'DISCOUNTS' ? t('offers.tabDiscounts') : tk === 'OFFERS' ? t('offers.tabOffers') : t('offers.tabRewards')}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 mt-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse" />)}
          </div>
        ) : tab === 'REWARDS' ? (
          <RewardsView reward={reward} />
        ) : !hasAny ? (
          <EmptyState tab={tab} hasVisited={outlets.length > 0} />
        ) : (
          <div className="space-y-3">
            {outlets.map(o => (
              <OutletCard
                key={o.outlet.id}
                group={o}
                tab={tab}
                expanded={openOutlets[tab].has(o.outlet.id)}
                onToggle={() => toggleOutlet(o.outlet.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OutletCard({
  group, tab, expanded, onToggle,
}: { group: OutletPromos; tab: Tab; expanded: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const showDiscounts = tab === 'DISCOUNTS' && group.discounts.length > 0;
  const showOffers = tab === 'OFFERS' && (group.offers.length > 0 || group.coupons.length > 0);
  if (!showDiscounts && !showOffers) return null;

  // Count badges drive the collapsed-header summary so the customer can
  // decide which outlet to drill into without expanding everything.
  const counts: { label: string; n: number; tone: string }[] = [];
  if (tab === 'OFFERS' && group.coupons.length) counts.push({ label: t('offers.countCoupons'), n: group.coupons.length, tone: 'bg-brand-50 text-brand-900 border-brand-100' });
  if (tab === 'OFFERS' && group.offers.length) counts.push({ label: t('offers.countOffers'),   n: group.offers.length,   tone: 'bg-amber-50 text-amber-700 border-amber-100' });
  if (tab === 'DISCOUNTS' && group.discounts.length) counts.push({ label: t('offers.countDiscounts'), n: group.discounts.length, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Outlet header (toggle) */}
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full px-3 py-2.5 bg-slate-50/60 border-b border-slate-100 flex items-center gap-3 hover:bg-slate-50 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
          {group.outlet.logoUrl
            ? <img src={group.outlet.logoUrl} alt="" className="w-8 h-8 object-contain" />
            : <Store size={14} className="text-slate-400" />}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-bold text-slate-900 truncate">{group.outlet.name}</p>
          {group.outlet.businessName && (
            <p className="text-[10px] text-slate-500 truncate">{group.outlet.businessName}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {counts.map(c => (
            <span key={c.label} className={clsx('inline-flex items-center text-[10px] font-bold border rounded-full px-1.5 py-0.5', c.tone)}>
              {c.n} {c.label}
            </span>
          ))}
          <ChevronDown
            size={16}
            className={clsx('text-slate-400 transition-transform shrink-0', expanded && 'rotate-180')}
          />
        </div>
      </button>

      {expanded && (
      <div className="p-3 space-y-2">
        {showOffers && group.coupons.length > 0 && (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            {t('offers.couponsHeader', { count: group.coupons.length })}
          </p>
        )}
        {showOffers && group.coupons.map(c => (
          <div key={c.id} className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-800 flex items-center justify-center shrink-0">
              <Ticket size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {c.name} <span className="font-mono text-[10px] text-slate-500 ml-1">{c.code}</span>
              </p>
              <p className="text-[11px] text-slate-500">
                {discountAmount(c, t)}
                {c.minBillAmount ? ` · ${t('offers.minBill', { amount: c.minBillAmount })}` : ''}
                {c.maxDiscountAmount ? ` · ${t('offers.upTo', { amount: c.maxDiscountAmount })}` : ''}
                {' · '}{t('offers.validTill', { date: dayjs(c.validUntil).format('DD MMM') })}
              </p>
            </div>
          </div>
        ))}

        {showOffers && group.offers.length > 0 && (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide pt-1">
            {t('offers.offersHeader', { count: group.offers.length })}
          </p>
        )}

        {showDiscounts && group.discounts.map(d => (
          <div key={d.id} className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Percent size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">{d.name}</p>
              <p className="text-[11px] text-slate-500">
                {t('offers.discountOn', { discount: discountAmount(d, t), target: targetLabel(d, t) })}
                {(() => { const s = scheduleSummary(d, t); return s ? ` · ${s}` : ''; })()}
              </p>
            </div>
          </div>
        ))}

        {showOffers && group.offers.map(o => (
          <div key={o.id} className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Gift size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">{o.name}</p>
              <p className="text-[11px] text-slate-500">
                {o.triggerType === 'MIN_BILL'
                  ? t('offers.offerSpend', { amount: o.minBillAmount, qty: o.getQuantity ?? 1, item: o.getItem?.name ?? t('offers.freeItemFallback') })
                  : t('offers.offerBuyGet', { buyQty: o.buyQuantity ?? 0, buyItem: o.buyItem?.name ?? t('offers.itemFallback'), getQty: o.getQuantity ?? 0, getItem: o.getItem?.name ?? t('offers.freeItemFallback') })}
                {(() => { const s = scheduleSummary(o, t); return s ? ` · ${s}` : ''; })()}
              </p>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

function RewardsView({ reward }: { reward: any | null }) {
  const { t } = useTranslation();
  if (!reward) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 py-10 px-4 text-center">
        <Award className="text-slate-300 mx-auto mb-2" size={32} />
        <p className="text-sm text-slate-500 font-semibold">{t('offers.noRewardAccount')}</p>
        <p className="text-[11px] text-slate-400 mt-1">{t('offers.firstOrderHint')}</p>
      </div>
    );
  }

  const txs = reward.transactions || [];
  return (
    <div className="space-y-3">
      {/* Balance card */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-400 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wide font-bold opacity-90">{t('offers.availableBalance')}</span>
          <Award size={18} className="opacity-80" />
        </div>
        <p className="text-4xl font-black">{reward.balance}</p>
        <p className="text-[11px] mt-1 opacity-90">{t('offers.pointsUseAtCheckout')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 p-3 text-center">
          <p className="text-[10px] text-slate-500 font-semibold uppercase">{t('offers.lifetimeEarned')}</p>
          <p className="text-xl font-black text-emerald-600 mt-0.5">{reward.lifetimeEarned}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-3 text-center">
          <p className="text-[10px] text-slate-500 font-semibold uppercase">{t('offers.lifetimeRedeemed')}</p>
          <p className="text-xl font-black text-rose-600 mt-0.5">{reward.lifetimeRedeemed}</p>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl border border-slate-100">
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5">
          <History size={12} className="text-slate-400" />
          <p className="text-[11px] uppercase font-bold text-slate-500 tracking-wide">{t('offers.recentActivity')}</p>
        </div>
        {txs.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">{t('offers.noTransactions')}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {txs.slice(0, 10).map((tx: any) => (
              <div key={tx.id} className="px-3 py-2 flex items-center gap-2.5">
                <div className={clsx(
                  'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                  tx.points >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
                )}>
                  <ChevronRight size={12} className={clsx(tx.points < 0 && 'rotate-180')} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800">
                    {tx.type === 'EARN' ? t('offers.txEarned') : tx.type === 'REDEEM' ? t('offers.txRedeemed') : tx.type === 'EXPIRE' ? t('offers.txExpired') : t('offers.txAdjusted')}
                  </p>
                  <p className="text-[10px] text-slate-400">{dayjs(tx.createdAt).format('DD MMM, hh:mm A')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={clsx('text-sm font-black', tx.points >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                    {tx.points > 0 ? '+' : ''}{tx.points}
                  </p>
                  <p className="text-[10px] text-slate-400">{t('offers.balAfter', { after: tx.balanceAfter })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ tab, hasVisited }: { tab: Tab; hasVisited: boolean }) {
  const { t } = useTranslation();
  const Icon = tab === 'DISCOUNTS' ? Percent : Gift;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 py-10 px-4 text-center">
      <Icon className="text-slate-300 mx-auto mb-2" size={32} />
      <p className="text-sm text-slate-500 font-semibold">
        {tab === 'DISCOUNTS' ? t('offers.emptyDiscounts') : t('offers.emptyOffers')}
      </p>
      <p className="text-[11px] text-slate-400 mt-1">
        {hasVisited ? t('offers.emptyHintVisited') : t('offers.emptyHintNew')}
      </p>
    </div>
  );
}
