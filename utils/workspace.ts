import type { MonthSchedule } from '../types/schedule'
import { loadSchedule } from '../services/storage'
import { createMonthSchedule } from '../services/schedule'
import { logger } from './logger'

export const getWorkspaceSchedule = async (
  teamId: string | undefined,
  state: Map<string, MonthSchedule>,
): Promise<MonthSchedule | undefined> => {
  if (!teamId) {
    logger.error('No team ID found in context')
    return undefined
  }

  let schedule = state.get(teamId)
  if (!schedule) {
    schedule = (await loadSchedule(teamId)) ?? createMonthSchedule()
    if (schedule) {
      state.set(teamId, schedule)
    }
  }
  return schedule
}
