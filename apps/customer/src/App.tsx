import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useCustomerAuth } from './context/CustomerAuthContext';
import BottomNav from './components/BottomNav';
import HomePage from './pages/HomePage';
import ScanPage from './pages/ScanPage';
import AuthPage from './pages/AuthPage';
import OrderPage from './pages/OrderPage';
import OrderTrackingPage from './pages/OrderTrackingPage';
import ProfilePage from './pages/ProfilePage';
import PaymentPage from './pages/PaymentPage';
import ReceiptPage from './pages/ReceiptPage';
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import ItemDetailPage from './pages/ItemDetailPage';
import AlertsPage from './pages/AlertsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useCustomerAuth();
  return isLoggedIn ? <>{children}</> : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone (no bottom nav) */}
        <Route path="/auth"   element={<AuthPage />} />

        {/* Tabbed shell — all signed-in flows keep the bottom nav visible */}
        <Route element={<BottomNav />}>
          <Route path="/home"      element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/scan"      element={<ScanPage />} />
          <Route path="/history"   element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/profile"   element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          <Route path="/order"  element={<OrderPage />} />
          <Route path="/order/item/:itemId" element={<ItemDetailPage />} />
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
