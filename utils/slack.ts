import type { WebClient } from '@slack/web-api'
import { tryCatch } from './error-handlers'

export const checkIfAdmin = async (client: WebClient, userId: string, teamId: string) =>
  tryCatch(async () => {
    const userInfo = await client.users.info({
      user: userId,
      team_id: teamId
    })

    return Boolean(
      userInfo.user?.is_admin ||
      userInfo.user?.is_owner ||
      userInfo.user?.is_primary_owner
    )
  }, 'Failed to check admin status')