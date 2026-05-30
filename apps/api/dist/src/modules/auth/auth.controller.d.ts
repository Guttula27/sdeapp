import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/customer-otp.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            name: string;
            phone: string;
            email: string | null;
            id: string;
            status: import(".prisma/client").$Enums.UserStatus;
            createdAt: Date;
        };
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            role: ({
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
            } & {
                name: string;
                description: string | null;
                id: string;
                businessId: string | null;
                outletId: string | null;
                createdAt: Date;
                updatedAt: Date;
                isSystem: boolean;
                isTemplate: boolean;
            }) | null;
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
            avatarUrl: string | null;
            roleId: string | null;
            businessId: string | null;
            outletId: string | null;
            preferredUpiApp: string | null;
            profileImageUrl: string | null;
            alertRingtone: string | null;
            alertVolume: number | null;
            mustChangePassword: boolean;
            preferredLanguage: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    requestCustomerOtp(dto: RequestOtpDto): Promise<{
        message: string;
        phone: string;
    }>;
    verifyCustomerOtp(dto: VerifyOtpDto): Promise<{
        user: any;
        accessToken: string;
        refreshToken: string;
    }>;
    getProfile(user: any): any;
    logout(userId: string, req: any): Promise<{
        message: string;
    }>;
}
