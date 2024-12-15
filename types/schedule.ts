export interface DaySchedule {
  attendees: string[]
  date: number
}

export interface WeekSchedule {
  [key: string]: DaySchedule
}

export type MonthSchedule = {
  [weekIndex: number]: WeekSchedule
}

export enum AttendanceStatus {
  Office = 'office',
  Home = 'home',
}
