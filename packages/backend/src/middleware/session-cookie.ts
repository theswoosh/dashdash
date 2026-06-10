export const SESSION_COOKIE_NAME = 'dashdash_session';

// Browsers only clear a cookie when the attributes match the ones it was set with,
// so every setCookie/clearCookie for the session must use these options.
// Function (not constant) so env is read at call time, not module load.
export function getSessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict';
  path: string;
} {
  return {
    httpOnly: true,
    secure: process.env['DASHDASH_COOKIE_SECURE'] !== 'false'
      && process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    path: '/',
  };
}
