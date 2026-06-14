import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { useUserRole } from './hooks/useUserRole';
import Layout from './components/layout/Layout';
import LandingPage from './pages/landing/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import PlatformPage from './pages/platform/PlatformPage';
import PlatformFeesPage from './pages/platform/PlatformFeesPage';
import BusinessDetailPage from './pages/platform/BusinessDetailPage';
import ClusterDetailPage from './pages/clusters/ClusterDetailPage';
import OrdersPage from './pages/orders/OrdersPage';
import PlaceOrderPage from './pages/orders/PlaceOrderPage';
import MenuPage from './pages/menu/MenuPage';
import OutletsPage from './pages/outlets/OutletsPage';
import ReportsPage from './pages/reports/ReportsPage';
import KitchenPage from './pages/kitchen/KitchenPage';
import StationsPage from './pages/stations/StationsPage';
import ServiceStationsPage from './pages/service-stations/ServiceStationsPage';
import ServiceDeskPage from './pages/service-desk/ServiceDeskPage';
import ParcelDeskPage from './pages/parcel-desk/ParcelDeskPage';
import OfflineOrdersPage from './pages/offline-orders/OfflineOrdersPage';
import TagsPage from './pages/tags/TagsPage';
import CustomersPage from './pages/customers/CustomersPage';
import ToppingsPage from './pages/toppings/ToppingsPage';
import TableTypesPage from './pages/table-types/TableTypesPage';
import BusinessProfilePage from './pages/business/BusinessProfilePage';
import OutletProfilePage from './pages/outlets/OutletProfilePage';
import StaffPage from './pages/staff/StaffPage';
import RolesPage from './pages/roles/RolesPage';
import LanguagesPage from './pages/languages/LanguagesPage';
import DisputesPage from './pages/disputes/DisputesPage';
import SettingsPage from './pages/settings/SettingsPage';
import IntegrationsPage from './pages/integrations/IntegrationsPage';
import TemplateApprovalsPage from './pages/integrations/TemplateApprovalsPage';
import MessagingPage from './pages/messaging/MessagingPage';
import FeedbackPage from './pages/feedback/FeedbackPage';
import CouponsPage from './pages/promotions/CouponsPage';
import DiscountsPage from './pages/promotions/DiscountsPage';
import OffersPage from './pages/promotions/OffersPage';
import RewardsPage from './pages/promotions/RewardsPage';
import ForcePasswordResetPage from './pages/ForcePasswordResetPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import TermsPage from './pages/legal/TermsPage';
import PrivacyPage from './pages/legal/PrivacyPage';
import RefundPage from './pages/legal/RefundPage';
import AgreementPage from './pages/legal/AgreementPage';
import OfflineBanner from './components/common/OfflineBanner';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.token);
  const user  = useSelector((s: RootState) => s.auth.user);
  if (!token) return <Navigate to="/login" replace />;
  if (user?.mustChangePassword) return <Navigate to="/force-password-reset" replace />;
  return <>{children}</>;
}

function HomeRoute() {
  const token = useSelector((s: RootState) => s.auth.token);
  const { defaultPage } = useUserRole();
  return token ? <Navigate to={defaultPage} replace /> : <LandingPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        {/* Public */}
        <Route path="/"      element={<HomeRoute />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/force-password-reset" element={<ForcePasswordResetPage />} />

        {/* Legal — public */}
        <Route path="/legal/terms"     element={<TermsPage />} />
        <Route path="/legal/privacy"   element={<PrivacyPage />} />
        <Route path="/legal/refund"    element={<RefundPage />} />
        <Route path="/legal/agreement" element={<AgreementPage />} />

        {/* Authenticated app */}
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          {/* Platform admin */}
          <Route path="platform"           element={<PlatformPage />} />
          <Route path="subscriptions-mgmt" element={<PlatformPage />} />
          <Route path="businesses"         element={<PlatformPage />} />
          <Route path="platform/clusters/:id" element={<ClusterDetailPage />} />
          <Route path="platform/businesses/:id" element={<BusinessDetailPage />} />
          <Route path="platform-settings" element={<PlatformFeesPage />} />

          {/* Shared across tiers */}
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="orders"     element={<OrdersPage />} />
          <Route path="place-order" element={<PlaceOrderPage />} />
          <Route path="menu"       element={<MenuPage />} />
          <Route path="outlets"    element={<OutletsPage />} />
          {/* Inventory + Vendors temporarily disabled — modules not ready */}
          <Route path="inventory"  element={<Navigate to="/dashboard" replace />} />
          <Route path="vendors"    element={<Navigate to="/dashboard" replace />} />
          <Route path="disputes"   element={<DisputesPage />} />
          <Route path="staff"      element={<StaffPage />} />
          <Route path="roles"      element={<RolesPage />} />
          <Route path="languages"  element={<LanguagesPage />} />
          <Route path="reports"    element={<ReportsPage />} />
          <Route path="kitchen"    element={<KitchenPage />} />
          <Route path="service-desk" element={<ServiceDeskPage />} />
          <Route path="parcel-desk" element={<ParcelDeskPage />} />
          <Route path="offline-orders" element={<OfflineOrdersPage />} />
          <Route path="stations"   element={<StationsPage />} />
          <Route path="service-stations" element={<ServiceStationsPage />} />
          <Route path="tags"       element={<TagsPage />} />
          <Route path="toppings"   element={<ToppingsPage />} />
          <Route path="table-types" element={<TableTypesPage />} />
          <Route path="customers"  element={<CustomersPage />} />
          <Route path="business"   element={<BusinessProfilePage />} />
          <Route path="outlet-profile" element={<OutletProfilePage />} />
          <Route path="settings"   element={<SettingsPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="template-approvals" element={<TemplateApprovalsPage />} />
          <Route path="messaging"  element={<MessagingPage />} />
          <Route path="feedback"   element={<FeedbackPage />} />

          {/* Promotions */}
          <Route path="promotions/coupons"   element={<CouponsPage />} />
          <Route path="promotions/discounts" element={<DiscountsPage />} />
          <Route path="promotions/bundles"   element={<Navigate to="/menu" replace />} />
          <Route path="promotions/offers"    element={<OffersPage />} />
          <Route path="promotions/rewards"   element={<RewardsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
