import { AttendanceStatus } from '../constants'

export interface Attendee {
  userId: string
  status: AttendanceStatus
}

export interface DaySchedule {
  attendees: Attendee[]
  date: number
  month: number
  year: number
}

export interface WeekSchedule {
  [key: string]: DaySchedule
}

export type MonthSchedule = {
  [weekIndex: number]: WeekSchedule
}
