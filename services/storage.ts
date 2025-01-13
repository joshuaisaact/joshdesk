import type { MonthSchedule } from '../types/schedule'
import { Database } from 'bun:sqlite'
import { join } from 'path'
import { logger } from '../utils/logger'
import { DB_PATH } from '../constants'
import { tryCatch } from '../utils/error-handlers'

const db = new Database(DB_PATH)

type ScheduleRow = {
  schedule_data: string
  updated_at: string
}

type QueryParams = [string]

db.run(`CREATE TABLE IF NOT EXISTS schedules (
  team_id TEXT PRIMARY KEY,
  schedule_data JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`)

const DEFAULT_TEAM_ID = 'default'

export const loadSchedule = () =>
  tryCatch(async () => {
    const row = db
      .query<
        ScheduleRow,
        QueryParams
      >('SELECT schedule_data FROM schedules WHERE team_id = ?')
      .get(DEFAULT_TEAM_ID)

    if (!row) return null
    return JSON.parse(row.schedule_data)
  }, 'Error loading schedule from SQLite')

export const saveSchedule = (schedule: MonthSchedule) =>
  tryCatch(async () => {
    db.run(
      `INSERT OR REPLACE INTO schedules (team_id, schedule_data, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [DEFAULT_TEAM_ID, JSON.stringify(schedule)],
    )
  }, 'Error saving schedule to SQLite')
