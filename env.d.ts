declare module 'bun' {
  interface Env {
    SLACK_BOT_TOKEN: string
    SLACK_SIGNING_SECRET: string
    SLACK_APP_TOKEN: string
  }
}
