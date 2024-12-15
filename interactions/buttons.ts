import type {
  AllMiddlewareArgs,
  SlackActionMiddlewareArgs,
  BlockElementAction,
} from '@slack/bolt'
import type { HomeView } from '../types/slack'
import type { MonthSchedule, WeekSchedule } from '../types/schedule'
import { AttendanceStatus } from '../constants'
import { generateBlocks } from '../blocks/home'
import { updateAttendance } from '../services/schedule'

// Helper function to parse day from action_id
const parseDayFromAction = (
  action_id: string,
): { day: string; week: number } | null => {
  const parts = action_id.split('_')
  if (parts.length !== 3) return null

  const day = parts[1].charAt(0).toUpperCase().concat(parts[1].slice(1))
  const week = parseInt(parts[2], 10)

  return { day, week }
}

type ButtonHandlerArgs = AllMiddlewareArgs &
  SlackActionMiddlewareArgs & {
    action: BlockElementAction
  }

export const officeButtonHandler = async (
  { action, ack, body, client }: ButtonHandlerArgs,
  schedule: MonthSchedule,
): Promise<MonthSchedule | undefined> => {
  await ack()
  const parsed = parseDayFromAction(action.action_id)
  if (!parsed) return

  // Check if week and day exist in schedule
  if (!(parsed.week in schedule) || !(parsed.day in schedule[parsed.week]))
    return

  const updatedSchedule = updateAttendance(
    schedule,
    parsed.day, // Use parsed.day instead of day
    parsed.week, // Use parsed.week instead of currentWeek
    body.user.id,
    AttendanceStatus.Office,
  )

  await client.views.publish({
    user_id: body.user.id,
    view: {
      type: 'home',
      blocks: generateBlocks(updatedSchedule, true, parsed.week), // Use parsed.week here too
    } as HomeView,
  })

  return updatedSchedule
}

export const homeButtonHandler = async (
  { action, ack, body, client }: ButtonHandlerArgs,
  schedule: MonthSchedule, // Changed from WeekSchedule to MonthSchedule
): Promise<MonthSchedule | undefined> => {
  await ack()
  const parsed = parseDayFromAction(action.action_id)
  if (!parsed) return

  if (!(parsed.week in schedule) || !(parsed.day in schedule[parsed.week]))
    return

  const updatedSchedule = updateAttendance(
    schedule,
    parsed.day,
    parsed.week, // Need to pass current week
    body.user.id,
    AttendanceStatus.Home,
  )

  await client.views.publish({
    user_id: body.user.id,
    view: {
      type: 'home',
      blocks: generateBlocks(updatedSchedule, true, parsed.week),
    } as HomeView,
  })

  return updatedSchedule
}
