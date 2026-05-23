"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NO_SEATING_OUTLET_TYPES = void 0;
exports.allowsSeating = allowsSeating;
const client_1 = require("@prisma/client");
exports.NO_SEATING_OUTLET_TYPES = new Set([
    client_1.OutletType.SELF_SERVICE,
    client_1.OutletType.SELF_SERVICE_PARCEL,
]);
function allowsSeating(t) {
    return !!t && !exports.NO_SEATING_OUTLET_TYPES.has(t);
}
//# sourceMappingURL=outlet-type.js.map