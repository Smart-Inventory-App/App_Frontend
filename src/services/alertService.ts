import api from './api';

export interface Alert {
    id: number;
    userId: string;
    productId: number;
    type: 'stock' | 'expiry' | 'info';
    level: 'critical' | 'warning' | 'info';
    image_url?: string;
    product_name?: string;
    product_stock?: number;
    product_expiry?: string;
}

export const alertService = {
    async getAlerts(): Promise<Alert[]> {
        const { data } = await api.get<Alert[]>('/alerts/');
        return data;
    },
    async getCriticalAlerts(): Promise<Alert[]> {
        const { data } = await api.get<Alert[]>('/alerts/critical_alerts');
        return data;
    },
    async getStockAlerts(): Promise<Alert[]> {
        const { data } = await api.get<Alert[]>('/alerts/stock_alerts');
        return data;
    },
    async getExpiryAlerts(): Promise<Alert[]> {
        const { data } = await api.get<Alert[]>('/alerts/expiry_alerts');
        return data;
    },
    async getSummaryAlerts():  Promise<any> {
        const { data } = await api.get<any>('/alerts/summary');
        return data;
    }
}