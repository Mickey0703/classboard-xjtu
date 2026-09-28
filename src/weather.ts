export type WeatherResult = { available: true; temperature: number; feelsLike: number; humidity: number; wind: number; condition: string } | { available: false };
const weatherText = (code: number) => code === 0 ? '晴' : code <= 3 ? '多云' : code <= 48 ? '雾' : code <= 67 ? '有雨' : code <= 77 ? '有雪' : code <= 82 ? '阵雨' : code <= 86 ? '阵雪' : '雷雨';

export async function getXianWeather(fetcher: typeof fetch = fetch): Promise<WeatherResult> {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=34.26&longitude=108.95&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia%2FShanghai';
    const response = await fetcher(url);
    if (!response.ok) return { available: false };
    const data = await response.json() as { current?: Record<string, number> };
    const c = data.current;
    if (!c || !Number.isFinite(c.temperature_2m) || !Number.isFinite(c.weather_code)) return { available: false };
    return { available: true, temperature: Math.round(c.temperature_2m), feelsLike: Math.round(c.apparent_temperature), humidity: c.relative_humidity_2m, wind: Math.round(c.wind_speed_10m), condition: weatherText(c.weather_code) };
  } catch { return { available: false }; }
}
