import { Platform } from 'react-native';

export interface UploadableImage {
  uri: string;
  name?: string | null;
  type?: string | null;
}

/**
 * Adjunta una imagen a un `FormData` según la plataforma.
 *
 * En nativo, React Native arma la parte del multipart a partir de un objeto
 * `{ uri, name, type }`. En web ese objeto no es un archivo: el navegador lo
 * serializa como texto y el backend responde 422 porque no llegó ningún `file`.
 * Ahí hay que adjuntar un `Blob` real, que se obtiene del `uri` (una URL `blob:`
 * o `data:`) que devuelve el selector de imágenes.
 */
export async function appendImage(
  formData: FormData,
  field: string,
  image: UploadableImage,
  fallbackName = 'photo.jpg',
): Promise<void> {
  const name = image.name ?? fallbackName;
  const type = image.type ?? 'image/jpeg';

  if (Platform.OS === 'web') {
    const blob = await (await fetch(image.uri)).blob();
    const DomBlob = Blob as unknown as new (parts: unknown[], options: { type: string }) => Blob;
    const file = blob.type ? blob : new DomBlob([blob], { type });
    (formData as unknown as { append(name: string, value: Blob, filename?: string): void }).append(field, file, name);
    return;
  }

  formData.append(field, { uri: image.uri, name, type } as unknown as Blob);
}
