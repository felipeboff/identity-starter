import type { Entry } from "../handler";

export type JobSchedule = Readonly<{
  pattern: string;
  tz: string;
}>;

export type ScheduledJob = Entry &
  Readonly<{
    name: string;
    schedule: JobSchedule;
  }>;
