import type { FastifyInstance } from 'fastify';

/**
 * Registers the first user (becomes admin) and returns a session cookie string
 * ready to use in `headers: { cookie: authCookie }`.
 */
export async function loginAsAdmin(server: FastifyInstance): Promise<string> {
  await server.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'admin@test.local', password: 'password123', name: 'Admin' },
  });

  const loginRes = await server.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@test.local', password: 'password123' },
  });

  const setCookie = loginRes.headers['set-cookie'];
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match = cookieHeader?.match(/dashdash_session=([^;]+)/);
  const sessionId = match?.[1];
  if (!sessionId) throw new Error('Login did not set session cookie');

  return `dashdash_session=${sessionId}`;
}
