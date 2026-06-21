// Tiny Web-Bluetooth ESC/POS printer helper. Used by the kitchen page to
// auto-print or manually print kitchen tickets to a paired bluetooth
// thermal printer.
//
// Pairing requires a user gesture (Bluetooth API contract), so the page
// exposes a "Connect printer" button. Once paired, the device handle is
// cached in this module for subsequent silent prints — at least until the
// browser disconnects (tab close / sleep). On disconnect the user re-pairs.
//
// We don't lock down the service UUID: many cheap thermal printers expose
// the standard ESC/POS service 000018f0, but some clones publish a custom
// one. We scan the device's primary services for any characteristic with
// `write` or `writeWithoutResponse` and use the first one we find.

const SCAN_SERVICE = '000018f0-0000-1000-8000-00805f9b34fb';

type Handle = {
  device: any;
  characteristic: any;
};

const handles = new Map<string, Handle>();

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
}

export function isPrinterConnected(printerId: string): boolean {
  const h = handles.get(printerId);
  return !!(h && h.device?.gatt?.connected);
}

// Returns true if we have a live device reference for this printer even
// if the GATT layer is currently disconnected. A device ref means the
// browser still remembers the pairing and we can call gatt.connect()
// without a fresh user gesture (only requestDevice needs one).
export function isPrinterPaired(printerId: string): boolean {
  return handles.has(printerId);
}

// Reconnect a previously-paired printer without a user gesture. Web
// Bluetooth disconnects on idle / sleep / device-out-of-range; the
// pairing itself survives, so we can call gatt.connect() on the cached
// device ref. Throws if we never paired (the caller should fall back to
// connectPrinter for a user-gesture pairing prompt). Auto-print relies
// on this — the order arrives long after the page loaded and the BLE
// layer has typically gone idle by then.
export async function ensurePrinterConnected(printerId: string): Promise<void> {
  const h = handles.get(printerId);
  if (!h) throw new Error('Printer not paired — tap "Connect printer" first');
  if (h.device?.gatt?.connected) return;
  await h.device.gatt.connect();
  // After a reconnect the previous characteristic handle is invalid; re-
  // resolve a writable characteristic against the freshly-opened GATT
  // services. Mirrors connectPrinter's scan logic.
  const services = await h.device.gatt.getPrimaryServices();
  let chosen: any = null;
  outer: for (const svc of services) {
    const chars = await svc.getCharacteristics();
    for (const ch of chars) {
      if (ch.properties.write || ch.properties.writeWithoutResponse) {
        chosen = ch;
        break outer;
      }
    }
  }
  if (!chosen) throw new Error('No writable characteristic found after reconnect');
  h.characteristic = chosen;
}

// User-gesture call. Opens the browser's BT chooser, lets the operator
// pick the printer this station should use, then resolves once we have a
// writable characteristic.
export async function connectPrinter(printerId: string): Promise<void> {
  if (!isBluetoothSupported()) throw new Error('Web Bluetooth not supported');
  const nav: any = navigator;
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [SCAN_SERVICE],
  });
  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  let chosen: any = null;
  outer: for (const svc of services) {
    const chars = await svc.getCharacteristics();
    for (const ch of chars) {
      if (ch.properties.write || ch.properties.writeWithoutResponse) {
        chosen = ch;
        break outer;
      }
    }
  }
  if (!chosen) throw new Error('No writable characteristic found on device');
  handles.set(printerId, { device, characteristic: chosen });
  device.addEventListener('gattserverdisconnected', () => handles.delete(printerId));
}

async function writeBytes(printerId: string, bytes: Uint8Array): Promise<void> {
  const h = handles.get(printerId);
  if (!h) throw new Error('Printer not connected — tap "Connect printer" first');
  // BLE MTU caps writes to ~20 bytes on many devices; chunk to be safe.
  const chunk = 64;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.slice(i, i + chunk);
    if (h.characteristic.properties.writeWithoutResponse) {
      await h.characteristic.writeValueWithoutResponse(slice);
    } else {
      await h.characteristic.writeValue(slice);
    }
  }
}

