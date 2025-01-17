import type { Block, KnownBlock } from '@slack/types'
import type { MonthSchedule } from '../types/schedule'
import {
  createHeaderBlock,
  createDayBlock,
  createWeekSelectorBlock,
} from './parts'
import { format } from 'date-fns/format'
import { getWeather } from '../utils/weather'
import { getWorkspaceSettings } from '../services/storage'

export const generateBlocks = async (
  monthSchedule: MonthSchedule,
  isHomeView: boolean,
  currentWeek: number = 0,
  userId: string,
  teamId: string,
): Promise<(KnownBlock | Block)[]> => {
  const settings = getWorkspaceSettings(teamId)

  const blocks: (KnownBlock | Block)[] = [
    ...(await createHeaderBlock(isHomeView, currentWeek, settings)),
  ]

  const weather = await getWeather(
    settings.latitude,
    settings.longitude,
    settings.timezone,
  )

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
