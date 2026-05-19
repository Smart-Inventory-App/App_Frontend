import { View, Text, StyleSheet } from 'react-native';
import {useFonts, Figtree_400Regular} from '@expo-google-fonts/figtree'

type Props = {
  title: string;
  value: string;
  label: string;
  labelColor: 'green' | 'yellow' | 'red';
};

export default function StatCard({ title, value, label, labelColor }: Props) {
  const [] = useFonts({Figtree_400Regular})
  const getLabelStyle = () => {
    switch(labelColor) {
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
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={getLabelStyle()}>{label}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    marginHorizontal: 4,
    marginVertical: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    elevation: 2,
  },
  value: { fontSize: 22, fontWeight: 'bold', fontFamily: 'Figtree_400Regular' },
  title: { fontSize: 14, fontFamily: 'Figtree_400Regular' },
  labelGreen: {
    fontFamily: 'Figtree_400Regular',
    fontSize: 10,
    color: '#14554b',
    borderRadius: 10,
    backgroundColor: '#2db7a352',
    width: 101,
    height: 17,
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 10,
  },
  labelYellow: {
    fontFamily: 'Figtree_400Regular',
    fontSize: 10,
    color: '#564209',
    borderRadius: 10,
    backgroundColor: '#fbbc059d',
    width: 101,
    height: 17,
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 10
  },
  labelRed: {
    fontFamily: 'Figtree_400Regular',
    fontSize: 10,
    color: '#671a1c',    
    borderRadius: 10,
    backgroundColor: '#e5484d8f',
    width: 101,
    height: 17,
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 10
  }

});
