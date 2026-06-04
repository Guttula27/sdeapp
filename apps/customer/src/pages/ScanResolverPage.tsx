import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { QrCode, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useCustomerAuth } from '../context/CustomerAuthContext';

/**
 * Universal /s/* (scan) handler.
 *
 * URLs encoded in QR codes look like one of these:
 *
 *   /s/table/<tableId>
 *   /s/outlet/<outletId>
 *   /s/outlet/<outletId>/item/<itemId>
 *   /s/cluster/<publicCode>
 *   /s/cluster/<publicCode>/outlet/<outletId>
 *   /s/cluster/<publicCode>/outlet/<outletId>/item/<itemId>
 *
 * Behaviour matrix:
 *
 *   not logged in
 *     → stash the resolved target in localStorage and redirect to
 *       /auth?from=<target>. AuthPage navigates to the stashed
 *       target on successful login.
 *
 *   logged in
 *     → navigate straight to the target (/cluster/... or /order...).
 *
 *   table or outlet under a cluster
 *     → resolve cluster context server-side and route through
 *       /cluster/<publicCode>?outletId=...&tableId=... so the
 *       customer always sees the cluster shell when scanning a
 *       cluster-member's QR.
 *
 *   standalone outlet/table
 *     → /order?outlet=...&table=...
 *
 *   item suffix
 *     → adds &item=<id> to the URL so OrderPage / ClusterPage can
 *       auto-open the item detail sheet on mount.
 */

const PENDING_SCAN_KEY = 'paynpik-pending-scan';

type ResolveResult = {
  outletId?: string;
  tableId?: string;
  clusterPublicCode?: string | null;
};

export default function ScanResolverPage() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn } = useCustomerAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const target = await resolve(params, location.pathname);
        if (!target) {
          navigate('/scan', { state: { error: 'This QR code is not recognised.' }, replace: true });
          return;
        }
        if (!isLoggedIn) {
          // Customer needs to sign in first. Stash the resolved
          // target and let AuthPage resume the navigation after a
          // successful OTP. Cleared on consumption.
          try { localStorage.setItem(PENDING_SCAN_KEY, target); } catch { /* ignore */ }
          navigate('/auth', { state: { from: target }, replace: true });
        } else {
          navigate(target, { replace: true });
        }
      } catch (e: any) {
        navigate('/scan', {
          state: { error: e?.message || 'Could not resolve this QR code.' },
          replace: true,
        });
      }
    })();
    // params + isLoggedIn drive resolution, but we deliberately
    // run-once via the ref above so a re-render mid-navigation
    // doesn't fire a second resolve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-orange-400 flex items-center justify-center shadow-lg">
          <QrCode size={28} className="text-white" />
        </div>
        <p className="text-sm font-bold text-slate-800">Opening menu…</p>
        <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1">
          <Loader2 size={11} className="animate-spin" /> hang tight
        </p>
      </div>
    </div>
  );
}

async function resolve(p: Record<string, string | undefined>, pathname: string): Promise<string | null> {
  const { tableId, outletId, publicCode, itemId } = p;

  // ── Cluster URLs ────────────────────────────────────────────
  if (publicCode) {
    // /s/cluster/:publicCode[/outlet/:outletId[/item/:itemId]]
    const qs = new URLSearchParams();
    if (outletId) qs.set('outletId', outletId);
    if (itemId)   qs.set('item', itemId);
    return `/cluster/${publicCode}${qs.toString() ? `?${qs}` : ''}`;
  }

  // ── Table URL ────────────────────────────────────────────────
  if (tableId && pathname.startsWith('/s/table/')) {
    const { data } = await api.get(`/qr/scan/table/${tableId}`);
    const info: ResolveResult | null = data?.data ?? data;
    if (!info?.outletId) return null;
    if (info.clusterPublicCode) {
      const qs = new URLSearchParams({ outletId: info.outletId, tableId });
      return `/cluster/${info.clusterPublicCode}?${qs}`;
    }
    const qs = new URLSearchParams({ outlet: info.outletId, table: tableId });
    return `/order?${qs}`;
  }

  // ── Outlet URLs ──────────────────────────────────────────────
  if (outletId) {
    // /s/outlet/:outletId[/item/:itemId]
    const { data } = await api.get(`/qr/scan/outlet/${outletId}`);
    const info: ResolveResult | null = data?.data ?? data;
    if (info?.clusterPublicCode) {
      const qs = new URLSearchParams({ outletId });
      if (itemId) qs.set('item', itemId);
      return `/cluster/${info.clusterPublicCode}?${qs}`;
    }
    const qs = new URLSearchParams({ outlet: outletId });
    if (itemId) qs.set('item', itemId);
    return `/order?${qs}`;
  }

  return null;
}

export { PENDING_SCAN_KEY };
