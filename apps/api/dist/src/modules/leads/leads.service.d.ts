import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
export declare class LeadsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(data: CreateLeadDto): import(".prisma/client").Prisma.Prisma__LeadClient<{
        name: string;
        phone: string;
        email: string | null;
        message: string | null;
        id: string;
        status: import(".prisma/client").$Enums.LeadStatus;
        createdAt: Date;
        updatedAt: Date;
        source: string | null;
        notes: string | null;
        businessType: string | null;
        restaurantName: string;
        outletCount: number | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findAll(status?: string, take?: number, skip?: number): import(".prisma/client").Prisma.PrismaPromise<{
        name: string;
        phone: string;
        email: string | null;
        message: string | null;
        id: string;
        status: import(".prisma/client").$Enums.LeadStatus;
        createdAt: Date;
        updatedAt: Date;
        source: string | null;
        notes: string | null;
        businessType: string | null;
        restaurantName: string;
        outletCount: number | null;
    }[]>;
    findOne(id: string): Promise<{
        name: string;
        phone: string;
        email: string | null;
        message: string | null;
        id: string;
        status: import(".prisma/client").$Enums.LeadStatus;
        createdAt: Date;
        updatedAt: Date;
        source: string | null;
        notes: string | null;
        businessType: string | null;
        restaurantName: string;
        outletCount: number | null;
    }>;
    updateStatus(id: string, status: string, notes?: string): Promise<{
        name: string;
        phone: string;
        email: string | null;
        message: string | null;
        id: string;
        status: import(".prisma/client").$Enums.LeadStatus;
        createdAt: Date;
        updatedAt: Date;
        source: string | null;
        notes: string | null;
        businessType: string | null;
        restaurantName: string;
        outletCount: number | null;
    }>;
    stats(): Promise<{
        total: number;
        byStatus: Record<string, number>;
    }>;
}
