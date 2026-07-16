import { describe, it, expect, vi, beforeEach } from 'vitest';

const discoveryMock = vi.fn((..._args: unknown[]) => Promise.resolve({} as unknown));

vi.mock('openid-client', () => ({
  discovery: (...args: unknown[]) => discoveryMock(...args),
  allowInsecureRequests: Symbol('allowInsecureRequests'),
}));

import { buildOidcConfig, invalidateOidcCache } from '../services/oidc.service.js';
import * as oidcClient from 'openid-client';

describe('buildOidcConfig', () => {
  beforeEach(() => {
    invalidateOidcCache();
    discoveryMock.mockClear();
  });

  it('does not pass the insecure-requests escape hatch for an https issuer even when allowInsecureHttp is true', async () => {
    await buildOidcConfig({
      issuer: 'https://idp.example.com',
      clientId: 'client',
      clientSecret: 'secret',
      scopes: 'openid',
      allowInsecureHttp: true,
    });

    expect(discoveryMock).toHaveBeenCalledTimes(1);
    const options = discoveryMock.mock.calls[0]?.[4];
    expect(options).toBeUndefined();
  });

  it('does not pass the insecure-requests escape hatch for an http issuer when allowInsecureHttp is false', async () => {
    await buildOidcConfig({
      issuer: 'http://idp.internal.lan',
      clientId: 'client',
      clientSecret: 'secret',
      scopes: 'openid',
      allowInsecureHttp: false,
    });

    expect(discoveryMock).toHaveBeenCalledTimes(1);
    const options = discoveryMock.mock.calls[0]?.[4];
    expect(options).toBeUndefined();
  });

  it('passes the insecure-requests escape hatch only for an http issuer with allowInsecureHttp enabled', async () => {
    await buildOidcConfig({
      issuer: 'http://idp.internal.lan',
      clientId: 'client',
      clientSecret: 'secret',
      scopes: 'openid',
      allowInsecureHttp: true,
    });

    expect(discoveryMock).toHaveBeenCalledTimes(1);
    const options = discoveryMock.mock.calls[0]?.[4] as unknown as { execute: unknown[] };
    expect(options.execute).toEqual([oidcClient.allowInsecureRequests]);
  });
});
