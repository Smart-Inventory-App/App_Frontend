import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { truncateLabel } from '@/utils/text';

interface Props {
  /** Primer renglón del saludo, sin la coma ("Bienvenido" o "Tu estado"). */
  greeting: string;
  name: string;
}

const NAME_MAX = 20;

const LOGO_SIZE = 84;
// Logo de la app en blanco (símbolo sin fondo ni borde, recortado al borde del dibujo) sobre el banner de color.
// Se corre a la izquierda; el margen derecho negativo deja el saludo 3 px a la derecha de donde estaba antes de agrandar el logo.
const LOGO_SHIFT_LEFT = 8;
const LOGO_RIGHT_MARGIN = -3;

// Banner del inicio: el logo de la app a la izquierda y el saludo en dos renglones (el nombre, debajo).
export default function HomeHeader({ greeting, name }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View testID="home-header" style={[styles.banner, { paddingTop: insets.top + 8 }]}>
      <Image testID="home-logo" source={require('../../assets/logo-home.png')} style={styles.logo} />
      <View style={styles.greetingBox}>
        <Text testID="home-greeting" style={styles.greeting} numberOfLines={1}>
          {name ? `${greeting},` : greeting}
        </Text>
        {name ? (
          <Text testID="home-name" style={styles.name} numberOfLines={1}>
            {truncateLabel(name, NAME_MAX)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.primary,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 4,
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE, marginLeft: -LOGO_SHIFT_LEFT, marginRight: LOGO_RIGHT_MARGIN },
  greetingBox: { flex: 1 },
  // Los dos renglones van pegados: sin espacio de más entre ellos
  greeting: { fontSize: 17, lineHeight: 20, color: '#fff', fontWeight: '600', includeFontPadding: false },
  name: { fontSize: 28, lineHeight: 31, color: '#fff', fontWeight: '800', includeFontPadding: false },
});
