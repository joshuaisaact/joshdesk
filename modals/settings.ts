import type { ModalView } from '@slack/types'
import type { WorkspaceSettings } from '../services/storage'

export const createSettingsModal = (settings: WorkspaceSettings): ModalView => ({
  type: 'modal',
  callback_id: 'settings_submit',
  title: {
    type: 'plain_text',
    text: 'Office Settings',
    emoji: true,
  },
  submit: {
    type: 'plain_text',
    text: 'Save',
    emoji: true,
  },
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Office Location*',
      },
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
        min_query_length: 3,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Status Categories*',
      },
    },
    ...settings.categories.map((category, index) => ([
      {
        type: 'section',
        block_id: `category_${index}`,
        text: {
          type: 'mrkdwn',
          text: `${category.emoji} ${category.displayName}`,
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: category.isEnabled ? 'Disable' : 'Enable',
            emoji: true,
          },
          value: `toggle_category_${category.id}`,
          action_id: `toggle_category_${index}`,
          style: category.isEnabled ? 'danger' : 'primary',
        },
      },
      {
        type: 'actions',
        block_id: `category_actions_${index}`,
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⬆️',
              emoji: true,
            },
            value: `move_up_${category.id}`,
            action_id: `move_category_up_${index}`,
            style: 'primary',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⬇️',
              emoji: true,
            },
            value: `move_down_${category.id}`,
            action_id: `move_category_down_${index}`,
            style: 'primary',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Edit',
              emoji: true,
            },
            value: `edit_${category.id}`,
            action_id: `edit_category_${index}`,
          },
        ],
      }
    ])).flat(),
    {
      type: 'actions',
      block_id: 'add_category',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '➕ Add Category',
            emoji: true,
          },
          action_id: 'add_new_category',
          style: 'primary',
        },
      ],
    },
  ],
})