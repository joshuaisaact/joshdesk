import type { Block, KnownBlock } from '@slack/types'
import type { DaySchedule, MonthSchedule } from '../types/schedule'
import { format, isBefore, isToday, startOfDay } from 'date-fns'
import { AttendanceStatus, STATUS_OPTIONS, WEEK_LABELS } from '../constants'
import { logger } from '../utils/logger'
import {
  getWeather,
  getWeatherEmoji,
  WEATHER_CODES,
  type WeatherData,
} from '../utils/weather'
import { getDailyQuote } from '../utils/quotes'

function normalizeUserId(userId: string): string {
  if (!userId) return ''
  // If it's already in <@ID> format, return as is
  if (userId.startsWith('<@') && userId.endsWith('>')) return userId
  // If it's a raw ID, wrap it
  return `<@${userId}>`
}

export const createHeaderBlock = async (
  isHomeView: boolean,
  currentWeek: number,
): Promise<(KnownBlock | Block)[]> => {
  const weather = await getWeather()
  const quoteBlocks = await getDailyQuote()

  const blocks: (KnownBlock | Block)[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🏢 London Office*  📍 Liverpool Street',
      },
    },

    {
      type: 'divider',
    },
    ...quoteBlocks,
    {
      type: 'divider',
    },
  ]

  if (isHomeView) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ' ',
      },
      accessory: {
        type: 'static_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select week',
          emoji: true,
        },
        options: WEEK_LABELS.map((label, index) => ({
          text: {
            type: 'plain_text',
            text: label,
            emoji: true,
          },
          value: index.toString(),
        })),
        initial_option: {
          text: {
            type: 'plain_text',
            text: WEEK_LABELS[currentWeek],
            emoji: true,
          },
          value: currentWeek.toString(),
        },
        action_id: 'select_week',
      },
    })
  }

  return blocks
}

export const createWeekLabelBlock = (weekLabel: string): KnownBlock => ({
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: `*${weekLabel}*`,
  },
})

export const createWeekSelectorBlock = (currentWeek: number): KnownBlock => ({
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: ' ', // Empty space to prevent cursor, but maintain layout
  },
  accessory: {
    type: 'static_select' as const,
    placeholder: {
      type: 'plain_text' as const,
      text: 'Select week',
      emoji: true,
    },
    options: WEEK_LABELS.map((label, index) => ({
      text: {
        type: 'plain_text' as const,
        text: label,
        emoji: true,
      },
      value: index.toString(),
    })),
    initial_option: {
      text: {
        type: 'plain_text' as const,
        text: WEEK_LABELS[currentWeek],
        emoji: true,
      },
      value: currentWeek.toString(),
    },
    action_id: 'select_week',
  },
})

function shouldShowDay(scheduleDate: Date): boolean {
  const today = startOfDay(new Date())
  const dayDate = startOfDay(scheduleDate)
  return !isBefore(dayDate, today)
}

