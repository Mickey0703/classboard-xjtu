import { describe, expect, it, vi } from 'vitest';
import { isAdminEmail, requireAdmin } from './auth';
import { onRequestPost as createEvent } from './events';
import { onRequestPut as saveSiteSettings } from './site-settings';
import { validEvent } from './validate';
import { onRequest as middleware } from './_middleware';
import { webcrypto } from 'node:crypto';

const statement = { bind: vi.fn(() => ({ run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })) })) };
const db = { prepare: vi.fn(() => statement) };
const env = { DB: db, ADMIN_EMAILS: 'monitor@stu.xjtu.edu.cn' };
const event = { title: '班会', description: '', category: '班级', startAt: '2026-09-29T18:00:00+08:00', dueAt: '2026-09-29T19:00:00+08:00', done: false };
function context(body: unknown, email?: string, path = 'events', method = 'POST') {
  return { env, request: new Request(`https://example.com/api/admin/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), data: email ? { cloudflareAccess: { JWT: { payload: { email } } } } : {} } as never;
}

describe('admin protection', () => {
  it('denies missing and non-allowlisted identities', () => {
    expect(isAdminEmail(undefined, env.ADMIN_EMAILS)).toBe(false);
    expect(isAdminEmail('other@example.com', env.ADMIN_EMAILS)).toBe(false);
    expect(requireAdmin(context(event))).toBe(false);
  });
  it('permits an allowlisted email regardless of case', () => {
    expect(isAdminEmail('MONITOR@stu.xjtu.edu.cn', env.ADMIN_EMAILS)).toBe(true);
  });
  it('rejects writes without a verified admin context', async () => {
    expect((await createEvent(context(event))).status).toBe(403);
    expect(db.prepare).not.toHaveBeenCalled();
  });
  it('rejects invalid event fields and accepts a valid class matter', async () => {
    expect((await createEvent(context({ ...event, dueAt: 'bad' }, 'monitor@stu.xjtu.edu.cn'))).status).toBe(400);
    expect((await createEvent(context(event, 'monitor@stu.xjtu.edu.cn'))).status).toBe(200);
  });
  it('protects and validates changes to the public class name', async () => {
    expect((await saveSiteSettings(context({ className: '新班名' }, undefined, 'site-settings', 'PUT'))).status).toBe(403);
    expect((await saveSiteSettings(context({ className: '' }, 'monitor@stu.xjtu.edu.cn', 'site-settings', 'PUT'))).status).toBe(400);
    expect((await saveSiteSettings(context({ className: '工业设计 2601 班' }, 'monitor@stu.xjtu.edu.cn', 'site-settings', 'PUT'))).status).toBe(200);
  });
  it('requires event timestamps to have valid Shanghai dates and offsets', () => {
    const event = { title: '班会', description: '', category: '班级', startAt: '2026-09-28T18:00:00+08:00', dueAt: '2026-09-28T19:00:00+08:00', done: false };
    expect(validEvent({ ...event, dueAt: '2026-09-28T19:00:00Z' })).toBe(false);
    expect(validEvent({ ...event, startAt: '2026-02-30T18:00:00+08:00' })).toBe(false);
  });
  it('requires a local test cookie and never enables local bypass on a public hostname', async () => {
    const next = vi.fn(async () => new Response('next'));
    const localEnv = { ...env, LOCAL_DEV_MODE: 'true', LOCAL_DEV_ADMIN_EMAIL: 'monitor@stu.xjtu.edu.cn', LOCAL_DEV_TOKEN: 'test-token' };
    const make = (url: string, cookie = '') => ({ env: localEnv, data: {}, request: new Request(url, { headers: { Cookie: cookie } }), next }) as never;
    expect((await middleware[0](make('http://127.0.0.1:8788/api/admin/session')) as Response).status).toBe(403);
    expect((await middleware[0](make('http://127.0.0.1:8788/api/admin/session', 'local_admin=test-token')) as Response).status).toBe(200);
    expect((await middleware[0](make('https://class.example/api/admin/session', 'local_admin=test-token')) as Response).status).toBe(403);
  });
  it('rejects missing and forged Access assertions in production mode', async () => {
    const productionEnv = { ...env, ACCESS_DOMAIN: 'https://example.cloudflareaccess.com', ACCESS_AUD: 'expected-audience' };
    const next = vi.fn(async () => new Response('should not run'));
    for (const assertion of ['', 'forged.token.value']) {
      const headers = new Headers();
      if (assertion) headers.set('Cf-Access-Jwt-Assertion', assertion);
      const context = { env: productionEnv, data: {}, request: new Request('https://class.example/api/admin/session', { headers }), next, functionPath: '', waitUntil: vi.fn(), passThroughOnException: vi.fn() } as never;
      const response = await middleware[0](context) as Response;
      expect(response.status).toBe(302);
    }
    expect(next).not.toHaveBeenCalled();
  });
  it('accepts a signed Access assertion only with the right audience and validity window', async () => {
    const keys = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 1024, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
    const jwk = { ...await webcrypto.subtle.exportKey('jwk', keys.publicKey), kid: 'test-key', alg: 'RS256' };
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ keys: [jwk] }) })));
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const makeToken = async (aud: string, exp: number) => {
      const content = `${encode({ alg: 'RS256', kid: 'test-key' })}.${encode({ iss: 'https://example.cloudflareaccess.com', aud: [aud], exp, email: 'monitor@stu.xjtu.edu.cn' })}`;
      const signature = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(content));
      return `${content}.${Buffer.from(signature).toString('base64url')}`;
    };
    const run = async (token: string) => {
      const context = { env: { ...env, ACCESS_DOMAIN: 'https://example.cloudflareaccess.com', ACCESS_AUD: 'expected-audience' }, data: {}, request: new Request('https://class.example/api/admin/session', { headers: { 'Cf-Access-Jwt-Assertion': token } }), next: vi.fn(async () => new Response('ok')), functionPath: '', waitUntil: vi.fn(), passThroughOnException: vi.fn() };
      const response = await middleware[0](context as never) as Response;
      return { response, context };
    };
    const future = Math.floor(Date.now() / 1000) + 3600;
    const valid = await run(await makeToken('expected-audience', future));
    expect(valid.response.status).toBe(200);
    expect((await middleware[1](valid.context as never) as Response).status).toBe(200);
    expect((await run(await makeToken('wrong-audience', future))).response.status).toBe(302);
    expect((await run(await makeToken('expected-audience', 1))).response.status).toBe(302);
    vi.unstubAllGlobals();
  });
});
