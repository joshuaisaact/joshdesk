import { join } from 'path'

export enum AttendanceStatus {
  Office = 'office',
  Home = 'home',
}
export const WEEK_LABELS = ['Current Week', 'Next Week', 'Week 3', 'Week 4']

export const DB_PATH = join(import.meta.dir, '..', 'data', 'joshdesk.db')

export const JSON_STORAGE_PATH = join(
  import.meta.dir,
  '..',
  'data',
  'schedule.json',
)
