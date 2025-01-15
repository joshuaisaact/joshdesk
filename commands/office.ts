import type { AllMiddlewareArgs, SlackCommandMiddlewareArgs } from '@slack/bolt'
import { generateBlocks } from '../blocks/home'
import type { MonthSchedule } from '../types/schedule'

export const officeCommandHandler = async (
  { ack, say }: AllMiddlewareArgs & SlackCommandMiddlewareArgs,
  schedule: MonthSchedule,
) => {
  await ack()
  await say({
    blocks: await generateBlocks(schedule, false, 0, ''),
    text: "Here's who's in the office this week",
  })
}
