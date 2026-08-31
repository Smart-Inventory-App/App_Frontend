import { Alert } from '@/services/alertService';
import React from 'react';
import { FlatList, View, Text, StyleSheet, Image } from 'react-native';

export default function DynamicAlert({ alertsData }: { alertsData: Alert[] }) {
    console.log('DynamicAlert received alertsData:', alertsData);
    const getAlertType = (alert: Alert) : string[] =>  {
        switch (alert.type) {
            case 'stock':
                return [`critical`,`Stock crítico`];
            case 'expiry':
                const today = new Date();
                const daysUntilExpiry = Math.ceil(((new Date(alert.product_expiry!).getTime() ?? 0) - today.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntilExpiry > 1) {
                    return ['warning' ,`Vence en ${daysUntilExpiry} días`];
                } else if (daysUntilExpiry == 1) {
                    return ['critical',`Vence mañana`]
                } else {
                    return ['critical',`Vencido`]
                }
            default:
                return ['info',`Información`];
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
                const [alertLevel, alertDescription] = getAlertType(alert);
                return (
                <View style={
                    alertLevel == 'critical' ? styles.criticalContainer :
                    alertLevel == 'warning' ? styles.warningContainer :
                    styles.infoContainer 
                }>
                    <View style={styles.container}>
                        <View>
                            <Image
                                source={alert.image_url ? { uri: alert.image_url } : require('../../assets/icon.png')}
                                style={styles.alertImage}
                            />
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
                            ) || alert.type == 'stock' && (
                                <View>
                                    <Text style={styles.description}>Stock Restante: {alert.product_stock} ud. Minimo Configurado: 10. Reponer Pronto</Text>
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