import type {
  App,
  BlockAction,
  Middleware,
  SlackAction,
  SlackActionMiddlewareArgs,
  StaticSelectAction,
} from '@slack/bolt'
import type { MonthSchedule } from '../types/schedule'
import type { HomeView, SelectWeekAction } from '../types/slack'
import { appHomeOpenedHandler } from '../events/app-home'
import { officeCommandHandler } from '../commands/office'
import { homeButtonHandler, officeButtonHandler } from '../interactions/buttons'
import { generateBlocks } from '../blocks/home'
import { logger } from '../utils/logger'
import { saveSchedule } from '../services/storage'

let currentWeek = 0

export const setupEventHandlers = (app: App, officeSchedule: MonthSchedule) => {
  app.event('app_home_opened', async (args) => {
    try {
      await appHomeOpenedHandler(args, officeSchedule, 0)
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling app_home_opened' })
    }
  })

  app.command('/office', async (args) => {
    try {
      await officeCommandHandler(args, officeSchedule)
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling /office' })
    }
  })
  app.action<BlockAction>(/office_.*/, async (args) => {
    try {
      const updatedSchedule = await officeButtonHandler(args, officeSchedule)
      if (updatedSchedule) {
        officeSchedule = updatedSchedule
        await saveSchedule(updatedSchedule)
      }
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling office button' })
    }
  })

  app.action<BlockAction>(/home_.*/, async (args) => {
    try {
      const updatedSchedule = await homeButtonHandler(args, officeSchedule)
      if (updatedSchedule) {
        officeSchedule = updatedSchedule
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
          blocks: generateBlocks(officeSchedule, true, week),
        },
      })
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling week selection' })
    }
  })
}
