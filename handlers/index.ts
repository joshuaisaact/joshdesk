import type { App, BlockAction } from '@slack/bolt'
import type { MonthSchedule } from '../types/schedule'
import { AttendanceStatus } from '../constants'
import { appHomeOpenedHandler } from '../events/app-home'
import { officeCommandHandler } from '../commands/office'
import { homeButtonHandler, officeButtonHandler } from '../interactions/buttons'
import { generateBlocks } from '../blocks/home'
import { logger } from '../utils/logger'
import { saveSchedule } from '../services/storage'
import { updateAttendance } from '../services/schedule'

let currentWeek = 0

export const setupEventHandlers = (
  app: App,
  state: { schedule: MonthSchedule },
) => {
  app.event('app_home_opened', async (args) => {
    try {
      await appHomeOpenedHandler(args, state.schedule, 0)
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling app_home_opened' })
    }
  })

  app.command('/office', async (args) => {
    try {
      await officeCommandHandler(args, state.schedule)
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling /office' })
    }
  })

  app.action<BlockAction>(/office_.*/, async (args) => {
    try {
      const updatedSchedule = await officeButtonHandler(args, state.schedule)
      if (updatedSchedule) {
        state.schedule = updatedSchedule
        await saveSchedule(updatedSchedule)
      }
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling office button' })
    }
  })

  app.action<BlockAction>(/home_.*/, async (args) => {
    try {
      const updatedSchedule = await homeButtonHandler(args, state.schedule)
      if (updatedSchedule) {
        state.schedule = updatedSchedule
        await saveSchedule(updatedSchedule)
      }
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling home button' })
    }
  })

  app.action<BlockAction>(
    /^set_status_(.+)_(\d+)$/,
    async ({ action, ack, client, body }) => {
      try {
        await ack()

        if (!('selected_option' in action) || !action.selected_option?.value) {
          logger.warn('No status selected')
          return
        }

        const [_, status, day, week] = action.selected_option.value.split(':')

        logger.info('Updating status:', {
          status,
          day,
          week,
          userId: body.user.id,
        })

        const updatedSchedule = updateAttendance(
          state.schedule,
          day,
          parseInt(week),
          body.user.id,
          status as AttendanceStatus,
        )

        state.schedule = updatedSchedule
        await saveSchedule(updatedSchedule)
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

  app.action('select_week', async ({ ack, body, client }) => {
    try {
      await ack()
      const action = (body as any).actions[0]
      const week = parseInt(action.selected_option.value)

      await client.views.publish({
        user_id: body.user.id,
        view: {
          type: 'home',
          blocks: await generateBlocks(
            state.schedule,
            true,
            week,
            body.user.id,
          ),
        },
      })
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling week selection' })
    }
  })
}

function normalizeUserId(userId: string): string {
  // If it starts with @ it's a display name, otherwise it's an ID
  return userId.startsWith('@') ? userId : `<@${userId}>`
}
