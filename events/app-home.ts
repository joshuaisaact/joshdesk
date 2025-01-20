import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt'
import type { HomeView } from '../types/slack'
import { generateBlocks } from '../blocks/home'
import type { MonthSchedule } from '../types/schedule'
import { checkIfAdmin } from '../utils/slack.ts'
import { installationStore } from '../services/installation'

export const appHomeOpenedHandler = async (
  {
    event,
    client,
    context,
  }: AllMiddlewareArgs & SlackEventMiddlewareArgs<'app_home_opened'>,
  schedule: MonthSchedule,
  currentWeek: number = 0,
) => {
  try {
    const installation = await installationStore.fetchInstallation({
      teamId: context.teamId!,
      isEnterpriseInstall: false,
      enterpriseId: undefined,
    })

    const token = installation.bot?.token
    if (!token) {
      throw new Error('No bot token found')
    }

    const isAdmin = await checkIfAdmin(client, event.user, context.teamId!)

    await client.views.publish({
      token,
      user_id: event.user,
      view: {
        type: 'home',
        blocks: await generateBlocks(
          schedule,
          true,
          currentWeek,
          event.user,
          context.teamId!,
          isAdmin,
        ),
      } as HomeView,
    })
  } catch (error) {
    console.error(error)
  }
}
