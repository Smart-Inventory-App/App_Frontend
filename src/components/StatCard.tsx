import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Figtree_400Regular } from '@expo-google-fonts/figtree';
import { RobotoFlex_400Regular } from '@expo-google-fonts/roboto-flex';
import { Colors } from '@/constants/colors';

type Props = {
  title: string;
  value: string;
  label: string;
  labelColor: 'green' | 'yellow' | 'red';
  /** El comentario va con el fondo del color de acento y la letra blanca. */
  labelSolid?: boolean;
  /** Ícono de la tarjeta, dentro de un círculo del color de acento. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Color de acento del ícono y del número (por defecto, el del texto de abajo). */
  accent?: string;
  /** Si se indica, la tarjeta se puede tocar. */
  onPress?: () => void;
  testID?: string;
};

// Alcanza para el comentario más largo («Alertas de productos»)
export const LABEL_WIDTH = 140;

const LABEL_ACCENT = { green: '#2db7a3', yellow: '#f59e0b', red: '#e5484d' } as const;

// Cuantos más caracteres tiene el número (con sus puntos), más chico se escribe para que entre en la tarjeta
export function valueFontSize(value: string): number {
  if (value.length <= 5) return 30;
  if (value.length <= 7) return 25;
  if (value.length <= 9) return 21;
  return 17;
}

export default function StatCard({ title, value, label, labelColor, labelSolid, icon, accent, onPress, testID }: Props) {
  useFonts({ Figtree_400Regular, RobotoFlex_400Regular });
  const getLabelStyle = () => {
    switch (labelColor) {
      case 'green':
        return styles.labelGreen;
      case 'yellow':
        return styles.labelYellow;
      case 'red':
        return styles.labelRed;
      default:
        return styles.labelGreen;
    }
  };
  const color = accent ?? LABEL_ACCENT[labelColor] ?? LABEL_ACCENT.green;

  const content = (
    <>
      <View style={styles.top}>
        {icon ? (
          <View testID={testID ? `${testID}-icon` : undefined} style={[styles.iconCircle, { backgroundColor: `${color}22` }]}>
            <Ionicons name={icon} size={18} color={color} />
          </View>
        ) : <View />}
        {onPress ? <Ionicons name="chevron-forward" size={18} color={Colors.placeholder} /> : null}
      </View>
      <Text
        testID={testID ? `${testID}-value` : undefined}
        style={[styles.value, { color, fontSize: valueFontSize(value) }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text style={styles.title}>{title}</Text>
      <Text testID={testID ? `${testID}-label` : undefined} style={[styles.label, getLabelStyle(), labelSolid && { backgroundColor: color, color: '#fff' }]} numberOfLines={1}>{label}</Text>
    </>
  );

  if (!onPress) {
    return <View testID={testID} style={styles.card}>{content}</View>;
  }
  return (
    <TouchableOpacity testID={testID} style={styles.card} activeOpacity={0.8} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    marginHorizontal: 6,
    marginVertical: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#1B3A8F',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 34 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: 'RobotoFlex_400Regular', fontWeight: '700', marginTop: 4 },
  title: { fontSize: 14, fontFamily: 'Figtree_400Regular', fontWeight: '600', color: Colors.textPrimary, marginTop: 1, marginBottom: 6 },
  label: {
    fontFamily: 'Figtree_400Regular',
    fontSize: 10,
    borderRadius: 10,
    alignSelf: 'center',
    // Mismo largo en los cuatro comentarios
    width: LABEL_WIDTH,
    maxWidth: '100%',
    paddingHorizontal: 4,
    height: 18,
    lineHeight: 18,
    overflow: 'hidden',
    textAlign: 'center',
  },
  labelGreen: { color: '#14554b', backgroundColor: '#2db7a352' },
  labelYellow: { color: '#564209', backgroundColor: '#fbbc059d' },
  labelRed: { color: '#671a1c', backgroundColor: '#e5484d8f' },
});
