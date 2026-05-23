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
    customerPhone?: string;
    paymentMode?: string;
    payment?: OrderPaymentDto;
}
export {};