// ESC/POS receipt builder. Plain-ASCII text only — works on the cheapest
// thermal printers without code-page handshakes. Anything outside ASCII is
// approximated to '?' so the print head doesn't choke.
function asAscii(s: string): string {
  return s.replace(/[^\x20-\x7E\n]/g, '?');
}

export type ReceiptLine = {
  itemName: string;
  variantName: string | null;
  toppings: string | null;
  quantity: number;
  notes: string | null;
};

export type ReceiptPayload = {
  orderNumber: string;
  tokenNumber: number | null;
  outletName: string;
  table: string | null;
  section: string | null;
  isParcel: boolean;
  stationName: string;
  printedAt: string;
  lines: ReceiptLine[];
};

function buildEscPos(r: ReceiptPayload): Uint8Array {
  const enc = new TextEncoder();
  const ESC = 0x1b;
  const GS = 0x1d;
  const buf: number[] = [];
  const push = (s: string) => { for (const c of enc.encode(asAscii(s))) buf.push(c); };
  const cmd = (...b: number[]) => { for (const c of b) buf.push(c); };

  cmd(ESC, 0x40);          // init
  cmd(ESC, 0x61, 0x01);    // center
  cmd(ESC, 0x21, 0x30);    // double w/h
  push(r.stationName.toUpperCase() + '\n');
  cmd(ESC, 0x21, 0x00);    // normal
  push(r.outletName + '\n');
  push('--------------------------------\n');
  cmd(ESC, 0x21, 0x30);
  if (r.tokenNumber != null) push(`TOKEN #${r.tokenNumber}\n`);
  cmd(ESC, 0x21, 0x00);
  cmd(ESC, 0x61, 0x00);    // left
  push(`Order: ${r.orderNumber}\n`);
  if (r.table) push(`Table: ${r.table}${r.section ? ` (${r.section})` : ''}\n`);
  else if (r.isParcel) push('PARCEL\n');
  else if (r.section) push(`Service desk: ${r.section}\n`);
  push(`Time: ${new Date(r.printedAt).toLocaleTimeString()}\n`);
  push('--------------------------------\n');
  for (const li of r.lines) {
    cmd(ESC, 0x21, 0x10);  // double height
    push(`${li.quantity} x ${li.itemName}\n`);
    cmd(ESC, 0x21, 0x00);
    if (li.variantName) push(`   ${li.variantName}\n`);
    if (li.toppings) push(`   + ${li.toppings}\n`);
    if (li.notes) push(`   * ${li.notes}\n`);
  }
  push('--------------------------------\n');
  cmd(ESC, 0x64, 0x04);    // feed 4 lines
  cmd(GS, 0x56, 0x00);     // full cut

  return new Uint8Array(buf);
}

export async function printReceipt(printerId: string, receipt: ReceiptPayload): Promise<void> {
  const bytes = buildEscPos(receipt);
  await writeBytes(printerId, bytes);
}

// ── Customer bill ──────────────────────────────────────────────────────
// Distinct from the kitchen-station ticket — this is the full customer
// receipt with prices, discounts, GST split (CGST+SGST or IGST), and
// grand total. Same ESC/POS sequence, 32-char width tuned for a 58mm
// roll (most common thermal printer); 80mm rolls render with right-
// justified amounts that still line up by virtue of the rune-padding
// below.
export type ReceiptItemLine = {
  itemName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  // When set, this line represents a combo / bundle — the children
  // are listed beneath the parent line, indented, and the parent's
  // quantity / amount are the combo's totals (children are display-
  // only, no separate price column).
  bundleChildren?: Array<{
    itemName: string;
    variantName?: string | null;
    quantity: number;
  }>;
};

export type ReceiptDiscountLine = {
  label: string;
  amount: number;
};

