import type {
  App,
  BlockAction,
  ButtonAction,
  ViewSubmitAction,
} from '@slack/bolt'
import type { MonthSchedule } from '../types/schedule'
import { AttendanceStatus } from '../constants'
import { officeCommandHandler } from '../commands/office'
import { generateBlocks } from '../blocks/home'
import { logger } from '../utils/logger'
import {
  getWorkspaceSettings,
  saveSchedule,
  saveWorkspaceSettings,
  type WorkspaceSettings,
} from '../services/storage'
import { createMonthSchedule, updateAttendance } from '../services/schedule'
import { createSettingsModal } from '../modals/settings'
import { getPlaceDetails, searchPlaces } from '../services/geocoding'
import { handleReminderAction } from './reminder-buttons.ts'
import { tryCatch } from '../utils/error-handlers.ts'
import { getWorkspaceSchedule } from '../utils/workspace.ts'
import { setupHomeHandlers } from './home.ts'
import { setupSettingsHandlers } from './settings.ts'
import { setupScheduleHandlers } from './schedule.ts'

export const setupEventHandlers = (
  app: App,
  state: Map<string, MonthSchedule>,
) => {
  setupHomeHandlers(app, state)
  setupSettingsHandlers(app, state)
  setupScheduleHandlers(app, state)

  const isButtonAction = (action: any): action is ButtonAction => {
    return 'text' in action
  }

  app.action<BlockAction>(/^reminder_status_.*/, async (args) => {
    // Type guard to ensure args.payload is ButtonAction
    if (!isButtonAction(args.payload)) return

    // Create a new args object with the correct type
    const buttonArgs = {
      ...args,
      payload: args.payload as ButtonAction,
      action: args.payload as ButtonAction,
      body: args.body as BlockAction<ButtonAction>,
    }

    await tryCatch(async () => {
      const schedule = await getWorkspaceSchedule(args.context.teamId, state)
      if (!schedule) return null
      return handleReminderAction(buttonArgs, schedule, state)
    }, 'Error handling reminder action')
  })

  app.command('/office', async ({ command, context, ...rest }) => {
    const schedule = await tryCatch(
      async () => getWorkspaceSchedule(context.teamId, state),
      'Error getting workspace schedule',
    )
    if (!schedule) return

    await tryCatch(
      async () =>
        officeCommandHandler(
          { command, context, ...rest },
          schedule,
          context.teamId!,
        ),
      'Error handling office command',
    )
  })
}
