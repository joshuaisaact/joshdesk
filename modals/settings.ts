import type { ModalView } from '@slack/types'
import type { WorkspaceSettings } from '../services/storage'

export const createSettingsModal = (settings: WorkspaceSettings): ModalView => ({
  type: 'modal',
  callback_id: 'settings_submit',
  title: {
    type: 'plain_text',
    text: 'Workspace Settings',
    emoji: true,
  },
  submit: {
    type: 'plain_text',
    text: 'Save Changes',
    emoji: true,
  },
  blocks: [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Office Location',
        emoji: true
      }
    },
    {
      type: 'input',
      block_id: 'office_name',
      label: {
        type: 'plain_text',
        text: 'Office Name',
        emoji: true,
      },
      element: {
        type: 'plain_text_input',
        action_id: 'office_name_input',
        initial_value: settings.officeName,
      },
    },
    {
      type: 'input',
      block_id: 'office_address',
      label: {
        type: 'plain_text',
        text: 'Office Address',
        emoji: true,
      },
      element: {
        type: 'external_select',
        action_id: 'office_address_input',
        placeholder: {
          type: 'plain_text',
          text: 'Start typing an address...',
          emoji: true,
        },
        initial_option: {
          text: {
            type: 'plain_text',
            text: settings.officeAddress
          },
          value: 'initial',
        },
        min_query_length: 3,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Status Categories',
        emoji: true
      }
    },
    ...settings.categories.map((category) => ({
      type: 'section',
      block_id: `category_${category.id}`,
      text: {
        type: 'mrkdwn',
        text: `${category.emoji} *${category.displayName}*`,
      },
      accessory: {
        type: 'radio_buttons',
        action_id: `toggle_category_${category.id}`,
        initial_option: {
          text: {
            type: 'plain_text',
            text: category.isEnabled ? 'Enabled' : 'Hidden',
            emoji: true
          },
          value: category.isEnabled ? 'enabled' : 'disabled'
        },
        options: [
          {
            text: {
              type: 'plain_text',
              text: 'Enabled',
              emoji: true
            },
            value: 'enabled'
          },
          {
            text: {
              type: 'plain_text',
              text: 'Hidden',
              emoji: true
            },
            value: 'disabled'
          }
        ]
      }
    }))
  ],
})