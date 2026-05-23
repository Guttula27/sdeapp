import { OutletType } from '@prisma/client';

// Outlet types where guests don't sit down — no tables, sections, or
// table types apply. Mirror this list in apps/web/src/utils/outletType.ts.
export const NO_SEATING_OUTLET_TYPES: ReadonlySet<OutletType> = new Set<OutletType>([
  OutletType.SELF_SERVICE,
  OutletType.SELF_SERVICE_PARCEL,
]);

export function allowsSeating(t: OutletType | null | undefined): boolean {
  return !!t && !NO_SEATING_OUTLET_TYPES.has(t);
}
