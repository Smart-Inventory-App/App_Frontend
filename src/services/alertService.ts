import api from './api';

export interface Alert {
    id: number;
    userId: string;
    productId: number;
    type: 'stock_low_coverage' | 'expiry' | 'slow_pace' | 'info';
    level: 'critical' | 'warning' | 'info';
    units_wasted?: number;
    days_until_stockout?: number;
    image_url?: string;
    product_name?: string;
    product_stock?: number;
    product_expiry?: string;
    product_category?: string;
    product_brand?: string;
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