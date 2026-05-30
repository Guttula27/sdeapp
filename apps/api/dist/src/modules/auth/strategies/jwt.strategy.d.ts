import { Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private authService;
    constructor(authService: AuthService);
    validate(payload: {
        sub: string;
        phone: string;
    }): Promise<{
        role: {
            responsibilities: ({
                responsibility: {
                    name: string;
                    description: string | null;
                    id: string;
                    module: string;
                };
            } & {
                roleId: string;
                responsibilityId: string;
            })[];
            name: string;
            description: string | null;
            id: string;
            businessId: string | null;
            outletId: string | null;
            createdAt: Date;
            updatedAt: Date;
            isSystem: boolean;
            isTemplate: boolean;
        } | null;
        business: {
            name: string;
            id: string;
            isCluster: boolean;
        } | null;
        name: string;
        phone: string;
        email: string | null;
        id: string;
        status: import(".prisma/client").$Enums.UserStatus;
        businessId: string | null;
        outletId: string | null;
        preferredUpiApp: string | null;
        profileImageUrl: string | null;
        alertRingtone: string | null;
        alertVolume: number | null;
        mustChangePassword: boolean;
        preferredLanguage: string | null;
    }>;
}
export {};
