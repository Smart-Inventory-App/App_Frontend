import { View, Text, StyleSheet } from 'react-native';

type Props = {
  title: string;
  value: string;
  label: string;
  labelColor: string;
};

export default function StatCard({ title, value, label, labelColor }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.label, { backgroundColor: labelColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    elevation: 2,
  },
  value: { fontSize: 22, fontWeight: 'bold' },
  title: { fontSize: 14, color: '#555' },
  // label: { fontSize: 12, marginTop: 4 },
  label: {
    fontSize: 12,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    color: '#fff',        // texto blanco para contraste
    alignSelf: 'flex-start', // que no ocupe todo el ancho
    fontWeight: '600',
  }

});
