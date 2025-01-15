import { logger } from './utils/logger'
import { App } from '@slack/bolt'
import { createMonthSchedule } from './services/schedule'
import { setupWeeklyReset } from './utils/schedule-reset'
import { tryCatch } from './utils/error-handlers'
import { setupEventHandlers } from './handlers'
import { initializeDB } from './services/init'
import { startServer } from './services/server'
import { installationStore } from './services/installation'

// State
const state = {
  schedule: createMonthSchedule(),
}

const initApp = async () => {
  const app = new App({
    signingSecret: Bun.env.SLACK_SIGNING_SECRET,
    clientId: Bun.env.SLACK_CLIENT_ID,
    clientSecret: Bun.env.SLACK_CLIENT_SECRET,
    stateSecret: Bun.env.SLACK_STATE_SECRET,
    scopes: ['channels:history', 'chat:write', 'commands'],
    installationStore,
    socketMode: true,
    appToken: Bun.env.SLACK_APP_TOKEN,
    redirectUri:
      'https://bf89-149-22-196-72.ngrok-free.app/slack/oauth/callback',
    installerOptions: {
      redirectUriPath: '/slack/oauth/callback',
    },
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
