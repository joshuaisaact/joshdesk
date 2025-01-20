import type { Block, KnownBlock } from '@slack/types'
import type { WorkspaceSettings } from '../services/storage'

export const generateSettingsBlocks = async (
  settings: WorkspaceSettings,
  isAdmin: boolean
): Promise<(KnownBlock | Block)[]> => {
  if (!isAdmin) {
    return [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🔒 You need to be a workspace admin to view settings.'
      }
    }]
  }

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '⚙️ Workspace Settings',
        emoji: true
      }
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Office Location*'
      }
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Name:*\n${settings.officeName}`
        },
        {
          type: 'mrkdwn',
          text: `*Address:*\n${settings.officeAddress}`
        }
      ]
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Edit Location',
            emoji: true
          },
          action_id: 'edit_office_location'
        }
      ]
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Status Categories*'
      }
    },
    ...settings.categories.map((category, index) => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${category.emoji} *${category.displayName}*`
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: category.isEnabled ? 'Disable' : 'Enable',
          emoji: true
        },
        style: category.isEnabled ? 'danger' : 'primary',
        action_id: `toggle_category_${category.id}`,
        value: category.id
      }
    }))
  ]
}