import { logger } from './logger'
import { format } from 'date-fns/format'

export interface WeatherData {
  temperature: number
  description: string
  isDay: boolean
  weatherCode: number
  // Additional useful fields
  feelsLike: number
  humidity: number
  precipitation: number
  windSpeed: number
  uvIndex: number
  // Forecast
  hourlyForecast: {
    time: string
    temperature: number
    weatherCode: number
    precipitation: number
  }[]
  // Daily forecast
  dailyForecast: {
    time: string
    temperatureMax: number
    temperatureMin: number
    weatherCode: number
    sunrise: string
    sunset: string
    precipitation: number
  }[]
}

export const WEATHER_CODES: { [key: number]: string } = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
}

const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

const weatherCache: {
  [key: string]: {
    data: WeatherData | null
    timestamp: number
  }
} = {}

export async function getWeather(
  latitude: number,
  longitude: number,
  timezone: string,
): Promise<WeatherData | null> {
  const cacheKey = `${latitude},${longitude}`
  const now = Date.now()

  if (
    weatherCache[cacheKey]?.data &&
    now - weatherCache[cacheKey].timestamp < CACHE_DURATION
  ) {
    return weatherCache[cacheKey].data
  }

  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?' +
        `latitude=${latitude}&` +
        `longitude=${longitude}&` +
        'current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day,uv_index&' +
        'hourly=temperature_2m,weather_code,precipitation_probability&' +
        'daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_mean&' +
        `timezone=${timezone}&` +
        'forecast_days=5',
    )

    const data = await response.json()

    const weatherData = {
      temperature: Math.round(data.current.temperature_2m),
      weatherCode: data.current.weather_code,
      description: WEATHER_CODES[data.current.weather_code] || 'Unknown',
      isDay: data.current.is_day === 1,
      feelsLike: Math.round(data.current.apparent_temperature),
      humidity: Math.round(data.current.relative_humidity_2m),
      precipitation: data.current.precipitation,
      windSpeed: Math.round(data.current.wind_speed_10m),
      uvIndex: Math.round(data.current.uv_index),

      // Next few hours forecast
      hourlyForecast: data.hourly.time
        .slice(0, 24) // Next 24 hours
        .map((time: string, i: number) => ({
          time,
          temperature: Math.round(data.hourly.temperature_2m[i]),
          weatherCode: data.hourly.weather_code[i],
          precipitation: data.hourly.precipitation_probability[i],
        })),

      // Next few days
      dailyForecast: data.daily.time.map((time: string, i: number) => ({
        time,
        temperatureMax: Math.round(data.daily.temperature_2m_max[i]),
        temperatureMin: Math.round(data.daily.temperature_2m_min[i]),
        weatherCode: data.daily.weather_code[i],
        sunrise: data.daily.sunrise[i],
        sunset: data.daily.sunset[i],
        precipitation: data.daily.precipitation_probability_mean[i],
      })),
    }
    weatherCache[cacheKey] = {
      data: weatherData,
      timestamp: now,
    }

    return weatherData
  } catch (error) {
    logger.error({ msg: 'Failed to fetch weather', error })
    return null
  }
}

// Helper to get weather emoji based on code and time of day
export function getWeatherEmoji(code: number, isDay: boolean): string {
  const emojiMap: { [key: number]: string } = {
    0: isDay ? '☀️' : '🌙',
    1: isDay ? '🌤️' : '🌙',
    2: isDay ? '⛅️' : '🌙☁️',
    3: '☁️',
    45: '🌫️',
    48: '🌫️❄️',
    51: '🌦️',
    53: '🌧️',
    55: '🌧️🌧️',
    61: '🌧️',
    63: '🌧️⚡️',
    65: '⛈️',
    71: '🌨️',
    73: '❄️',
    75: '❄️❄️',
    77: '❄️',
    80: '🌦️',
    81: '🌧️',
    82: '⛈️',
    95: '⛈️⚡️',
  }
  return emojiMap[code] || '🌡️'
}

export function getFormattedWeather(
  weather: WeatherData | null,
  scheduleDate: Date,
  isCurrentDay: boolean,
): {
  emoji: string
  temp: string
  description: string
  feelsLike?: number
  humidity?: number
  uvIndex?: number
  precipitation?: number
  windSpeed?: number
} | null {
  if (!weather) return null

  const dayIndex = weather.dailyForecast.findIndex(
    (forecast) =>
      format(new Date(forecast.time), 'yyyy-MM-dd') ===
      format(scheduleDate, 'yyyy-MM-dd'),
  )

  if (dayIndex === -1) return null

  if (isCurrentDay) {
    return {
      emoji: getWeatherEmoji(weather.weatherCode, weather.isDay),
      temp: `${weather.temperature}°C`,
      description: weather.description,
      feelsLike: weather.feelsLike,
      humidity: weather.humidity,
      uvIndex: weather.uvIndex,
    }
  }

  const forecast = weather.dailyForecast[dayIndex]
  return {
    emoji: getWeatherEmoji(forecast.weatherCode, true),
    temp: `${forecast.temperatureMax}°/${forecast.temperatureMin}°C`,
    description: WEATHER_CODES[forecast.weatherCode],
    precipitation: forecast.precipitation,
    windSpeed: weather.windSpeed,
  }
}
