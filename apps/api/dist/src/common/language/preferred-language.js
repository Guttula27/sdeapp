"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferredLanguage = void 0;
exports.preferredLanguageFromRequest = preferredLanguageFromRequest;
const common_1 = require("@nestjs/common");
function preferredLanguageFromRequest(req) {
    if (!req)
        return null;
    const q = req.query?.lang;
    if (typeof q === 'string' && q.trim())
        return q.trim().toLowerCase();
    if (req.user?.preferredLanguage)
        return String(req.user.preferredLanguage).toLowerCase();
    const accept = req.headers?.['accept-language'];
    if (typeof accept === 'string' && accept.trim()) {
        const first = accept.split(',')[0]?.split(';')[0]?.trim().toLowerCase();
        if (first)
            return first;
    }
    return null;
}
exports.PreferredLanguage = (0, common_1.createParamDecorator)((_, ctx) => preferredLanguageFromRequest(ctx.switchToHttp().getRequest()));
//# sourceMappingURL=preferred-language.js.map