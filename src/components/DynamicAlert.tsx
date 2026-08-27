import React from 'react';
import { FlatList, View, Text, StyleSheet, Image } from 'react-native';

type Alert = {
  image?: string;
  product: string;
  type: 'stock' | 'expiry' | 'info';
  stock: number;
  expiry: Date;
  level: 'critical' | 'warning' | 'info';
};

export default function DynamicAlert({ alertsData }: { alertsData: Alert[] }) {
    const getAlertType = (alert: Alert) : string[] =>  {
        switch (alert.type) {
            case 'stock':
                return [`critical`,`Stock crítico`];
            case 'expiry':
                const today = new Date();
                const daysUntilExpiry = Math.ceil((alert.expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
    const getExpiracyDate = (expiryDate: Date) => {
        const format = expiryDate.toLocaleDateString("es-AR", {
            day: 'numeric',
            month: 'long'
        })
        return format
    }
    return (
        <FlatList
            data={alertsData}
            keyExtractor={(alert) => alert.product}
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
                                source={alert.image ? { uri: alert.image } : require('../../assets/icon.png')}
                                style={styles.alertImage}
                            />
                        </View>
                        <View>
                            <View>
                                <Text style={styles.title}>{alert.product} - {alertDescription}</Text>
                            </View>
                            {alert.type == 'expiry' && (
                                <View>
                                    <Text style={styles.description}>Stock Restante: {alert.stock} ud.</Text>
                                    <Text style={styles.description}>Fecha Límite: {getExpiracyDate(alert.expiry)}</Text>
                                </View>
                            ) || alert.type == 'stock' && (
                                <View>
                                    <Text style={styles.description}>Stock Restante: {alert.stock} ud. Minimo Configurado: No se. Reponer Pronto</Text>
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