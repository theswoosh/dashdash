import * as oidcClient from 'openid-client';

export interface OidcProviderConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  allowInsecureHttp: boolean;
}

export interface OidcUserClaims {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  groups: string[];
}

let cachedConfig: oidcClient.Configuration | null = null;
let cachedIssuer = '';

export async function buildOidcConfig(providerConfig: OidcProviderConfig): Promise<oidcClient.Configuration> {
  if (cachedConfig && cachedIssuer === providerConfig.issuer) {
    return cachedConfig;
  }

  const issuerUrl = new URL(providerConfig.issuer);
  const allowInsecure = providerConfig.allowInsecureHttp && issuerUrl.protocol === 'http:';

  const config = await oidcClient.discovery(
    issuerUrl,
    providerConfig.clientId,
    providerConfig.clientSecret,
    undefined,
    allowInsecure ? { execute: [oidcClient.allowInsecureRequests] } : undefined,
  );

  cachedConfig = config;
  cachedIssuer = providerConfig.issuer;
  return config;
}

export function invalidateOidcCache(): void {
  cachedConfig = null;
  cachedIssuer = '';
}

export async function buildAuthorizationUrl(
  config: oidcClient.Configuration,
  state: string,
  codeVerifier: string,
  redirectUri: string,
  scopes: string
): Promise<URL> {
  const codeChallenge = await oidcClient.calculatePKCECodeChallenge(codeVerifier);
  return oidcClient.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
}

export async function exchangeCode(
  config: oidcClient.Configuration,
  currentUrl: URL,
  redirectUri: string,
  codeVerifier: string,
  expectedState: string
): Promise<oidcClient.TokenEndpointResponse & oidcClient.TokenEndpointResponseHelpers> {
  return oidcClient.authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedState,
  }, { redirect_uri: redirectUri });
}

export function extractUserClaims(
  claims: oidcClient.IDToken,
  groupsClaim: string
): OidcUserClaims {
  const sub = String(claims['sub'] ?? '');
  const email = String(claims['email'] ?? '');
  const emailVerified = claims['email_verified'] === true;
  const name = String(claims['name'] ?? claims['preferred_username'] ?? email);

  let groups: string[] = [];
  if (groupsClaim && groupsClaim in claims) {
    const raw = claims[groupsClaim];
    if (Array.isArray(raw)) {
      groups = raw.map(String);
    }
  }

  return { sub, email, emailVerified, name, groups };
}

export function generateCodeVerifier(): string {
  return oidcClient.randomPKCECodeVerifier();
}

export function generateState(): string {
  return oidcClient.randomState();
}

export interface EndSessionParams {
  idTokenHint?: string;
  postLogoutRedirectUri?: string;
}

export function getEndSessionUrl(config: oidcClient.Configuration, params?: EndSessionParams): string | undefined {
  const metadata = config.serverMetadata();
  if (!metadata.end_session_endpoint) return undefined;

  const parameters: Record<string, string> = {};
  if (params?.idTokenHint) parameters['id_token_hint'] = params.idTokenHint;
  if (params?.postLogoutRedirectUri) parameters['post_logout_redirect_uri'] = params.postLogoutRedirectUri;

  return oidcClient.buildEndSessionUrl(config, parameters).toString();
}
