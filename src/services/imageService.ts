import * as ImagePicker from 'expo-image-picker';
import axios, { AxiosError } from 'axios';
import { getAuthToken, handleUnauthorized } from './api';
import { appendImage } from '../utils/formData';

const IMAGE_STORAGE_URL = process.env.EXPO_PUBLIC_IMAGE_STORAGE_URL;

/** Una imagen elegida o sacada con la cámara que todavía no se subió. */
export type PickedImage = ImagePicker.ImagePickerAsset;

/** Sube la imagen elegida (ya recortada y confirmada) y devuelve su dirección. */
export async function uploadImage(asset: PickedImage): Promise<string> {
  const formData = new FormData();
  await appendImage(
    formData,
    'file',
    { uri: asset.uri, name: asset.fileName, type: asset.mimeType },
    'product.jpg',
  );
  formData.append('folder', 'tpp/products');

  const token = getAuthToken();
  try {
    const { data } = await axios.post<{ url: string }>(
      `${IMAGE_STORAGE_URL}/storage/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    );
    return data.url;
  } catch (error) {
    // Esta subida no pasa por las instancias de axios de la app: si el token venció, también se cierra la sesión
    handleUnauthorized(error as AxiosError);
    throw error;
  }
}

// Al elegir una imagen de la galería o sacar una foto se abre la pantalla del sistema para recortarla (si el usuario
// quiere) y confirmarla. Elegir no sube nada: la subida la hace quien llama con la imagen ya confirmada.
export async function pickFromGallery(): Promise<PickedImage | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Se necesita permiso para acceder a la galería.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9,
  });

  if (result.canceled) return null;
  return result.assets[0];
}

export async function pickFromCamera(): Promise<PickedImage | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') throw new Error('Se necesita permiso para usar la cámara.');

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.9,
  });

  if (result.canceled) return null;
  return result.assets[0];
}
