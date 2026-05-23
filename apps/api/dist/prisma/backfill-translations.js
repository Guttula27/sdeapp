"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/config/prisma/prisma.service");
const translations_service_1 = require("../src/modules/translations/translations.service");
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: ['log', 'error', 'warn'] });
    const prisma = app.get(prisma_service_1.PrismaService);
    const translations = app.get(translations_service_1.TranslationsService);
    const work = [];
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
            const payload = {};
            for (const f of w.fields)
                if (row[f])
                    payload[f] = row[f];
            if (Object.keys(payload).length === 0)
                continue;
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
//# sourceMappingURL=backfill-translations.js.map