export type CustomerReceiptPayload = {
  orderNumber: string;
  tokenNumber: number | null;
  printedAt: string;
  outletName: string;
  outletAddress?: string[];      // each line rendered separately
  outletGstin?: string | null;
  outletPhone?: string | null;
  customerName?: string | null;
  table?: string | null;
  isParcel?: boolean;

  items: ReceiptItemLine[];
  subtotal: number;
  parcelCharge?: number;
  discounts: ReceiptDiscountLine[];      // each rendered as -₹X
  taxable: number;                       // subtotal - discount
  // Either cgst+sgst pair (intra-state) or igst alone (inter-state).
  // Legacy single-rate fields — kept for back-compat with older receipt
  // payloads / cached snapshots. Multi-rate carts populate `taxLines`
  // below; when present, the printer renders one CGST/SGST row per
  // unique GST rate (food at 5% + beverages at 18% each get their own
  // line) and the single-rate fields are ignored.
  cgst?: number;
  sgst?: number;
  igst?: number;
  gstPct?: number;                       // total %, used for "CGST 2.5%" label
  // Per-GST-rate breakdown. Each entry sums the items on the order
  // that snapshotted the same OrderItem.gstRate. For intra-state
  // orders `cgst` and `sgst` are populated (half the group's tax
  // each); for inter-state `igst` carries the full group tax.
  taxLines?: Array<{
    rate: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    gstAmount: number;
  }>;
  roundOff?: number;
  total: number;
  paidVia?: string | null;
};

const W = 32; // 58mm thermal char width — works on 80mm too with safe margins
function pad(left: string, right: string, width = W): string {
  const l = asAscii(left);
  const r = asAscii(right);
  const free = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(free) + r;
}
function dash(width = W) { return '-'.repeat(width); }
function fmt(n: number): string { return n.toFixed(2); }

