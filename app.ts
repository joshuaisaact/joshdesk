import { App, type BlockAction } from '@slack/bolt'
import { createMonthSchedule } from './services/schedule'
import { loadSchedule, saveSchedule } from './services/storage'
import { appHomeOpenedHandler } from './events/app-home'
import { officeCommandHandler } from './commands/office'
import { homeButtonHandler, officeButtonHandler } from './interactions/buttons'
import { generateBlocks } from './blocks/home'
import type { HomeView, SelectWeekAction } from './types/slack'
import { setupWeeklyReset } from './utils/schedule-reset'

// State
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

// Event handlers
app.event('app_home_opened', async (args) => {
  await appHomeOpenedHandler(args, officeSchedule, currentWeek)
})

// Command handlers
app.command('/office', async (args) => {
  await officeCommandHandler(args, officeSchedule)
})

// Interactive component handlers
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

app.action<SelectWeekAction>('select_week', async ({ ack, body, client }) => {
  await ack()
  const selectedWeek = parseInt(body.actions[0].selected_option.value)
  currentWeek = selectedWeek

  await client.views.publish({
    user_id: body.user.id,
    view: {
      type: 'home',
      blocks: generateBlocks(officeSchedule, true, selectedWeek),
    } as HomeView,
  })
})

// Startup
const start = async () => {
  await initializeSchedule()

  setupWeeklyReset((newSchedule) => {
    officeSchedule = newSchedule
    currentWeek = 0
  }, Bun.env.SCHEDULE_TEST_MODE === 'true')

  await app.start(process.env.PORT || 3000)
  console.log('⚡️ Joshicely app is running!')
}

start()
