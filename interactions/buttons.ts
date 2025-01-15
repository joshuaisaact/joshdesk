import type {
  AllMiddlewareArgs,
  SlackActionMiddlewareArgs,
  BlockElementAction,
} from '@slack/bolt'
import type { HomeView } from '../types/slack'
import type { MonthSchedule } from '../types/schedule'
import { AttendanceStatus } from '../constants'
import { generateBlocks } from '../blocks/home'
import { updateAttendance } from '../services/schedule'
import { logger } from '../utils/logger'

const parseDayFromAction = (
  action_id: string,
): { day: string; week: number } | null => {
  const [, dayPart, weekPart] = action_id.split('_')
  if (!dayPart || !weekPart) return null

  return {
    day: dayPart.charAt(0).toUpperCase() + dayPart.slice(1),
    week: parseInt(weekPart, 10),
  }
}

type ButtonHandlerArgs = AllMiddlewareArgs &
  SlackActionMiddlewareArgs & {
    action: BlockElementAction
  }

const handleAttendanceButton = async (
  { action, ack, body, client }: ButtonHandlerArgs,
  schedule: MonthSchedule,
  status: AttendanceStatus,
): Promise<MonthSchedule | undefined> => {
  await ack()
  const parsed = parseDayFromAction(action.action_id)
  if (!parsed) {
    logger.warn({ actionId: action.action_id, msg: 'Failed to parse action' })
    return
  }

  if (!(parsed.week in schedule) || !(parsed.day in schedule[parsed.week])) {
    logger.warn({
      week: parsed.week,
      day: parsed.day,
      msg: 'Invalid week or day',
    })
    return
  }

  logger.info({
    msg: 'Updating attendance',
    user: body.user.id,
    day: parsed.day,
    week: parsed.week,
    status,
    date: `${schedule[parsed.week][parsed.day].date}/${schedule[parsed.week][parsed.day].month}`,
  })

  const updatedSchedule = updateAttendance(
    schedule,
    parsed.day,
    parsed.week,
    body.user.id,
    status,
  )

  await client.views.publish({
    user_id: body.user.id,
    view: {
      type: 'home',
      blocks: await generateBlocks(
        updatedSchedule,
        true,
        parsed.week,
        body.user.id,
      ), // Add await here
    } as HomeView,
  })

  return updatedSchedule
}

export const officeButtonHandler = (
  args: ButtonHandlerArgs,
  schedule: MonthSchedule,
) => handleAttendanceButton(args, schedule, AttendanceStatus.OFFICE)

export const homeButtonHandler = (
  args: ButtonHandlerArgs,
  schedule: MonthSchedule,
) => handleAttendanceButton(args, schedule, AttendanceStatus.REMOTE)
