import { logger } from './logger'

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

let weatherCache: {
  data: WeatherData | null
  timestamp: number
} = {
  data: null,
  timestamp: 0,
}

const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

export async function getWeather(): Promise<WeatherData | null> {
  const now = Date.now()
  if (weatherCache.data && now - weatherCache.timestamp < CACHE_DURATION) {
    return weatherCache.data
  }
  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?' +
        'latitude=51.5174&' +
        'longitude=-0.0795&' +
        'current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day,uv_index&' +
        'hourly=temperature_2m,weather_code,precipitation_probability&' +
        'daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset&' +
        'timezone=Europe/London&' +
        'forecast_days=3',
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
      })),
    }
    weatherCache = {
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
export function getWeatherEmoji(weatherCode: number, isDay: boolean): string {
  switch (weatherCode) {
    case 0:
      return isDay ? '☀️' : '🌙'
    case 1:
    case 2:
      return isDay ? '🌤️' : '☁️'
    case 3:
      return '☁️'
    case 45:
    case 48:
      return '🌫️'
    case 51:
    case 53:
    case 55:
      return '🌧️'
    case 61:
    case 63:
    case 65:
      return '🌧️'
    case 71:
    case 73:
    case 75:
    case 77:
      return '🌨️'
    case 80:
    case 81:
    case 82:
      return '🌦️'
    case 95:
      return '⛈️'
    default:
      return '🌡️'
  }
}
