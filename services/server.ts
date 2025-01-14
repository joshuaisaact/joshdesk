import { serve } from 'bun'
import { App } from '@slack/bolt'

export const startServer = async (slackApp: App) => {
  // Start Slack app
  await slackApp.start(process.env.PORT || 3000)

  // Start landing page server
  serve({
    port: process.env.WEB_PORT || 3001,
    fetch(req) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head><title>JoshDesk</title></head>
          <body>
            <h1>JoshDesk</h1>
            <p>A Slack app for managing office attendance</p>
            <a href="[your_slack_install_url]">Install on Slack</a>
          </body>
        </html>
      `,
        {
          headers: { 'Content-Type': 'text/html' },
        },
      )
    },
  })
}
