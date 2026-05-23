import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OrdersState {
  orders: any[];
  activeFilter: string | null;
}

const initialState: OrdersState = {
  orders: [],
  activeFilter: null,
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setOrders: (state, action: PayloadAction<any[]>) => {
      state.orders = action.payload;
    },
    addOrder: (state, action: PayloadAction<any>) => {
      state.orders.unshift(action.payload);
    },
    updateOrder: (state, action: PayloadAction<any>) => {
      const idx = state.orders.findIndex((o) => o.id === action.payload.id);
      if (idx !== -1) state.orders[idx] = action.payload;
    },
    setFilter: (state, action: PayloadAction<string | null>) => {
      state.activeFilter = action.payload;
    },
  },
});

export const { setOrders, addOrder, updateOrder, setFilter } = ordersSlice.actions;
export default ordersSlice.reducer;
