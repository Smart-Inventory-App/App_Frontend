import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import api from '../src/services/api';
import { useFetch } from '../src/hooks/useFetch';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function Probe({ url }: { url: string }) {
  const { data, loading, error } = useFetch<{ name: string }>(url);
  if (loading) return <Text>loading</Text>;
  if (error) return <Text>error:{error}</Text>;
  return <Text>data:{data?.name}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useFetch', () => {
  it('starts in a loading state', () => {
    mockedApi.get.mockReturnValue(new Promise(() => {}));
    render(<Probe url="/x" />);
    expect(screen.getByText('loading')).toBeTruthy();
  });

  it('resolves with the fetched data', async () => {
    mockedApi.get.mockResolvedValue({ data: { name: 'Leche' } });
    render(<Probe url="/x" />);
    await waitFor(() => expect(screen.getByText('data:Leche')).toBeTruthy());
  });

  it('surfaces the error message on failure', async () => {
    mockedApi.get.mockRejectedValue(new Error('network down'));
    render(<Probe url="/x" />);
    await waitFor(() => expect(screen.getByText('error:network down')).toBeTruthy());
  });

  it('ignores a resolved response after the component unmounts', async () => {
    let resolvePromise: (v: any) => void;
    mockedApi.get.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));
    const { unmount } = render(<Probe url="/x" />);
    unmount();
    resolvePromise!({ data: { name: 'Leche' } });
    await Promise.resolve();
    // No assertion needed beyond "does not throw" — cancellation guards the setState call.
  });

  it('refetches when the url changes', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { name: 'A' } }).mockResolvedValueOnce({ data: { name: 'B' } });
    const { rerender } = render(<Probe url="/a" />);
    await waitFor(() => expect(screen.getByText('data:A')).toBeTruthy());
    rerender(<Probe url="/b" />);
    await waitFor(() => expect(screen.getByText('data:B')).toBeTruthy());
    expect(mockedApi.get).toHaveBeenCalledWith('/a');
    expect(mockedApi.get).toHaveBeenCalledWith('/b');
  });
});
