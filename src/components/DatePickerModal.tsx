import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/colors';
import { toIsoDate } from '../utils/dateInput';

interface Props {
  visible: boolean;
  /** Fecha seleccionada (AAAA-MM-DD); si no es válida se abre en el mes actual. */
  value?: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}

const WEEKS_SHOWN = 6;

function parseIso(value?: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match ? { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) } : null;
}

// Calendario propio (sin módulos nativos) para que funcione igual en Android, iOS y web.
export default function DatePickerModal({ visible, value, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });

  useEffect(() => {
    if (!visible) return;
    const selected = parseIso(value);
    const now = new Date();
    setView(selected ? { year: selected.year, month: selected.month } : { year: now.getFullYear(), month: now.getMonth() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const months = t('calendar.months', { returnObjects: true }) as unknown as string[];
  const weekdays = t('calendar.weekdays', { returnObjects: true }) as unknown as string[];

  const shiftMonth = (delta: number) =>
    setView((v) => {
      const index = v.year * 12 + v.month + delta;
      return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
    });

  // Semana que empieza en lunes.
  const firstWeekday = (new Date(view.year, view.month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Siempre 6 semanas (42 celdas) para que el calendario mida lo mismo en todos los meses.
  while (cells.length < WEEKS_SHOWN * 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const selected = parseIso(value);
  const isSelected = (day: number) =>
    !!selected && selected.year === view.year && selected.month === view.month && selected.day === day;
  const isToday = (day: number) =>
    today.getFullYear() === view.year && today.getMonth() === view.month && today.getDate() === day;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable testID="calendar-backdrop" style={styles.overlay} onPress={onClose}>
        {/* Pressable interno: tocar la tarjeta no debe cerrar el calendario */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <TouchableOpacity testID="calendar-prev-year" style={styles.navBtn} onPress={() => shiftMonth(-12)}>
              <Ionicons name="play-back" size={16} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity testID="calendar-prev-month" style={styles.navBtn} onPress={() => shiftMonth(-1)}>
              <Ionicons name="chevron-back" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.title}>{months[view.month]} {view.year}</Text>
            <TouchableOpacity testID="calendar-next-month" style={styles.navBtn} onPress={() => shiftMonth(1)}>
              <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity testID="calendar-next-year" style={styles.navBtn} onPress={() => shiftMonth(12)}>
              <Ionicons name="play-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {weekdays.map((d, i) => (
              <Text key={i} style={styles.weekday}>{d}</Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} testID={`calendar-week-${wi}`} style={styles.weekRow}>
              {week.map((day, di) =>
                day === null ? (
                  <View key={di} style={styles.cell} />
                ) : (
                  <TouchableOpacity
                    key={di}
                    testID={`calendar-day-${day}`}
                    style={[styles.cell, isToday(day) && styles.cellToday, isSelected(day) && styles.cellSelected]}
                    onPress={() => onSelect(toIsoDate(view.year, view.month + 1, day))}
                  >
                    <Text style={[styles.dayText, isSelected(day) && styles.dayTextSelected]}>{day}</Text>
                  </TouchableOpacity>
                ),
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: { width: '100%', maxWidth: 360, backgroundColor: Colors.white, borderRadius: 14, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  navBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: Colors.textSecondary, paddingVertical: 6 },
  cell: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  cellToday: { borderWidth: 1, borderColor: Colors.primary },
  cellSelected: { backgroundColor: Colors.primary },
  dayText: { fontSize: 14, color: Colors.textPrimary },
  dayTextSelected: { color: Colors.white, fontWeight: '700' },
  cancelBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
});
