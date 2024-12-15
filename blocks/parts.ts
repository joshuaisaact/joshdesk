import type { Block, KnownBlock } from '@slack/types'
import type { DaySchedule } from '../types/schedule'
import { getDateSuffix } from '../utils/dates'
import { WEEK_LABELS } from '../constants'

export const createHeaderBlock = (isHomeView: boolean): KnownBlock => ({
  type: 'header',
  text: {
    type: 'plain_text',
    text: isHomeView
      ? '📅 Office Schedule'
      : "📅 Here's who's in the office this week:",
    emoji: true,
  },
})

export const createWeekLabelBlock = (weekLabel: string): KnownBlock => ({
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: `*${weekLabel}*`,
  },
})

export const createDayBlock = (
  day: string,
  schedule: DaySchedule,
  isHomeView: boolean,
  currentWeek: number,
): (KnownBlock | Block)[] => {
  const shortDay = isHomeView ? day.slice(0, 3) : day
  const dayText = `*${shortDay}${isHomeView ? ` ${schedule.date}${getDateSuffix(schedule.date)}` : ''}*\n${
    schedule.attendees.length ? schedule.attendees.join(' ') : 'No one yet!'
  }`

  if (!isHomeView) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: dayText,
        },
      },
      {
        type: 'divider',
      },
    ]
  }

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: dayText,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🏢 Office',
            emoji: true,
          },
          style: 'primary',
          action_id: `office_${day.toLowerCase()}_${currentWeek}`,
          value: `${day.toLowerCase()}_${currentWeek}`,
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🏠 Home',
            emoji: true,
          },
          action_id: `home_${day.toLowerCase()}_${currentWeek}`,
          value: `${day.toLowerCase()}_${currentWeek}`,
        },
      ],
    },
    {
      type: 'divider',
    },
  ]
}

export const createWeekSelectorBlock = (currentWeek: number): KnownBlock => ({
  type: 'actions',
  elements: [
    {
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
  ],
})
