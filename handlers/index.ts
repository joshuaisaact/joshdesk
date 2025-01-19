import type { App, BlockAction, ViewSubmitAction } from '@slack/bolt'
import type { MonthSchedule } from '../types/schedule'
import { AttendanceStatus } from '../constants'
import { appHomeOpenedHandler } from '../events/app-home'
import { officeCommandHandler } from '../commands/office'
import { homeButtonHandler, officeButtonHandler } from '../interactions/buttons'
import { generateBlocks } from '../blocks/home'
import { logger } from '../utils/logger'
import {
  getWorkspaceSettings,
  loadSchedule,
  saveSchedule,
  saveWorkspaceSettings,
  type WorkspaceSettings,
} from '../services/storage'
import { createMonthSchedule, updateAttendance } from '../services/schedule'
import { createSettingsModal } from '../modals/settings'
import {
  geocodeAddress,
  getPlaceDetails,
  searchPlaces,
} from '../services/geocoding'
import { generateSettingsBlocks } from '../blocks/settings.ts'
import { updateUserSlackStatus } from '../services/status-update.ts'
import { checkIfAdmin } from '../utils/slack.ts'
import { handleReminderAction } from './reminder-buttons.ts'

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

  app.action('open_settings', async ({ ack, body, client, context }) => {
    await ack()
    try {
      const settings = getWorkspaceSettings(context.teamId!)
      logger.info({
        msg: 'Retrieved workspace settings',
        settings,
        categoriesCount: settings.categories?.length,
        teamId: context.teamId,
      })

      const view = createSettingsModal(settings)
      logger.info({
        msg: 'Generated modal view',
        blockCount: view.blocks.length,
        categoriesBlocksCount: settings.categories?.length * 2, // each category creates 2 blocks
      })

      await client.views.open({
        trigger_id: (body as any).trigger_id,
        view,
      })
    } catch (error) {
      logger.error({ msg: 'Error opening settings modal', error })
    }
  })

  app.action<BlockAction>(/^reminder_status_.*/, async (args) => {
    try {
      const schedule = await getWorkspaceSchedule(args.context.teamId, state)
      if (!schedule) return
      await handleReminderAction(args, schedule, state)
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling reminder action' })
    }
  })

  app.action<BlockAction>(
    /^toggle_category_.*/,
    async ({ ack, body, client, context, action }) => {
      if (!('selected_option' in action)) return
      await ack()
      try {
        const categoryId = action.action_id.replace('toggle_category_', '')
        const isEnabled = action.selected_option.value === 'enabled'

        // Get current settings
        const settings = await getWorkspaceSettings(context.teamId!)

        // Update the category
        const updatedCategories = settings.categories.map((cat) =>
          cat.id === categoryId ? { ...cat, isEnabled } : cat,
        )

        // Save the updated settings
        await saveWorkspaceSettings(context.teamId!, {
          ...settings,
          categories: updatedCategories,
        })

        // No need to update the modal view as radio buttons update automatically

        logger.info({
          msg: 'Category visibility updated',
          categoryId,
          isEnabled,
          teamId: context.teamId,
        })
      } catch (error) {
        logger.error({
          msg: 'Error updating category visibility',
          error,
          actionId: action.action_id,
        })
      }
    },
  )

  app.view('settings_submit', async ({ ack, view, context, body, client }) => {
    await ack()
    try {
      const values = view.state.values
      const officeName = values.office_name.office_name_input.value
      const selectedPlace =
        values.office_address.office_address_input.selected_option

      // Get current settings
      const currentSettings = await getWorkspaceSettings(context.teamId!)

      // If address was changed, get new place details
      let locationDetails = null
      if (selectedPlace && selectedPlace.value !== 'initial') {
        locationDetails = await getPlaceDetails(selectedPlace.value)
      }

      const settings: WorkspaceSettings = {
        // Use new office name if provided, otherwise keep current
        officeName: officeName || currentSettings.officeName,
        // If we have new place details, use those, otherwise keep current location info
        officeAddress: locationDetails
          ? selectedPlace.text.text
          : currentSettings.officeAddress,
        latitude: locationDetails
          ? locationDetails.latitude
          : currentSettings.latitude,
        longitude: locationDetails
          ? locationDetails.longitude
          : currentSettings.longitude,
        timezone: locationDetails
          ? locationDetails.timezone
          : currentSettings.timezone,
        // Add updated categories
        categories: currentSettings.categories,
      }

      await saveWorkspaceSettings(context.teamId!, settings)

      // Refresh home view
      const schedule = await getWorkspaceSchedule(context.teamId!, state)
      if (schedule) {
        await client.views.publish({
          user_id: body.user.id,
          view: {
            type: 'home',
            blocks: await generateBlocks(
              schedule,
              true,
              0,
              body.user.id,
              context.teamId!,
            ),
          },
        })
      }

      // Only show location update message if location was actually changed
      if (locationDetails) {
        await client.chat.postEphemeral({
          channel: body.user.id,
          user: body.user.id,
          text: `✅ Office location updated to: ${settings.officeName} (${settings.officeAddress})`,
        })
      }
    } catch (error) {
      logger.error('Error in settings submit:', error)
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: `❌ Error saving settings: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  })

  app.options('office_address_input', async ({ ack, body }) => {
    try {
      const results = await searchPlaces(body.value || '')
      await ack({
        options: results.map((place) => ({
          text: {
            type: 'plain_text',
            text: place.description,
          },
          value: place.place_id,
        })),
      })
    } catch (error) {
      logger.error({ msg: 'Error loading address suggestions', error })
      await ack({
        options: [],
      })
    }
  })

  app.command('/office', async ({ command, context, ...rest }) => {
    try {
      const schedule = await getWorkspaceSchedule(context.teamId, state)
      if (!schedule) return
      await officeCommandHandler(
        { command, context, ...rest },
        schedule,
        context.teamId!,
      )
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

        // Update the schedule with all required parameters
        const updatedSchedule = await updateAttendance(
          schedule,
          day,
          parseInt(week),
          body.user.id,
          status as AttendanceStatus,
          client, // Previously missing
          context.teamId!, // Previously missing
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
          view_id: body.view!.id,
          view: {
            type: 'home',
            blocks: await generateBlocks(
              updatedSchedule,
              true,
              parseInt(week),
              body.user.id,
              context.teamId!,
              false,
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
          blocks: await generateBlocks(
            schedule,
            true,
            week,
            body.user.id,
            context.teamId!,
          ),
        },
      })
    } catch (error) {
      logger.error({ err: error, msg: 'Error handling week selection' })
    }
  })
}
