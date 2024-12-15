import { App, type BlockAction } from '@slack/bolt'
import { createMonthSchedule } from './services/schedule'
import { loadSchedule, saveSchedule } from './services/storage'
import { appHomeOpenedHandler } from './events/app-home'
import { officeCommandHandler } from './commands/office'
import { homeButtonHandler, officeButtonHandler } from './interactions/buttons'
import { generateBlocks } from './blocks/home'
import type { HomeView } from './types/slack'

let officeSchedule = createMonthSchedule()
let currentWeek = 0

const initializeSchedule = async () => {
  const stored = await loadSchedule()
  if (stored) {
    officeSchedule = stored
  }
}

// App initialization
const app = new App({
  token: Bun.env.SLACK_BOT_TOKEN,
  signingSecret: Bun.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: Bun.env.SLACK_APP_TOKEN,
})

// Commands
app.command('/office', async (args) => {
  await officeCommandHandler(args, officeSchedule)
})

// Interactive components (buttons, etc)
app.action<BlockAction>(/office_.*/, async (args) => {
  const updatedSchedule = await officeButtonHandler(args, officeSchedule)
  if (updatedSchedule) {
    officeSchedule = updatedSchedule
    await saveSchedule(officeSchedule)
  }
})

app.action<BlockAction>(/home_.*/, async (args) => {
  const updatedSchedule = await homeButtonHandler(args, officeSchedule)
  if (updatedSchedule) {
    officeSchedule = updatedSchedule
    await saveSchedule(officeSchedule)
  }
})

app.action('prev_week', async ({ ack, body, client }) => {
  await ack()
  if (currentWeek > 0) currentWeek--
  await client.views.publish({
    user_id: body.user.id,
    view: {
      type: 'home',
      blocks: generateBlocks(officeSchedule, true, currentWeek),
    } as HomeView,
  })
})

app.action('next_week', async ({ ack, body, client }) => {
  await ack()
  if (currentWeek < 3) currentWeek++
  await client.views.publish({
    user_id: body.user.id,
    view: {
      type: 'home',
      blocks: generateBlocks(officeSchedule, true, currentWeek),
    } as HomeView,
  })
})

// Events
app.event('app_home_opened', async (args) => {
  await appHomeOpenedHandler(args, officeSchedule, currentWeek)
})

const start = async () => {
  await initializeSchedule() // Make sure this runs first
  await app.start(process.env.PORT || 3000)
  console.log('⚡️ Joshicely app is running!')
}

start()
