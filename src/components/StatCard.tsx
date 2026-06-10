import { View, Text, StyleSheet } from 'react-native';
import {useFonts, Figtree_400Regular} from '@expo-google-fonts/figtree'
import {RobotoFlex_400Regular} from '@expo-google-fonts/roboto-flex'

type Props = {
  title: string;
  value: string;
  label: string;
  labelColor: 'green' | 'yellow' | 'red';
};

export default function StatCard({ title, value, label, labelColor }: Props) {
  useFonts({Figtree_400Regular, RobotoFlex_400Regular });
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
      <Text style={getLabelStyle()}>{label}</Text>
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
    height: 131,
    // justifyContent: 'space-between'
  },
  value: { fontSize: 36, fontFamily: 'RobotoFlex_400Regular', marginBottom: 15 },
  title: { fontSize: 14, fontFamily: 'Figtree_400Regular', marginBottom: 15 },
  labelGreen: {
    fontFamily: 'Figtree_400Regular',
    fontSize: 10,
    color: '#14554b',
    borderRadius: 10,
    backgroundColor: '#2db7a352',
    width: 101,
    height: 17,
    lineHeight: 17,
    textAlign: 'center',
  },
  labelYellow: {
    fontFamily: 'Figtree_400Regular',
    fontSize: 10,
    color: '#564209',
    borderRadius: 10,
    backgroundColor: '#fbbc059d',
    width: 101,
    height: 17,
    lineHeight: 17,
    textAlign: 'center',
  },
  labelRed: {
    fontFamily: 'Figtree_400Regular',
    fontSize: 10,
    color: '#671a1c',
    borderRadius: 10,
    backgroundColor: '#e5484d8f',
    width: 101,
    height: 17,
    lineHeight: 17,
    textAlign: 'center',
  }

});
