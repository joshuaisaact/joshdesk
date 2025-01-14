import { logger } from './utils/logger'
import { App } from '@slack/bolt'
import { createMonthSchedule } from './services/schedule'
import { setupWeeklyReset } from './utils/schedule-reset'
import { tryCatch } from './utils/error-handlers'
import { setupEventHandlers } from './handlers'
import { initializeDB } from './services/init'
import { startServer } from './services/server'

// State
const state = {
  schedule: createMonthSchedule(),
}

const initApp = async () => {
  const app = new App({
    token: Bun.env.SLACK_BOT_TOKEN,
    signingSecret: Bun.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: Bun.env.SLACK_APP_TOKEN,
  })

  const storedSchedule = await initializeDB()
  if (storedSchedule) {
    state.schedule = storedSchedule
  }

  return app
}

const start = () =>
  tryCatch(async () => {
    logger.info('Starting app initialization...')
    const app = await initApp()

    setupEventHandlers(app, state)

    setupWeeklyReset((newSchedule) => {
      logger.info({ msg: 'Weekly reset triggered' })
      state.schedule = newSchedule
    }, Bun.env.SCHEDULE_TEST_MODE === 'true')

    await startServer(app)
    logger.info('⚡️ JoshDesk app is running!')
  }, 'Failed to start app')

start()
