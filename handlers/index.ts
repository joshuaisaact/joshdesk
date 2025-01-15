import type { App, BlockAction } from '@slack/bolt'
import type { MonthSchedule } from '../types/schedule'
import { AttendanceStatus } from '../constants'
import { appHomeOpenedHandler } from '../events/app-home'
import { officeCommandHandler } from '../commands/office'
import { homeButtonHandler, officeButtonHandler } from '../interactions/buttons'
import { generateBlocks } from '../blocks/home'
import { logger } from '../utils/logger'
import { loadSchedule, saveSchedule } from '../services/storage'
import { createMonthSchedule, updateAttendance } from '../services/schedule'

let currentWeek = 0

const getWorkspaceSchedule = async (
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

export const setupEventHandlers = (
  app: App,
  state: Map<string, MonthSchedule>,
) => {
  app.event('app_home_opened', async ({ event, context, ...rest }) => {
    try {
      const schedule = await getWorkspaceSchedule(context.teamId, state)
      if (!schedule) return
      await appHomeOpenedHandler({ event, context, ...rest }, schedule, 0)
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling app_home_opened' })
    }
  })

  app.command('/office', async ({ command, context, ...rest }) => {
    try {
      const schedule = await getWorkspaceSchedule(context.teamId, state)
      if (!schedule) return
      await officeCommandHandler({ command, context, ...rest }, schedule)
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling /office' })
    }
  })

  app.action<BlockAction>(/office_.*/, async (args) => {
    try {
      const schedule = await getWorkspaceSchedule(args.context.teamId, state)
      if (!schedule) return

      const updatedSchedule = await officeButtonHandler(args, schedule)
      if (updatedSchedule && args.context.teamId) {
        state.set(args.context.teamId, updatedSchedule)
        await saveSchedule(args.context.teamId, updatedSchedule)
      }
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling office button' })
    }
  })

  app.action<BlockAction>(/home_.*/, async (args) => {
    try {
      const schedule = await getWorkspaceSchedule(args.context.teamId, state)
      if (!schedule) return

      const updatedSchedule = await homeButtonHandler(args, schedule)
      if (updatedSchedule && args.context.teamId) {
        state.set(args.context.teamId, updatedSchedule)
        await saveSchedule(args.context.teamId, updatedSchedule)
      }
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling home button' })
    }
  })

  app.action<BlockAction>(
    /^set_status_(.+)_(\d+)$/,
    async ({ action, ack, client, body, context }) => {
      try {
        await ack()
        const schedule = await getWorkspaceSchedule(context.teamId, state)
        if (!schedule) return

        if (!('selected_option' in action) || !action.selected_option?.value) {
          logger.warn('No status selected')
          return
        }

        const [_, status, day, week] = action.selected_option.value.split(':')

        const updatedSchedule = updateAttendance(
          schedule,
          day,
          parseInt(week),
          body.user.id,
          status as AttendanceStatus,
        )

        if (context.teamId) {
          state.set(context.teamId, updatedSchedule)
          await saveSchedule(context.teamId, updatedSchedule)
        }

        if (!body.view?.id) {
          logger.warn('View ID is missing')
          return
        }

        await client.views.update({
          view_id: body.view.id,
          view: {
            type: 'home',
            blocks: await generateBlocks(
              updatedSchedule,
              true,
              parseInt(week),
              body.user.id,
            ),
          },
        })
      } catch (error) {
        logger.error({ err: error, msg: 'Error handling status update' })
      }
    },
  )

  app.action('select_week', async ({ ack, body, client, context }) => {
    try {
      await ack()
      const schedule = await getWorkspaceSchedule(context.teamId, state)
      if (!schedule) return

      const action = (body as any).actions[0]
      const week = parseInt(action.selected_option.value)

      await client.views.publish({
        user_id: body.user.id,
        view: {
          type: 'home',
          blocks: await generateBlocks(schedule, true, week, body.user.id),
        },
      })
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling week selection' })
    }
  })
}
