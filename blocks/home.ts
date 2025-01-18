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
import { logger } from '../utils/logger.ts'

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

  logger.info('Settings for weather:', {
    teamId,
    lat: settings.latitude,
    long: settings.longitude,
    timezone: settings.timezone,
    officeName: settings.officeName // Add this to verify we have the right settings
  });


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
  logger.info('dayblocks called with:', {
    isHomeView: isHomeView,
    currentWeek: currentWeek,
    userId: userId,
    weather: weather,
    settings: settings,
    teamId: teamId,
  })
  for (const [day, schedule] of Object.entries(weekSchedule)) {
    const dayBlocks = await createDayBlock(
      day,
      schedule,
      isHomeView,
      currentWeek,
      userId,
      weather,
      settings,
      teamId,
    )
    if (dayBlocks) {
      hasVisibleDays = true
      blocks.push(...dayBlocks)
    }
  }

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
