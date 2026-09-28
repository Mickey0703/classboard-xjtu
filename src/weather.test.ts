import { expect, it, vi } from 'vitest';
import { getXianWeather } from './weather';

it('reads live Xi’an temperature from a successful response', async () => {
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ current: { temperature_2m: 22.3, apparent_temperature: 20, relative_humidity_2m: 64, weather_code: 3, wind_speed_10m: 12 } }) })) as never;
  expect(await getXianWeather(fetcher)).toMatchObject({ temperature: 22, condition: '多云', humidity: 64 });
});
it('reports unavailable weather instead of a fake temperature', async () => {
  const fetcher = vi.fn(async () => { throw Error('network'); }) as never;
  expect(await getXianWeather(fetcher)).toEqual({ available: false });
});
