# 05 — Menu management

Covers category / subcategory / item CRUD, availability toggles,
the menu × section availability gate, and multi-menu support.

### MENU-001 — Add category / subcategory / item (P0)
**Steps:** *Menu* → New Category → New Subcategory → New Item.
**Expected:** All three persisted. Item visible to the customer PWA after publish.
**Actual Result: [GAP / FAIL]** The API lacks permission checks. Any logged-in user can add categories, subcategories, or items.

### MENU-002 — Toggle item availability (P0)
**Pre:** user has `TOGGLE_ITEM_AVAILABILITY`.
**Steps:** Click the visibility toggle on an item.
**Expected:** Item disappears from customer menu fetch on the next reload.
**Actual Result: [GAP / FAIL]** Tested on the live server. A staff user lacking toggle permissions successfully toggled Masala Dosa availability and got a 200 OK response.

### MENU-003 — Variant + topping CRUD (P1)
**Steps:** Add a variant under an item; add a topping; assign topping to the item.
**Expected:** Customer cart shows variant choices + topping picker.
**Actual Result: [GAP / FAIL]** Variant and topping CRUD endpoints lack role/permission restrictions on the API level.

### MENU-004 — Multi-menu tabs (P1)
**Pre:** business has `multipleMenusEnabled=true`.
**Steps:** Create "Breakfast", "Lunch" menus; assign categories to each.
**Expected:** Customer PWA shows the menu tabs.
**Actual Result: [PASSED]** Successfully supported and rendered in the customer PWA.

### MENU-005 — Menu × Section availability toggle (P0)
**Pre:** outlet has multiple menus and at least one section.
**Steps:** *Outlets → expand → section row → Menus → disable a menu*.
**Expected:** `paynpik_menu_section_exclusions` row created. Customer scanning a table in that section no longer sees the disabled menu.
**Actual Result: [PASSED]** Verified in the codebase. Toggling menu section availability correctly inserts/deletes exclusion rows in the database.

### MENU-006 — Default menu cannot be disabled (P0)
**Steps:** In MENU-005, try to disable the default menu.
**Expected:** Toggle is locked / API returns 400 with "The default menu cannot be disabled".
**Actual Result: [PASSED]** Verified in the codebase. The backend throws a 400 bad request error if a user tries to disable the default menu.

### MENU-007 — Table-type × menu rule applies (P1)
**Pre:** outlet has table-types; one type has menu X disabled.
**Steps:** Customer scans a table of that type.
**Expected:** Menu X hidden. Combines with section rules from MENU-005.
**Actual Result: [PASSED]** The menu resolving query checks table types and section exclusions to compute the final active menu list.

### MENU-008 — Menu import from another outlet (P2)
**Pre:** user has `IMPORT_MENU`.
**Steps:** Import a sister outlet's menu.
**Expected:** Categories / subcategories / items duplicated under this outlet.
**Actual Result: [GAP / FAIL]** The import endpoint does not check for the `IMPORT_MENU` responsibility or verify tenant-level authorization bounds.