export const createDayBlock = (
  day: string,
  schedule: DaySchedule,
  isHomeView: boolean,
  currentWeek: number,
  userId: string,
  weather: WeatherData | null, // Add weather parameter
): (KnownBlock | Block)[] | null => {
  const scheduleDate = new Date(
    schedule.year,
    schedule.month - 1,
    schedule.date,
  )
  if (!shouldShowDay(scheduleDate)) {
    return null
  }
  const isCurrentDay = isToday(scheduleDate)
  const formattedDate = format(scheduleDate, 'EEEE, do MMMM')

  // Get weather for this day
  let dayWeather = null
  if (weather) {
    const dayIndex = weather.dailyForecast.findIndex(
      (forecast) =>
        format(new Date(forecast.time), 'yyyy-MM-dd') ===
        format(scheduleDate, 'yyyy-MM-dd'),
    )

    if (dayIndex !== -1) {
      const forecast = weather.dailyForecast[dayIndex]
      if (isCurrentDay) {
        dayWeather = {
          emoji: getWeatherEmoji(weather.weatherCode, weather.isDay),
          temp: `${weather.temperature}°C`,
          description: weather.description,
          feelsLike: weather.feelsLike,
        }
      } else {
        dayWeather = {
          emoji: getWeatherEmoji(forecast.weatherCode, true),
          temp: `${forecast.temperatureMax}°/${forecast.temperatureMin}°C`,
          description: WEATHER_CODES[forecast.weatherCode],
          // Note: daily forecast might not have feels like temp
        }
      }
    }
  }

  const userStatus = schedule.attendees.find(
    (a) => normalizeUserId(a.userId) === normalizeUserId(userId),
  )?.status
  // Simple categorization of users
  const officeUsers = schedule.attendees.filter((a) => a.status === 'office')
  const remoteUsers = schedule.attendees.filter((a) => a.status === 'remote')
  const travelingUsers = schedule.attendees.filter(
    (a) => a.status === 'traveling',
  )
  const clientUsers = schedule.attendees.filter((a) => a.status === 'client')

  logger.info({
    msg: 'Day status',
    data: {
      day,
      userStatus,
      userCount: {
        office: officeUsers.length,
        remote: remoteUsers.length,
        traveling: travelingUsers.length,
        client: clientUsers.length,
      },
    },
  })

  const blocks: (KnownBlock | Block)[] = [
    spacer,
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: formattedDate,
        emoji: true,
      },
    },
    {
      type: 'divider',
    },
  ]

  if (dayWeather) {
    blocks.push(
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${dayWeather.emoji} ${dayWeather.temp} • ${dayWeather.description}${
              dayWeather.feelsLike
                ? ` • _Feels like ${dayWeather.feelsLike}°C_`
                : ''
            }${
              isCurrentDay
                ? ` • ${weather?.humidity}% humidity • UV ${weather?.uvIndex} • <https://www.metoffice.gov.uk/weather/forecast/gcpvj0v07|Met Office Forecast>`
                : ''
            }`,
          },
        ],
      } as KnownBlock,
      spacer,
    )
  }

  // Add travel info right after the date for today only
  if (isCurrentDay) {
    blocks.push(
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '🚂 Liverpool St: Good service | Central Line: Minor delays',
          },
        ],
      },
      spacer,
    )
  }

  blocks.push(
    // Office section
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🏢 Office _(${officeUsers.length} going)_\n`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: renderUserList(officeUsers, 'No one in the office'),
      },
    },
    spacer,
    // Home section
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🏠 Home',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: renderUserList(remoteUsers, 'No one working remotely'),
      },
    },
    spacer,
    // Traveling section
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '✈️ Traveling for work',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: renderUserList(travelingUsers, 'No one traveling'),
      },
    },
    spacer,
    // Vacation section
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🌴 Holiday',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: renderUserList(clientUsers, 'No one on holiday'),
      },
    },
    spacer,
  )

  const statusEmoji =
    userStatus === 'office'
      ? '🏢 Office'
      : userStatus === 'remote'
        ? '🏠 Home'
        : userStatus === 'traveling'
          ? '✈️ Traveling'
          : userStatus === 'client'
            ? '🌴 Vacation'
            : '🔘 Set your status...'

  if (isHomeView) {
    const statusOptions = STATUS_OPTIONS.map((option) => ({
      ...option,
      value: `status:${option.value}:${day}:${currentWeek}`,
    }))

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'static_select' as const,
          placeholder: {
            type: 'plain_text' as const,
            text: userStatus ? statusEmoji : '🔘 Set your status...',
            emoji: true,
          },
          options: statusOptions,
          initial_option: userStatus
            ? statusOptions.find((option) =>
                option.value.includes(`status:${userStatus}:`),
              )
            : undefined,
          action_id: `set_status_${day.toLowerCase()}_${currentWeek}`,
        },
      ],
    })
  }

  return blocks
}

const spacer = {
  type: 'context',
  elements: [{ type: 'mrkdwn', text: ' ' }],
}

const renderUserList = (
  users: Array<{ userId: string }>,
  emptyMessage: string,
) =>
  users.length
    ? users.map((a) => normalizeUserId(a.userId)).join(' ')
    : `_${emptyMessage}_`
