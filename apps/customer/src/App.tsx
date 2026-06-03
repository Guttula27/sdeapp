import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import ReceiptPage from './pages/ReceiptPage';
import DashboardPage from './pages/DashboardPage';
import OffersPage from './pages/OffersPage';
import AlertsPage from './pages/AlertsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useCustomerAuth();
  return isLoggedIn ? <>{children}</> : <Navigate to="/auth" replace />;
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
              half-screen sheet inside OrderPage. Legacy deep links
              redirect to /order so the visitor can pick the item again. */}
          <Route path="/order/item/:itemId" element={<Navigate to="/order" replace />} />
          {/* Cluster shell — food-court roof with outlet picker + unified cart */}
          <Route path="/cluster/:publicCode" element={<ClusterPage />} />
          {/* /cluster/:publicCode/item/:itemId retired — same sheet pattern in ClusterPage. */}
          <Route path="/cluster/:publicCode/item/:itemId" element={<Navigate to=".." replace />} />
          <Route path="/pay"    element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
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
