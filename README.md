## README.md

# Joshicely

A Slack app for tracking office attendance.

## Features

- 4-week schedule visibility
- Easy office/WFH status updates
- Automatic weekly schedule reset every Friday at 12:00 PM
- Data persistence between app restarts

## Environment Variables

```env
# Required
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-token

# Optional
SCHEDULE_TEST_MODE=true  # Set to true to test schedule reset every 30 seconds
```

## Development

1. Clone the repository
2. Copy .env.example to .env and fill in your Slack credentials
3. Install dependencies: bun install
4. Start the app: bun app.ts

## Testing schedule reset

The app automatically resets the schedule every Friday at 12:00 PM, shifting all future weeks forward and creating a new empty week. To test this functionality:

1. Set SCHEDULE_TEST_MODE=true in your .env file
2. Run the app: bun app.ts
3. The schedule will reset every 30 seconds, allowing you to see the effect of the reset on the UI.

Remember to set SCHEDULE_TEST_MODE=false or remove it from your .env file before deploying to production.
