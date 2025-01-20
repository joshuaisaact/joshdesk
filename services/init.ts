import { tryCatch } from '../utils/error-handlers'
import { loadSchedule, saveSchedule } from './storage'
import { logger } from '../utils/logger'
import { JSON_STORAGE_PATH } from '../constants'

export const initializeDB = () =>
  tryCatch(async () => {
    const DEFAULT_TEAM_ID = 'T9TK3CUKW' // Or whatever your original workspace ID is

    const jsonFile = Bun.file(JSON_STORAGE_PATH)
    const jsonExists = await jsonFile.exists()

    if (jsonExists) {
      logger.info('Found JSON file, starting migration to SQLite')
      const jsonData = await jsonFile.json()
      await saveSchedule(DEFAULT_TEAM_ID, jsonData)
      await Bun.write(
        `${JSON_STORAGE_PATH}.backup.${Date.now()}`,
        JSON.stringify(jsonData, null, 2),
      )
      await Bun.write(JSON_STORAGE_PATH, '')
      logger.info('Successfully migrated data to SQLite')
    }

    const stored = await loadSchedule(DEFAULT_TEAM_ID)
    return stored
  }, 'Error initializing database')

