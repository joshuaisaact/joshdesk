import type {
  Block,
  ContextBlock,
  KnownBlock,
  MrkdwnElement,
  PlainTextOption,
} from '@slack/types'
import type { DaySchedule } from '../types/schedule'
import { format, isBefore, isToday, startOfDay } from 'date-fns'
import { STATUS_OPTIONS, WEEK_LABELS } from '../constants'
import {
  getFormattedWeather,
  getWeatherEmoji,
  WEATHER_CODES,
  type WeatherData,
} from '../utils/weather'
import { getDailyQuote } from '../utils/quotes'
import { type WorkspaceSettings } from '../services/storage'

const DIVIDER_BLOCK: KnownBlock = { type: 'divider' }
const TINY_SPACER: KnownBlock = {
  type: 'context',
  elements: [{ type: 'mrkdwn', text: ' ' }],
}

interface CategoryGroup {
  emoji: string
  displayName: string
  users: Array<{ userId: string }>
  emptyMessage: string
  isOffice: boolean
}

function normalizeUserId(userId: string): string {
  if (!userId) return ''
  if (userId.startsWith('<@') && userId.endsWith('>')) return userId
  return `<@${userId}>`
}

function renderUserList(
  users: Array<{ userId: string }>,
  emptyMessage: string,
): string {
  return users.length
    ? users.map((a) => normalizeUserId(a.userId)).join(' ')
    : `_${emptyMessage}_`
}

function createCategorySection({
  emoji,
  displayName,
  users,
  emptyMessage,
  isOffice = false, // Add this parameter
}: CategoryGroup): KnownBlock {
  const countSuffix = isOffice ? ` _(${users.length} going)_` : ''

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${emoji} ${displayName}${countSuffix}\n\n${renderUserList(users, emptyMessage)}`,
    },
  }
}

export const createHeaderBlock = async (
  isHomeView: boolean,
  currentWeek: number,
  settings: WorkspaceSettings,
): Promise<(KnownBlock | Block)[]> => {
  const quoteBlocks = await getDailyQuote()

  return [
    {
      type: 'divider',
    },
    ...quoteBlocks,
    {
      type: 'divider',
    },

    // Header with office name and settings
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: settings.officeName,
        emoji: true,
      },
    },

    // Office address in context block for subtle appearance
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📍 _${settings.officeAddress}_`, // Making it italic to keep it subtle like before
      },
      accessory: {
        type: 'static_select',
        placeholder: {
          type: 'plain_text',
          text: 'Choose a week',
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
    },
  ]
}

