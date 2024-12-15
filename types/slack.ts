import type { BlockAction, StaticSelectAction } from '@slack/bolt'
import type { Block, KnownBlock } from '@slack/types'

export interface HomeView {
  type: 'home'
  blocks: Array<KnownBlock | Block>
  private_metadata?: string
  callback_id?: string
  external_id?: string
  title?: {
    type: 'plain_text'
    text: string
    emoji?: boolean
  }
  close?: {
    type: 'plain_text'
    text: string
    emoji?: boolean
  }
  submit?: {
    type: 'plain_text'
    text: string
    emoji?: boolean
  }
}
export interface SelectWeekAction extends BlockAction<StaticSelectAction> {
  actions: [
    StaticSelectAction & {
      selected_option: {
        text: {
          type: 'plain_text'
          text: string
          emoji: boolean
        }
        value: string
      }
    },
  ]
}
