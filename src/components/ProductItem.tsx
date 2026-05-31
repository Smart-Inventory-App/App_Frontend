import { View, Text, StyleSheet, Image } from 'react-native';
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

  const getLabelStyle = () => {
    switch(statusColor) {
      case 'green':
        return styles.labelGreen
      case 'yellow':
        return styles.labelYellow
      case 'red':
        return styles.labelRed
      default:
        return styles.labelGreen
    }
  }

  return (
    <View style={styles.item}>
      <Image source={require("../../assets/icon.png")} style={styles.image}></Image>
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
          <View style={{flexDirection: 'row', gap: 12}}>
            <Text style={styles.detail}>Vence: {expiry}</Text>
            <Text style={styles.detail}>Stock: {stock}</Text>
          </View>
          {status && <View style={getLabelStyle()}>{status}</View>}
          {!status && <View style={getLabelStyle()}>OK</View>}
        </View>
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
    flexDirection: 'row'
  },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 14, fontWeight: 'bold', fontFamily: 'Figtree_400Regular' },
  detail: { fontSize: 14, color: '#555', fontFamily: 'Figtree_400Regular' },
  status: { fontSize: 12, marginTop: 4, fontFamily: 'Figtree_400Regular' },
  image: { width: 40, height: 40 },
  labelGreen: {
    fontFamily: 'Figtree_400Regular',
    fontSize: 10,
    color: '#14554b',
    borderRadius: 10,
    backgroundColor: '#2db7a352',
    width: 60,
    height: 17,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center'
  },
  labelYellow: {
    fontFamily: 'Figtree_400Regular',
    fontSize: 10,
    color: '#564209',
    borderRadius: 10,
    backgroundColor: '#fbbc059d',
    width: 60,
    height: 17,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center'
  },
  labelRed: {
    fontFamily: 'Figtree_400Regular',
    fontSize: 10,
    color: '#671a1c',    
    borderRadius: 10,
    backgroundColor: '#e5484d8f',
    width: 60,
    height: 17,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center'
  }
});
