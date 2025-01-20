import { logger } from './utils/logger'
import { App } from '@slack/bolt'
import {
  resetWorkspaceSchedules,
  setupWeeklyReset,
  shouldResetSchedule,
} from './utils/schedule-reset'
import { tryCatch } from './utils/error-handlers'
import { setupEventHandlers } from './handlers'
import { startServer } from './services/server'
import { installationStore } from './services/installation'
import {
  deleteWorkspaceData,
  getAllWorkspaceIds,
  loadSchedule,
  saveSchedule,
} from './services/storage'
import type { MonthSchedule } from './types/schedule'
import { createMonthSchedule } from './services/schedule.ts'

// State
const state = new Map<string, MonthSchedule>()

const initApp = async () => {
  const app = new App({
    signingSecret: Bun.env.SLACK_SIGNING_SECRET,
    clientId: Bun.env.SLACK_CLIENT_ID,
    clientSecret: Bun.env.SLACK_CLIENT_SECRET,
    stateSecret: Bun.env.SLACK_STATE_SECRET,
    scopes: ['chat:write', 'commands', 'users:read', 'users.profile:write'],
    installationStore,
    socketMode: true,
    appToken: Bun.env.SLACK_APP_TOKEN,
    redirectUri:
      'https://9884-149-22-196-72.ngrok-free.app/slack/oauth/callback',
    installerOptions: {
      redirectUriPath: '/slack/oauth/callback',
      directInstall: true,
      stateVerification: false, // Disable state verification
    },
  })

  // Add error handler
  app.error(async (error) => {
    console.error('Detailed app error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    })
  })

  // Initialize the event handlers with workspace awareness
  app.event('app_installed', async ({ context }) => {
    try {
      const teamId = context.teamId
      if (!teamId) {
        logger.error('No team ID found in context during installation')
        return
      }

      const schedule = createMonthSchedule(shouldResetSchedule())
      await saveSchedule(teamId, schedule)
      state.set(teamId, schedule)
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

    // First load existing schedules into state
    const workspaceIds = await getAllWorkspaceIds()
    if (workspaceIds) {
      for (const teamId of workspaceIds) {
        const schedule = await loadSchedule(teamId)
        if (schedule) {
          state.set(teamId, schedule)
        }
      }
      logger.info(`Loaded ${workspaceIds.length} schedules into state`)
    }

    await resetWorkspaceSchedules(state)

    setupEventHandlers(app, state)
    setupWeeklyReset(
      (teamId, newSchedule) => {
        logger.info({ msg: 'Weekly reset triggered' })
        state.set(teamId, newSchedule)
      },
      state,
      app,
      Bun.env.SCHEDULE_TEST_MODE === 'true',
    )

    await startServer(app)
    logger.info('⚡️ JoshDesk app is running!')
  }, 'Failed to start app')

start()
