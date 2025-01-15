import { join } from 'path'

export const AttendanceStatus = {
  OFFICE: 'office',
  REMOTE: 'remote',
  TRAVELING: 'traveling',
  CLIENT: 'client',
} as const

export type AttendanceStatus =
  (typeof AttendanceStatus)[keyof typeof AttendanceStatus]

export const WEEK_LABELS = ['Current Week', 'Next Week', 'Week 3', 'Week 4']

export const DB_PATH = join(import.meta.dir, '..', 'data', 'joshdesk.db')

export const JSON_STORAGE_PATH = join(
  import.meta.dir,
  '..',
  'data',
  'schedule.json',
)

export const STATUS_OPTIONS = [
  {
    text: { type: 'plain_text' as const, text: '🏢 Office', emoji: true },
    value: 'office',
  },
  {
    text: { type: 'plain_text' as const, text: '🏠 Home', emoji: true },
    value: 'remote',
  },
  {
    text: {
      type: 'plain_text' as const,
      text: '✈️ Traveling',
      emoji: true,
    },
    value: 'traveling',
  },
  {
    text: { type: 'plain_text' as const, text: '🌴 Vacation', emoji: true },
    value: 'client',
  },
]