function buildCustomerEscPos(r: CustomerReceiptPayload): Uint8Array {
  const enc = new TextEncoder();
  const ESC = 0x1b;
  const GS = 0x1d;
  const buf: number[] = [];
  const push = (s: string) => { for (const c of enc.encode(asAscii(s))) buf.push(c); };
  const cmd = (...b: number[]) => { for (const c of b) buf.push(c); };

  cmd(ESC, 0x40);          // init
  cmd(ESC, 0x61, 0x01);    // center
  cmd(ESC, 0x21, 0x30);    // double w/h
  push(r.outletName.toUpperCase() + '\n');
  cmd(ESC, 0x21, 0x00);    // normal
  for (const line of r.outletAddress ?? []) push(line + '\n');
  if (r.outletPhone) push('Tel: ' + r.outletPhone + '\n');
  if (r.outletGstin)  push('GSTIN: ' + r.outletGstin + '\n');

  cmd(ESC, 0x61, 0x00);    // left
  push('\n' + dash() + '\n');
  if (r.customerName) push('Name : ' + r.customerName + '\n');
  push('Bill : ' + r.orderNumber + '\n');
  if (r.tokenNumber != null) push('Token: #' + r.tokenNumber + '\n');
  if (r.table) push('Table: ' + r.table + '\n');
  else if (r.isParcel) push('Type : PARCEL\n');
  push('Date : ' + new Date(r.printedAt).toLocaleString('en-IN') + '\n');
  push(dash() + '\n');

  push(pad('Item', 'Amt') + '\n');
  push(dash() + '\n');
  for (const it of r.items) {
    push(`${it.quantity} x ${it.itemName}\n`);
    if (it.variantName) push(`   ${it.variantName}\n`);
    push(pad(`   @ ${fmt(it.unitPrice)}`, fmt(it.totalPrice)) + '\n');
    // Combo expansion — indent each sub-item beneath its combo line
    // so the customer sees what came in the combo without the bill
    // listing every child as a separate priced row.
    if (it.bundleChildren?.length) {
      for (const ch of it.bundleChildren) {
        const variant = ch.variantName ? ` (${ch.variantName})` : '';
        push(`     - ${ch.itemName}${variant} x ${ch.quantity}\n`);
      }
    }
  }
  push(dash() + '\n');

  push(pad('Sub Total', fmt(r.subtotal)) + '\n');
  if (r.parcelCharge && r.parcelCharge > 0) {
    push(pad('Parcel', fmt(r.parcelCharge)) + '\n');
  }
  for (const d of r.discounts) {
    push(pad(d.label, '-' + fmt(d.amount)) + '\n');
  }
  if (r.discounts.length > 0) {
    push(pad('Taxable', fmt(r.taxable)) + '\n');
  }
  // GST split — per-rate when the order has items snapshotted at
  // different rates (food at 5% + beverages at 18%), single-rate
  // fallback for the common case + legacy payloads.
  // Always two decimals so half-rates like 2.5% never round up to 3%
  // and the printed rate matches the Indian GST receipt convention.
  const fmtPct = (n: number) => n.toFixed(2);
  if (r.taxLines && r.taxLines.length > 0) {
    for (const tl of r.taxLines) {
      if (tl.cgst != null && tl.sgst != null) {
        const half = fmtPct(tl.rate / 2);
        push(pad(`CGST ${half}%`, fmt(tl.cgst)) + '\n');
        push(pad(`SGST ${half}%`, fmt(tl.sgst)) + '\n');
      } else if (tl.igst != null) {
        const full = fmtPct(tl.rate);
        push(pad(`IGST ${full}%`, fmt(tl.igst)) + '\n');
      }
    }
  } else if (r.cgst != null && r.sgst != null && (r.cgst > 0 || r.sgst > 0)) {
    // Legacy single-rate fallback. Same 2-decimal rule as the
    // multi-rate path so a half-rate (2.5%) never prints as 3%.
    const half = ((r.gstPct ?? 0) / 2).toFixed(2);
    push(pad(`CGST ${half}%`, fmt(r.cgst)) + '\n');
    push(pad(`SGST ${half}%`, fmt(r.sgst)) + '\n');
  } else if (r.igst && r.igst > 0) {
    const full = (r.gstPct ?? 0).toFixed(2);
    push(pad(`IGST ${full}%`, fmt(r.igst)) + '\n');
  }
  if (r.roundOff && r.roundOff !== 0) {
    push(pad('Round off', (r.roundOff > 0 ? '+' : '-') + fmt(Math.abs(r.roundOff))) + '\n');
  }

  push(dash() + '\n');
  cmd(ESC, 0x21, 0x10);    // double height
  push(pad('TOTAL', '₹' + fmt(r.total)) + '\n');
  cmd(ESC, 0x21, 0x00);
  if (r.paidVia) push('Paid: ' + r.paidVia + '\n');

  push(dash() + '\n');
  cmd(ESC, 0x61, 0x01);    // center
  push('Thank you, visit again!\n');

  cmd(ESC, 0x64, 0x04);    // feed 4 lines
  cmd(GS, 0x56, 0x00);     // full cut
  return new Uint8Array(buf);
}

export async function printCustomerReceipt(
  printerId: string,
  receipt: CustomerReceiptPayload,
): Promise<void> {
  const bytes = buildCustomerEscPos(receipt);
  await writeBytes(printerId, bytes);
}

// ── Aggregator packing slip ────────────────────────────────────────
// Used for delivery orders that came in via Zomato / Swiggy / Uber Eats.
// Two reasons we don't print the regular customer receipt here:
//   1. The customer already paid the aggregator at a marketplace price
//      that's typically different from our outlet price (commissions /
//      menu markups). Showing OUR price on the parcel would confuse the
//      customer at delivery.
//   2. GST on aggregator orders is collected by the marketplace, not us.
//      Putting our GSTIN + tax breakup on a parcel is misleading.
//
// The slip is a packing checklist — items, variants, toppings, quantities,
// customer notes. It's stapled to the bag so the delivery rider and the
// customer can verify the parcel without seeing prices.
export type PackingSlipItemLine = {
  itemName: string;
  variantName?: string | null;
  toppings?: string | null;
  quantity: number;
  notes?: string | null;
};

