import type { MonthSchedule } from '../types/schedule'
import { Database } from 'bun:sqlite'
import { logger } from '../utils/logger'
import { DB_PATH } from '../constants'
import { tryCatch } from '../utils/error-handlers'
import { createMonthSchedule } from './schedule'
import type { Statement } from 'bun:sqlite'

class CategoryError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message)
    this.name = 'CategoryError'
  }
}

const db = new Database(DB_PATH)

type ScheduleRow = {
  schedule_data: string
  updated_at: string
  team_id: string
}

export interface WorkspaceSettings {
  officeName: string
  officeAddress: string
  latitude: number
  longitude: number
  timezone: string
  categories: Category[]
}

export interface Category {
  id: string
  displayName: string
  emoji: string
  sortOrder: number
  isEnabled: boolean
}

const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'office',
    displayName: 'Office',
    emoji: '🏢',
    sortOrder: 0,
    isEnabled: true,
  },
  {
    id: 'remote',
    displayName: 'Home',
    emoji: '🏠',
    sortOrder: 1,
    isEnabled: true,
  },
  {
    id: 'traveling',
    displayName: 'Traveling',
    emoji: '✈️',
    sortOrder: 2,
    isEnabled: false,
  },
  {
    id: 'holiday',
    displayName: 'Holiday',
    emoji: '🌴',
    sortOrder: 3,
    isEnabled: false,
  },
]

const DEFAULT_SETTINGS: WorkspaceSettings = {
  officeName: 'London Office',
  officeAddress: 'Liverpool Street',
  latitude: 51.5174,
  longitude: -0.0795,
  timezone: 'Europe/London',
  categories: DEFAULT_CATEGORIES,
}

type QueryParams = [string]

db.run(`CREATE TABLE IF NOT EXISTS schedules (
  team_id TEXT PRIMARY KEY,
  schedule_data JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`)

db.run(`CREATE TABLE IF NOT EXISTS workspace_settings (
  team_id TEXT PRIMARY KEY,
  office_name TEXT NOT NULL,
  office_address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timezone TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`)

