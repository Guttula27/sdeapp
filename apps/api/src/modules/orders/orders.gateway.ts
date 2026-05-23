import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/orders',
})
export class OrdersGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(OrdersGateway.name);

  afterInit() {
    this.logger.log('Orders WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinOutlet')
  handleJoinOutlet(@MessageBody() outletId: string, @ConnectedSocket() client: Socket) {
    client.join(`outlet:${outletId}`);
    this.logger.log(`Client ${client.id} joined outlet ${outletId}`);
  }

  @SubscribeMessage('joinKitchen')
  handleJoinKitchen(@MessageBody() outletId: string, @ConnectedSocket() client: Socket) {
    client.join(`kitchen:${outletId}`);
  }

  @SubscribeMessage('joinTable')
  handleJoinTable(
    @MessageBody() data: { outletId: string; tableId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`table:${data.tableId}`);
  }

  @SubscribeMessage('joinOrder')
  handleJoinOrder(@MessageBody() orderId: string, @ConnectedSocket() client: Socket) {
    client.join(`order:${orderId}`);
  }

  // Customers join their own room so the dispatcher can push lifecycle alerts
  // (item ready, payment received, etc.) directly to the customer's devices —
  // even if they leave the order-tracking page.
  @SubscribeMessage('joinCustomer')
  handleJoinCustomer(@MessageBody() customerId: string, @ConnectedSocket() client: Socket) {
    client.join(`customer:${customerId}`);
  }

  emitOrderCreated(outletId: string, order: any) {
    this.server.to(`outlet:${outletId}`).emit('orderCreated', order);
    this.server.to(`kitchen:${outletId}`).emit('orderCreated', order);
  }

  emitOrderStatusUpdated(outletId: string, order: any) {
    this.server.to(`outlet:${outletId}`).emit('orderStatusUpdated', order);
    this.server.to(`kitchen:${outletId}`).emit('orderStatusUpdated', order);
    if (order.tableId) {
      this.server.to(`table:${order.tableId}`).emit('orderStatusUpdated', order);
    }
    if (order.id) {
      this.server.to(`order:${order.id}`).emit('orderStatusUpdated', order);
    }
  }

  emitPaymentConfirmed(outletId: string, payment: any) {
    this.server.to(`outlet:${outletId}`).emit('paymentConfirmed', payment);
  }

  // Lifecycle alerts (item ready, etc.) are pushed to two rooms: the customer
  // themselves (so it reaches any device they're signed in on) and the order
  // room (so the order-tracking page on a shared tablet also rings).
  emitCustomerAlert(alert: { customerId: string; orderId?: string | null; [k: string]: any }) {
    this.server.to(`customer:${alert.customerId}`).emit('customerAlert', alert);
    if (alert.orderId) this.server.to(`order:${alert.orderId}`).emit('customerAlert', alert);
  }
}
