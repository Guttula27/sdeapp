// Cluster cart persistence — sessionStorage-backed so the cart survives
// navigations between the cluster shell and the item detail page.
// Keyed per cluster (multi-cluster customers — eat at Phoenix Mall today,
// Inorbit tomorrow — keep separate carts).

export interface ClusterCartTopping {
  toppingId: string;
  optionId?: string;
  label: string;     // human-readable e.g. "Spicy: Medium"
  priceAdd: number;
}

export interface ClusterCartLine {
  // Stable composite key: outlet + item + variant + sorted topping sig.
  // Ensures "Masala Dosa with extra cheese" and "Masala Dosa" stack as
  // separate lines.
  cartLineId: string;
  outletId: string;
  outletName: string;
  itemId: string;
  itemName: string;
  variantId?: string | null;
  variantName?: string | null;
  unitPrice: number;
  quantity: number;
  toppings?: ClusterCartTopping[];
}

const KEY = (clusterId: string) => `cluster-cart-${clusterId}`;

export function readClusterCart(clusterId: string): ClusterCartLine[] {
  if (!clusterId) return [];
  try {
    return JSON.parse(sessionStorage.getItem(KEY(clusterId)) || '[]');
  } catch {
    return [];
  }
}

export function writeClusterCart(clusterId: string, lines: ClusterCartLine[]) {
  if (!clusterId) return;
  try {
    sessionStorage.setItem(KEY(clusterId), JSON.stringify(lines));
  } catch {
    /* quota — best effort */
  }
}

export function makeClusterLineId(
  outletId: string,
  itemId: string,
  variantId: string | null | undefined,
  toppings: ClusterCartTopping[] | undefined,
): string {
  const t = (toppings || [])
    .map((tp) => `${tp.toppingId}:${tp.optionId || ''}`)
    .sort()
    .join('|');
  return `${outletId}-${itemId}-${variantId || ''}-${t}`;
}

// Upsert helper — returns the next cart array. Pure, no side effects.
export function upsertLine(
  prev: ClusterCartLine[],
  line: ClusterCartLine,
  delta: number,
): ClusterCartLine[] {
  const idx = prev.findIndex((p) => p.cartLineId === line.cartLineId);
  if (idx === -1) {
    if (delta <= 0) return prev;
    return [...prev, { ...line, quantity: delta }];
  }
  const next = [...prev];
  const q = next[idx].quantity + delta;
  if (q <= 0) next.splice(idx, 1);
  else next[idx] = { ...next[idx], quantity: q };
  return next;
}
