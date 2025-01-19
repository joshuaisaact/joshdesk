import type { AllMiddlewareArgs, SlackCommandMiddlewareArgs } from '@slack/bolt'
import { generateOfficeBlocks } from '../blocks/office'
import type { MonthSchedule } from '../types/schedule'

export const officeCommandHandler = async (
  { ack, say, context }: AllMiddlewareArgs & SlackCommandMiddlewareArgs,
  schedule: MonthSchedule,
  teamId: string,
) => {
  await ack()
  await say({
    blocks: await generateOfficeBlocks(schedule, 0, teamId),
    text: "Here's who's in the office this week",
  })
}
