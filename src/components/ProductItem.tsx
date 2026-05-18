import { View, Text, StyleSheet } from 'react-native';

type Props = {
  name: string;
  expiry: string;
  stock: string;
  status?: string;
  statusColor?: string;
};

export default function ProductItem({ name, expiry, stock, status, statusColor }: Props) {
  return (
    <View style={styles.item}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.detail}>Vence: {expiry}</Text>
      <Text style={styles.detail}>Stock: {stock}</Text>
      {status && <Text style={[styles.status, { color: statusColor }]}>{status}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    padding: 12,
    marginVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fafafa',
    elevation: 1,
  },
  name: { fontSize: 16, fontWeight: 'bold' },
  detail: { fontSize: 14, color: '#555' },
  status: { fontSize: 12, marginTop: 4 },
});
