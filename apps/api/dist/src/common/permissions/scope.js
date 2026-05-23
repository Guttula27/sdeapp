"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUSINESS_ONLY = exports.PLATFORM_ONLY = void 0;
exports.scopeFor = scopeFor;
exports.isGrantable = isGrantable;
exports.assertGrantable = assertGrantable;
const common_1 = require("@nestjs/common");
exports.PLATFORM_ONLY = new Set([
    'PLATFORM_ADMIN',
    'VIEW_PLATFORM_REPORTS',
    'MANAGE_LEADS',
    'MANAGE_PLANS',
]);
exports.BUSINESS_ONLY = new Set([
    'MANAGE_BUSINESSES',
    'MANAGE_BUSINESS_IMAGES',
    'MANAGE_SUBSCRIPTIONS',
    'VIEW_INVOICES',
]);
function scopeFor(user) {
    if (!user?.businessId && !user?.outletId)
        return { kind: 'platform' };
    if (user.businessId && !user.outletId) {
        return { kind: 'business', businessId: user.businessId };
    }
    return { kind: 'outlet', businessId: user.businessId, outletId: user.outletId };
}
function isGrantable(scope, responsibilityName) {
    if (scope.kind === 'platform')
        return true;
    if (exports.PLATFORM_ONLY.has(responsibilityName))
        return false;
    if (scope.kind === 'outlet' && exports.BUSINESS_ONLY.has(responsibilityName))
        return false;
    return true;
}
function assertGrantable(scope, responsibilityName) {
    if (isGrantable(scope, responsibilityName))
        return;
    if (exports.PLATFORM_ONLY.has(responsibilityName)) {
        throw new common_1.ForbiddenException(`${responsibilityName} can only be granted by a platform admin`);
    }
    throw new common_1.ForbiddenException(`${responsibilityName} can only be granted at the business level`);
}
//# sourceMappingURL=scope.js.map