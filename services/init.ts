import { tryCatch } from '../utils/error-handlers'
import { loadSchedule, saveSchedule } from './storage'
import { logger } from '../utils/logger'
import { JSON_STORAGE_PATH } from '../constants'

export const initializeDB = () =>
  tryCatch(async () => {
    // Handle JSON to SQLite migration
    const jsonFile = Bun.file(JSON_STORAGE_PATH)
    const jsonExists = await jsonFile.exists()

    if (jsonExists) {
      logger.info('Found JSON file, starting migration to SQLite')
      const jsonData = await jsonFile.json()
      await saveSchedule(jsonData)
      await Bun.write(
        JSON_STORAGE_PATH + '.backup',
        JSON.stringify(jsonData, null, 2),
      )
      await Bun.write(JSON_STORAGE_PATH, '')
      logger.info('Successfully migrated data to SQLite')
    }

    // Load schedule from SQLite
    const stored = await loadSchedule()
    return stored
  }, 'Error initializing database')
