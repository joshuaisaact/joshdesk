import type { WebClient } from '@slack/web-api'
import { tryCatch } from './error-handlers'
import { installationStore } from '../services/installation.ts'

export const checkIfAdmin = async (
  client: WebClient,
  userId: string,
  teamId: string,
) =>
  (await tryCatch(async () => {
    // Get installation for this team
    const installation = await installationStore.fetchInstallation({
      teamId,
      isEnterpriseInstall: false,
      enterpriseId: undefined,
    })

    const token = installation.bot?.token
    if (!token) {
      throw new Error('No bot token found')
    }

    const userInfo = await client.users.info({
      token, // Use the bot token here
      user: userId,
    })

    return Boolean(
      userInfo.user?.is_admin ||
        userInfo.user?.is_owner ||
        userInfo.user?.is_primary_owner,
    )
  }, 'Failed to check admin status')) ?? false
