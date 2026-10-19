import React, { useState } from 'react';
import { Image, ImageResizeMode, ImageStyle, StyleProp, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import ImageViewerModal from '@/components/ImageViewerModal';

interface Props {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
}

// Imagen de un producto: al tocarla se abre a pantalla completa con zoom.
// Sin imagen propia se muestra el ícono de la app y no se abre nada.
export default function ProductImage({ uri, style, resizeMode }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!uri) {
    return <Image source={require('../../assets/icon.png')} style={style} resizeMode={resizeMode} />;
  }

  return (
    <>
      <TouchableOpacity testID="product-image-button" accessibilityLabel={t('product.imageOpen')} onPress={() => setOpen(true)}>
        <Image source={{ uri }} style={style} resizeMode={resizeMode} />
      </TouchableOpacity>
      <ImageViewerModal visible={open} uri={uri} onClose={() => setOpen(false)} />
    </>
  );
}
