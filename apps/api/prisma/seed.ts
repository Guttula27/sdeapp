import { PrismaClient, BusinessType, OutletType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Responsibility catalogue ────────────────────────────────
// One row per discrete capability across the API surface.
// Naming convention: VERB_RESOURCE (VIEW_*, MANAGE_*, CREATE_*, …).
const RESPONSIBILITY_DEFS: Array<{ name: string; module: string; description: string }> = [
  // Platform-wide (only platform admins / internal staff)
  { name: 'PLATFORM_ADMIN',          module: 'PLATFORM',   description: 'Full platform administration access' },
  { name: 'VIEW_PLATFORM_REPORTS',   module: 'PLATFORM',   description: 'View platform-wide summary & hourly reports' },
  { name: 'MANAGE_PLATFORM_SETTINGS',module: 'PLATFORM',   description: 'Edit platform-wide settings (Razorpay route fee defaults)' },
  { name: 'MANAGE_LEADS',            module: 'PLATFORM',   description: 'View and update sales leads' },
  { name: 'MANAGE_PLANS',            module: 'PLATFORM',   description: 'Create or update subscription plans' },

  // Businesses
  { name: 'VIEW_BUSINESSES',         module: 'BUSINESSES', description: 'View businesses list & details' },
  { name: 'MANAGE_BUSINESSES',       module: 'BUSINESSES', description: 'Create, update or toggle businesses' },
  { name: 'MANAGE_BUSINESS_IMAGES',  module: 'BUSINESSES', description: 'Upload or remove business images' },

  // Outlets
  { name: 'VIEW_OUTLETS',            module: 'OUTLETS',    description: 'View outlets list & details' },
  { name: 'MANAGE_OUTLETS',          module: 'OUTLETS',    description: 'Create or update outlets' },
  { name: 'MANAGE_OUTLET_IMAGES',    module: 'OUTLETS',    description: 'Upload or remove outlet images' },
  { name: 'MANAGE_OUTLET_HOURS',     module: 'OUTLETS',    description: 'Update outlet operating hours' },
  { name: 'MANAGE_SECTIONS',         module: 'OUTLETS',    description: 'Manage sections within an outlet' },
  { name: 'MANAGE_TABLES',           module: 'OUTLETS',    description: 'Create or remove tables' },
  { name: 'MANAGE_TABLE_TYPES',      module: 'OUTLETS',    description: 'Manage table types and table-type pricing' },

  // Menu
  { name: 'VIEW_MENU',               module: 'MENU',       description: 'View menu items, categories and subcategories' },
  { name: 'MANAGE_MENU',             module: 'MENU',       description: 'Manage categories and subcategories' },
  { name: 'MANAGE_MENU_ITEMS',       module: 'MENU',       description: 'Create, update or remove items, variants and images' },
  { name: 'TOGGLE_ITEM_AVAILABILITY',module: 'MENU',       description: 'Quickly toggle item availability' },
  { name: 'IMPORT_MENU',             module: 'MENU',       description: 'Import a menu from another outlet' },
  { name: 'MANAGE_TOPPINGS',         module: 'MENU',       description: 'Manage toppings and item topping assignments' },

  // Orders
  { name: 'VIEW_ORDERS',             module: 'ORDERS',     description: 'View orders list & details' },
  { name: 'VIEW_ORDER_LOG',          module: 'ORDERS',     description: 'View the per-order status history (stage, time, staff)' },
  { name: 'CREATE_ORDER',            module: 'ORDERS',     description: 'Create new orders' },
  { name: 'UPDATE_ORDER_STATUS',     module: 'ORDERS',     description: 'Move orders through workflow states' },
  { name: 'CANCEL_ORDER',            module: 'ORDERS',     description: 'Cancel existing orders' },
  { name: 'UPDATE_ITEM_STATUS',      module: 'ORDERS',     description: 'Update kitchen item status (start/ready)' },

  // Payments
  { name: 'COLLECT_PAYMENT',         module: 'PAYMENTS',   description: 'Initiate and confirm payments' },
  { name: 'VIEW_PAYMENTS',           module: 'PAYMENTS',   description: 'View payment history per order' },

  // Kitchen
  { name: 'VIEW_KITCHEN',            module: 'KITCHEN',    description: 'View the kitchen display / KDS queue' },
  { name: 'MANAGE_KITCHEN_STATIONS', module: 'KITCHEN',    description: 'Manage kitchen stations and item routing' },
  { name: 'VIEW_SERVICE_DESK',       module: 'KITCHEN',    description: 'View the service-desk dashboard (verify / release / pickup lanes)' },
  { name: 'MANAGE_SERVICE_DESK',     module: 'KITCHEN',    description: 'Act on service-desk lanes (verify postpaid items, release, mark on-its-way / served)' },
  { name: 'VIEW_PARCEL_DESK',        module: 'KITCHEN',    description: 'View the parcel-desk dashboard (pack / handover lanes)' },
  { name: 'MANAGE_PARCEL_DESK',      module: 'KITCHEN',    description: 'Act on parcel-desk lanes (mark packed, mark handed over)' },

  // Inventory & vendors
  { name: 'VIEW_INVENTORY',          module: 'INVENTORY',  description: 'View raw materials and stock levels' },
  { name: 'MANAGE_INVENTORY',        module: 'INVENTORY',  description: 'Create raw materials and record consumption' },
  { name: 'MANAGE_PURCHASE_ORDERS',  module: 'INVENTORY',  description: 'Create and receive purchase orders' },
  { name: 'VIEW_VENDORS',            module: 'INVENTORY',  description: 'View vendors' },
  { name: 'MANAGE_VENDORS',          module: 'INVENTORY',  description: 'Create, update or remove vendors' },

  // Reports
  { name: 'VIEW_REPORTS',            module: 'REPORTS',    description: 'View revenue, item-sales and hourly reports' },
  { name: 'VIEW_KITCHEN_REPORTS',    module: 'REPORTS',    description: 'View kitchen efficiency reports' },

  // Staff & roles
  { name: 'VIEW_STAFF',              module: 'USERS',      description: 'View staff users' },
  { name: 'MANAGE_STAFF',            module: 'USERS',      description: 'Invite, update or toggle staff' },
  { name: 'MANAGE_ROLES',            module: 'USERS',      description: 'Manage custom roles and responsibilities' },

  // Customers
  { name: 'VIEW_CUSTOMERS',          module: 'CUSTOMERS',  description: 'View customer list' },
  { name: 'MANAGE_CUSTOMERS',        module: 'CUSTOMERS',  description: 'Create or update customer records' },
  { name: 'MANAGE_CUSTOMER_TAGS',    module: 'CUSTOMERS',  description: 'Manage customer tags and tag-based pricing' },
  { name: 'ASSIGN_CUSTOMER_TAGS',    module: 'CUSTOMERS',  description: 'Assign tags to customer profiles' },

  // QR codes
  { name: 'VIEW_QR_CODES',           module: 'QR',         description: 'View QR codes for outlet & tables' },
  { name: 'MANAGE_QR_CODES',         module: 'QR',         description: 'Generate or regenerate QR codes' },

  // Disputes
  { name: 'VIEW_DISPUTES',           module: 'DISPUTES',   description: 'View disputes for an outlet' },
  { name: 'MANAGE_DISPUTES',         module: 'DISPUTES',   description: 'Respond to and resolve disputes' },

  // Subscriptions / billing
  { name: 'MANAGE_SUBSCRIPTIONS',    module: 'BILLING',    description: 'Subscribe a business to a plan' },
  { name: 'VIEW_INVOICES',           module: 'BILLING',    description: 'View invoices for a business' },

  // Customer (PWA) capabilities — assigned to the system Customer role
  { name: 'PLACE_CUSTOMER_ORDER',    module: 'CUSTOMER',   description: 'Place orders from the customer app' },
  { name: 'VIEW_OWN_ORDERS',         module: 'CUSTOMER',   description: 'View own order history' },
  { name: 'MANAGE_FAVORITES',        module: 'CUSTOMER',   description: 'Add or remove favorite items' },
  { name: 'RAISE_DISPUTE',           module: 'CUSTOMER',   description: 'Raise a dispute on an order' },
];

async function main() {
  console.log('Seeding database...');

  // ─── Languages ─────────────────────────────────────────────
  await prisma.language.upsert({
    where: { code: 'en' },
    update: { name: 'English', nativeName: 'English', isEnabled: true },
    create: { code: 'en', name: 'English', nativeName: 'English', isEnabled: true },
  });
  await prisma.language.upsert({
    where: { code: 'hi' },
    update: { name: 'Hindi', nativeName: 'हिन्दी', isEnabled: true },
    create: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', isEnabled: true },
  });

  // ─── Responsibilities ─────────────────────────────────────
  const responsibilities = await Promise.all(
    RESPONSIBILITY_DEFS.map((r) =>
      prisma.responsibility.upsert({
        where: { name: r.name },
        update: { module: r.module, description: r.description },
        create: r,
      }),
    ),
  );

  const respByName = new Map(responsibilities.map((r) => [r.name, r]));
  const pick = (names: string[]) =>
    names.map((n) => {
      const r = respByName.get(n);
      if (!r) throw new Error(`Unknown responsibility: ${n}`);
      return { responsibilityId: r.id };
    });

  // ─── Role → responsibility mapping ───────────────────────
  // Outlet-level "everything" set (excludes platform-only powers).
  const OUTLET_FULL = [
    'VIEW_BUSINESSES', 'VIEW_OUTLETS', 'MANAGE_OUTLETS', 'MANAGE_OUTLET_IMAGES', 'MANAGE_OUTLET_HOURS',
    'MANAGE_SECTIONS', 'MANAGE_TABLES', 'MANAGE_TABLE_TYPES',
    'VIEW_MENU', 'MANAGE_MENU', 'MANAGE_MENU_ITEMS', 'TOGGLE_ITEM_AVAILABILITY', 'IMPORT_MENU', 'MANAGE_TOPPINGS',
    'VIEW_ORDERS', 'CREATE_ORDER', 'UPDATE_ORDER_STATUS', 'CANCEL_ORDER', 'UPDATE_ITEM_STATUS', 'VIEW_ORDER_LOG',
    'COLLECT_PAYMENT', 'VIEW_PAYMENTS',
    'VIEW_KITCHEN', 'MANAGE_KITCHEN_STATIONS', 'VIEW_SERVICE_DESK', 'MANAGE_SERVICE_DESK',
    'VIEW_PARCEL_DESK', 'MANAGE_PARCEL_DESK',
    'VIEW_INVENTORY', 'MANAGE_INVENTORY', 'MANAGE_PURCHASE_ORDERS', 'VIEW_VENDORS', 'MANAGE_VENDORS',
    'VIEW_REPORTS', 'VIEW_KITCHEN_REPORTS',
    'VIEW_STAFF', 'MANAGE_STAFF', 'MANAGE_ROLES',
    'VIEW_CUSTOMERS', 'MANAGE_CUSTOMERS', 'MANAGE_CUSTOMER_TAGS', 'ASSIGN_CUSTOMER_TAGS',
    'VIEW_QR_CODES', 'MANAGE_QR_CODES',
    'VIEW_DISPUTES', 'MANAGE_DISPUTES',
    'VIEW_INVOICES',
  ];

  const BUSINESS_OWNER = [
    ...OUTLET_FULL,
    'MANAGE_BUSINESSES', 'MANAGE_BUSINESS_IMAGES', 'MANAGE_SUBSCRIPTIONS',
  ];

  const KITCHEN_MANAGER = [
    'VIEW_MENU', 'TOGGLE_ITEM_AVAILABILITY',
    'VIEW_ORDERS', 'UPDATE_ORDER_STATUS', 'UPDATE_ITEM_STATUS', 'VIEW_ORDER_LOG',
    'VIEW_KITCHEN', 'MANAGE_KITCHEN_STATIONS',
    // Read-only visibility into the service-desk lanes so the kitchen
    // manager can see where their finished output is going. The "Manage"
    // counterpart belongs to the service desk / cashier role.
    'VIEW_SERVICE_DESK',
    'VIEW_INVENTORY', 'MANAGE_INVENTORY',
    'VIEW_KITCHEN_REPORTS',
  ];

  const CASHIER = [
    'VIEW_MENU',
    'VIEW_ORDERS', 'CREATE_ORDER', 'CANCEL_ORDER', 'UPDATE_ORDER_STATUS',
    'COLLECT_PAYMENT', 'VIEW_PAYMENTS',
    'VIEW_CUSTOMERS', 'ASSIGN_CUSTOMER_TAGS',
    'VIEW_QR_CODES',
    'VIEW_SERVICE_DESK', 'MANAGE_SERVICE_DESK',
    'VIEW_PARCEL_DESK', 'MANAGE_PARCEL_DESK',
  ];

  // Dedicated service-desk role for outlets that staff the verify /
  // release / pickup lanes separately from the cashier. Smaller surface
  // than Cashier: no payment collection, no order create. They still
  // need UPDATE_ORDER_STATUS so the lane buttons (release, on-its-way,
  // served) work; the actions go through the regular status PATCH.
  const SERVICE_DESK = [
    'VIEW_MENU',
    'VIEW_ORDERS', 'UPDATE_ORDER_STATUS', 'VIEW_ORDER_LOG',
    'VIEW_SERVICE_DESK', 'MANAGE_SERVICE_DESK',
    'VIEW_CUSTOMERS',
  ];

  // Parcel-desk operator — mirrors SERVICE_DESK but for the parcel
  // pack / handover lanes. Same minimal surface plus the parcel perms.
  const PARCEL_DESK = [
    'VIEW_MENU',
    'VIEW_ORDERS', 'UPDATE_ORDER_STATUS', 'VIEW_ORDER_LOG',
    'VIEW_PARCEL_DESK', 'MANAGE_PARCEL_DESK',
    'VIEW_CUSTOMERS',
  ];

  const STORE_MANAGER = [
    'VIEW_INVENTORY', 'MANAGE_INVENTORY', 'MANAGE_PURCHASE_ORDERS',
    'VIEW_VENDORS', 'MANAGE_VENDORS',
    'VIEW_MENU',
  ];

  const CUSTOMER = [
    'PLACE_CUSTOMER_ORDER', 'VIEW_OWN_ORDERS', 'MANAGE_FAVORITES', 'RAISE_DISPUTE',
  ];

  // Helper: idempotently sync a role + its responsibilities so re-runs refresh
  // the join table when the responsibility set in this file changes.
  async function syncRole(
    args: { id: string; name: string; isSystem?: boolean; isTemplate?: boolean; businessId?: string; description?: string },
    responsibilityNames: string[],
  ) {
    const responsibilitiesCreate = pick(responsibilityNames);
    const role = await prisma.role.upsert({
      where: { id: args.id },
      update: {
        name: args.name,
        isSystem: args.isSystem ?? false,
        isTemplate: args.isTemplate ?? false,
        businessId: args.businessId ?? null,
        description: args.description ?? null,
        responsibilities: { deleteMany: {}, create: responsibilitiesCreate },
      },
      create: {
        id: args.id,
        name: args.name,
        isSystem: args.isSystem ?? false,
        isTemplate: args.isTemplate ?? false,
        businessId: args.businessId,
        description: args.description,
        responsibilities: { create: responsibilitiesCreate },
      },
    });
    return role;
  }

  // ─── Platform Admin ───────────────────────────────────────
  const adminRole = await syncRole(
    { id: 'platform-admin-role', name: 'Platform Admin', isSystem: true },
    RESPONSIBILITY_DEFS
      .filter((r) => r.module !== 'CUSTOMER')
      .map((r) => r.name),
  );

  // ─── Customer (system role for PWA users) ─────────────────
  await syncRole(
    {
      id: 'customer-role',
      name: 'Customer',
      isSystem: true,
      description: 'Default role for customers signing in via the PWA',
    },
    CUSTOMER,
  );

  // ─── Business Owner template ──────────────────────────────
  // Platform-scoped role whose responsibilities are cloned into every new
  // business's Business Owner role. Edits to this template cascade to all
  // existing per-business copies (see roles.service.toggleResponsibility).
  await syncRole(
    {
      id: 'business-owner-template',
      name: 'Business Owner',
      isTemplate: true,
      description: 'Template role. Permissions toggled here become defaults for every new business and cascade to existing ones.',
    },
    BUSINESS_OWNER,
  );

  const adminPassword = await bcrypt.hash('Admin@123', 12);
  await prisma.user.upsert({
    where: { phone: '9000000000' },
    update: {},
    create: {
      name: 'Platform Admin',
      phone: '9000000000',
      email: 'admin@paynpik.com',
      passwordHash: adminPassword,
      roleId: adminRole.id,
    },
  });

  // ─── Demo Business ────────────────────────────────────────
  const starterPlan = await prisma.plan.upsert({
    where: { id: 'plan-starter' },
    update: {},
    create: {
      id: 'plan-starter',
      name: 'Starter',
      monthlyCost: 999,
      annualCost: 9999,
      maxOutlets: 2,
      maxUsers: 10,
      transactionLimit: 5000,
      storageLimit: 5,
      features: { qrOrdering: true, kds: true, pos: true, inventory: false, analytics: false },
    },
  });

  await prisma.plan.upsert({
    where: { id: 'plan-growth' },
    update: {},
    create: {
      id: 'plan-growth',
      name: 'Growth',
      monthlyCost: 2499,
      annualCost: 24999,
      maxOutlets: 10,
      maxUsers: 50,
      transactionLimit: 25000,
      storageLimit: 20,
      features: { qrOrdering: true, kds: true, pos: true, inventory: true, analytics: true },
    },
  });

  await prisma.plan.upsert({
    where: { id: 'plan-enterprise' },
    update: {},
    create: {
      id: 'plan-enterprise',
      name: 'Enterprise',
      monthlyCost: 7999,
      annualCost: 79999,
      maxOutlets: 9999,
      maxUsers: 9999,
      features: { qrOrdering: true, kds: true, pos: true, inventory: true, analytics: true, whatsapp: true, onlineOrdering: true },
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      planId: starterPlan.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const demoBusiness = await prisma.business.upsert({
    where: { id: 'demo-business' },
    update: {},
    create: {
      id: 'demo-business',
      name: 'Demo Restaurant',
      businessType: BusinessType.RESTAURANT,
      gstNumber: '29ABCDE1234F1Z5',
      subscriptionId: subscription.id,
    },
  });

  const businessOwnerRole = await syncRole(
    { id: 'business-owner-role', name: 'Business Owner', businessId: demoBusiness.id },
    BUSINESS_OWNER,
  );

  const outletRole = await syncRole(
    { id: 'outlet-admin-role', name: 'Outlet Admin', businessId: demoBusiness.id },
    OUTLET_FULL,
  );

  const ownerPassword = await bcrypt.hash('Owner@123', 12);
  await prisma.user.upsert({
    where: { phone: '9876543210' },
    update: {},
    create: {
      name: 'Demo Owner',
      phone: '9876543210',
      email: 'owner@demo.com',
      passwordHash: ownerPassword,
      businessId: demoBusiness.id,
      roleId: businessOwnerRole.id,
    },
  });

  const demoOutlet = await prisma.outlet.upsert({
    where: { id: 'demo-outlet' },
    update: {},
    create: {
      id: 'demo-outlet',
      name: 'Demo Outlet - Koramangala',
      businessId: demoBusiness.id,
      outletType: OutletType.DINE_IN_POSTPAID,
      address: '123, 80 Feet Road, Koramangala, Bengaluru - 560034',
      gstNumber: '29ABCDE1234F1Z5',
    },
  });

  const section = await prisma.section.upsert({
    where: { id: 'demo-section-main' },
    update: {},
    create: { id: 'demo-section-main', name: 'Main Hall', outletId: demoOutlet.id },
  });

  for (let i = 1; i <= 10; i++) {
    await prisma.table.upsert({
      where: { id: `table-${i}` },
      update: {},
      create: {
        id: `table-${i}`,
        number: `T${String(i).padStart(2, '0')}`,
        capacity: i <= 5 ? 2 : 4,
        sectionId: section.id,
        outletId: demoOutlet.id,
      },
    });
  }

  // ─── Demo Menu ────────────────────────────────────────────
  // All categories / subcategories / items below use stable IDs +
  // upsert so re-running `npm run db:seed` (which is mandatory after
  // adding new responsibilities) doesn't duplicate the menu. Variants
  // ride on the item's nested-create, which only fires on first
  // insert — subsequent runs leave existing variants untouched.
  const breakfastCat = await prisma.category.upsert({
    where: { id: 'demo-cat-breakfast' },
    update: {},
    create: { id: 'demo-cat-breakfast', name: 'Breakfast', outletId: demoOutlet.id, displayOrder: 1 },
  });
  const mainsCat = await prisma.category.upsert({
    where: { id: 'demo-cat-mains' },
    update: {},
    create: { id: 'demo-cat-mains', name: 'Main Course', outletId: demoOutlet.id, displayOrder: 2 },
  });
  const beveragesCat = await prisma.category.upsert({
    where: { id: 'demo-cat-beverages' },
    update: {},
    create: { id: 'demo-cat-beverages', name: 'Beverages', outletId: demoOutlet.id, displayOrder: 3 },
  });

  const southIndianSub = await prisma.subcategory.upsert({
    where: { id: 'demo-sub-south-indian' },
    update: {},
    create: { id: 'demo-sub-south-indian', name: 'South Indian', categoryId: breakfastCat.id, displayOrder: 1 },
  });
  const northIndianSub = await prisma.subcategory.upsert({
    where: { id: 'demo-sub-north-indian' },
    update: {},
    create: { id: 'demo-sub-north-indian', name: 'North Indian', categoryId: mainsCat.id, displayOrder: 1 },
  });
  const hotBeveragesSub = await prisma.subcategory.upsert({
    where: { id: 'demo-sub-hot-beverages' },
    update: {},
    create: { id: 'demo-sub-hot-beverages', name: 'Hot Beverages', categoryId: beveragesCat.id, displayOrder: 1 },
  });

  const dosa = await prisma.item.upsert({
    where: { id: 'demo-item-masala-dosa' },
    update: {},
    create: {
      id: 'demo-item-masala-dosa',
      name: 'Masala Dosa',
      description: 'Crispy dosa with spiced potato filling',
      basePrice: 80,
      preparationTime: 10,
      isPopular: true,
      subcategoryId: southIndianSub.id,
      variants: {
        create: [
          { name: 'Regular', price: 80 },
          { name: 'Ghee Dosa', price: 100 },
          { name: 'Paper Roast', price: 120 },
        ],
      },
    },
  });

  await prisma.item.upsert({
    where: { id: 'demo-item-idli' },
    update: {},
    create: {
      id: 'demo-item-idli',
      name: 'Idli (2 Pcs)',
      basePrice: 50,
      preparationTime: 8,
      subcategoryId: southIndianSub.id,
    },
  });

  await prisma.item.upsert({
    where: { id: 'demo-item-butter-chicken' },
    update: {},
    create: {
      id: 'demo-item-butter-chicken',
      name: 'Butter Chicken',
      basePrice: 280,
      preparationTime: 20,
      isPopular: true,
      subcategoryId: northIndianSub.id,
    },
  });

  await prisma.item.upsert({
    where: { id: 'demo-item-paneer-butter-masala' },
    update: {},
    create: {
      id: 'demo-item-paneer-butter-masala',
      name: 'Paneer Butter Masala',
      basePrice: 240,
      preparationTime: 18,
      subcategoryId: northIndianSub.id,
    },
  });

  await prisma.item.upsert({
    where: { id: 'demo-item-filter-coffee' },
    update: {},
    create: {
      id: 'demo-item-filter-coffee',
      name: 'Filter Coffee',
      basePrice: 40,
      preparationTime: 3,
      isPopular: true,
      subcategoryId: hotBeveragesSub.id,
      variants: {
        create: [
          { name: 'Small', price: 40 },
          { name: 'Large', price: 60 },
        ],
      },
    },
  });

  // ─── Outlet-level roles & demo staff ────────────────────────
  const kitchenRole = await syncRole(
    { id: 'kitchen-manager-role', name: 'Kitchen Manager', businessId: demoBusiness.id },
    KITCHEN_MANAGER,
  );

  const cashierRole = await syncRole(
    { id: 'cashier-role', name: 'Cashier', businessId: demoBusiness.id },
    CASHIER,
  );

  const storeRole = await syncRole(
    { id: 'store-manager-role', name: 'Store Manager', businessId: demoBusiness.id },
    STORE_MANAGER,
  );

  // Dedicated service-desk staff role on the demo business. Outlets
  // running the verify / release / pickup workflow as a separate
  // function from the cashier can assign staff here.
  const serviceDeskRole = await syncRole(
    { id: 'service-desk-role', name: 'Service Desk', businessId: demoBusiness.id },
    SERVICE_DESK,
  );

  const parcelDeskRole = await syncRole(
    { id: 'parcel-desk-role', name: 'Parcel Desk', businessId: demoBusiness.id },
    PARCEL_DESK,
  );

  const outletAdminPassword = await bcrypt.hash('Outlet@123', 12);
  await prisma.user.upsert({
    where: { phone: '9999000000' },
    update: {},
    create: {
      name: 'Demo Outlet Admin',
      phone: '9999000000',
      email: 'outlet@demo.com',
      passwordHash: outletAdminPassword,
      businessId: demoBusiness.id,
      outletId: demoOutlet.id,
      roleId: outletRole.id,
    },
  });

  // Also re-pin the outlet admin user's role/business in case of stale data.
  await prisma.user.update({
    where: { phone: '9999000000' },
    data: { roleId: outletRole.id, businessId: demoBusiness.id, outletId: demoOutlet.id },
  });

  // And the business owner.
  await prisma.user.update({
    where: { phone: '9876543210' },
    data: { roleId: businessOwnerRole.id, businessId: demoBusiness.id },
  });

  const chefPassword = await bcrypt.hash('Chef@123', 12);
  await prisma.user.upsert({
    where: { phone: '9111000001' },
    update: { roleId: kitchenRole.id, businessId: demoBusiness.id, outletId: demoOutlet.id },
    create: {
      name: 'Demo Chef',
      phone: '9111000001',
      email: 'chef@demo.com',
      passwordHash: chefPassword,
      businessId: demoBusiness.id,
      outletId: demoOutlet.id,
      roleId: kitchenRole.id,
    },
  });

  await prisma.user.upsert({
    where: { phone: '9111000004' },
    update: { roleId: kitchenRole.id, businessId: demoBusiness.id, outletId: demoOutlet.id },
    create: {
      name: 'Vinod Chef',
      phone: '9111000004',
      email: 'vinod@demo.com',
      passwordHash: chefPassword,
      businessId: demoBusiness.id,
      outletId: demoOutlet.id,
      roleId: kitchenRole.id,
    },
  });

  const cashierPassword = await bcrypt.hash('Cash@123', 12);
  await prisma.user.upsert({
    where: { phone: '9111000002' },
    update: { roleId: cashierRole.id, businessId: demoBusiness.id, outletId: demoOutlet.id },
    create: {
      name: 'Demo Cashier',
      phone: '9111000002',
      email: 'cashier@demo.com',
      passwordHash: cashierPassword,
      businessId: demoBusiness.id,
      outletId: demoOutlet.id,
      roleId: cashierRole.id,
    },
  });

  const storePassword = await bcrypt.hash('Store@123', 12);
  await prisma.user.upsert({
    where: { phone: '9111000003' },
    update: { roleId: storeRole.id, businessId: demoBusiness.id, outletId: demoOutlet.id },
    create: {
      name: 'Demo Store Manager',
      phone: '9111000003',
      email: 'store@demo.com',
      passwordHash: storePassword,
      businessId: demoBusiness.id,
      outletId: demoOutlet.id,
      roleId: storeRole.id,
    },
  });

  console.log('Seeding complete!');
  console.log('─────────────────────────────────────');
  console.log(`Responsibilities loaded → ${responsibilities.length}`);
  console.log('Platform Admin  → 9000000000 / Admin@123');
  console.log('Business Owner  → 9876543210 / Owner@123');
  console.log('Outlet Admin    → 9999000000 / Outlet@123');
  console.log('Kitchen Manager → 9111000001 / Chef@123');
  console.log('Kitchen Manager → 9111000004 / Chef@123  (Vinod Chef)');
  console.log('Cashier         → 9111000002 / Cash@123');
  console.log('Store Manager   → 9111000003 / Store@123');
  console.log('Demo outlet ID  → demo-outlet');
  console.log('─────────────────────────────────────');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
