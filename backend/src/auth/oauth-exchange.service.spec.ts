import { OAuthExchangeService } from './oauth-exchange.service';

describe('OAuthExchangeService', () => {
  let config: { get: jest.Mock };
  let service: OAuthExchangeService;

  beforeEach(() => {
    config = { get: jest.fn().mockReturnValue(undefined) };
    service = new OAuthExchangeService(config as never);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('redeems a freshly created code exactly once', async () => {
    const code = await service.create('access-1', 'refresh-1');

    const first = await service.redeem(code);
    expect(first).toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });

    const second = await service.redeem(code);
    expect(second).toBeNull();
  });

  it('returns null for an unknown code', async () => {
    const result = await service.redeem('does-not-exist');
    expect(result).toBeNull();
  });
});
