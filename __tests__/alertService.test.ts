import api from '../src/services/api';
import { alertService } from '../src/services/alertService';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('alertService', () => {
  it('getAlerts fetches all alerts', async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: 1 }] });
    await expect(alertService.getAlerts()).resolves.toEqual([{ id: 1 }]);
    expect(mockedApi.get).toHaveBeenCalledWith('/alerts/');
  });

  it('getCriticalAlerts fetches only critical alerts', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    await alertService.getCriticalAlerts();
    expect(mockedApi.get).toHaveBeenCalledWith('/alerts/critical_alerts');
  });

  it('getStockAlerts fetches stock alerts', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    await alertService.getStockAlerts();
    expect(mockedApi.get).toHaveBeenCalledWith('/alerts/stock_alerts');
  });

  it('getExpiryAlerts fetches expiry alerts', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    await alertService.getExpiryAlerts();
    expect(mockedApi.get).toHaveBeenCalledWith('/alerts/expiry_alerts');
  });

  it('getSummaryAlerts fetches the summary', async () => {
    mockedApi.get.mockResolvedValue({ data: { total: 0 } });
    await expect(alertService.getSummaryAlerts()).resolves.toEqual({ total: 0 });
    expect(mockedApi.get).toHaveBeenCalledWith('/alerts/summary');
  });
});
