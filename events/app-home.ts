import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt'
import type { HomeView } from '../types/slack'
import { generateBlocks } from '../blocks/home'
import type { MonthSchedule } from '../types/schedule'

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
    await client.views.publish({
      user_id: event.user,
      view: {
        type: 'home',
        blocks: await generateBlocks(
          schedule,
          true,
          currentWeek,
          event.user,
          context.teamId!,
        ),
      } as HomeView,
    })
  } catch (error) {
    console.error(error)
  }
}

