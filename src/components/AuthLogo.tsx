import { Image, StyleSheet } from 'react-native';

// Logo horizontal (símbolo a la izquierda y el texto a la derecha, sin los arcos) de las pantallas de registro y recuperación de contraseña.
export default function AuthLogo() {
  return <Image testID="auth-logo" source={require('../../assets/logo-horizontal.png')} style={styles.logo} accessibilityLabel="Smart Inventory" />;
}

const styles = StyleSheet.create({
  // Medidas fijas con la proporción exacta de la imagen (720x232): la caja del logo es del tamaño de lo que se ve, sin franjas
  // vacías arriba y abajo. maxWidth evita que se salga de la pantalla en celulares angostos.
  logo: { width: 250, height: 81, maxWidth: '100%', resizeMode: 'contain', marginTop: 16, marginBottom: 16 },
});
