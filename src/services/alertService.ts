import api from './api';

export interface Alert {
    id: number;
    user_id: string;
    product_id: number;
    type: 'stock_low_coverage' | 'expiry' | 'slow_pace' | 'info';
    level: 'critical' | 'warning' | 'info';
    units_wasted?: number;
    days_until_stockout?: number;
    /** Alerta de stock: cuántas unidades conviene reponer para volver a la cobertura mínima. */
    suggested_qty?: number;
    /** La regla que se aplicó: cuántos días (vencimiento o stock mínimo) y si es la del producto o la general. */
    limit_days?: number;
    rule_scope?: 'product' | 'general';
    /** "rule": sale de una regla que configuró el usuario; "system": la genera el sistema a partir de su consumo. */
    origin?: 'rule' | 'system';
    image_url?: string;
    product_name?: string;
    product_stock?: number;
    product_expiry?: string;
    product_category?: string;
    product_brand?: string;
}

/** Cuántas alertas hay, salido de la misma lista que ve el usuario. */
export interface AlertSummary {
    critical: number;
    warning: number;
    info: number;
    total: number;
    /** Productos con alertas de vencimiento o de ritmo lento (los de la opción «Vencimiento»), de cualquier nivel. */
    expiring: number;
    /** Productos con alertas de stock (los de la opción «Stock»), de cualquier nivel. */
    low_stock: number;
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
    async getSummaryAlerts():  Promise<AlertSummary> {
        const { data } = await api.get<AlertSummary>('/alerts/summary');
        return data;
    }
}