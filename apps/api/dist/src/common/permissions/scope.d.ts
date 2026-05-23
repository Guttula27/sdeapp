export declare const PLATFORM_ONLY: Set<string>;
export declare const BUSINESS_ONLY: Set<string>;
export type ActorScope = {
    kind: 'platform';
} | {
    kind: 'business';
    businessId: string;
} | {
    kind: 'outlet';
    businessId: string;
    outletId: string;
};
export declare function scopeFor(user: any): ActorScope;
export declare function isGrantable(scope: ActorScope, responsibilityName: string): boolean;
export declare function assertGrantable(scope: ActorScope, responsibilityName: string): void;