db.run(`CREATE TABLE IF NOT EXISTS workspace_categories (
  team_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (team_id, category_id),
  FOREIGN KEY (team_id) REFERENCES workspace_settings(team_id) ON DELETE CASCADE
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
      const now = new Date()
      const isFridayAfternoon = now.getDay() === 5 && now.getHours() >= 16
      const shouldStartFromNext = isFridayAfternoon || now.getDay() >= 5 // Friday afternoon or weekend

      logger.info(
        `Creating new schedule for team ${teamId}, starting from next week: ${shouldStartFromNext}`,
      )
      const newSchedule = createMonthSchedule(shouldStartFromNext)
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
  }, 'Error deleting  data')

export const getWorkspaceCategories = (teamId: string): Category[] => {
  try {
    if (!teamId) {
      throw new CategoryError('Team ID is required')
    }

    const rows = db
      .query(
        'SELECT * FROM workspace_categories WHERE team_id = ? ORDER BY sort_order',
      )
      .all([teamId]) as Array<{
      category_id: string
      display_name: string
      emoji: string
      sort_order: number
      is_enabled: number
    }>

    if (!rows || rows.length === 0) {
      logger.info({
        msg: `No categories found for team ${teamId}, using defaults`,
        teamId,
        defaults: DEFAULT_CATEGORIES,
      })

      // Initialize defaults if none exist
      tryCatch(async () => {
        await saveWorkspaceCategories(teamId, DEFAULT_CATEGORIES)
      }, 'Failed to save default categories')

      return DEFAULT_CATEGORIES
    }

    return rows.map((row) => ({
      id: row.category_id,
      displayName: row.display_name,
      emoji: row.emoji,
      sortOrder: row.sort_order,
      isEnabled: Boolean(row.is_enabled),
    }))
  } catch (error) {
    logger.error({
      msg: 'Failed to get workspace categories',
      error: error instanceof Error ? error.message : String(error),
      stackTrace: error instanceof Error ? error.stack : undefined,
      teamId,
    })
    return DEFAULT_CATEGORIES
  }
}

export const saveWorkspaceCategories = async (
  teamId: string,
  categories: Category[],
): Promise<void> => {
  let deleteStmt: Statement | null = null
  let insertStmt: Statement | null = null

  try {
    if (!teamId) {
      throw new CategoryError('Team ID is required')
    }

    if (!Array.isArray(categories)) {
      throw new CategoryError('Categories must be an array')
    }

    // Validate categories before starting transaction
    categories.forEach((cat, index) => {
      if (!cat.id || !cat.displayName || !cat.emoji) {
        throw new CategoryError(`Invalid category at index ${index}`)
      }
    })

    db.transaction(() => {
      try {
        // Prepare statements
        deleteStmt = db.prepare(
          'DELETE FROM workspace_categories WHERE team_id = ?',
        )
        insertStmt = db.prepare(`
          INSERT INTO workspace_categories
          (team_id, category_id, display_name, emoji, sort_order, is_enabled)
          VALUES (?, ?, ?, ?, ?, ?)
        `)

        // Delete existing categories
        deleteStmt.run([teamId])

        // Insert new categories
        categories.forEach((cat) => {
          if (!insertStmt) return // TypeScript guard

          insertStmt.run([
            teamId,
            cat.id,
            cat.displayName,
            cat.emoji,
            cat.sortOrder,
            Number(cat.isEnabled), // Explicitly convert boolean to number
          ])
        })

        logger.info({
          msg: 'Successfully saved workspace categories',
          teamId,
          categoryCount: categories.length,
        })
      } catch (error) {
        logger.error({
          msg: 'Error in category transaction',
          error,
          teamId,
        })
        throw error // Re-throw to trigger rollback
      }
    })()
  } catch (error) {
    logger.error({
      msg: 'Failed to save workspace categories',
      error,
      teamId,
      categoriesCount: categories?.length,
    })
    throw new CategoryError('Failed to save categories', error)
  }
}

export const getWorkspaceSettings = (teamId: string): WorkspaceSettings => {
  if (!teamId) {
    logger.warn('getWorkspaceSettings called with no teamId, using defaults')
    return DEFAULT_SETTINGS
  }

  try {
    const row = db
      .query('SELECT * FROM workspace_settings WHERE team_id = ?')
      .get(teamId) as any

    const categories = getWorkspaceCategories(teamId)

    if (!row) {
      logger.info('No settings found for team, using defaults', { teamId })
      return {
        ...DEFAULT_SETTINGS,
        categories,
      }
    }

    return {
      officeName: row.office_name,
      officeAddress: row.office_address,
      latitude: row.latitude,
      longitude: row.longitude,
      timezone: row.timezone,
      categories,
    }
  } catch (error) {
    logger.error({
      msg: 'Error fetching workspace settings, using defaults',
      error,
      teamId,
    })
    return {
      ...DEFAULT_SETTINGS,
      categories: DEFAULT_SETTINGS.categories,
    }
  }
}

export const saveWorkspaceSettings = async (
  teamId: string,
  settings: WorkspaceSettings,
): Promise<void> => {
  try {
    if (!teamId) {
      throw new Error('Team ID is required')
    }

    // Validate required fields
    if (!settings.officeName || !settings.officeAddress) {
      throw new Error('Office name and address are required')
    }

    db.transaction(() => {
      try {
        // Save main settings
        db.run(
          `INSERT OR REPLACE INTO workspace_settings
           (team_id, office_name, office_address, latitude, longitude, timezone, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            teamId,
            settings.officeName,
            settings.officeAddress,
            settings.latitude,
            settings.longitude,
            settings.timezone,
          ],
        )

        // Save categories if present
        if (!settings.categories) {
          initializeWorkspaceCategories(teamId)
        } else {
          saveWorkspaceCategories(teamId, settings.categories)
        }

        logger.info({
          msg: 'Successfully saved workspace settings',
          teamId,
        })
      } catch (error) {
        logger.error({
          msg: 'Error in settings transaction',
          error,
          teamId,
        })
        throw error
      }
    })()
  } catch (error) {
    logger.error({
      msg: 'Failed to save workspace settings',
      error,
      teamId,
    })
    throw new Error('Failed to save workspace settings')
  }
}

export const getAllWorkspaceIds = () =>
  tryCatch(async () => {
    const rows = db
      .query('SELECT team_id FROM schedules WHERE team_id IS NOT NULL')
      .all() as Array<{ team_id: string }>
    return rows.map((row) => row.team_id)
  }, 'Error getting workspace IDs')

export const cleanupInvalidData = () =>
  tryCatch(async () => {
    const deleted = db.run('DELETE FROM schedules WHERE team_id IS NULL')
    if (deleted.changes > 0) {
      logger.info(`Cleaned up ${deleted.changes} invalid schedule entries`)
    }
  }, 'Error cleaning up invalid data')

export const initializeWorkspaceCategories = (teamId: string) =>
  tryCatch(async () => {
    if (!teamId) {
      throw new CategoryError('Team ID is required')
    }

    const existing = db
      .query(
        'SELECT COUNT(*) as count FROM workspace_categories WHERE team_id = ?',
      )
      .get(teamId) as { count: number }

    if (existing.count === 0) {
      logger.info(`Initializing default categories for team ${teamId}`)
      await saveWorkspaceCategories(teamId, DEFAULT_CATEGORIES)
    }
  }, 'Error initializing workspace categories')
