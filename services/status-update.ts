import { App } from '@slack/bolt'
import { logger } from '../utils/logger'
import { getWorkspaceSettings } from './storage'
import { endOfDay, getUnixTime, isSameDay } from 'date-fns'
import { format } from 'date-fns/format'
import { installationStore } from './installation'
import type { WebClient } from '@slack/web-api'

export async function updateUserSlackStatus(
  client: WebClient,
  userId: string,
  status: string,
  teamId: string,
  selectedDate: Date,
) {
  // Only proceed if the date is today
  if (!isSameDay(selectedDate, new Date())) {
    return
  }

  try {
    const settings = getWorkspaceSettings(teamId)
    const category = settings.categories.find((c) => c.id === status)

    if (!category) {
      logger.warn(`No category found for status: ${status}`)
      return
    }

    const cleanUserId = userId.replace('<@', '').replace('>', '')
    const expirationTimestamp = getUnixTime(endOfDay(selectedDate))

    const installation = await installationStore.fetchInstallation({
      teamId: teamId,
      enterpriseId: undefined,
      isEnterpriseInstall: false,
    })

    if (!installation?.user?.token) {
      throw new Error('No user token found for installation')
    }

    await client.users.profile.set({
      token: installation.user.token,
      user: cleanUserId,
      profile: {
        status_emoji: category.emoji,
        status_text: `${category.displayName} today`,
        status_expiration: expirationTimestamp,
      },
    })

    logger.info({
      msg: 'Updated Slack status for user',
      userId: cleanUserId,
      status,
      emoji: category.emoji,
      expiresAt: new Date(expirationTimestamp * 1000).toISOString(),
    })
  } catch (error: any) {
    logger.error({
      msg: 'Failed to update Slack status',
      userId,
      status,
      teamId,
      errorCode: error.code,
      errorData: error.data,
    })

    // Handling specific errors
    if (error.data?.error === 'not_allowed_token_type') {
      logger.error({
        msg: 'Token type not allowed for this operation. Please check app installation and permissions.',
        teamId,
      })
    }
  }
}
