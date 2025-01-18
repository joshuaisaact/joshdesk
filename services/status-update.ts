import { App } from '@slack/bolt';
import { logger } from '../utils/logger';
import { Category, getWorkspaceSettings } from './storage';
import { endOfDay, getUnixTime } from 'date-fns';

export async function updateUserSlackStatus(
  app: App,
  userId: string,
  status: string,
  teamId: string
) {
  try {
    const settings = getWorkspaceSettings(teamId);
    const category = settings.categories.find(c => c.id === status);

    if (!category) {
      logger.warn(`No category found for status: ${status}`);
      return;
    }

    const cleanUserId = userId.replace('<@', '').replace('>', '');
    const expirationTimestamp = getUnixTime(endOfDay(new Date())); // Simply expire end of today

    await app.client.users.profile.set({
      token: process.env.SLACK_BOT_TOKEN,
      user: cleanUserId,
      profile: JSON.stringify({
        status_emoji: category.emoji,
        status_text: `${category.displayName} today`,
        status_expiration: expirationTimestamp
      })
    });

    logger.info({
      msg: 'Updated Slack status for user',
      userId: cleanUserId,
      status,
      emoji: category.emoji,
      expiresAt: new Date(expirationTimestamp * 1000).toISOString()
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to update Slack status',
      error,
      userId,
      status
    });
  }
}