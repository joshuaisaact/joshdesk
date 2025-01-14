import type { App, BlockAction } from '@slack/bolt'
import type { MonthSchedule } from '../types/schedule'
import { appHomeOpenedHandler } from '../events/app-home'
import { officeCommandHandler } from '../commands/office'
import { homeButtonHandler, officeButtonHandler } from '../interactions/buttons'
import { generateBlocks } from '../blocks/home'
import { logger } from '../utils/logger'
import { saveSchedule } from '../services/storage'

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

  app.action('select_week', async ({ ack, body, client }) => {
    try {
      await ack()
      const action = (body as any).actions[0]
      const week = parseInt(action.selected_option.value)

      await client.views.publish({
        user_id: body.user.id,
        view: {
          type: 'home',
          blocks: generateBlocks(state.schedule, true, week),
        },
      })
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling week selection' })
    }
  })
}
