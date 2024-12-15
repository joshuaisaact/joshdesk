import type { WeekSchedule } from '../types/schedule'

const STORAGE_PATH = import.meta.dir + '/data/schedule.json'

export const loadSchedule = async (): Promise<WeekSchedule | null> => {
  try {
    const file = Bun.file(STORAGE_PATH)
    const exists = await file.exists()
    if (!exists) return null
    return await file.json()
  } catch (error) {
    console.error('Error loading schedule:', error)
    return null
  }
}

export const saveSchedule = async (schedule: WeekSchedule): Promise<void> => {
  try {
    await Bun.write(STORAGE_PATH, JSON.stringify(schedule, null, 2))
  } catch (error) {
    console.error('Error saving schedule:', error)
  }
}
