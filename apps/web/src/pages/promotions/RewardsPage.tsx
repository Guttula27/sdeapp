import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Award, Search, Plus, Settings, History } from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';

type Config = {
  earnRate: string | number;
  redeemRate: string | number;
  minRedemptionPoints: number;
  maxRedemptionPercent: string | number;
  expiryDays: number | null;
  isActive: boolean;
};

type Account = {
  id: string;
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  transactions: {
    id: string; type: string; points: number; amountValue: string | number | null;
    balanceAfter: number; createdAt: string; notes?: string | null;
  }[];
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

export default function RewardsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId;

  const [config, setConfig] = useState<Config | null>(null);
  const [savingCfg, setSavingCfg] = useState(false);
  const [outlets, setOutlets] = useState<any[]>([]);

  const [phone, setPhone] = useState('');
  const [lookupResult, setLookupResult] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState('0');
  const [adjustNotes, setAdjustNotes] = useState('');

  useEffect(() => {
    api.get('/rewards/config').then(({ data }) => setConfig(data.data || data)).catch(() => {});
    if (businessId) {
      api.get(`/outlets/business/${businessId}`).then(({ data }) => setOutlets(data.data || [])).catch(() => {});
    }
  }, [businessId]);

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSavingCfg(true);
    try {
      const body = {
        earnRate: Number(config.earnRate),
        redeemRate: Number(config.redeemRate),
        minRedemptionPoints: Number(config.minRedemptionPoints),
        maxRedemptionPercent: Number(config.maxRedemptionPercent),
        expiryDays: config.expiryDays === null ? null : Number(config.expiryDays),
        isActive: config.isActive,
      };
      const { data } = await api.patch('/rewards/config', body);
      setConfig(data.data || data);
      toast.success('Rewards config saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSavingCfg(false);
    }
  };

  const toggleOutletAccept = async (outletId: string, accept: boolean) => {
    try {
      await api.patch(`/outlets/${outletId}`, { acceptRewardRedemption: accept });
      setOutlets(outlets.map((o) => o.id === outletId ? { ...o, acceptRewardRedemption: accept } : o));
      toast.success('Outlet updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update outlet');
    }
  };

  const lookupCustomer = async () => {
    if (!phone.trim()) return;
    setLookingUp(true);
    try {
      const { data } = await api.post('/coupons/lookup-customers', { phones: [phone.trim()] });
      const list = data.data || data || [];
      if (!list.length) {
        toast.error('No customer found with that phone');
        setLookupResult(null);
        setAccount(null);
        return;
      }
      const u = list[0];
      setLookupResult(u);
      const acc = await api.get(`/rewards/customers/${u.id}`);
      setAccount(acc.data.data || acc.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lookup failed');
    } finally {
      setLookingUp(false);
    }
  };

  const submitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupResult) return;
    const pts = Number(adjustPoints);
    if (!pts) return;
    try {
      await api.post(`/rewards/customers/${lookupResult.id}/adjust`, {
        points: pts,
        notes: adjustNotes.trim() || undefined,
      });
      const acc = await api.get(`/rewards/customers/${lookupResult.id}`);
      setAccount(acc.data.data || acc.data);
      setAdjustOpen(false);
      setAdjustPoints('0');
      setAdjustNotes('');
      toast.success(pts > 0 ? `Added ${pts} points` : `Deducted ${-pts} points`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to adjust');
    }
  };

  if (!config) {
    return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Award className="w-6 h-6 text-brand-700" /> Rewards
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Platform-wide reward points — customers earn at any outlet and can redeem anywhere it's accepted.
        </p>
      </div>

      {/* Config card */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4" /> Platform Config
        </h2>
        <form onSubmit={saveConfig} className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Earn rate (points per ₹1 spent)">
            <input type="number" step="0.0001" value={String(config.earnRate)}
              onChange={(e) => setConfig({ ...config, earnRate: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
          </Field>
          <Field label="Redeem rate (₹ per 1 point)">
            <input type="number" step="0.0001" value={String(config.redeemRate)}
              onChange={(e) => setConfig({ ...config, redeemRate: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
          </Field>
          <Field label="Min redemption (points)">
            <input type="number" value={config.minRedemptionPoints}
              onChange={(e) => setConfig({ ...config, minRedemptionPoints: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
          </Field>
          <Field label="Max % of bill via points">
            <input type="number" value={String(config.maxRedemptionPercent)}
              onChange={(e) => setConfig({ ...config, maxRedemptionPercent: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" min={0} max={100} required />
          </Field>
          <Field label="Expiry days (blank = never)">
            <input type="number" value={config.expiryDays ?? ''}
              onChange={(e) => setConfig({ ...config, expiryDays: e.target.value === '' ? null : Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </Field>
          <Field label="Status">
            <label className="flex items-center gap-2 text-sm pt-2">
              <input type="checkbox" checked={config.isActive}
                onChange={(e) => setConfig({ ...config, isActive: e.target.checked })} />
              Rewards system enabled
            </label>
          </Field>
          <div className="col-span-full flex justify-end pt-2">
            <button type="submit" disabled={savingCfg}
              className="px-4 py-2 text-sm font-semibold text-white bg-gold-500 hover:bg-gold-600 text-charcoal-900 rounded-md disabled:opacity-50">
              {savingCfg ? 'Saving…' : 'Save Config'}
            </button>
          </div>
        </form>
      </div>

      {/* Outlet acceptance */}
      {outlets.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Per-outlet redemption</h2>
          <p className="text-xs text-slate-500 mb-3">
            Customers earn points at every outlet. Whether they can <em>burn</em> points at a given outlet is up to that outlet.
          </p>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="text-left px-4 py-2">Outlet</th>
                <th className="text-center px-4 py-2">Accept redemption</th>
              </tr>
            </thead>
            <tbody>
              {outlets.map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{o.name}</td>
                  <td className="px-4 py-2 text-center">
                    <input type="checkbox" checked={o.acceptRewardRedemption !== false}
                      onChange={(e) => toggleOutletAccept(o.id, e.target.checked)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer lookup */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <Search className="w-4 h-4" /> Customer Lookup
        </h2>
        <div className="flex gap-2 mb-4">
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="Customer phone number"
            className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <button onClick={lookupCustomer} disabled={lookingUp}
            className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-charcoal-900 rounded-md text-sm font-semibold">
            {lookingUp ? 'Searching…' : 'Lookup'}
          </button>
        </div>

        {lookupResult && account && (
          <div>
            <div className="bg-slate-50 rounded-lg p-4 mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{lookupResult.name}</div>
                <div className="text-xs text-slate-500">{lookupResult.phone}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-brand-800">{account.balance}</div>
                <div className="text-xs text-slate-500">points</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-700">{account.lifetimeEarned}</div>
                <div className="text-xs text-slate-600 mt-1">Lifetime earned</div>
              </div>
              <div className="bg-rose-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-rose-700">{account.lifetimeRedeemed}</div>
                <div className="text-xs text-slate-600 mt-1">Lifetime redeemed</div>
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={() => { setAdjustPoints('100'); setAdjustOpen(true); }}
                className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm font-semibold inline-flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Adjust
              </button>
            </div>

            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1">
              <History className="w-3 h-3" /> Recent transactions
            </h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">When</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-right px-3 py-2">Points</th>
                    <th className="text-right px-3 py-2">Balance</th>
                    <th className="text-left px-3 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {account.transactions.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-500">No transactions yet</td></tr>
                  ) : account.transactions.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-xs text-slate-600">{new Date(t.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs">{t.type}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${t.points >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {t.points > 0 ? '+' : ''}{t.points}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">{t.balanceAfter}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{t.notes || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Adjust points" size="sm">
        <form onSubmit={submitAdjust} className="space-y-4 p-6">
          <p className="text-xs text-slate-500">
            Positive to add, negative to deduct. Both flow into the customer's ledger as a manual ADJUST entry.
          </p>
          <Field label="Points (use a negative number to deduct)">
            <input type="number" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
          </Field>
          <Field label="Notes (optional)">
            <input value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              placeholder="Reason for adjustment" />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdjustOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-md">Cancel</button>
            <button type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-gold-500 hover:bg-gold-600 text-charcoal-900 rounded-md">
              Apply
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
