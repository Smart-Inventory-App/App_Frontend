import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Roboto_500Medium, useFonts } from '@expo-google-fonts/roboto';
import { Colors } from '../constants/colors';

interface Props {
  title: string;
  /** Si es true, el título nunca se acorta: lo que está a la derecha se achica antes. */
  keepTitleWhole?: boolean;
  /** Contenido opcional a la izquierda; el título pasa a quedar a la derecha (p. ej. en Inicio). */
  left?: ReactNode;
  /** Contenido opcional a la derecha del título (no cambia el alto del banner). */
  right?: ReactNode;
}

// Banner blanco superior de las pestañas: mismo alto y mismo formato de título en todas.
export default function ScreenHeader({ title, left, right, keepTitleWhole }: Props) {
  useFonts({ Roboto_500Medium });
  return (
    <View testID="screen-header" style={styles.banner}>
      {left}
      <Text style={[styles.title, keepTitleWhole && styles.titleWhole]} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
      {right}
    </View>
  );
}

export const SCREEN_HEADER_HEIGHT = 92;

const styles = StyleSheet.create({
  banner: {
    height: SCREEN_HEADER_HEIGHT,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  title: {
    flexShrink: 1,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'Roboto_500Medium',
    color: Colors.textPrimary,
  },
  titleWhole: { flexShrink: 0 },
});
