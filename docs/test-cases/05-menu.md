# 05 — Menu management

Covers category / subcategory / item CRUD, availability toggles,
the menu × section availability gate, and multi-menu support.

### MENU-001 — Add category / subcategory / item (P0)
**Steps:** *Menu* → New Category → New Subcategory → New Item.
**Expected:** All three persisted. Item visible to the customer PWA after publish.

### MENU-002 — Toggle item availability (P0)
**Pre:** user has `TOGGLE_ITEM_AVAILABILITY`.
**Steps:** Click the visibility toggle on an item.
**Expected:** Item disappears from customer menu fetch on the next reload.

### MENU-003 — Variant + topping CRUD (P1)
**Steps:** Add a variant under an item; add a topping; assign topping to the item.
**Expected:** Customer cart shows variant choices + topping picker.

### MENU-004 — Multi-menu tabs (P1)
**Pre:** business has `multipleMenusEnabled=true`.
**Steps:** Create "Breakfast", "Lunch" menus; assign categories to each.
**Expected:** Customer PWA shows the menu tabs.

### MENU-005 — Menu × Section availability toggle (P0)
**Pre:** outlet has multiple menus and at least one section.
**Steps:** *Outlets → expand → section row → Menus → disable a menu*.
**Expected:** `paynpik_menu_section_exclusions` row created. Customer scanning a table in that section no longer sees the disabled menu.

### MENU-006 — Default menu cannot be disabled (P0)
**Steps:** In MENU-005, try to disable the default menu.
**Expected:** Toggle is locked / API returns 400 with "The default menu cannot be disabled".

### MENU-007 — Table-type × menu rule applies (P1)
**Pre:** outlet has table-types; one type has menu X disabled.
**Steps:** Customer scans a table of that type.
**Expected:** Menu X hidden. Combines with section rules from MENU-005.

### MENU-008 — Menu import from another outlet (P2)
**Pre:** user has `IMPORT_MENU`.
**Steps:** Import a sister outlet's menu.
**Expected:** Categories / subcategories / items duplicated under this outlet.
