import type { App, BlockAction } from '@slack/bolt'
import { tryCatch } from '../utils/error-handlers'
import { logger } from '../utils/logger'
import { updateAttendance } from '../services/schedule'
import { getWorkspaceSchedule } from '../utils/workspace'
import { saveSchedule } from '../services/storage'
import { generateBlocks } from '../blocks/home'
import type { MonthSchedule } from '../types/schedule'
import type { AttendanceStatus } from '../constants'

export const setupScheduleHandlers = (
  app: App,
  state: Map<string, MonthSchedule>,
) => {
  app.action<BlockAction>(
    /^set_status_(.+)_(\d+)$/,
    async ({ action, ack, client, body, context }) => {
      await ack()

      const schedule = await tryCatch(
        async () => getWorkspaceSchedule(context.teamId, state),
        'Error getting workspace schedule',
      )
      if (!schedule) return

      if (!('selected_option' in action) || !action.selected_option?.value) {
        logger.warn('No status selected')
        return
      }

      const [_, status, day, week] = action.selected_option.value.split(':')

      const updatedSchedule = await tryCatch(
        async () =>
          updateAttendance(
            schedule,
            day,
            parseInt(week),
            body.user.id,
            status as AttendanceStatus,
            client,
            context.teamId!,
          ),
        'Error updating attendance',
      )
      if (!updatedSchedule) return

      if (context.teamId) {
        await tryCatch(async () => {
          state.set(context.teamId!, updatedSchedule)
          return saveSchedule(context.teamId!, updatedSchedule)
        }, 'Error saving updated schedule')
      }

      if (!body.view?.id) {
        logger.warn('View ID is missing')
        return
      }

      await tryCatch(
        async () =>
          client.views.update({
            view_id: body.view!.id,
            view: {
              type: 'home',
              blocks: await generateBlocks(
                updatedSchedule,
                true,
                parseInt(week),
                body.user.id,
                context.teamId!,
              ),
            },
          }),
        'Error updating view',
      )
    },
  )
}
