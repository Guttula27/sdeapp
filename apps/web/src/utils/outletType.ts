// Mirror of apps/api/src/common/outlet-type.ts. Keep in sync.
export const NO_SEATING_OUTLET_TYPES = new Set<string>([
  'SELF_SERVICE',
  'SELF_SERVICE_PARCEL',
]);

export function allowsSeating(t: string | null | undefined): boolean {
  return !!t && !NO_SEATING_OUTLET_TYPES.has(t);
}
