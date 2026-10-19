import { Alert } from '@/services/alertService';
import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import ProductImage from '@/components/ProductImage';

export default function DynamicAlert({ alertsData }: { alertsData: Alert[] }) {
    console.log('DynamicAlert received alertsData:', alertsData);
    const getAlertType = (alert: Alert) : string =>  {
        switch (alert.type) {
            case 'stock_low_coverage':
                return `Stock crítico`;
            case 'expiry':
                const today = new Date();
                const daysUntilExpiry = Math.ceil(((new Date(alert.product_expiry!).getTime() ?? 0) - today.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntilExpiry > 1) {
                    return `Vence en ${daysUntilExpiry} días`;
                } else if (daysUntilExpiry == 1) {
                    return `Vence mañana`
                } else {
                    return `Vencido`
                }
            default:
                return `Información`;
            }
        }
    const getExpiracyDate = (expiryDate?: string) => {
        const format = new Date(expiryDate!).toLocaleDateString("es-AR", {
            day: 'numeric',
            month: 'long'
        })
        return format
    }
    return (
        <FlatList
            data={alertsData}
            keyExtractor={(alert) => alert.id.toString()}
            renderItem={({ item: alert }) => {
                const alertDescription = getAlertType(alert);
                return (
                <View style={
                    alert.level == 'critical' ? styles.criticalContainer :
                    alert.level == 'warning' ? styles.warningContainer :
                    styles.infoContainer 
                }>
                    <View style={styles.container}>
                        <View>
                            <ProductImage uri={alert.image_url} style={styles.alertImage} />
                        </View>
                        <View>
                            <View>
                                <Text style={styles.title}>{alert.product_name} - {alertDescription}</Text>
                            </View>
                            {alert.type == 'expiry' && (
                                <View>
                                    <Text style={styles.description}>Stock Restante: {alert.product_stock} ud.</Text>
                                    <Text style={styles.description}>Fecha Límite: {getExpiracyDate(alert.product_expiry)}</Text>
                                </View>
                            ) || alert.type == 'stock_low_coverage' && (
                                <View>
                                    <Text style={styles.description}>Stock Restante: {alert.product_stock} ud.</Text>
                                    <Text style={styles.description}>El stock actual alcanza para {alert.days_until_stockout} días</Text>
                                </View>
                            ) || alert.type == 'slow_pace' && (
                                <View>
                                    <Text style={styles.description}>Stock en conflicto: {alert.units_wasted} ud.</Text>
                                    <Text style={styles.description}>Al ritmo actual, {alert.units_wasted} unidades se vencerán en {Math.ceil(((new Date(alert.product_expiry!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} días</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>)
            }}
        />
    );
}

const styles = StyleSheet.create({
    criticalContainer: {
        backgroundColor: '#e5484d',
        borderRadius: 10,
        marginVertical: 6
    },
    warningContainer: {
        backgroundColor: '#fbbc05',
        borderRadius: 10,
        marginVertical: 6
    },
    infoContainer: {
        backgroundColor: '#4285f4',
        borderRadius: 10,
        marginVertical: 6
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        marginLeft: 7,
        flexDirection: 'row',
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    description: {
        color: '#828282',
    },
    alertImage: { width: 44, height: 44, borderRadius: 8, marginRight: 12 },
})