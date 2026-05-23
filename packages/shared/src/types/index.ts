// ─── Enums (mirrored from Prisma for frontend use) ──────────

export enum OrderStatus {
  NEW = 'NEW',
  ACCEPTED = 'ACCEPTED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
}

export enum PaymentMode {
  UPI = 'UPI',
  CARD = 'CARD',
  CASH = 'CASH',
  WALLET = 'WALLET',
  NET_BANKING = 'NET_BANKING',
}

export enum OutletType {
  SELF_SERVICE = 'SELF_SERVICE',
  SELF_SERVICE_PARCEL = 'SELF_SERVICE_PARCEL',
  DINE_IN_PREPAID = 'DINE_IN_PREPAID',
  DINE_IN_POSTPAID = 'DINE_IN_POSTPAID',
  HYBRID = 'HYBRID',
}

// ─── API Response ─────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Domain Types ─────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  role?: Role;
  businessId?: string;
  outletId?: string;
}

export interface Role {
  id: string;
  name: string;
  responsibilities?: RoleResponsibility[];
}

export interface RoleResponsibility {
  responsibility: {
    id: string;
    name: string;
    module: string;
  };
}

export interface Business {
  id: string;
  name: string;
  gstNumber?: string;
  businessType: string;
  status: string;
  subscription?: Subscription;
}

export interface Outlet {
  id: string;
  name: string;
  outletType: OutletType;
  address?: string;
  gstNumber?: string;
  isActive: boolean;
  businessId: string;
}

export interface Category {
  id: string;
  name: string;
  imageUrl?: string;
  displayOrder: number;
  isActive: boolean;
  subcategories: Subcategory[];
}

export interface Subcategory {
  id: string;
  name: string;
  displayOrder: number;
  items: Item[];
}

export interface Item {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  basePrice: number;
  parcelCharge?: number;
  preparationTime?: number;
  isAvailable: boolean;
  isDisplayed: boolean;
  isPopular: boolean;
  variants: Variant[];
  options: Option[];
  tags: ItemTag[];
}

export interface Variant {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
}

export interface Option {
  id: string;
  name: string;
  price: number;
}

export interface ItemTag {
  id: string;
  name: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  isParcel: boolean;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  items: OrderItem[];
  table?: Table;
  customer?: Partial<User>;
  payments: Payment[];
  createdAt: string;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  item: Item;
  variant?: Variant;
  notes?: string;
}

export interface Table {
  id: string;
  number: string;
  capacity: number;
  sectionId: string;
}

export interface Payment {
  id: string;
  amount: number;
  mode: PaymentMode;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  gatewayRef?: string;
}

export interface Plan {
  id: string;
  name: string;
  monthlyCost: number;
  annualCost: number;
  maxOutlets: number;
  maxUsers: number;
  features: Record<string, boolean>;
}

export interface Subscription {
  id: string;
  status: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  startDate: string;
  endDate: string;
  plan: Plan;
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderLevel?: number;
  costPerUnit?: number;
}

export interface Vendor {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  isActive: boolean;
}
