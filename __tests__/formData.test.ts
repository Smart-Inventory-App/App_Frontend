import { Platform } from 'react-native';
import { appendImage } from '../src/utils/formData';

const originalOS = Platform.OS;
const originalFetch = (global as any).fetch;

afterEach(() => {
  (Platform as any).OS = originalOS;
  (global as any).fetch = originalFetch;
});

function fakeForm() {
  const append = jest.fn();
  return { form: { append } as unknown as FormData, append };
}

describe('appendImage (nativo)', () => {
  it('adjunta el objeto { uri, name, type } que entiende React Native', async () => {
    (Platform as any).OS = 'ios';
    const { form, append } = fakeForm();

    await appendImage(form, 'file', { uri: 'file://a.jpg', name: 'a.jpg', type: 'image/png' });

    expect(append).toHaveBeenCalledWith('file', { uri: 'file://a.jpg', name: 'a.jpg', type: 'image/png' });
  });

  it('usa el nombre y el tipo por defecto cuando el selector no los informa', async () => {
    (Platform as any).OS = 'android';
    const { form, append } = fakeForm();

    await appendImage(form, 'file', { uri: 'file://a.jpg', name: null, type: null }, 'product.jpg');

    expect(append).toHaveBeenCalledWith('file', { uri: 'file://a.jpg', name: 'product.jpg', type: 'image/jpeg' });
  });

  it('usa photo.jpg si no se indica un nombre alternativo', async () => {
    (Platform as any).OS = 'ios';
    const { form, append } = fakeForm();

    await appendImage(form, 'file', { uri: 'file://a.jpg' });

    expect(append).toHaveBeenCalledWith('file', expect.objectContaining({ name: 'photo.jpg' }));
  });
});

describe('appendImage (web)', () => {
  it('descarga la imagen y adjunta un Blob real con su nombre', async () => {
    (Platform as any).OS = 'web';
    const blob = new (Blob as any)(['x'], { type: 'image/png' });
    (global as any).fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) });
    const { form, append } = fakeForm();

    await appendImage(form, 'file', { uri: 'blob:http://localhost/abc', name: 'a.png', type: 'image/png' });

    expect((global as any).fetch).toHaveBeenCalledWith('blob:http://localhost/abc');
    expect(append).toHaveBeenCalledWith('file', blob, 'a.png');
  });

  it('si el navegador no informó el tipo del blob lo completa con el del selector', async () => {
    (Platform as any).OS = 'web';
    const untyped = new Blob(['x']);
    (global as any).fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(untyped) });
    const { form, append } = fakeForm();

    await appendImage(form, 'file', { uri: 'blob:x', type: 'image/webp' }, 'p.jpg');

    const [field, file, name] = append.mock.calls[0];
    expect(field).toBe('file');
    expect(file).not.toBe(untyped);
    expect((file as Blob).type).toBe('image/webp');
    expect(name).toBe('p.jpg');
  });

  it('propaga el error si no se puede leer la imagen', async () => {
    (Platform as any).OS = 'web';
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('no se pudo leer'));
    const { form, append } = fakeForm();

    await expect(appendImage(form, 'file', { uri: 'blob:x' })).rejects.toThrow('no se pudo leer');
    expect(append).not.toHaveBeenCalled();
  });
});
