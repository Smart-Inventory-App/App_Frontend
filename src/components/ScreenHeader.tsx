import { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/colors';

interface Props {
  title: string;
  /** Si es true, el título nunca se acorta: lo que está a la derecha se achica antes. */
  keepTitleWhole?: boolean;
  /** Contenido opcional a la izquierda; el título pasa a quedar a la derecha (p. ej. la flecha de volver). */
  left?: ReactNode;
  /** Contenido opcional a la derecha del título (no cambia el alto del banner). */
  right?: ReactNode;
  /**
   * Si se indica (y no hay `left`), el banner muestra a la izquierda un ícono de inicio, sin texto,
   * que al tocarlo llama a esta función.
   */
  onHomePress?: () => void;
}

// Banner blanco superior de las pestañas: mismo alto y mismo formato de título en todas.
export default function ScreenHeader({ title, left, right, keepTitleWhole, onHomePress }: Props) {
  const { t } = useTranslation();
  const leftContent = left ?? (onHomePress ? (
    <TouchableOpacity testID="header-home" accessibilityLabel={t('common.goHome')} hitSlop={10} onPress={onHomePress}>
      <Ionicons name="home" size={26} color={Colors.primary} />
    </TouchableOpacity>
  ) : null);

  return (
    <View testID="screen-header" style={styles.banner}>
      {leftContent}
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
  // La misma letra que el nombre del inicio (la del sistema), pero menos gruesa
  title: {
    flexShrink: 1,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    color: Colors.textPrimary,
    includeFontPadding: false,
  },
  titleWhole: { flexShrink: 0 },
});
