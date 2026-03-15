/**
 * Login → then repeatedly call debug/emit-new-post every 3 seconds (Bearer JWT).
 * Usage: pnpm script:emit-new-post [userId]
 * Ctrl+C to stop.
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:4040';
const API_PREFIX = process.env.API_PREFIX ?? 'api/v1';
const base = `${BASE_URL}/${API_PREFIX.replace(/^\//, '')}`;
const INTERVAL_MS = 3000;

const EMAIL = 'hehehehe@gmail.com';
const PASSWORD = 'Thinhpro0123';
const FINGERPRINT =
  'eyJhcHBWZXJzaW9uIjoiMC4wLjEiLCJkZXZpY2VJZCI6IjM1NWZjODcyMWQ0NzRmOWMiLCJpcCI6IjEwLjAuMi4xNSIsIm1vZGVsIjoiR29vZ2xlIHNka19ncGhvbmU2NF9hcm02NCIsInBsYXRmb3JtIjoiYW5kcm9pZCIsInVzZXJBZ2VudCI6IlNuYXBsZXQvMC4wLjEgKEFuZHJvaWQ7IEdvb2dsZSBzZGtfZ3Bob25lNjRfYXJtNjQpIn0=';

const DEFAULT_USER_ID = '6965e21d1a259d10c7be1726';
const userId = process.argv[2] ?? DEFAULT_USER_ID;

async function login(): Promise<string> {
  const url = `${base}/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Fingerprint': FINGERPRINT,
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: { token?: { accessToken?: string } };
    token?: { accessToken?: string };
  };
  const accessToken =
    body?.data?.token?.accessToken ?? body?.token?.accessToken;
  if (!res.ok || !accessToken) {
    const hint =
      res.status === 404
        ? ' (Nếu app dùng global prefix, thử: API_PREFIX=api pnpm script:emit-new-post)'
        : '';
    throw new Error(
      `Login failed: ${res.status} ${url} ${JSON.stringify(body)}${hint}`,
    );
  }
  return accessToken;
}

async function emitNewPost(accessToken: string): Promise<void> {
  const res = await fetch(`${base}/debug/emit-new-post`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Fingerprint': FINGERPRINT,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ userId }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    console.error('Request failed:', res.status, data);
    return;
  }
  console.log(new Date().toISOString(), JSON.stringify(data));
}

async function main(): Promise<void> {
  console.log('Logging in...');
  const accessToken = await login();
  console.log(
    'Logged in. Emitting new_post every 3s (Ctrl+C to stop). userId=',
    userId,
  );

  await emitNewPost(accessToken);

  setInterval(() => {
    emitNewPost(accessToken);
  }, INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
