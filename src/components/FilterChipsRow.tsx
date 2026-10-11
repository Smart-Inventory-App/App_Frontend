import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { findSimilarOptions } from '../utils/optionSearch';
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

// Fila de filtro: un botón con lupa, "Todas" y las opciones que entran en el renglón.
// Las que no entran se encuentran con la lupa, que abre un campo de texto en el mismo renglón.
export default function FilterChipsRow({
  label, allLabel, searchPlaceholder, options, selected, onSelect, testKey,
}: Props) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const matches = useMemo(() => findSimilarOptions(query, options, MAX_SUGGESTIONS), [query, options]);

  // La opción elegida va primero, así nunca queda escondida fuera del renglón.
  const ordered = selected && options.includes(selected)
    ? [selected, ...options.filter(o => o !== selected)]
    : options;

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
            <TouchableOpacity testID={`filter-search-close-${testKey}`} style={styles.squareBtn} onPress={closeSearch}>
              <Ionicons name="close" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          {matches.length > 0 && (
            <View style={styles.suggestionsBox}>
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
            </View>
          )}
        </>
      ) : (
        <View style={styles.row}>
          <TouchableOpacity testID={`filter-search-${testKey}`} style={styles.squareBtn} onPress={() => setSearching(true)}>
            <Ionicons name="search" size={18} color={Colors.primary} />
          </TouchableOpacity>
          {/* Un solo renglón: lo que no entra queda oculto y se busca con la lupa */}
          <View testID={`filter-chips-${testKey}`} style={styles.chipsLine}>
            <TouchableOpacity
              style={[styles.chip, !selected && styles.chipActive]}
              onPress={() => onSelect(null)}
            >
              <Text style={[styles.chipText, !selected && styles.chipTextActive]}>{allLabel}</Text>
            </TouchableOpacity>
            {ordered.map(option => (
              <TouchableOpacity
                key={option}
                style={[styles.chip, selected === option && styles.chipActive]}
                onPress={() => onSelect(selected === option ? null : option)}
              >
                <Text style={[styles.chipText, selected === option && styles.chipTextActive]}>
                  {truncateLabel(option)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
  chipsLine: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    height: CHIP_HEIGHT,
    overflow: 'hidden',
  },
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
  searchInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: '#fafafa',
  },
  suggestionsBox: {
    marginTop: 4,
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
