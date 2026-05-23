import { OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
export declare class OrdersGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private readonly logger;
    afterInit(): void;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleJoinOutlet(outletId: string, client: Socket): void;
    handleJoinKitchen(outletId: string, client: Socket): void;
    handleJoinTable(data: {
        outletId: string;
        tableId: string;
    }, client: Socket): void;
    handleJoinOrder(orderId: string, client: Socket): void;
    handleJoinCustomer(customerId: string, client: Socket): void;
    emitOrderCreated(outletId: string, order: any): void;
    emitOrderStatusUpdated(outletId: string, order: any): void;
    emitPaymentConfirmed(outletId: string, payment: any): void;
    emitCustomerAlert(alert: {
        customerId: string;
        orderId?: string | null;
        [k: string]: any;
    }): void;
}
