import { useSelector } from 'react-redux';
import { RootState } from '../store';

export type UserTier = 'platform' | 'business' | 'outlet' | 'kitchen' | 'counter' | 'store';

const KITCHEN_ROLES  = ['chef', 'kitchen manager', 'kitchen staff'];
const COUNTER_ROLES  = ['cashier', 'counter staff'];
const STORE_ROLES    = ['store manager', 'store staff', 'inventory executive'];

function roleName(user: any): string {
  return (user?.role?.name || '').toLowerCase();
}

function hasResponsibility(user: any, name: string): boolean {
  return user?.role?.responsibilities?.some(
    (r: any) => r.responsibility?.name === name,
  ) ?? false;
}

export function useUserRole() {
  const user = useSelector((s: RootState) => s.auth.user);

  const name = roleName(user);

  let tier: UserTier = 'outlet'; // safe default

  if (!user?.businessId && !user?.outletId) {
    tier = 'platform';
  } else if (user?.businessId && !user?.outletId) {
    tier = 'business';
  } else if (KITCHEN_ROLES.some(r => name.includes(r))) {
    tier = 'kitchen';
  } else if (COUNTER_ROLES.some(r => name.includes(r))) {
    tier = 'counter';
  } else if (STORE_ROLES.some(r => name.includes(r))) {
    tier = 'store';
  }

  const has = (perm: string) => hasResponsibility(user, perm);

  // Capability flags — one per responsibility so pages can gate UI cleanly.
  const can = {
    // Platform
    platformAdmin:        has('PLATFORM_ADMIN'),
    viewPlatformReports:  has('VIEW_PLATFORM_REPORTS'),
    manageLeads:          has('MANAGE_LEADS'),
    managePlans:          has('MANAGE_PLANS'),

    // Businesses
    viewBusinesses:       has('VIEW_BUSINESSES'),
    manageBusinesses:     has('MANAGE_BUSINESSES'),
    manageBusinessImages: has('MANAGE_BUSINESS_IMAGES'),

    // Outlets
    viewOutlets:          has('VIEW_OUTLETS'),
    manageOutlets:        has('MANAGE_OUTLETS'),
    manageOutletImages:   has('MANAGE_OUTLET_IMAGES'),
    manageOutletHours:    has('MANAGE_OUTLET_HOURS'),
    manageSections:       has('MANAGE_SECTIONS'),
    manageTables:         has('MANAGE_TABLES'),
    manageTableTypes:     has('MANAGE_TABLE_TYPES'),

    // Menu
    viewMenu:             has('VIEW_MENU'),
    manageMenu:           has('MANAGE_MENU'),
    manageMenuItems:      has('MANAGE_MENU_ITEMS'),
    toggleItemAvailability: has('TOGGLE_ITEM_AVAILABILITY'),
    importMenu:           has('IMPORT_MENU'),
    manageToppings:       has('MANAGE_TOPPINGS'),

    // Orders
    viewOrders:           has('VIEW_ORDERS'),
    createOrder:          has('CREATE_ORDER'),
    updateOrderStatus:    has('UPDATE_ORDER_STATUS'),
    cancelOrder:          has('CANCEL_ORDER'),
    updateItemStatus:     has('UPDATE_ITEM_STATUS'),

    // Payments
    collectPayment:       has('COLLECT_PAYMENT'),
    viewPayments:         has('VIEW_PAYMENTS'),

    // Kitchen
    viewKitchen:          has('VIEW_KITCHEN'),
    manageKitchenStations: has('MANAGE_KITCHEN_STATIONS'),

    // Inventory & vendors
    viewInventory:        has('VIEW_INVENTORY'),
    manageInventory:      has('MANAGE_INVENTORY'),
    managePurchaseOrders: has('MANAGE_PURCHASE_ORDERS'),
    viewVendors:          has('VIEW_VENDORS'),
    manageVendors:        has('MANAGE_VENDORS'),

    // Reports
    viewReports:          has('VIEW_REPORTS'),
    viewKitchenReports:   has('VIEW_KITCHEN_REPORTS'),

    // Staff & roles
    viewStaff:            has('VIEW_STAFF'),
    manageStaff:          has('MANAGE_STAFF'),
    manageRoles:          has('MANAGE_ROLES'),

    // Customers
    viewCustomers:        has('VIEW_CUSTOMERS'),
    manageCustomers:      has('MANAGE_CUSTOMERS'),
    manageCustomerTags:   has('MANAGE_CUSTOMER_TAGS'),
    assignCustomerTags:   has('ASSIGN_CUSTOMER_TAGS'),

    // QR
    viewQrCodes:          has('VIEW_QR_CODES'),
    manageQrCodes:        has('MANAGE_QR_CODES'),

    // Disputes
    viewDisputes:         has('VIEW_DISPUTES'),
    manageDisputes:       has('MANAGE_DISPUTES'),

    // Billing
    manageSubscriptions:  has('MANAGE_SUBSCRIPTIONS'),
    viewInvoices:         has('VIEW_INVOICES'),
  };

  // Default landing page
  const defaultPage: Record<UserTier, string> = {
    platform: '/platform',
    business: '/dashboard',
    outlet:   '/dashboard',
    kitchen:  '/kitchen',
    counter:  '/orders',
    store:    '/inventory',
  };

  // Cluster owners land on their cluster admin page rather than a generic
  // /dashboard, because almost everything they do is cluster-scoped
  // (members, branding, QR, orders routed through children).
  const isClusterOwner = tier === 'business' && !!user?.business?.isCluster;
  const resolvedDefault = isClusterOwner ? `/platform/clusters/${user.businessId}` : defaultPage[tier];

  return { tier, can, has, defaultPage: resolvedDefault, user, isClusterOwner };
}
