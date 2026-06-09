/**
 * One-shot dedupe for menu rows that got created multiple times when an
 * earlier non-idempotent seed ran more than once. For each duplicated
 * (parent, name) group, keep the OLDEST row, reparent the children of
 * every younger duplicate onto the survivor, then delete the duplicate.
 *
 * Run with:
 *   cd apps/api
 *   npx ts-node prisma/cleanup-duplicates.ts
 *
 * Safe to re-run — after the first run there are no duplicate groups
 * left to act on, so the script is a no-op.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function dedupeCategories() {
  // Find (outletId, name) groups with more than one Category row.
  const groups: Array<{ outletId: string; name: string; cnt: number }> =
    await prisma.$queryRawUnsafe(`
      SELECT outletId, name, COUNT(*) AS cnt
      FROM paynpik_categories
      GROUP BY outletId, name
      HAVING COUNT(*) > 1
    `);
  if (groups.length === 0) {
    console.log('Categories: no duplicates');
    return;
  }
  for (const g of groups) {
    const rows = await prisma.category.findMany({
      where: { outletId: g.outletId, name: g.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const keep = rows[0].id;
    const drop = rows.slice(1).map((r) => r.id);
    console.log(`Category "${g.name}" in outlet ${g.outletId}: keep ${keep}, merge ${drop.length} dup(s)`);
    await prisma.subcategory.updateMany({
      where: { categoryId: { in: drop } },
      data: { categoryId: keep },
    });
    await prisma.category.deleteMany({ where: { id: { in: drop } } });
  }
}

async function dedupeSubcategories() {
  const groups: Array<{ categoryId: string; name: string; cnt: number }> =
    await prisma.$queryRawUnsafe(`
      SELECT categoryId, name, COUNT(*) AS cnt
      FROM paynpik_subcategories
      GROUP BY categoryId, name
      HAVING COUNT(*) > 1
    `);
  if (groups.length === 0) {
    console.log('Subcategories: no duplicates');
    return;
  }
  for (const g of groups) {
    const rows = await prisma.subcategory.findMany({
      where: { categoryId: g.categoryId, name: g.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const keep = rows[0].id;
    const drop = rows.slice(1).map((r) => r.id);
    console.log(`Subcategory "${g.name}" in cat ${g.categoryId}: keep ${keep}, merge ${drop.length} dup(s)`);
    await prisma.item.updateMany({
      where: { subcategoryId: { in: drop } },
      data: { subcategoryId: keep },
    });
    await prisma.subcategory.deleteMany({ where: { id: { in: drop } } });
  }
}

async function dedupeItems() {
  const groups: Array<{ subcategoryId: string; name: string; cnt: number }> =
    await prisma.$queryRawUnsafe(`
      SELECT subcategoryId, name, COUNT(*) AS cnt
      FROM paynpik_items
      GROUP BY subcategoryId, name
      HAVING COUNT(*) > 1
    `);
  if (groups.length === 0) {
    console.log('Items: no duplicates');
    return;
  }
  for (const g of groups) {
    const rows = await prisma.item.findMany({
      where: { subcategoryId: g.subcategoryId, name: g.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const keep = rows[0].id;
    const drop = rows.slice(1).map((r) => r.id);
    console.log(`Item "${g.name}" in sub ${g.subcategoryId}: keep ${keep}, drop ${drop.length} dup(s)`);
    // Items have variants / topping-assignments / customer-tag-prices /
    // table-type-prices hanging off them. Variants on duplicates are
    // safe to delete (the survivor already has its own). Order items
    // reference itemId via FK — if any orders pointed at a duplicate
    // we skip it for safety so the historical record stays intact.
    for (const dropId of drop) {
      const refs = await prisma.orderItem.count({ where: { itemId: dropId } });
      if (refs > 0) {
        console.log(`  ↳ skip ${dropId}: ${refs} order item(s) reference it`);
        continue;
      }
      await prisma.variant.deleteMany({ where: { itemId: dropId } });
      await prisma.item.delete({ where: { id: dropId } });
    }
  }
}

async function main() {
  console.log('Cleaning up duplicate menu rows…');
  await dedupeCategories();
  await dedupeSubcategories();
  await dedupeItems();
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
