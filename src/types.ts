export type TimeRecord = {
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakDuration: number;
  onBreak: boolean;
  breakStartTime?: string | null;
};
