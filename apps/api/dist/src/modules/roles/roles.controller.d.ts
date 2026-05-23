import { RolesService, CreateRoleDto, ToggleResponsibilityDto } from './roles.service';
export declare class RolesController {
    private service;
    constructor(service: RolesService);
    listResponsibilities(user: any): Promise<{
        grantable: boolean;
        name: string;
        description: string | null;
        id: string;
        module: string;
    }[]>;
    list(user: any): Promise<{
        id: string;
        name: string;
        description: string | null;
        isSystem: boolean;
        businessId: string | null;
        outletId: string | null;
        userCount: number;
        responsibilities: string[];
        editable: boolean;
    }[]>;
    findOne(user: any, id: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        isSystem: boolean;
        businessId: string | null;
        outletId: string | null;
        userCount: number;
        responsibilities: string[];
        editable: boolean;
    }>;
    create(user: any, dto: CreateRoleDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        isSystem: boolean;
        businessId: string | null;
        outletId: string | null;
        userCount: number;
        responsibilities: string[];
    }>;
    update(user: any, id: string, dto: Partial<Pick<CreateRoleDto, 'name' | 'description'>>): Promise<{
        name: string;
        description: string | null;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        isSystem: boolean;
        isTemplate: boolean;
    }>;
    toggle(user: any, id: string, dto: ToggleResponsibilityDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        isSystem: boolean;
        businessId: string | null;
        outletId: string | null;
        userCount: number;
        responsibilities: string[];
        editable: boolean;
    }>;
    remove(user: any, id: string): Promise<{
        message: string;
    }>;
}
