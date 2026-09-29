import { expect, it } from 'vitest';
import { onRequestGet } from './login';

it('returns the browser to the management view after Access login', async () => {
  const response = await onRequestGet({ request: new Request('https://class.example/api/admin/login') } as never);
  expect(response.status).toBe(302);
  expect(response.headers.get('Location')).toBe('https://class.example/?view=admin');
});
