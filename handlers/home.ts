import type { App } from '@slack/bolt'
import type { MonthSchedule } from '../types/schedule'
import { tryCatch } from '../utils/error-handlers'
import { appHomeOpenedHandler } from '../events/app-home.ts'
import { generateBlocks } from '../blocks/home.ts'
import { getWorkspaceSchedule } from '../utils/workspace.ts'
import { checkIfAdmin } from '../utils/slack.ts'

export const setupHomeHandlers = (
  app: App,
  state: Map<string, MonthSchedule>,
) => {
  app.event('app_home_opened', async ({ event, context, ...rest }) => {
    const schedule = await tryCatch(
      async () => getWorkspaceSchedule(context.teamId, state),
      'Error getting workspace schedule',
    )
    if (!schedule) return

    await tryCatch(
      async () =>
        appHomeOpenedHandler({ event, context, ...rest }, schedule, 0),
      'Error handling app_home_opened',
    )
  })

  app.action('select_week', async ({ ack, body, client, context }) => {
    await ack()
    const schedule = await tryCatch(
      async () => getWorkspaceSchedule(context.teamId, state),
      'Error getting workspace schedule',
    )
    if (!schedule) return

    const action = (body as any).actions[0]
    const week = parseInt(action.selected_option.value)

    await tryCatch(
      async () =>
        client.views.publish({
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
        }),
      'Error publishing updated view',
    )
  })
}
