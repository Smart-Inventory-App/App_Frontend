import { Alert } from '@/services/alertService';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import ProductImage from '@/components/ProductImage';
import { AlertOrigin, alertTone, getAlertLines, getAlertType, isPredictive } from '@/utils/alertInfo';

// Alto de cada entrada: el producto, qué le pasa y hasta dos renglones de detalle
export const ALERT_ROW_HEIGHT = 104;

// El color con el que se destacan las alertas del modelo predictivo
export const PREDICTIVE_COLOR = '#7c5cff';

interface Props {
    alertsData: Alert[];
    /** Se llama al tocar una entrada de la lista. */
    onPressAlert?: (alert: Alert) => void;
    /** De dónde salen estas alertas: las de las reglas del usuario se destacan con contorno de la app. */
    origin?: AlertOrigin;
}

// La lista va dentro de la pantalla, que ya se desliza: no es una FlatList (una lista virtualizada dentro de un
// ScrollView del mismo sentido rompe su carga por partes y React Native avisa con un error)
export default function DynamicAlert({ alertsData, onPressAlert, origin = 'system' }: Props) {
    return (
        <View>
            {alertsData.map((alert) => {
                const predictive = isPredictive(alert);
                const tone = alertTone(alert);
                return (
                <TouchableOpacity
                    key={alert.id}
                    testID={`alert-item-${alert.id}`}
                    activeOpacity={0.8}
                    onPress={() => onPressAlert?.(alert)}
                    style={
                    alert.level == 'critical' ? styles.criticalContainer :
                    alert.level == 'warning' ? styles.warningContainer :
                    styles.infoContainer
                }>
                    <View
                        testID={`alert-row-${alert.id}`}
                        style={[styles.container, origin === 'rule' && styles.ruleContainer, predictive && styles.predictiveContainer]}
                    >
                        <View>
                            <ProductImage uri={alert.image_url} style={styles.alertImage} />
                        </View>
                        <View testID={`alert-text-${alert.id}`} style={styles.textColumn}>
                            <View style={styles.nameRow}>
                                <Text style={styles.title} numberOfLines={1}>{alert.product_name}</Text>
                                {predictive && (
                                    <View testID={`alert-predictive-${alert.id}`} style={styles.badge}>
                                        <Ionicons name="sparkles" size={11} color="#fff" />
                                        <Text style={styles.badgeText}>Predicción</Text>
                                    </View>
                                )}
                            </View>
                            <Text testID={`alert-kind-${alert.id}`} style={[styles.kind, { color: tone.text }]} numberOfLines={1}>
                                {getAlertType(alert)}
                            </Text>
                            {getAlertLines(alert).map(line => (
                                <Text key={line} style={styles.description} numberOfLines={1}>{line}</Text>
                            ))}
                        </View>
                    </View>
                </TouchableOpacity>);
            })}
        </View>
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
    // Las alertas de las reglas del usuario: contorno del color de la app y un fondo apenas teñido
    ruleContainer: {
        backgroundColor: '#eefaf8',
        borderWidth: 2,
        borderColor: Colors.primary,
    },
    // Las del modelo predictivo se destacan siempre, con su propio color
    predictiveContainer: {
        backgroundColor: '#f6f3ff',
        borderWidth: 2,
        borderColor: PREDICTIVE_COLOR,
    },
    // El mensaje queda centrado verticalmente en el espacio que le deja la imagen
    textColumn: { flex: 1, justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: {
        flex: 1,
        fontSize: 16,
        fontWeight: 'bold',
    },
    kind: { fontSize: 15, fontWeight: '700', marginTop: 1 },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: PREDICTIVE_COLOR,
        borderRadius: 10,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    description: {
        color: '#828282',
        fontSize: 13,
    },
    alertImage: { width: 44, height: 44, borderRadius: 8, marginRight: 12 },
})