export const createWeekSelectorBlock = (currentWeek: number): KnownBlock => ({
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

const getWeatherElements = (
  dayWeather: ReturnType<typeof getFormattedWeather>,
  isCurrentDay: boolean,
): MrkdwnElement[] => {
  if (!dayWeather) return []

  const elements: MrkdwnElement[] = [
    {
      type: 'mrkdwn',
      text: `${dayWeather.emoji}  ${dayWeather.temp}`,
    },
  ]

  // Handle description and precipitation together
  const precipText =
    !isCurrentDay && dayWeather.precipitation && dayWeather.precipitation >= 20
      ? ` (${dayWeather.precipitation}% chance)`
      : ''

  elements.push({
    type: 'mrkdwn',
    text: dayWeather.description + precipText,
  })

  if (isCurrentDay) {
    // Current day elements
    if (dayWeather.feelsLike) {
      elements.push({
        type: 'mrkdwn',
        text: `Feels like ${dayWeather.feelsLike}°C`,
      })
    }

    if (dayWeather.uvIndex !== undefined) {
      const uvIndicator =
        dayWeather.uvIndex >= 8
          ? '🔴'
          : dayWeather.uvIndex >= 6
            ? '🟠'
            : dayWeather.uvIndex >= 3
              ? '🟡'
              : '🟢'
      elements.push({
        type: 'mrkdwn',
        text: `UV ${dayWeather.uvIndex} ${uvIndicator}`,
      })
    }

    if (dayWeather.humidity) {
      elements.push({
        type: 'mrkdwn',
        text: `${dayWeather.humidity}% humidity`,
      })
    }

    // Add wind info if significant
    if (dayWeather.windSpeed && dayWeather.windSpeed >= 15) {
      const windText =
        dayWeather.windSpeed >= 30
          ? `Strong wind ${dayWeather.windSpeed}mph 💨💨`
          : dayWeather.windSpeed >= 20
            ? `Windy ${dayWeather.windSpeed}mph 💨`
            : `Breezy ${dayWeather.windSpeed}mph`
      elements.push({
        type: 'mrkdwn',
        text: `${windText}`,
      })
    }

    elements.push({
      type: 'mrkdwn',
      text: `<https://www.metoffice.gov.uk/weather/forecast/gcpvj0v07|Details>`,
    })
  } else {
    // Add wind warning for future days if very windy
    if (dayWeather.windSpeed && dayWeather.windSpeed >= 20) {
      const windText =
        dayWeather.windSpeed >= 30
          ? `Strong wind ${dayWeather.windSpeed}mph 💨💨`
          : `Windy ${dayWeather.windSpeed}mph 💨`
      elements.push({
        type: 'mrkdwn',
        text: `${windText}`,
      })
    }
  }

  return elements
}

export function createDayBlock(
  day: string,
  schedule: DaySchedule,
  isHomeView: boolean,
  currentWeek: number,
  userId: string,
  weather: WeatherData | null,
  settings: WorkspaceSettings,
): (KnownBlock | Block)[] | null {
  // Setup and validation
  const scheduleDate = new Date(
    schedule.year,
    schedule.month - 1,
    schedule.date,
  )
  if (!shouldShowDay(scheduleDate)) return null

  const isCurrentDay = isToday(scheduleDate)
  const formattedDate = format(scheduleDate, 'EEEE, do MMMM')
  const dayWeather = getFormattedWeather(weather, scheduleDate, isCurrentDay)

  const userStatus = schedule.attendees.find(
    (a) => normalizeUserId(a.userId) === normalizeUserId(userId),
  )?.status

  const enabledCategories = settings.categories.filter(
    (c) => c.isEnabled || c.id === 'office',
  )
  const categoryMap = new Map(enabledCategories.map((c) => [c.id, c]))

  // Group users by category
  const usersByCategory = enabledCategories.reduce(
    (acc, category) => ({
      ...acc,
      [category.id]: schedule.attendees.filter((a) => a.status === category.id),
    }),
    {} as Record<string, typeof schedule.attendees>,
  )

  // Build blocks
  const blocks: (KnownBlock | Block)[] = [
    // Header section
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: formattedDate,
        emoji: true,
      },
    },

    // Weather section (if available)
    ...(dayWeather
      ? [
          {
            type: 'context' as const,
            elements: getWeatherElements(dayWeather, isCurrentDay),
          } satisfies ContextBlock,
        ]
      : []),

    DIVIDER_BLOCK,
  ]

  // Add categories with proper spacing
  enabledCategories.forEach((category, index) => {
    const categoryGroup: CategoryGroup = {
      emoji: category.emoji,
      displayName: category.displayName,
      users: usersByCategory[category.id] || [],
      emptyMessage: getEmptyMessage(category.id),
      isOffice: category.id === 'office', // Add this
    }

    if (index === enabledCategories.length - 1 && isHomeView) {
      // For the last category, create a section with both category and status selector
      const countSuffix =
        category.id === 'office'
          ? ` _(${usersByCategory[category.id]?.length || 0} going)_`
          : ''

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${category.emoji} ${category.displayName}${countSuffix}\n\n${renderUserList(
            usersByCategory[category.id] || [],
            getEmptyMessage(category.id),
          )}`,
        },
        accessory: {
          type: 'static_select',
          placeholder: {
            type: 'plain_text',
            text:
              userStatus && categoryMap.has(userStatus)
                ? `${categoryMap.get(userStatus)?.emoji} ${categoryMap.get(userStatus)?.displayName}`
                : `${format(scheduleDate, 'EEEE')} - Set status`, // Updated placeholder text
            emoji: true,
          },
          options: enabledCategories.map((c) => ({
            text: {
              type: 'plain_text',
              text: `${c.emoji} ${c.displayName}`,
              emoji: true,
            },
            value: `status:${c.id}:${day}:${currentWeek}`,
          })),
          initial_option:
            userStatus && categoryMap.has(userStatus)
              ? {
                  text: {
                    type: 'plain_text',
                    text: `${categoryMap.get(userStatus)?.emoji} ${categoryMap.get(userStatus)?.displayName}`,
                    emoji: true,
                  },
                  value: `status:${userStatus}:${day}:${currentWeek}`,
                }
              : undefined,
          action_id: `set_status_${day.toLowerCase()}_${currentWeek}`,
        },
      })
    } else {
      // For all other categories, render normally
      blocks.push(createCategorySection(categoryGroup))
      if (index < enabledCategories.length - 1) {
        blocks.push(TINY_SPACER)
      }
    }
  })

  blocks.push(TINY_SPACER, DIVIDER_BLOCK, TINY_SPACER)

  return blocks
}

export const createFooterBlock = (
  isHomeView: boolean,
  isAdmin: boolean,
): (KnownBlock | Block)[] => {
  if (!isHomeView || !isAdmin) return []

  return [
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Admin Settings',
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Configure workspace settings including office location, categories, and timezone.',
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '⚙️ Workspace Settings',
          emoji: true,
        },
        action_id: 'open_settings',
      },
    },
  ]
}

function getEmptyMessage(categoryId: string): string {
  const messages: Record<string, string> = {
    office: 'No one in the office',
    remote: 'No one working remotely',
    traveling: 'No one traveling',
    holiday: 'No one on holiday',
  }
  return messages[categoryId] || 'No one in this category'
}

function shouldShowDay(scheduleDate: Date): boolean {
  const today = startOfDay(new Date())
  const dayDate = startOfDay(scheduleDate)
  return !isBefore(dayDate, today)
}
