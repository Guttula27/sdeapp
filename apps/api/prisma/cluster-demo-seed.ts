// Cluster demo seed — 5 fictional food-court brands with curated images.
//
// Idempotent. Re-running:
//   • Re-uses brand owners (phones are stable)
//   • Releases the current Demo Food Court members
//   • Wipes-and-rebuilds each brand's menu (so changes in this file replace
//     stale data without manual cleanup)
//
// Run with: cd apps/api && npx ts-node prisma/cluster-demo-seed.ts

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// ── Brand logos ──────────────────────────────────────────────────
// Inline SVG data URIs so we don't depend on an external CDN for the
// most identity-critical asset. Each logo is the brand initial on a
// solid colored disc with a small ring — clean, recognisable, stable.
function svgLogo(initials: string, color: string, ring = '#ffffff'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="98" fill="${color}" stroke="${ring}" stroke-width="4"/><text x="100" y="140" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="120" font-weight="900" fill="${ring}">${initials}</text></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

// ── Image catalogue ──────────────────────────────────────────────
// Curated Unsplash food photos. Each URL is the published images.unsplash
// permalink with width / format hints — Unsplash hands out the right CDN
// asset and these IDs are stable for popular photos. If any 404 the UI
// has its own emoji fallback.
const IMG = (id: string, w = 600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

// ── Brand catalogue ──────────────────────────────────────────────
// Items can optionally declare:
//   variants[]  — radio-group choices, each with its own price.
//   toppings[]  — `null`-priceAdd means "use topping.basePriceAdd";
//                  optional `options[]` makes the topping a radio group.
type ItemSpec = {
  name: string; price: number; desc: string; img: string;
  variants?: Array<{ name: string; price: number }>;
  toppings?: string[]; // names of toppings declared in `brandToppings`
};
const BRANDS: Array<{
  key: string; name: string; tagline: string; color: string; initials: string;
  ownerPhone: string; ownerName: string; razorpayLA: string; hero: string;
  // Outlet-level toppings catalogue — items reference these by name.
  toppings?: Array<{
    name: string; basePriceAdd: number;
    options?: Array<{ name: string; priceAdd: number }>;
  }>;
  categories: Array<{
    name: string; imageUrl: string;
    subcategories: Array<{
      name: string; imageUrl?: string; items: ItemSpec[];
    }>;
  }>;
}> = [
  {
    key: 'lotus',
    name: 'Lotus Tiffin',
    tagline: 'Authentic South Indian',
    color: '#f97316',
    initials: 'LT',
    ownerPhone: '9111111101',
    ownerName: 'Lotus Tiffin Owner',
    razorpayLA: 'acc_demo_LOTUS',
    hero: IMG('1668236543090-82eba5ee5976', 1200),
    categories: [
      {
        name: 'Tiffin',
        imageUrl: IMG('1668236543090-82eba5ee5976'),
        subcategories: [
          {
            name: 'Dosa',
            imageUrl: IMG('1668236543090-82eba5ee5976', 400),
            items: [
              { name: 'Masala Dosa',    price: 90,  desc: 'Crispy crepe with spicy potato filling',        img: IMG('1668236543090-82eba5ee5976') },
              { name: 'Ghee Roast Dosa', price: 120, desc: 'Roasted to a golden brown in pure ghee',      img: IMG('1606491956689-2ea866880c84') },
              { name: 'Onion Dosa',     price: 100, desc: 'Topped with finely chopped onions',           img: IMG('1697155242809-87e9d23a8d8b') },
              { name: 'Plain Dosa',     price: 70,  desc: 'Light, crisp, served with chutney & sambar',  img: IMG('1668236543090-82eba5ee5976') },
            ],
          },
          {
            name: 'Idli & Vada',
            imageUrl: IMG('1589301760014-d929f3979dbc'),
            items: [
              { name: 'Idli (2 pcs)',         price: 50, desc: 'Steamed rice cakes',                  img: IMG('1589301760014-d929f3979dbc') },
              { name: 'Vada (2 pcs)',         price: 60, desc: 'Crisp lentil donuts',                 img: IMG('1606491956689-2ea866880c84') },
              { name: 'Idli + Vada Combo',    price: 90, desc: 'Pair of each, with chutney & sambar', img: IMG('1589301760014-d929f3979dbc') },
            ],
          },
        ],
      },
      {
        name: 'Beverages',
        imageUrl: IMG('1583146193353-d9fae0d3bc62'),
        subcategories: [
          {
            name: 'Coffee & Tea',
            imageUrl: IMG('1583146193353-d9fae0d3bc62'),
            items: [
              { name: 'Filter Coffee', price: 40, desc: 'Strong South Indian filter brew',  img: IMG('1583146193353-d9fae0d3bc62') },
              { name: 'Masala Chai',   price: 35, desc: 'Spiced tea with cardamom & ginger', img: IMG('1576092768241-dec231879fc3') },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'saffron',
    name: 'Saffron Wok',
    tagline: 'Indo-Chinese — Stir, Sizzle, Serve',
    color: '#dc2626',
    initials: 'SW',
    ownerPhone: '9111111102',
    ownerName: 'Saffron Wok Owner',
    razorpayLA: 'acc_demo_SAFFRON',
    hero: IMG('1569718212165-3a8278d5f624', 1200),
    categories: [
      {
        name: 'Mains',
        imageUrl: IMG('1569718212165-3a8278d5f624'),
        subcategories: [
          {
            name: 'Noodles',
            imageUrl: IMG('1569718212165-3a8278d5f624'),
            items: [
              { name: 'Veg Hakka Noodles',     price: 160, desc: 'Wok-tossed with crunchy veg',          img: IMG('1569718212165-3a8278d5f624') },
              { name: 'Schezwan Noodles',      price: 180, desc: 'Fiery red, smoky finish',              img: IMG('1612929633738-8fe44f7ec841') },
              { name: 'Chicken Hakka Noodles', price: 210, desc: 'With juicy chicken strips',            img: IMG('1612929633738-8fe44f7ec841') },
            ],
          },
          {
            name: 'Fried Rice',
            imageUrl: IMG('1603133872878-684f208fb84b'),
            items: [
              { name: 'Veg Fried Rice',        price: 150, desc: 'Long-grain with seasonal veg',         img: IMG('1603133872878-684f208fb84b') },
              { name: 'Schezwan Fried Rice',   price: 170, desc: 'House schezwan, extra heat',           img: IMG('1603133872878-684f208fb84b') },
            ],
          },
        ],
      },
      {
        name: 'Starters',
        imageUrl: IMG('1606471191009-63994c53433b'),
        subcategories: [
          {
            name: 'Manchurian & More',
            imageUrl: IMG('1606471191009-63994c53433b'),
            items: [
              { name: 'Veg Manchurian',  price: 180, desc: 'Crispy veg balls in tangy sauce', img: IMG('1606471191009-63994c53433b') },
              { name: 'Spring Rolls',    price: 140, desc: 'Pan-fried, 4 pieces',             img: IMG('1606471191009-63994c53433b') },
              { name: 'Chilli Paneer',   price: 220, desc: 'Tossed in spicy garlic sauce',    img: IMG('1606471191009-63994c53433b') },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'pizza',
    name: 'Pizza Junction',
    tagline: 'Hand-tossed since 2018',
    color: '#16a34a',
    initials: 'PJ',
    ownerPhone: '9111111103',
    ownerName: 'Pizza Junction Owner',
    razorpayLA: 'acc_demo_PIZZA',
    hero: IMG('1604068549290-dea0e4a305ca', 1200),
    toppings: [
      { name: 'Extra Cheese', basePriceAdd: 60 },
      { name: 'Jalapeños',    basePriceAdd: 40 },
      { name: 'Stuffed Crust', basePriceAdd: 80 },
    ],
    categories: [
      {
        name: 'Pizzas',
        imageUrl: IMG('1604068549290-dea0e4a305ca'),
        subcategories: [
          {
            name: 'Veg',
            imageUrl: IMG('1604068549290-dea0e4a305ca'),
            items: [
              {
                name: 'Margherita', price: 220, desc: 'Classic tomato + mozzarella',
                img: IMG('1604068549290-dea0e4a305ca'),
                variants: [
                  { name: 'Regular (7")', price: 220 },
                  { name: 'Medium (10")', price: 340 },
                  { name: 'Large (13")',  price: 480 },
                ],
                toppings: ['Extra Cheese', 'Jalapeños', 'Stuffed Crust'],
              },
              {
                name: 'Farmhouse', price: 320, desc: 'Bell peppers, onion, mushroom, corn',
                img: IMG('1565299624946-b28f40a0ae38'),
                variants: [
                  { name: 'Regular (7")', price: 320 },
                  { name: 'Medium (10")', price: 480 },
                  { name: 'Large (13")',  price: 640 },
                ],
                toppings: ['Extra Cheese', 'Stuffed Crust'],
              },
              { name: 'Paneer Tikka', price: 360, desc: 'Tandoori paneer + onion + capsicum',   img: IMG('1565299624946-b28f40a0ae38') },
            ],
          },
          {
            name: 'Non-Veg',
            imageUrl: IMG('1571066811602-716837d681de'),
            items: [
              {
                name: 'Pepperoni', price: 380, desc: 'Spicy pepperoni + mozzarella',
                img: IMG('1628840042765-356cda07504e'),
                variants: [
                  { name: 'Regular (7")', price: 380 },
                  { name: 'Medium (10")', price: 560 },
                  { name: 'Large (13")',  price: 740 },
                ],
                toppings: ['Extra Cheese', 'Jalapeños'],
              },
              { name: 'BBQ Chicken', price: 420, desc: 'Smoky BBQ sauce, grilled chicken', img: IMG('1571066811602-716837d681de') },
            ],
          },
        ],
      },
      {
        name: 'Sides',
        imageUrl: IMG('1573821663912-6df460f9c684'),
        subcategories: [
          {
            name: 'Sides',
            items: [
              { name: 'Garlic Bread', price: 120, desc: 'Toasted with garlic butter',  img: IMG('1573821663912-6df460f9c684') },
              { name: 'Cheese Sticks', price: 160, desc: '5 sticks with marinara dip', img: IMG('1573821663912-6df460f9c684') },
              { name: 'Tiramisu',     price: 180, desc: 'Coffee-soaked, mascarpone',   img: IMG('1571877227200-a0d98ea607e9') },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'burger',
    name: 'Burger Forge',
    tagline: 'Smashed. Grilled. Stacked.',
    color: '#ca8a04',
    initials: 'BF',
    ownerPhone: '9111111104',
    ownerName: 'Burger Forge Owner',
    razorpayLA: 'acc_demo_BURGER',
    hero: IMG('1568901346375-23c9450c58cd', 1200),
    toppings: [
      { name: 'Extra Patty',     basePriceAdd: 70 },
      { name: 'Bacon Strip',     basePriceAdd: 50 },
      {
        // Radio-group topping — customer picks one heat level
        name: 'Sauce', basePriceAdd: 0,
        options: [
          { name: 'Classic Mayo',  priceAdd: 0 },
          { name: 'Smoky Chipotle', priceAdd: 15 },
          { name: 'Spicy Sriracha', priceAdd: 15 },
        ],
      },
    ],
    categories: [
      {
        name: 'Burgers',
        imageUrl: IMG('1568901346375-23c9450c58cd'),
        subcategories: [
          {
            name: 'Classic',
            imageUrl: IMG('1568901346375-23c9450c58cd'),
            items: [
              {
                name: 'Classic Veg Burger', price: 130, desc: 'Patty + lettuce + tomato + mayo',
                img: IMG('1571091718767-18b5b1457add'),
                toppings: ['Extra Patty', 'Sauce'],
              },
              {
                name: 'Cheese Veg Burger', price: 160, desc: 'Double cheese, melted',
                img: IMG('1571091718767-18b5b1457add'),
                toppings: ['Extra Patty', 'Sauce'],
              },
            ],
          },
          {
            name: 'Premium',
            imageUrl: IMG('1607013251379-e6eecfffe234'),
            items: [
              {
                name: 'Smoked BBQ Chicken Burger', price: 220, desc: 'Grilled chicken, smoky BBQ',
                img: IMG('1607013251379-e6eecfffe234'),
                toppings: ['Extra Patty', 'Bacon Strip', 'Sauce'],
              },
              {
                name: 'Double Stack Beef', price: 280, desc: 'Two patties, caramelized onions',
                img: IMG('1568901346375-23c9450c58cd'),
                toppings: ['Bacon Strip', 'Sauce'],
              },
            ],
          },
        ],
      },
      {
        name: 'Sides & Drinks',
        imageUrl: IMG('1573080496219-bb080dd4f877'),
        subcategories: [
          {
            name: 'Sides',
            items: [
              { name: 'French Fries',  price: 90,  desc: 'Salted, crispy',         img: IMG('1573080496219-bb080dd4f877') },
              { name: 'Cheesy Fries',  price: 130, desc: 'With molten cheese sauce', img: IMG('1573080496219-bb080dd4f877') },
              { name: 'Onion Rings',   price: 110, desc: '6 crispy rings',          img: IMG('1573080496219-bb080dd4f877') },
            ],
          },
          {
            name: 'Drinks',
            items: [
              { name: 'Coke',           price: 60, desc: 'Chilled, 300ml',        img: IMG('1554866585-cd94860890b7') },
              { name: 'Chocolate Shake', price: 140, desc: 'Thick, hand-blended', img: IMG('1572490122747-3968b75cc699') },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'tandoor',
    name: 'Tandoor Tales',
    tagline: 'North Indian flame-grilled',
    color: '#9a3412',
    initials: 'TT',
    ownerPhone: '9111111105',
    ownerName: 'Tandoor Tales Owner',
    razorpayLA: 'acc_demo_TANDOOR',
    hero: IMG('1565557623262-b51c2513a641', 1200),
    categories: [
      {
        name: 'Curries',
        imageUrl: IMG('1565557623262-b51c2513a641'),
        subcategories: [
          {
            name: 'Veg Curries',
            imageUrl: IMG('1565557623262-b51c2513a641'),
            items: [
              { name: 'Dal Makhani',     price: 220, desc: 'Slow-cooked black lentils', img: IMG('1565557623262-b51c2513a641') },
              { name: 'Paneer Butter Masala', price: 260, desc: 'Cottage cheese in tomato-cream gravy', img: IMG('1567188040759-fb8a883dc6d8') },
              { name: 'Kadhai Paneer',   price: 250, desc: 'Wok-tossed with bell peppers', img: IMG('1567188040759-fb8a883dc6d8') },
            ],
          },
          {
            name: 'Non-Veg Curries',
            imageUrl: IMG('1603894584373-5ac82b2ae398'),
            items: [
              { name: 'Butter Chicken',  price: 320, desc: 'Tandoori chicken in rich tomato cream', img: IMG('1603894584373-5ac82b2ae398') },
              { name: 'Chicken Tikka Masala', price: 340, desc: 'Charred chicken in masala gravy', img: IMG('1603894584373-5ac82b2ae398') },
            ],
          },
        ],
      },
      {
        name: 'Breads & Rice',
        imageUrl: IMG('1565557623262-b51c2513a641'),
        subcategories: [
          {
            name: 'Naan & Roti',
            imageUrl: IMG('1565557623262-b51c2513a641'),
            items: [
              { name: 'Butter Naan',  price: 50, desc: 'Soft, brushed with butter', img: IMG('1565557623262-b51c2513a641') },
              { name: 'Garlic Naan',  price: 70, desc: 'Topped with fresh garlic',  img: IMG('1565557623262-b51c2513a641') },
              { name: 'Tandoori Roti', price: 40, desc: 'Whole wheat, from the tandoor', img: IMG('1565557623262-b51c2513a641') },
            ],
          },
        ],
      },
    ],
  },
];

// Cluster mall imagery — used for the food court business itself.
const CLUSTER_LOGO = svgLogo('FC', '#6366f1');
const CLUSTER_HERO = IMG('1530541930197-ff16ac917b0e', 1600);  // mall interior
const CLUSTER_GALLERY = [
  IMG('1567521464027-f127ff144326', 1200),
  IMG('1564013799919-ab600027ffc6', 1200),
  IMG('1530541930197-ff16ac917b0e', 1200),
];

const DEFAULT_OWNER_PW = 'Owner@123';

async function ensureBrandBusiness(b: typeof BRANDS[number]) {
  // 1. Owner user (idempotent on phone)
  const passwordHash = await bcrypt.hash(DEFAULT_OWNER_PW, 12);
  let owner = await prisma.user.findUnique({ where: { phone: b.ownerPhone } });

  // 2. Business (idempotent on name + isCluster=false)
  let business = await prisma.business.findFirst({
    where: { name: b.name, isCluster: false },
  });
  if (!business) {
    const publicCode = 'BIZ-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    business = await prisma.business.create({
      data: {
        name: b.name,
        description: b.tagline,
        businessType: 'QSR',
        publicCode,
        logoUrl: svgLogo(b.initials, b.color),
        thumbnailUrl: svgLogo(b.initials, b.color),
        primaryImageUrl: b.hero,
      },
    });
    await prisma.menu.create({ data: { businessId: business.id, name: 'Main Menu', isDefault: true } });
  } else {
    // Refresh logo + hero to whatever this seed defines now.
    await prisma.business.update({
      where: { id: business.id },
      data: {
        logoUrl: svgLogo(b.initials, b.color),
        thumbnailUrl: svgLogo(b.initials, b.color),
        primaryImageUrl: b.hero,
        description: b.tagline,
      },
    });
  }

  if (!owner) {
    // Create the Business Owner role for this business (clone responsibilities from template).
    const template = await prisma.role.findFirst({
      where: { name: 'Business Owner', isTemplate: true, businessId: null },
      select: { responsibilities: { select: { responsibilityId: true } } },
    });
    const ownerRole = await prisma.role.create({
      data: {
        name: 'Business Owner',
        businessId: business.id,
        isSystem: false,
        responsibilities: template
          ? { create: template.responsibilities.map((r) => ({ responsibilityId: r.responsibilityId })) }
          : undefined,
      },
    });
    owner = await prisma.user.create({
      data: {
        name: b.ownerName,
        phone: b.ownerPhone,
        passwordHash,
        businessId: business.id,
        roleId: ownerRole.id,
        status: 'ACTIVE',
      },
    });
  } else {
    // Always reset the owner password to the published demo value.
    await prisma.user.update({ where: { id: owner.id }, data: { passwordHash, mustChangePassword: false } });
  }

  // 3. Outlet (idempotent on businessId + name)
  let outlet = await prisma.outlet.findFirst({
    where: { businessId: business.id, name: b.name },
  });
  if (!outlet) {
    const publicCode = 'OL-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    outlet = await prisma.outlet.create({
      data: {
        businessId: business.id,
        name: b.name,
        outletType: 'SELF_SERVICE',
        publicCode,
        logoUrl: svgLogo(b.initials, b.color),
        primaryImageUrl: b.hero,
        razorpayLinkedAccountId: b.razorpayLA,
      },
    });
  } else {
    await prisma.outlet.update({
      where: { id: outlet.id },
      data: {
        logoUrl: svgLogo(b.initials, b.color),
        primaryImageUrl: b.hero,
        razorpayLinkedAccountId: b.razorpayLA,
      },
    });
  }

  // 4. Wipe and recreate the menu tree for this outlet so the seed data
  //    always matches what's in this file. Items hang under subcategories
  //    hang under categories — categories carry menuId so the cluster
  //    bundle groups them under the right menu tab.
  const defaultMenu = await prisma.menu.findFirst({
    where: { businessId: business.id, isDefault: true },
  });

  const existingCats = await prisma.category.findMany({ where: { outletId: outlet.id }, select: { id: true } });
  if (existingCats.length) {
    // Delete chain: items → subcategories → categories. Skip if there are
    // orders referencing items (rare in dev — guarded by hard-delete
    // failure surfacing as a warning).
    try {
      const subIds = (await prisma.subcategory.findMany({
        where: { categoryId: { in: existingCats.map((c) => c.id) } }, select: { id: true },
      })).map((s) => s.id);
      const itemIds = (await prisma.item.findMany({
        where: { subcategoryId: { in: subIds } }, select: { id: true },
      })).map((i) => i.id);
      // Clear topping links + variants before deleting items.
      if (itemIds.length) {
        await prisma.itemTopping.deleteMany({ where: { itemId: { in: itemIds } } });
        await prisma.variant.deleteMany({ where: { itemId: { in: itemIds } } });
      }
      await prisma.item.deleteMany({ where: { subcategoryId: { in: subIds } } });
      await prisma.subcategory.deleteMany({ where: { id: { in: subIds } } });
      await prisma.category.deleteMany({ where: { id: { in: existingCats.map((c) => c.id) } } });
    } catch (e: any) {
      console.warn(`  ⚠ ${b.name}: could not fully wipe old menu (${e.message?.slice(0, 80) ?? e})`);
    }
  }

  // Toppings catalogue at the outlet level — wipe + re-seed so the brand
  // file is the source of truth. Item-level links are recreated below.
  await prisma.itemTopping.deleteMany({
    where: { item: { subcategory: { category: { outletId: outlet.id } } } },
  });
  await prisma.topping.deleteMany({ where: { outletId: outlet.id } });
  const toppingByName: Record<string, { id: string }> = {};
  for (const t of b.toppings ?? []) {
    const created = await prisma.topping.create({
      data: {
        outletId: outlet.id,
        name: t.name,
        basePriceAdd: t.basePriceAdd,
        options: t.options?.length
          ? { create: t.options.map((o, idx) => ({ name: o.name, priceAdd: o.priceAdd, displayOrder: idx })) }
          : undefined,
      },
    });
    toppingByName[t.name] = created;
  }

  for (let ci = 0; ci < b.categories.length; ci++) {
    const c = b.categories[ci];
    const category = await prisma.category.create({
      data: {
        name: c.name,
        outletId: outlet.id,
        menuId: defaultMenu?.id,
        imageUrl: c.imageUrl,
        displayOrder: ci,
      },
    });
    for (let si = 0; si < c.subcategories.length; si++) {
      const s = c.subcategories[si];
      const subcategory = await prisma.subcategory.create({
        data: {
          name: s.name,
          categoryId: category.id,
          imageUrl: (s as any).imageUrl ?? null,
          displayOrder: si,
        },
      });
      for (let ii = 0; ii < s.items.length; ii++) {
        const it = s.items[ii];
        const item = await prisma.item.create({
          data: {
            name: it.name,
            shortDescription: it.desc,
            basePrice: it.price,
            subcategoryId: subcategory.id,
            imageUrl: it.img,
            thumbnailUrl: it.img,
            displayOrder: ii,
            isAvailable: true,
            isDisplayed: true,
            foodGrade: 'VEG',
            variants: it.variants?.length
              ? { create: it.variants.map((v) => ({ name: v.name, price: v.price })) }
              : undefined,
          },
        });
        // Topping links — each name in it.toppings must exist in the
        // brand's outlet-level catalogue (seeded above).
        if (it.toppings?.length) {
          for (const tname of it.toppings) {
            const tp = toppingByName[tname];
            if (!tp) {
              console.warn(`  ⚠ ${b.name}: ${it.name} references unknown topping "${tname}"`);
              continue;
            }
            await prisma.itemTopping.create({
              data: { itemId: item.id, toppingId: tp.id, isRequired: false },
            });
          }
        }
      }
    }
  }

  return outlet;
}

async function main() {
  console.log('═══ Cluster demo: themed brands + images ═══');

  // Find (or fail) the Demo Food Court cluster.
  const cluster = await prisma.business.findFirst({
    where: { name: 'Demo Food Court', isCluster: true },
    include: { clusterMembers: true, images: true },
  });
  if (!cluster) {
    throw new Error('Demo Food Court cluster not found. Run /tmp/populate-cluster-demo.py first.');
  }
  console.log(`  cluster ${cluster.name} (${cluster.publicCode})`);

  // Refresh cluster's own branding + gallery.
  await prisma.business.update({
    where: { id: cluster.id },
    data: {
      logoUrl: CLUSTER_LOGO,
      thumbnailUrl: CLUSTER_LOGO,
      primaryImageUrl: CLUSTER_HERO,
    },
  });
  // Replace the gallery wholesale.
  await prisma.businessImage.deleteMany({ where: { businessId: cluster.id } });
  for (let i = 0; i < CLUSTER_GALLERY.length; i++) {
    await prisma.businessImage.create({
      data: { businessId: cluster.id, url: CLUSTER_GALLERY[i], displayOrder: i },
    });
  }
  console.log('  ✓ cluster branding + gallery refreshed');

  // Release current members.
  await prisma.clusterMember.deleteMany({ where: { clusterBusinessId: cluster.id } });
  console.log('  ✓ released previous members');

  // Build each brand and link as cluster member.
  const linkedOutlets: { name: string; publicCode: string }[] = [];
  for (let i = 0; i < BRANDS.length; i++) {
    const b = BRANDS[i];
    console.log(`\n  → ${b.name}`);
    const outlet = await ensureBrandBusiness(b);
    await prisma.clusterMember.create({
      data: { clusterBusinessId: cluster.id, outletId: outlet.id, displayOrder: i },
    });
    linkedOutlets.push({ name: outlet.name, publicCode: outlet.publicCode! });
    console.log(`     linked ${outlet.publicCode}`);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  DONE');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Cluster:    ${cluster.name}  (${cluster.publicCode})`);
  console.log(`Customer:   http://localhost:5174/cluster/${cluster.publicCode}`);
  console.log(`Admin:      http://localhost:5173/platform/clusters/${cluster.id}`);
  console.log();
  console.log('Brand owner logins (password = Owner@123 for all):');
  for (const b of BRANDS) {
    console.log(`  ${b.ownerPhone}  ${b.name}  (${b.ownerName})`);
  }
  console.log();
  console.log(`Linked outlets (${linkedOutlets.length}):`);
  for (const o of linkedOutlets) console.log(`  ${o.publicCode}  ${o.name}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
