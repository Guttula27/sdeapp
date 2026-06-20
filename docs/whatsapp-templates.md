# WhatsApp / SMS Templates

Single source of truth for every customer-facing message the platform
sends. Every entry must be approved on the WhatsApp Business API
console (Meta) before it can be delivered through a real provider; SMS
versions are typically auto-allowed but still listed here for parity.

## How this file is used

1. **Approval submissions** — copy the Body for the trigger you want
   to enable and paste it into the WABA console's template form. Use
   the listed Category (UTILITY / MARKETING / etc.) and the documented
   parameter list.
2. **Operator customisation** — outlets can override any of these via
   `Settings → Messaging → Templates`. The platform default in this
   file is the fallback when no outlet/business override exists
   (`lifecycle-dispatcher.service.ts:117`).
3. **Adding a new message** — append a new section to this file FIRST,
   then ship the code that fires it. The PR description should
   reference the new template name + the WABA approval status.

The runtime renderer is `render()` in `lifecycle-dispatcher.service.ts`.
Markers use `{{name}}` syntax and resolve from the `Ctx` object passed
to `LifecycleDispatcherService.fire()`; unknown markers render as an
empty string (no error thrown), so a missing optional value collapses
gracefully.

---

## Marker catalogue

These tokens are available across every template. Implementers fill
them on the `Ctx` object before calling `dispatcher.fire(trigger, ctx)`.

| Marker | Source | Notes |
|---|---|---|
| `{{customer_name}}` | `ctx.customerName` or `User.name` fallback | First name preferred where the provider allows segmentation |
| `{{order_number}}` | `ctx.orderNumber` | The customer-visible ON-XXX / OFF-XXX string, not the internal cuid |
| `{{outlet_name}}` | `ctx.outletName` | Used in headers + body to anchor the customer to the outlet |
| `{{item}}` | `ctx.itemName` | Single item name — used by `ITEM_READY` only |
| `{{amount}}` | `ctx.amount` | Payment-mode-agnostic ₹ value, no currency symbol |
| `{{datetime}}` | runtime `new Date().toLocaleString()` | Auto-injected by the renderer |
| `{{items_list}}` | `ctx.items` joined as `• name × qty — ₹total` lines | Multiline; WABA templates support this in the body |
| `{{subtotal}}` | `ctx.subtotal` | Pre-formatted with ₹ prefix when present |
| `{{tax}}` | `ctx.taxAmount` | Pre-formatted with ₹ prefix when present |
| `{{total}}` | `ctx.totalAmount` | Pre-formatted with ₹ prefix when present |
| `{{token_number}}` | `ctx.tokenNumber` | Order pickup / counter token |
| `{{receipt_url}}` | `ctx.receiptUrl` | Deep-link to the hosted receipt page |

---

## Templates

### `ORDER_PLACED`

| | |
|---|---|
| **Category** | UTILITY |
| **Fires when** | A customer-attributed order is created (direct, web, customer PWA, or aggregator) |
| **Code path** | `OrdersService.create` → `LifecycleDispatcherService.fire('ORDER_PLACED', ...)` |
| **Markers required** | `customer_name`, `order_number`, `outlet_name`, `items_list`, `total`, `token_number`, `receipt_url` |
| **Loudness** | Quiet (toast + bell-list entry; no FCM push) |

```
Hi {{customer_name}}, your order *{{order_number}}* at {{outlet_name}} has been placed.

*Items*
{{items_list}}

Total: *{{total}}*
Token: {{token_number}}

View receipt: {{receipt_url}}
```

---

### `PAYMENT_RECEIVED`

| | |
|---|---|
| **Category** | UTILITY |
| **Fires when** | `Payment.confirm` completes for any non-refund payment |
| **Code path** | `PaymentsService.confirmPayment` (cash) or webhook handler (gateway) |
| **Markers required** | `amount`, `order_number` |
| **Loudness** | Quiet |

```
Payment of ₹{{amount}} received for order {{order_number}}.
```

---

### `ITEM_READY`

| | |
|---|---|
| **Category** | UTILITY |
| **Fires when** | An individual order item transitions to `READY` |
| **Code path** | `OrdersService.updateItemStatus` → lifecycle dispatcher |
| **Markers required** | `item`, `order_number` |
| **Loudness** | Loud (ringtone + FCM push) — unless the order is dine-in table-service, then quiet |

```
Your {{item}} is ready (order {{order_number}}).
```

---

### `ORDER_READY`

| | |
|---|---|
| **Category** | UTILITY |
| **Fires when** | Every item on the order is READY (auto-rollup) or staff manually flips status to READY |
| **Code path** | `OrdersService.updateStatus` / `rollupOrderStatus` → lifecycle dispatcher |
| **Markers required** | `order_number` |
| **Loudness** | Loud — unless table-service |

```
Your order {{order_number}} is ready.
```

---

### `PICKUP_READY`

| | |
|---|---|
| **Category** | UTILITY |
| **Fires when** | A parcel order transitions to `READY_FOR_PICKUP` |
| **Code path** | Parcel desk → status update → lifecycle dispatcher |
| **Markers required** | `order_number`, `outlet_name` |
| **Loudness** | Loud |

```
Your parcel order {{order_number}} is packed and ready for pickup at {{outlet_name}}.
```

---

### `ORDER_SERVED`

| | |
|---|---|
| **Category** | UTILITY |
| **Fires when** | The order reaches its terminal SERVED status — table cleared, parcel handed over, or self-service collected |
| **Code path** | `OrdersService.updateStatus` to SERVED |
| **Markers required** | `order_number` |
| **Loudness** | Quiet |

```
Order {{order_number}} has been served. Enjoy!
```

---

## Submitting for WABA approval — checklist

For each template above, the Meta Business Manager template form needs:

1. **Template name** — match the trigger name exactly (e.g. `order_placed`)
2. **Category** — as documented above
3. **Language** — `en_US` for the English defaults; add separate entries for each language you support (Hindi `hi_IN` etc.)
4. **Body** — paste the body, replacing `{{name}}` markers with `{{1}}`, `{{2}}`, … positional arguments. Document the mapping in the form's "Sample values" so reviewers can verify intent. The runtime renderer maps named markers to positional ones at send time.
5. **Header / Footer / Buttons** — optional; not required for any current template.
6. **Sample values** — include realistic examples (e.g. `{{1}}=Naren`, `{{2}}=ON-001`, `{{3}}=Hyderabadi Biryani`).

Approval usually takes 1–24 hours. While pending, the renderer falls back to the SMS path automatically when `outlet.notificationChannel === 'WHATSAPP'`.

---

## Maintenance rule

When the codebase grows a new message-sending path:

1. **Update this file first.** Add a new section under "Templates" with the trigger name, category, code path, markers, and full body.
2. Add the trigger to `LifecycleTrigger` and `FALLBACK_BODIES` in `lifecycle-dispatcher.service.ts`.
3. Add a sensible `TITLES[]` entry so the in-app CustomerAlert displays a usable subject.
4. Ship the code that fires it.
5. Manually submit for WABA approval after merge.

CLAUDE.md (project root) references this file as the canonical source for messaging strings, so contributors / agents pick it up automatically.
