import type { App, BlockAction, ViewSubmitAction } from '@slack/bolt'
import { tryCatch } from '../utils/error-handlers'
import { logger } from '../utils/logger'
import {
  getWorkspaceSettings,
  saveWorkspaceSettings,
  type WorkspaceSettings,
} from '../services/storage'
import { createSettingsModal } from '../modals/settings'
import { getPlaceDetails, searchPlaces } from '../services/geocoding'
import { getWorkspaceSchedule } from '../utils/workspace'
import { generateBlocks } from '../blocks/home'
import type { MonthSchedule } from '../types/schedule'

export const setupSettingsHandlers = (
  app: App,
  state: Map<string, MonthSchedule>,
) => {
  app.action('open_settings', async ({ ack, body, client, context }) => {
    await ack()
    const settings = await tryCatch(
      async () => getWorkspaceSettings(context.teamId!),
      'Error getting workspace settings',
    )
    if (!settings) return

    await tryCatch(async () => {
      const view = createSettingsModal(settings)
      await client.views.open({
        trigger_id: (body as any).trigger_id,
        view,
      })
    }, 'Error opening settings modal')
  })

  app.view('settings_submit', async ({ ack, view, context, body, client }) => {
    await ack()
    try {
      const values = view.state.values
      const officeName = values.office_name.office_name_input.value
      const addressInput =
        values.office_address.office_address_input.selected_option

      // Get current settings
      const currentSettings = await getWorkspaceSettings(context.teamId!)

      // Early return if required fields are missing
      if (!officeName || !addressInput) {
        throw new Error('Required fields are missing')
      }

      // If address was changed, get new place details
      let locationDetails = null
      if (addressInput.value !== 'initial') {
        locationDetails = await getPlaceDetails(addressInput.value)
      }

      const settings: WorkspaceSettings = {
        officeName,
        officeAddress: locationDetails
          ? addressInput.text.text
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

  app.action<BlockAction>(
    /^toggle_category_.*/,
    async ({ ack, body, client, context, action }) => {
      if (!('selected_option' in action)) return

      await ack()

      if (!('selected_option' in action) || !action.selected_option) {
        logger.warn('No option selected for category toggle')
        return
      }

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

  app.options('office_address_input', async ({ ack, body }) => {
    const results = await tryCatch(
      async () => searchPlaces(body.value || ''),
      'Error searching places',
    )
    await ack({
      options:
        results?.map((place) => ({
          text: { type: 'plain_text', text: place.description },
          value: place.place_id,
        })) || [],
    })
  })
}
