import { Alert } from '@/services/alertService';
import React from 'react';
import { FlatList, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ProductImage from '@/components/ProductImage';
import { getAlertType, getExpiryDate as getExpiracyDate } from '@/utils/alertInfo';

// Alto de cada entrada: entran el título en dos renglones y el detalle, también de hasta dos
export const ALERT_ROW_HEIGHT = 104;

interface Props {
    alertsData: Alert[];
    /** Se llama al tocar una entrada de la lista. */
    onPressAlert?: (alert: Alert) => void;
}

export default function DynamicAlert({ alertsData, onPressAlert }: Props) {
    console.log('DynamicAlert received alertsData:', alertsData);
    return (
        <FlatList
            data={alertsData}
            keyExtractor={(alert) => alert.id.toString()}
            renderItem={({ item: alert }) => {
                const alertDescription = getAlertType(alert);
                return (
                <TouchableOpacity
                    testID={`alert-item-${alert.id}`}
                    activeOpacity={0.8}
                    onPress={() => onPressAlert?.(alert)}
                    style={
                    alert.level == 'critical' ? styles.criticalContainer :
                    alert.level == 'warning' ? styles.warningContainer :
                    styles.infoContainer 
                }>
                    <View testID={`alert-row-${alert.id}`} style={styles.container}>
                        <View>
                            <ProductImage uri={alert.image_url} style={styles.alertImage} />
                        </View>
                        <View testID={`alert-text-${alert.id}`} style={styles.textColumn}>
                            <View>
                                <Text style={styles.title} numberOfLines={2}>{alert.product_name} - {alertDescription}</Text>
                            </View>
                            {alert.type == 'expiry' && (
                                <View>
                                    <Text style={styles.description} numberOfLines={2}>Stock Restante: {alert.product_stock} ud.</Text>
                                    <Text style={styles.description} numberOfLines={2}>Fecha Límite: {getExpiracyDate(alert.product_expiry)}</Text>
                                </View>
                            ) || alert.type == 'stock_low_coverage' && (
                                <View>
                                    <Text style={styles.description} numberOfLines={2}>Stock Restante: {alert.product_stock} ud.</Text>
                                    <Text style={styles.description} numberOfLines={2}>El stock actual alcanza para {alert.days_until_stockout} días</Text>
                                </View>
                            ) || alert.type == 'slow_pace' && (
                                <View>
                                    <Text style={styles.description} numberOfLines={2}>Stock en conflicto: {alert.units_wasted} ud.</Text>
                                    <Text style={styles.description} numberOfLines={2}>Al ritmo actual, {alert.units_wasted} unidades se vencerán en {Math.ceil(((new Date(alert.product_expiry!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} días</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>)
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
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginLeft: 7,
        flexDirection: 'row',
        alignItems: 'center',
        height: ALERT_ROW_HEIGHT,
    },
    // El mensaje queda centrado verticalmente en el espacio que le deja la imagen
    textColumn: { flex: 1, justifyContent: 'center' },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    description: {
        color: '#828282',
    },
    alertImage: { width: 44, height: 44, borderRadius: 8, marginRight: 12 },
})