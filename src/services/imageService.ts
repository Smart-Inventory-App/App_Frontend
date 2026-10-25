import * as ImagePicker from 'expo-image-picker';
import axios, { AxiosError } from 'axios';
import { getAuthToken, handleUnauthorized } from './api';
import { appendImage } from '../utils/formData';

const IMAGE_STORAGE_URL = process.env.EXPO_PUBLIC_IMAGE_STORAGE_URL;

/** Una imagen elegida o sacada con la cámara que todavía no se subió. */
export type PickedImage = ImagePicker.ImagePickerAsset;

/** Sube la imagen elegida y devuelve su dirección. Se llama recién cuando el usuario la confirma. */
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

// Elegir no sube nada: la imagen se carga tal cual (sin recorte) y recién se sube cuando el usuario la confirma.
export async function pickFromGallery(): Promise<PickedImage | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Se necesita permiso para acceder a la galería.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.9,
  });

  if (result.canceled) return null;
  return result.assets[0];
}

export async function pickFromCamera(): Promise<PickedImage | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') throw new Error('Se necesita permiso para usar la cámara.');

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.9,
  });

  if (result.canceled) return null;
  return result.assets[0];
}
