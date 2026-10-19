import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ScreenHeader from '@/components/ScreenHeader';
import { subscribeFixedBanner } from '@/utils/tabTransition';

/**
 * Banner que queda quieto arriba mientras la pantalla se desliza entre dos pestañas que no son Inicio. Tapa los
 * banners de las dos pantallas (que se deslizan por debajo) y su título cambia sin animación. Aparece solo durante el
 * deslizamiento y no recibe toques.
 */
export default function FixedTabBanner() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<string | null>(null);

  useEffect(() => subscribeFixedBanner(setTab), []);

  if (!tab) return null;

  const titles: Record<string, string> = {
    inventario: t('inventory.title'),
    cargar: t('product.loadTitle'),
    alertas: 'Centro de Alertas',
    perfil: t('tabs.profile'),
  };

  return (
    <View testID="fixed-banner" pointerEvents="none" style={styles.fixedBanner}>
      <ScreenHeader title={titles[tab]} onHomePress={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  fixedBanner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
});
