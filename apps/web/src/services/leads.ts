import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface LeadPayload {
  name: string;
  restaurantName: string;
  phone: string;
  email?: string;
  outletCount?: number;
  businessType?: string;
  message?: string;
  source?: string;
}

export async function submitLead(payload: LeadPayload) {
  const res = await axios.post(`${baseURL}/leads`, payload, { timeout: 15000 });
  return res.data;
}
