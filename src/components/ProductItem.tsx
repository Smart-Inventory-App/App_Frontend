import { View, Text, StyleSheet } from 'react-native';
import { Figtree_400Regular, useFonts } from '@expo-google-fonts/figtree';

type Props = {
  name: string;
  expiry: string;
  stock: string;
  status?: string;
  statusColor?: string;
};

export default function ProductItem({ name, expiry, stock, status, statusColor }: Props) {
  const [] = useFonts({Figtree_400Regular})
  return (
    <View style={styles.item}>
      <Text style={styles.name}>{name}</Text>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
        <View style={{flexDirection: 'row', gap: 12}}>
          <Text style={styles.detail}>Vence: {expiry}</Text>
          <Text style={styles.detail}>Stock: {stock}</Text>
        </View>
        {status && <Text style={[styles.status, { color: statusColor }]}>{status}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    padding: 12,
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: '#fafafa',
    elevation: 1,
  },
  name: { fontSize: 14, fontWeight: 'bold', fontFamily: 'Figtree_400Regular' },
  detail: { fontSize: 14, color: '#555', fontFamily: 'Figtree_400Regular' },
  status: { fontSize: 12, marginTop: 4, fontFamily: 'Figtree_400Regular' },
});
