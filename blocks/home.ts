import type { Block, KnownBlock } from '@slack/types'
import type { MonthSchedule, WeekSchedule } from '../types/schedule'
import { getDateSuffix } from '../utils/dates'

const WEEK_LABELS = ['Current Week', 'Next Week', 'Week 3', 'Week 4']

export const generateBlocks = (
  monthSchedule: MonthSchedule,
  isHomeView: boolean,
  currentWeek: number = 0,
): (KnownBlock | Block)[] => {
  const blocks: (KnownBlock | Block)[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: isHomeView ? '📅 Office Schedule' : "Here's who's in the office",
        emoji: true,
      },
    },
  ]

  if (isHomeView) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${WEEK_LABELS[currentWeek]}*`,
      },
    })
  }

  // Get the current week's schedule
  const weekSchedule = monthSchedule[currentWeek]

  if (!weekSchedule) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'No schedule available for this week',
      },
    })
    return blocks
  }

  // Add schedule content
  Object.entries(weekSchedule).forEach(([day, { attendees, date }]) => {
    const shortDay = isHomeView ? day.slice(0, 3) : day
    const dayText = `*${shortDay}${isHomeView ? ` ${date}${getDateSuffix(date)}` : ''}*\n${
      attendees.length ? attendees.join(' ') : 'No one yet!'
    }`

    blocks.push(
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
    )
  })

  // Add week selector at the bottom
  if (isHomeView) {
    blocks.push({
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
  }

  return blocks
}
