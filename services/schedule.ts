import type { MonthSchedule, WeekSchedule } from '../types/schedule'
import { AttendanceStatus } from '../constants'

const createWeekSchedule = (startDate: Date): WeekSchedule => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

  return days.reduce((acc, day, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    acc[day] = {
      attendees: [],
      date: date.getDate(),
    }
    return acc
  }, {} as WeekSchedule)
}

export const createMonthSchedule = (
  startFromNextMonday: boolean = false,
): MonthSchedule => {
  const today = new Date()

  if (startFromNextMonday) {
    // Get next Monday regardless of current day
    today.setDate(today.getDate() + (8 - today.getDay()))
  }

  const isWeekend = today.getDay() === 0 || today.getDay() === 6
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + (isWeekend ? 8 : 1))

  return Array.from({ length: 4 }).reduce<MonthSchedule>(
    (acc, _, weekIndex) => {
      const weekStart = new Date(monday)
      weekStart.setDate(monday.getDate() + weekIndex * 7)
      acc[weekIndex] = createWeekSchedule(weekStart)
      return acc
    },
    {},
  )
}

// Update attendance in a schedule
// src/services/schedule.ts
export const updateAttendance = (
  schedule: MonthSchedule,
  day: string,
  week: number,
  userId: string,
  status: AttendanceStatus,
): MonthSchedule => {
  if (!day || !(day in schedule[week])) return schedule

  const user = `<@${userId}>`
  const updatedSchedule = { ...schedule }

  if (status === AttendanceStatus.Office) {
    if (!updatedSchedule[week][day].attendees.includes(user)) {
      updatedSchedule[week] = {
        ...updatedSchedule[week],
        [day]: {
          ...updatedSchedule[week][day],
          attendees: [...updatedSchedule[week][day].attendees, user],
        },
      }
    }
  } else {
    updatedSchedule[week] = {
      ...updatedSchedule[week],
      [day]: {
        ...updatedSchedule[week][day],
        attendees: updatedSchedule[week][day].attendees.filter(
          (a) => a !== user,
        ),
      },
    }
  }

  return updatedSchedule
}

// Get attendance for a specific day
export const getDayAttendance = (
  schedule: WeekSchedule,
  day: string,
): string[] => {
  return schedule[day]?.attendees || []
}

// Check if someone is attending on a day
export const isAttending = (
  schedule: WeekSchedule,
  day: string,
  userId: string,
): boolean => {
  const user = `<@${userId}>`
  return schedule[day]?.attendees.includes(user) || false
}
