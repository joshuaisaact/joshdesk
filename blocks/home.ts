import type { Block, KnownBlock } from '@slack/types'
import type { MonthSchedule, WeekSchedule } from '../types/schedule'
import { getDateSuffix } from '../utils/dates'

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
    // Add pagination controls - removed disabled property and simplified
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '◀️ Previous',
            emoji: true,
          },
          action_id: 'prev_week',
          value: currentWeek.toString(),
          style: currentWeek === 0 ? 'danger' : 'primary', // Visual indication instead of disabled
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Next ▶️',
            emoji: true,
          },
          action_id: 'next_week',
          value: currentWeek.toString(),
          style: currentWeek === 3 ? 'danger' : 'primary', // Visual indication instead of disabled
        },
      ],
    })

    // Add week indicator
    const weekLabels = ['Current Week', 'Next Week', 'Week 3', 'Week 4']
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${weekLabels[currentWeek]}*`,
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

  // Rest of your block generation code...
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
        accessory: {
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
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ' ',
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🏠 Home',
            emoji: true,
          },
          action_id: `home_${day.toLowerCase()}_${currentWeek}`,
          value: `${day.toLowerCase()}_${currentWeek}`,
        },
      },
      {
        type: 'divider',
      },
    )
  })

  return blocks
}
