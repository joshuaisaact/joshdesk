import { logger } from './utils/logger'
import { App, type BlockAction } from '@slack/bolt'
import { createMonthSchedule } from './services/schedule'
import { loadSchedule, saveSchedule } from './services/storage'
import { appHomeOpenedHandler } from './events/app-home'
import { officeCommandHandler } from './commands/office'
import { homeButtonHandler, officeButtonHandler } from './interactions/buttons'
import { generateBlocks } from './blocks/home'
import type { HomeView, SelectWeekAction } from './types/slack'
import { setupWeeklyReset } from './utils/schedule-reset'
import { DB_PATH, JSON_STORAGE_PATH } from './constants'
import { tryCatch } from './utils/error-handlers'
import { setupEventHandlers } from './handlers'
import { initializeDB } from './services/init'

// State
let officeSchedule = createMonthSchedule()

const initApp = async () => {
  const app = new App({
    token: Bun.env.SLACK_BOT_TOKEN,
    signingSecret: Bun.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: Bun.env.SLACK_APP_TOKEN,
  })

  const storedSchedule = await initializeDB()
  if (storedSchedule) {
    officeSchedule = storedSchedule
  }

  return app
}

const start = () =>
  tryCatch(async () => {
    logger.info('Starting app initialization...')
    const app = await initApp()

    setupEventHandlers(app, officeSchedule)

    setupWeeklyReset((newSchedule) => {
      logger.info({ msg: 'Weekly reset triggered' })
      officeSchedule = newSchedule
    }, Bun.env.SCHEDULE_TEST_MODE === 'true')

    await app.start(process.env.PORT || 3000)
    logger.info('⚡️ JoshDesk app is running!')
  }, 'Failed to start app')

start()
