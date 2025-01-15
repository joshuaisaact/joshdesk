import type { Block, KnownBlock } from '@slack/types'
import type { MonthSchedule } from '../types/schedule'
import {
  createHeaderBlock,
  createDayBlock,
  createWeekSelectorBlock,
} from './parts'
import { format } from 'date-fns/format'
import { getWeather } from '../utils/weather'

export const generateBlocks = async (
  monthSchedule: MonthSchedule,
  isHomeView: boolean,
  currentWeek: number = 0,
  userId: string,
): Promise<(KnownBlock | Block)[]> => {
  // Make this async
  const blocks: (KnownBlock | Block)[] = [
    ...(await createHeaderBlock(isHomeView, currentWeek)), // Await the header blocks
  ]
  const weather = await getWeather()

  const weekSchedule = monthSchedule[currentWeek]

  if (!weekSchedule) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🚫 No schedule available for this week',
      },
    })
    return blocks
  }

  let hasVisibleDays = false

  Object.entries(weekSchedule).forEach(([day, schedule]) => {
    const dayBlocks = createDayBlock(
      day,
      schedule,
      isHomeView,
      currentWeek,
      userId,
      weather,
    )
    if (dayBlocks) {
      hasVisibleDays = true
      blocks.push(...dayBlocks)
    }
  })

  if (!hasVisibleDays) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '📅 No more days scheduled this week',
      },
    })
  }

  return blocks
}
