export interface WeatherCondition {
  condition: string;
  icon: string;
  description: string;
}

/**
 * Parses open-meteo weather forecast codes into standard conditions, icons, and descriptions.
 */
export function parseWeatherCode(code: number): WeatherCondition {
  if (code === 0) return { condition: 'clear', icon: 'sun', description: 'Trời nắng đẹp ☀️' };
  if ([1, 2, 3].includes(code)) return { condition: 'cloudy', icon: 'cloud', description: 'Có mây nhẹ ⛅' };
  if ([45, 48].includes(code)) return { condition: 'fog', icon: 'cloud-fog', description: 'Có sương mù 🌫️' };
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { condition: 'rain', icon: 'droplets', description: 'Trời có mưa 🌧️' };
  if ([95, 96, 99].includes(code)) return { condition: 'storm', icon: 'cloud-lightning', description: 'Giông bão ⛈️' };
  return { condition: 'cloudy', icon: 'cloud', description: 'Nhiều mây ☁️' };
}
