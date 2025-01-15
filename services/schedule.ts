import type { Attendee, MonthSchedule, WeekSchedule } from '../types/schedule'
import { AttendanceStatus } from '../constants'
import { addWeeks, addDays, startOfWeek, nextMonday, isWeekend } from 'date-fns'

const createWeekSchedule = (startDate: Date): WeekSchedule => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

  return days.reduce((acc, day, index) => {
    const date = addDays(startDate, index)
    acc[day] = {
      attendees: [],
      date: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    }
    return acc
  }, {} as WeekSchedule)
}

export const createMonthSchedule = (
  startFromNextMonday: boolean = false,
): MonthSchedule => {
  const today = new Date()
  let monday = startOfWeek(today, { weekStartsOn: 1 })

  if (startFromNextMonday || isWeekend(today) || today.getDay() === 5) {
    monday = nextMonday(today)
  }

  return Array.from({ length: 4 }).reduce<MonthSchedule>(
    (acc, _, weekIndex) => {
      const weekStart = addWeeks(monday, weekIndex)
      acc[weekIndex] = createWeekSchedule(weekStart)
      return acc
    },
    {},
  )
}

export const updateAttendance = (
  schedule: MonthSchedule,
  day: string,
  week: number,
  userId: string,
  status: AttendanceStatus,
): MonthSchedule => {
  if (!day || !(day in schedule[week])) return schedule

  const updatedSchedule = { ...schedule }
  const user = `<@${userId}>`

  // Remove any existing status for this user on this day
  const existingAttendees = updatedSchedule[week][day].attendees.filter(
    (a) => a.userId !== user,
  )

  // Always add the new status, even if remote
  existingAttendees.push({
    userId: user,
    status,
  })

  updatedSchedule[week] = {
    ...updatedSchedule[week],
    [day]: {
      ...updatedSchedule[week][day],
      attendees: existingAttendees,
    },
  }

  return updatedSchedule
}

export const getDayAttendance = (
  schedule: WeekSchedule,
  day: string,
  status?: AttendanceStatus,
): Attendee[] => {
  const attendees = schedule[day]?.attendees || []
  if (status) {
    return attendees.filter((a) => a.status === status)
  }
  return attendees
}
export const isAttending = (
  schedule: WeekSchedule,
  day: string,
  userId: string,
): boolean => {
  const user = `<@${userId}>`
  return schedule[day]?.attendees.some((a) => a.userId === user) || false
}

export const getUserStatus = (
  schedule: WeekSchedule,
  day: string,
  userId: string,
): AttendanceStatus | null => {
  const user = `<@${userId}>`
  const attendee = schedule[day]?.attendees.find((a) => a.userId === user)
  return attendee?.status || null
}

export const getAttendeesByStatus = (
  schedule: WeekSchedule,
  day: string,
): Record<AttendanceStatus, Attendee[]> => {
  const attendees = schedule[day]?.attendees || []
  return {
    office: attendees.filter((a) => a.status === 'office'),
    remote: attendees.filter((a) => a.status === 'remote'),
    traveling: attendees.filter((a) => a.status === 'traveling'),
    client: attendees.filter((a) => a.status === 'client'),
  }
}

export const getTotalCapacity = (
  schedule: WeekSchedule,
  day: string,
): { used: number; total: number } => {
  const officeAttendees =
    schedule[day]?.attendees.filter((a) => a.status === 'office').length || 0
  return {
    used: officeAttendees,
    total: 48, // You might want to make this configurable
  }
}
