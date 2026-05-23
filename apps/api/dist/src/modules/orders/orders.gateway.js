"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var OrdersGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
let OrdersGateway = OrdersGateway_1 = class OrdersGateway {
    constructor() {
        this.logger = new common_1.Logger(OrdersGateway_1.name);
    }
    afterInit() {
        this.logger.log('Orders WebSocket Gateway initialized');
    }
    handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    handleJoinOutlet(outletId, client) {
        client.join(`outlet:${outletId}`);
        this.logger.log(`Client ${client.id} joined outlet ${outletId}`);
    }
    handleJoinKitchen(outletId, client) {
        client.join(`kitchen:${outletId}`);
    }
    handleJoinTable(data, client) {
        client.join(`table:${data.tableId}`);
    }
    handleJoinOrder(orderId, client) {
        client.join(`order:${orderId}`);
    }
    handleJoinCustomer(customerId, client) {
        client.join(`customer:${customerId}`);
    }
    emitOrderCreated(outletId, order) {
        this.server.to(`outlet:${outletId}`).emit('orderCreated', order);
        this.server.to(`kitchen:${outletId}`).emit('orderCreated', order);
    }
    emitOrderStatusUpdated(outletId, order) {
        this.server.to(`outlet:${outletId}`).emit('orderStatusUpdated', order);
        this.server.to(`kitchen:${outletId}`).emit('orderStatusUpdated', order);
        if (order.tableId) {
            this.server.to(`table:${order.tableId}`).emit('orderStatusUpdated', order);
        }
        if (order.id) {
            this.server.to(`order:${order.id}`).emit('orderStatusUpdated', order);
        }
    }
    emitPaymentConfirmed(outletId, payment) {
        this.server.to(`outlet:${outletId}`).emit('paymentConfirmed', payment);
    }
    emitCustomerAlert(alert) {
        this.server.to(`customer:${alert.customerId}`).emit('customerAlert', alert);
        if (alert.orderId)
            this.server.to(`order:${alert.orderId}`).emit('customerAlert', alert);
    }
};
exports.OrdersGateway = OrdersGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], OrdersGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinOutlet'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], OrdersGateway.prototype, "handleJoinOutlet", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinKitchen'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], OrdersGateway.prototype, "handleJoinKitchen", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinTable'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], OrdersGateway.prototype, "handleJoinTable", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinOrder'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], OrdersGateway.prototype, "handleJoinOrder", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinCustomer'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], OrdersGateway.prototype, "handleJoinCustomer", null);
exports.OrdersGateway = OrdersGateway = OrdersGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
        namespace: '/orders',
    })
], OrdersGateway);
//# sourceMappingURL=orders.gateway.js.map