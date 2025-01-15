import { logger } from './utils/logger'
import { App } from '@slack/bolt'
import { createMonthSchedule } from './services/schedule'
import { setupWeeklyReset } from './utils/schedule-reset'
import { tryCatch } from './utils/error-handlers'
import { setupEventHandlers } from './handlers'
import { initializeDB } from './services/init'
import { startServer } from './services/server'
import { installationStore } from './services/installation'
import { deleteWorkspaceData, loadSchedule } from './services/storage'
import type { MonthSchedule } from './types/schedule'

// State
const state = new Map<string, MonthSchedule>()

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

  // Initialize the event handlers with workspace awareness
  app.event('app_installed', async ({ context }) => {
    try {
      const teamId = context.teamId
      if (!teamId) {
        logger.error('No team ID found in context during installation')
        return
      }
      await loadSchedule(teamId)
      logger.info(`App installed in workspace ${teamId}`)
    } catch (error) {
      logger.error('Error handling installation:', error)
    }
  })

  app.event('app_uninstalled', async ({ context }) => {
    try {
      const teamId = context.teamId
      if (!teamId) {
        logger.error('No team ID found in context during uninstall')
        return
      }
      await deleteWorkspaceData(teamId)
      await installationStore.deleteInstallation({
        teamId,
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      })
      logger.info(`App uninstalled from workspace ${teamId}`)
    } catch (error) {
      logger.error('Error handling uninstall:', error)
    }
  })

  return app
}

const start = () =>
  tryCatch(async () => {
    logger.info('Starting app initialization...')
    const app = await initApp()

    setupEventHandlers(app, state)
    setupWeeklyReset(
      (teamId, newSchedule) => {
        logger.info({ msg: 'Weekly reset triggered' })
        state.set(teamId, newSchedule)
      },
      state,
      Bun.env.SCHEDULE_TEST_MODE === 'true',
    )

    await startServer(app)
    logger.info('⚡️ JoshDesk app is running!')
  }, 'Failed to start app')

start()
