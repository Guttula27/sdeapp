// One-shot data migration: Postgres → MySQL.
// Reads each table from Postgres in FK-safe order and writes via Prisma to
// MySQL. Arrays (Postgres text[]) are converted to Json on the way through.
//
// Run: ts-node prisma/migrate-pg-to-mysql.ts
//      (requires DATABASE_URL pointing at MySQL and DATABASE_URL_PG at PG)

import { PrismaClient } from '@prisma/client';
import { Client as PgClient } from 'pg';

const PG_URL = process.env.DATABASE_URL_PG;
if (!PG_URL) {
  console.error('DATABASE_URL_PG is required (legacy Postgres connection string)');
  process.exit(1);
}

const prisma = new PrismaClient();
const pg = new PgClient({ connectionString: PG_URL });

// Tables to copy, in FK-safe order. snake_case names are the Postgres tables;
// the Prisma model key (camelCase) is what we write to in MySQL.
const STAGES: Array<{ pg: string; model: keyof PrismaClient }> = [
  // Stage 1 — no FK dependencies
  { pg: 'responsibilities', model: 'responsibility' as any },
  { pg: 'languages',        model: 'language' as any },
  { pg: 'plans',            model: 'plan' as any },

  // Stage 2 — top-level tenants
  { pg: 'businesses',       model: 'business' as any },

  // Stage 3 — depend on business
  { pg: 'outlets',          model: 'outlet' as any },
  { pg: 'subscriptions',    model: 'subscription' as any },
  { pg: 'business_images',  model: 'businessImage' as any },
  { pg: 'facilities',       model: 'facility' as any },
  { pg: 'categories',       model: 'category' as any },
  { pg: 'vendors',          model: 'vendor' as any },
  { pg: 'message_templates',    model: 'messageTemplate' as any },
  { pg: 'integration_configs',  model: 'integrationConfig' as any },
  { pg: 'invoices',         model: 'invoice' as any },

  // Stage 4 — depend on outlet (or category)
  { pg: 'subcategories',    model: 'subcategory' as any },
  { pg: 'sections',         model: 'section' as any },
  { pg: 'table_types',      model: 'tableType' as any },
  { pg: 'tables',           model: 'table' as any },
  { pg: 'kitchen_stations', model: 'kitchenStation' as any },
  { pg: 'service_stations', model: 'serviceStation' as any },
  { pg: 'customer_tags',    model: 'customerTag' as any },
  { pg: 'toppings',         model: 'topping' as any },
  { pg: 'outlet_hours',     model: 'outletHour' as any },
  { pg: 'outlet_images',    model: 'outletImage' as any },
  { pg: 'material_categories', model: 'materialCategory' as any },
  { pg: 'materials',        model: 'material' as any },
  { pg: 'roles',            model: 'role' as any },

  // Stage 5 — depend on stage 4
  { pg: 'items',            model: 'item' as any },
  { pg: 'users',            model: 'user' as any },
  { pg: 'role_responsibilities', model: 'roleResponsibility' as any },
  { pg: 'topping_options',  model: 'toppingOption' as any },
  { pg: 'table_type_prices',model: 'tableTypePrice' as any },
  { pg: 'qr_codes',         model: 'qRCode' as any },
  { pg: 'purchase_orders',  model: 'purchaseOrder' as any },

  // Stage 6 — depend on stage 5
  { pg: 'variants',                model: 'variant' as any },
  { pg: 'options',                 model: 'option' as any },
  { pg: 'item_images',             model: 'itemImage' as any },
  { pg: 'item_tags',               model: 'itemTag' as any },
  { pg: 'item_toppings',           model: 'itemTopping' as any },
  { pg: 'favorites',               model: 'favorite' as any },
  { pg: 'customer_tag_prices',     model: 'customerTagPrice' as any },
  { pg: 'customer_tag_assignments',model: 'customerTagAssignment' as any },
  { pg: 'service_station_workers', model: 'serviceStationWorker' as any },
  { pg: 'service_station_tables',  model: 'serviceStationTable' as any },
  { pg: 'outlet_customers',        model: 'outletCustomer' as any },
  { pg: 'user_responsibilities',   model: 'userResponsibility' as any },
  { pg: 'sessions',                model: 'session' as any },
  { pg: 'audit_logs',              model: 'auditLog' as any },
  { pg: 'consumption_logs',        model: 'consumptionLog' as any },
  { pg: 'translations',            model: 'translation' as any },

  // Stage 7 — orders + descendants
  { pg: 'orders',               model: 'order' as any },
  { pg: 'order_items',          model: 'orderItem' as any },
  { pg: 'order_status_history', model: 'orderStatusHistory' as any },
  { pg: 'payments',             model: 'payment' as any },
  { pg: 'disputes',             model: 'dispute' as any },
  { pg: 'customer_alerts',      model: 'customerAlert' as any },
];

// Postgres text[] columns whose data needs to flow into MySQL Json columns.
const ARRAY_TO_JSON: Record<string, string[]> = {
  disputes: ['attachments'],
  message_templates: ['variables'],
};

// Postgres column names that don't map 1:1 to Prisma field names. None in
// this schema use @map, so the row keys returned by pg match Prisma fields.

async function copyTable(pgTable: string, prismaModel: any): Promise<number> {
  const { rows } = await pg.query(`SELECT * FROM "${pgTable}"`);
  if (rows.length === 0) return 0;

  const arrayCols = ARRAY_TO_JSON[pgTable] ?? [];
  const data = rows.map((row) => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (arrayCols.includes(k)) {
        // pg returns text[] as a JS array — Prisma stores it as JSON.
        out[k] = v ?? [];
      } else {
        out[k] = v;
      }
    }
    return out;
  });

  const result = await prismaModel.createMany({ data, skipDuplicates: true });
  return result.count ?? rows.length;
}

async function main() {
  console.log(`Source: ${PG_URL!.replace(/:[^@]+@/, ':***@')}`);
  console.log(`Target: ${(process.env.DATABASE_URL ?? '').replace(/:[^@]+@/, ':***@')}`);
  await pg.connect();
  await prisma.$connect();

  // Disable FK checks for the duration so we can insert in any order if
  // self-referencing rows (e.g. material_categories.parentId) cause issues.
  await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS=0`);

  let total = 0;
  for (const stage of STAGES) {
    try {
      const n = await copyTable(stage.pg, (prisma as any)[stage.model]);
      total += n;
      if (n > 0) console.log(`  ${stage.pg.padEnd(28)} ${n.toString().padStart(5)} rows`);
    } catch (e: any) {
      console.error(`✗ ${stage.pg}: ${e.message.split('\n')[0]}`);
    }
  }

  await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS=1`);
  console.log(`\nTotal rows copied: ${total}`);

  await pg.end();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
