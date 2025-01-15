import type { MonthSchedule } from '../types/schedule'
import { Database } from 'bun:sqlite'
import { join } from 'path'
import { logger } from '../utils/logger'
import { DB_PATH } from '../constants'
import { tryCatch } from '../utils/error-handlers'
import { createMonthSchedule } from './schedule'

const db = new Database(DB_PATH)

type ScheduleRow = {
  schedule_data: string
  updated_at: string
  team_id: string
}

type QueryParams = [string]

db.run(`CREATE TABLE IF NOT EXISTS schedules (
  team_id TEXT PRIMARY KEY,
  schedule_data JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`)

export const loadSchedule = (teamId: string) =>
  tryCatch(async () => {
    const row = db
      .query<
        ScheduleRow,
        QueryParams
      >('SELECT schedule_data FROM schedules WHERE team_id = ?')
      .get(teamId)

    if (!row) {
      // Return a fresh schedule for new workspaces
      logger.info(`Creating new schedule for team ${teamId}`)
      const newSchedule = createMonthSchedule()
      await saveSchedule(teamId, newSchedule)
      return newSchedule
    }

    return JSON.parse(row.schedule_data)
  }, 'Error loading schedule from SQLite')

export const saveSchedule = (teamId: string, schedule: MonthSchedule) =>
  tryCatch(async () => {
    db.run(
      `INSERT OR REPLACE INTO schedules (team_id, schedule_data, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [teamId, JSON.stringify(schedule)],
    )
  }, 'Error saving schedule to SQLite')

// Add a cleanup function for uninstalls
export const deleteWorkspaceData = (teamId: string) =>
  tryCatch(async () => {
    db.run('DELETE FROM schedules WHERE team_id = ?', [teamId])
    logger.info(`Deleted schedule data for team ${teamId}`)
  }, 'Error deleting workspace data')
