import { Database } from 'bun:sqlite'
import { saveSchedule } from './services/storage'

const TEAM_ID = 'T02NH8X9Y73'

const importData = async (jsonPath: string, isDryRun: boolean = true) => {
  try {
    // Read backup file
    console.log('Reading backup file...')
    const backup = await Bun.file(jsonPath).json()

    // Get and parse the schedule data
    const scheduleData = JSON.parse(backup.schedules[0].schedule_data)

    console.log('Preview of data to be imported:')
    console.log('Number of weeks:', Object.keys(scheduleData).length)
    Object.keys(scheduleData).forEach((week) => {
      console.log(
        `Week ${week} has ${Object.keys(scheduleData[week]).length} days with data`,
      )
    })

    if (isDryRun) {
      console.log('DRY RUN - No data was imported')
      console.log('Run with isDryRun = false to perform actual import')
      return
    }

    // Save with the correct team ID
    await saveSchedule(TEAM_ID, scheduleData)

    console.log('Import completed successfully')
  } catch (error) {
    console.error('Error during import:', error)
  }
}

// First do a dry run
await importData('./backup1737314209129.json', false)
