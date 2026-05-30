declare class OrderItemToppingDto {
    toppingId: string;
    optionId?: string;
}
declare class OrderItemDto {
    itemId: string;
    variantId?: string;
    quantity: number;
    notes?: string;
    toppings?: OrderItemToppingDto[];
    bundleSelections?: string[];
}
declare class OrderPaymentDto {
    mode: string;
    app?: string;
    gatewayRef?: string;
    status?: string;
}
export declare class CreateOrderDto {
    items: OrderItemDto[];
    tableId?: string;
    sectionId?: string;
    isParcel?: boolean;
    isPostpaid?: boolean;
    notes?: string;
    couponCode?: string;
    couponId?: string;
    rewardPoints?: number;
    customerPhone?: string;
    paymentMode?: string;
    payment?: OrderPaymentDto;
}
export {};