export type PackingSlipPayload = {
  orderNumber: string;
  channel: string;                 // ZOMATO / SWIGGY / UBER_EATS — shown bold at the top
  tokenNumber?: number | null;
  externalOrderId?: string | null; // The aggregator's order id — what the rider's app shows
  printedAt: string;
  outletName: string;
  customerName?: string | null;
  customerPhone?: string | null;   // Usually masked by the aggregator (e.g. "+91 99999XXXXX")
  items: PackingSlipItemLine[];
  customerNotes?: string | null;   // "Less spicy", "no onion" etc. — surfaces on its own line
};

function buildPackingSlipEscPos(r: PackingSlipPayload): Uint8Array {
  const enc = new TextEncoder();
  const ESC = 0x1b;
  const GS = 0x1d;
  const buf: number[] = [];
  const push = (s: string) => { for (const c of enc.encode(asAscii(s))) buf.push(c); };
  const cmd = (...b: number[]) => { for (const c of b) buf.push(c); };

  cmd(ESC, 0x40);          // init
  cmd(ESC, 0x61, 0x01);    // center
  cmd(ESC, 0x21, 0x30);    // double w/h
  push(r.channel.toUpperCase() + '\n');
  cmd(ESC, 0x21, 0x00);
  push(r.outletName + '\n');
  push(dash() + '\n');
  cmd(ESC, 0x21, 0x30);
  if (r.tokenNumber != null) push(`TOKEN #${r.tokenNumber}\n`);
  cmd(ESC, 0x21, 0x00);
  cmd(ESC, 0x61, 0x00);    // left
  push(`Order: ${r.orderNumber}\n`);
  if (r.externalOrderId) push(`${r.channel} ID: ${r.externalOrderId}\n`);
  if (r.customerName) push(`Customer: ${r.customerName}\n`);
  if (r.customerPhone) push(`Phone: ${r.customerPhone}\n`);
  push(`Time: ${new Date(r.printedAt).toLocaleTimeString()}\n`);
  push(dash() + '\n');

  // Items — same emphasis as the kitchen ticket since this slip
  // doubles as a packing checklist. Quantity is the eye-catching part.
  for (const li of r.items) {
    cmd(ESC, 0x21, 0x10);  // double height
    push(`${li.quantity} x ${li.itemName}\n`);
    cmd(ESC, 0x21, 0x00);
    if (li.variantName) push(`   ${li.variantName}\n`);
    if (li.toppings) push(`   + ${li.toppings}\n`);
    if (li.notes) push(`   * ${li.notes}\n`);
  }
  push(dash() + '\n');

  if (r.customerNotes) {
    cmd(ESC, 0x21, 0x10);
    push('NOTE:\n');
    cmd(ESC, 0x21, 0x00);
    // Word-wrap to the receipt width so long notes don't get clipped
    // by the printer's hard line break.
    const words = r.customerNotes.split(/\s+/);
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).trim().length > W) {
        push(line + '\n');
        line = w;
      } else {
        line = (line ? line + ' ' : '') + w;
      }
    }
    if (line) push(line + '\n');
    push(dash() + '\n');
  }

  cmd(ESC, 0x61, 0x01);    // center
  push('Attach this slip to the parcel.\n');
  push('Prices are with the aggregator app.\n');

  cmd(ESC, 0x64, 0x04);    // feed 4 lines
  cmd(GS, 0x56, 0x00);     // full cut
  return new Uint8Array(buf);
}

export async function printPackingSlip(
  printerId: string,
  slip: PackingSlipPayload,
): Promise<void> {
  const bytes = buildPackingSlipEscPos(slip);
  await writeBytes(printerId, bytes);
}
