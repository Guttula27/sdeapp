"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const PG_URL = process.env.DATABASE_URL_PG;
if (!PG_URL) {
    console.error('DATABASE_URL_PG is required (legacy Postgres connection string)');
    process.exit(1);
}
const prisma = new client_1.PrismaClient();
const pg = new pg_1.Client({ connectionString: PG_URL });
const STAGES = [
    { pg: 'responsibilities', model: 'responsibility' },
    { pg: 'languages', model: 'language' },
    { pg: 'plans', model: 'plan' },
    { pg: 'businesses', model: 'business' },
    { pg: 'outlets', model: 'outlet' },
    { pg: 'subscriptions', model: 'subscription' },
    { pg: 'business_images', model: 'businessImage' },
    { pg: 'facilities', model: 'facility' },
    { pg: 'categories', model: 'category' },
    { pg: 'vendors', model: 'vendor' },
    { pg: 'message_templates', model: 'messageTemplate' },
    { pg: 'integration_configs', model: 'integrationConfig' },
    { pg: 'invoices', model: 'invoice' },
    { pg: 'subcategories', model: 'subcategory' },
    { pg: 'sections', model: 'section' },
    { pg: 'table_types', model: 'tableType' },
    { pg: 'tables', model: 'table' },
    { pg: 'kitchen_stations', model: 'kitchenStation' },
    { pg: 'service_stations', model: 'serviceStation' },
    { pg: 'customer_tags', model: 'customerTag' },
    { pg: 'toppings', model: 'topping' },
    { pg: 'outlet_hours', model: 'outletHour' },
    { pg: 'outlet_images', model: 'outletImage' },
    { pg: 'material_categories', model: 'materialCategory' },
    { pg: 'materials', model: 'material' },
    { pg: 'roles', model: 'role' },
    { pg: 'items', model: 'item' },
    { pg: 'users', model: 'user' },
    { pg: 'role_responsibilities', model: 'roleResponsibility' },
    { pg: 'topping_options', model: 'toppingOption' },
    { pg: 'table_type_prices', model: 'tableTypePrice' },
    { pg: 'qr_codes', model: 'qRCode' },
    { pg: 'purchase_orders', model: 'purchaseOrder' },
    { pg: 'variants', model: 'variant' },
    { pg: 'options', model: 'option' },
    { pg: 'item_images', model: 'itemImage' },
    { pg: 'item_tags', model: 'itemTag' },
    { pg: 'item_toppings', model: 'itemTopping' },
    { pg: 'favorites', model: 'favorite' },
    { pg: 'customer_tag_prices', model: 'customerTagPrice' },
    { pg: 'customer_tag_assignments', model: 'customerTagAssignment' },
    { pg: 'service_station_workers', model: 'serviceStationWorker' },
    { pg: 'service_station_tables', model: 'serviceStationTable' },
    { pg: 'outlet_customers', model: 'outletCustomer' },
    { pg: 'user_responsibilities', model: 'userResponsibility' },
    { pg: 'sessions', model: 'session' },
    { pg: 'audit_logs', model: 'auditLog' },
    { pg: 'consumption_logs', model: 'consumptionLog' },
    { pg: 'translations', model: 'translation' },
    { pg: 'orders', model: 'order' },
    { pg: 'order_items', model: 'orderItem' },
    { pg: 'order_status_history', model: 'orderStatusHistory' },
    { pg: 'payments', model: 'payment' },
    { pg: 'disputes', model: 'dispute' },
    { pg: 'customer_alerts', model: 'customerAlert' },
];
const ARRAY_TO_JSON = {
    disputes: ['attachments'],
    message_templates: ['variables'],
};
async function copyTable(pgTable, prismaModel) {
    const { rows } = await pg.query(`SELECT * FROM "${pgTable}"`);
    if (rows.length === 0)
        return 0;
    const arrayCols = ARRAY_TO_JSON[pgTable] ?? [];
    const data = rows.map((row) => {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
            if (arrayCols.includes(k)) {
                out[k] = v ?? [];
            }
            else {
                out[k] = v;
            }
        }
        return out;
    });
    const result = await prismaModel.createMany({ data, skipDuplicates: true });
    return result.count ?? rows.length;
}
async function main() {
    console.log(`Source: ${PG_URL.replace(/:[^@]+@/, ':***@')}`);
    console.log(`Target: ${(process.env.DATABASE_URL ?? '').replace(/:[^@]+@/, ':***@')}`);
    await pg.connect();
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS=0`);
    let total = 0;
    for (const stage of STAGES) {
        try {
            const n = await copyTable(stage.pg, prisma[stage.model]);
            total += n;
            if (n > 0)
                console.log(`  ${stage.pg.padEnd(28)} ${n.toString().padStart(5)} rows`);
        }
        catch (e) {
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
//# sourceMappingURL=migrate-pg-to-mysql.js.map