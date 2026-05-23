/**
 * Backfill: translate every translatable row that exists today into every
 * enabled language. Safe to re-run — `upsertAll` is idempotent and a row that
 * already has a translation is overwritten with the same value.
 *
 * Usage:
 *   npx ts-node prisma/backfill-translations.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/config/prisma/prisma.service';
import { TranslationsService } from '../src/modules/translations/translations.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });
  const prisma = app.get(PrismaService);
  const translations = app.get(TranslationsService);

  const work: Array<{ type: string; rows: Array<{ id: string } & Record<string, any>>; fields: string[] }> = [];

  work.push({
    type: 'Business',
    rows: await prisma.business.findMany({ select: { id: true, name: true, description: true } }),
    fields: ['name', 'description'],
  });
  work.push({
    type: 'Outlet',
    rows: await prisma.outlet.findMany({
      select: { id: true, name: true, description: true, address: true, addressLine1: true, addressLine2: true },
    }),
    fields: ['name', 'description', 'address', 'addressLine1', 'addressLine2'],
  });
  work.push({
    type: 'Category',
    rows: await prisma.category.findMany({ select: { id: true, name: true } }),
    fields: ['name'],
  });
  work.push({
    type: 'Subcategory',
    rows: await prisma.subcategory.findMany({ select: { id: true, name: true } }),
    fields: ['name'],
  });
  work.push({
    type: 'Item',
    rows: await prisma.item.findMany({
      select: { id: true, name: true, description: true, shortDescription: true },
    }),
    fields: ['name', 'description', 'shortDescription'],
  });
  work.push({
    type: 'Variant',
    rows: await prisma.variant.findMany({ select: { id: true, name: true } }),
    fields: ['name'],
  });
  work.push({
    type: 'Topping',
    rows: await prisma.topping.findMany({ select: { id: true, name: true } }),
    fields: ['name'],
  });
  work.push({
    type: 'ToppingOption',
    rows: await prisma.toppingOption.findMany({ select: { id: true, name: true } }),
    fields: ['name'],
  });
  work.push({
    type: 'CustomerTag',
    rows: await prisma.customerTag.findMany({ select: { id: true, name: true } }),
    fields: ['name'],
  });
  work.push({
    type: 'Dispute',
    rows: await prisma.dispute.findMany({ select: { id: true, description: true } }),
    fields: ['description'],
  });

  let total = 0;
  for (const w of work) {
    let done = 0;
    for (const row of w.rows) {
      const payload: Record<string, any> = {};
      for (const f of w.fields) if (row[f]) payload[f] = row[f];
      if (Object.keys(payload).length === 0) continue;
      await translations.upsertAll(w.type, row.id, payload);
      done++;
    }
    console.log(`  ${w.type}: ${done}/${w.rows.length}`);
    total += done;
  }
  console.log(`\nBackfilled ${total} rows.`);

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
