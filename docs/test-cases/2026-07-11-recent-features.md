# Recent Features Test Report — 2026-07-11

Covers verification and actual results for features added recently in the repository.

---

### Test 1: Admin Multi-Language Switcher
* **Steps:** Admin Panel $\rightarrow$ top-right Language Selector $\rightarrow$ switch to **"हिन्दी" (Hindi)**.
* **Expected:** Sidebar and main labels translate instantly without page reload.
* **Actual Result: [PASSED]** Language changes instantly to Hindi and translates back to English cleanly.

### Test 2: Place Order Grid vs. List View Toggle
* **Steps:** POS Screen (Place Order) $\rightarrow$ toggle list/grid view $\rightarrow$ type search query.
* **Expected:** Layout shifts dynamically; search box collapses to a clean icon to preserve category header space.
* **Actual Result: [PASSED]** Grid/list toggle swaps layouts instantly, search behaves correctly, and categories no longer overflow.

### Test 3: Two-Tier Aggregator Gating
* **Steps:** Toggle "Marketplace aggregators" on/off at Platform/Business level; log in as Outlet Admin.
* **Expected:** Settings sidebar item "Aggregators" hides/shows dynamically based on the parent gating flags.
* **Actual Result: [PASSED]** Gating logic correctly hides and shows the menu item on login.

### Test 4: Split Bill Admin Configuration
* **Steps:** *Outlet Profile* $\rightarrow$ check "Split Bills" configurations $\rightarrow$ edit values $\rightarrow$ Save.
* **Expected:** Configurations for fee absorption (OUTLET/CUSTOMER), reminder interval, max reminders, and auto-expiry persist correctly.
* **Actual Result: [PASSED]** Split Bill settings persist and save successfully.

### Test 5: Coupon Allowance and Tag Targeting
* **Steps:** Create a coupon with `Kind = ALLOWANCE` and `TargetType = TAG`. Apply it to a cart with eligible items.
* **Expected:** Entitlement quota limits are enforced; items are discounted cheapest-first.
* **Actual Result: [PASSED / WITH ISSUES]** 
  * *Quota and Cheapest-First:* Verified working correctly.
  * **[Issue]** Quota daily reset runs on UTC midnight (5:30 AM IST) instead of local midnight.
  * **[Issue]** The system does not check for duplicate coupon codes under the same business, allowing name conflicts.

### Test 6: Customer Dues and Credit Ceilings (Pay Later)
* **Steps:** Set a *Max Due Amount* (credit limit) on a customer tag. Checkout a cart that exceeds this limit using Pay Later.
* **Expected:** Checkout is blocked with a credit limit exceeded message.
* **Actual Result: [PASSED / WITH ISSUES]**
  * *Credit Check:* Successfully blocks checkouts exceeding the dues ceiling.
  * **[Issue]** A concurrency loophole exists where sending parallel checkout requests at the exact same time bypasses the credit check.
