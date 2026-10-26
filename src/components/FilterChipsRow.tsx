import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { findSimilarOptions, sortAlphabetically } from '../utils/optionSearch';
import { selectedFirst } from '../utils/selectedFirst';
import { truncateLabel } from '../utils/text';

interface Props {
  label: string;
  allLabel: string;
  searchPlaceholder: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  /** Identificador para los testID (p. ej. "categoria" o "ubicacion"). */
  testKey: string;
}

const MAX_SUGGESTIONS = 8;
// Unas tres opciones y media: se ve que hay más para desplazar y no quedan debajo del teclado
const SUGGESTIONS_MAX_HEIGHT = 136;

// Fila de filtro: un botón con lupa, "Todas" y las opciones que entran en el renglón.
// Las que no entran se encuentran con la lupa, que abre un campo de texto en el mismo renglón.
export default function FilterChipsRow({
  label, allLabel, searchPlaceholder, options, selected, onSelect, testKey,
}: Props) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const matches = useMemo(() => findSimilarOptions(query, options, MAX_SUGGESTIONS), [query, options]);

  // Las opciones van en orden alfabético y la elegida, primera (a la derecha de «Todas»): así siempre se ve
  const ordered = useMemo(() => selectedFirst(sortAlphabetically(options), o => o === selected), [options, selected]);

  // Al elegir una opción, la fila vuelve al principio para que se vea
  const chipsRef = useRef<ScrollView>(null);
  useEffect(() => {
    chipsRef.current?.scrollTo?.({ x: 0, animated: true });
  }, [selected]);

  const closeSearch = () => {
    setSearching(false);
    setQuery('');
  };

  const pick = (value: string) => {
    onSelect(value);
    closeSearch();
  };

  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>

      {searching ? (
        <>
          <View style={styles.row}>
            <TextInput
              testID={`filter-search-input-${testKey}`}
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor={Colors.placeholder}
              value={query}
              onChangeText={setQuery}
              autoFocus
              maxLength={20}
              onSubmitEditing={() => { if (matches.length > 0) pick(matches[0]); }}
            />
            <TouchableOpacity testID={`filter-search-close-${testKey}`} style={[styles.squareBtn, styles.searchCloseBtn]} onPress={closeSearch}>
              <Ionicons name="close" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          {matches.length > 0 && (
            // Alto acotado: con el teclado abierto la lista tiene que entrar en lo que queda visible (el resto se desplaza)
            <ScrollView
              testID={`filter-matches-${testKey}`}
              style={styles.suggestionsBox}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {matches.map(option => (
                <TouchableOpacity
                  key={option}
                  testID={`filter-match-${testKey}-${option}`}
                  style={styles.suggestionItem}
                  onPress={() => pick(option)}
                >
                  <Ionicons name="search-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.suggestionText}>{truncateLabel(option)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </>
      ) : (
        <View style={styles.row}>
          <TouchableOpacity testID={`filter-search-${testKey}`} style={styles.squareBtn} onPress={() => setSearching(true)}>
            <Ionicons name="search" size={18} color={Colors.primary} />
          </TouchableOpacity>
          {/* «Todas» queda fija; las opciones van en una sola fila que se desliza hacia los costados */}
          <TouchableOpacity
            testID={`filter-all-${testKey}`}
            style={[styles.chip, !selected && styles.chipActive]}
            onPress={() => onSelect(null)}
          >
            <Text style={[styles.chipText, !selected && styles.chipTextActive]}>{allLabel}</Text>
          </TouchableOpacity>
          <ScrollView
            ref={chipsRef}
            testID={`filter-chips-${testKey}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
            keyboardShouldPersistTaps="handled"
          >
            {ordered.map(option => (
              <TouchableOpacity
                key={option}
                testID={`filter-chip-${testKey}-${option}`}
                style={[styles.chip, selected === option && styles.chipActive]}
                onPress={() => onSelect(selected === option ? null : option)}
              >
                <Text style={[styles.chipText, selected === option && styles.chipTextActive]}>
                  {truncateLabel(option)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const CHIP_HEIGHT = 34;

const styles = StyleSheet.create({
  filterRow: { marginBottom: 4, paddingHorizontal: 16 },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Mismo formato que el botón "+" de la carga de productos
  squareBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  chipsScroll: { flex: 1 },
  chipsContent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
  chip: {
    flexShrink: 0,
    height: CHIP_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.inputBorder ?? '#ddd',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  // Sin alto fijo: con la letra más grande del sistema (p. ej. en un Galaxy A54) el texto no se recorta
  searchInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    textAlignVertical: 'center',
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: '#fafafa',
  },
  searchCloseBtn: { width: 44, height: 44 },
  suggestionsBox: {
    marginTop: 4,
    maxHeight: SUGGESTIONS_MAX_HEIGHT,
    borderWidth: 1,
    borderColor: Colors.inputBorder ?? '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: { fontSize: 14, color: Colors.textPrimary },
});
