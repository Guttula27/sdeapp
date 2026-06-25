import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useCustomerAuth } from './context/CustomerAuthContext';
import BottomNav from './components/BottomNav';
import HomePage from './pages/HomePage';
import ScanPage from './pages/ScanPage';
import AuthPage from './pages/AuthPage';
import OrderPage from './pages/OrderPage';
import ClusterPage from './pages/ClusterPage';
import OfflineBanner from './components/OfflineBanner';
import OrderTrackingPage from './pages/OrderTrackingPage';
import ProfilePage from './pages/ProfilePage';
import PaymentPage from './pages/PaymentPage';
import BillsPage from './pages/BillsPage';
import BillSharePage from './pages/BillSharePage';
import ReceiptPage from './pages/ReceiptPage';
import DashboardPage from './pages/DashboardPage';
import OffersPage from './pages/OffersPage';
import AlertsPage from './pages/AlertsPage';
import ScanResolverPage from './pages/ScanResolverPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useCustomerAuth();
  return isLoggedIn ? <>{children}</> : <Navigate to="/auth" replace />;
}

// Legacy /order/item/:itemId QR redirect — funnels already-printed QRs
// through the canonical scan resolver so they get the cluster / auth
// handling and OrderPage's item-detail-over-menu UX. Without this, the
// old <Navigate to="/order" /> dropped both the itemId and ?outlet=.
function LegacyItemQrRedirect() {
  const { itemId } = useParams();
  const [params] = useSearchParams();
  const outletId = params.get('outlet');
  const target = outletId && itemId
    ? `/s/outlet/${outletId}/item/${itemId}`
    : '/order';
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        {/* Standalone (no bottom nav) */}
        <Route path="/auth"   element={<AuthPage />} />

        {/* Tabbed shell — all signed-in flows keep the bottom nav visible */}
        <Route element={<BottomNav />}>
          <Route path="/home"      element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/scan"      element={<ScanPage />} />
          <Route path="/offers"    element={<ProtectedRoute><OffersPage /></ProtectedRoute>} />
          {/* /history → moved into /dashboard; redirect any deep links. */}
          <Route path="/history"   element={<Navigate to="/dashboard" replace />} />
          <Route path="/profile"   element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          <Route path="/order"  element={<OrderPage />} />
          {/* /order/item/:itemId retired — item details now open as a
              half-screen sheet inside OrderPage. Already-printed QRs
              encoded this URL with ?outlet=… so we forward to the
              canonical scan resolver, which handles cluster routing +
              auth and lands on /order?outlet=…&item=… (where OrderPage
              pops the item sheet over the outlet menu). */}
          <Route path="/order/item/:itemId" element={<LegacyItemQrRedirect />} />
          {/* Cluster shell — food-court roof with outlet picker + unified cart */}
          <Route path="/cluster/:publicCode" element={<ClusterPage />} />
          {/* /cluster/:publicCode/item/:itemId retired — same sheet pattern in ClusterPage. */}
          <Route path="/cluster/:publicCode/item/:itemId" element={<Navigate to=".." replace />} />

          {/* ── /s/* scan handlers ────────────────────────────────────
              QR codes encode short /s/<kind>/<id> URLs; the resolver
              page below figures out whether the target is in a
              cluster, whether the user is signed in, and what page
              to navigate to. Order matters — more specific routes
              must come before less specific ones (table is unique
              prefix). */}
          <Route path="/s/table/:tableId" element={<ScanResolverPage />} />
          <Route path="/s/cluster/:publicCode/outlet/:outletId/item/:itemId" element={<ScanResolverPage />} />
          <Route path="/s/cluster/:publicCode/outlet/:outletId" element={<ScanResolverPage />} />
          <Route path="/s/cluster/:publicCode" element={<ScanResolverPage />} />
          <Route path="/s/outlet/:outletId/item/:itemId" element={<ScanResolverPage />} />
          <Route path="/s/outlet/:outletId" element={<ScanResolverPage />} />
          <Route path="/pay"    element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
          <Route path="/bills"          element={<ProtectedRoute><BillsPage /></ProtectedRoute>} />
          <Route path="/bills/:shareId" element={<ProtectedRoute><BillSharePage /></ProtectedRoute>} />
          <Route path="/receipt/:orderId" element={<ProtectedRoute><ReceiptPage /></ProtectedRoute>} />
          <Route path="/track/:orderId" element={<OrderTrackingPage />} />
          <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
        </Route>

        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
