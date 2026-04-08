import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TimeRecord {
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakDuration: number;
  onBreak: boolean; // ★ 必須
}

export interface LeaveRequest {
  id: string;
  date: string;
  type: 'full' | 'half-am' | 'half-pm';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface AttendanceStore {
  records: TimeRecord[];
  leaveRequests: LeaveRequest[];
  addRecord: (record: TimeRecord) => void;
  updateRecord: (date: string, updates: Partial<TimeRecord>) => void;
  deleteRecord: (date: string) => void;
  getRecordByDate: (date: string) => TimeRecord | undefined;
  addLeaveRequest: (request: LeaveRequest) => void;
  cancelLeaveRequest: (id: string) => void;
  approveLeaveRequest: (id: string) => void;
  rejectLeaveRequest: (id: string) => void;
  getLeaveRequests: () => LeaveRequest[];
}

export const useAttendanceStore = create<AttendanceStore>()(
  persist(
    (set, get) => ({
      records: [],
      leaveRequests: [],

      addRecord: (record) =>
        set((state) => {
          const existing = state.records.findIndex((r) => r.date === record.date);
          const newRecords = [...state.records];
          if (existing >= 0) {
            newRecords[existing] = { ...newRecords[existing], ...record };
          } else {
            newRecords.push(record);
          }
          return { records: newRecords };
        }),

      updateRecord: (date, updates) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.date === date ? { ...r, ...updates } : r
          ),
        })),

      deleteRecord: (date) =>
        set((state) => ({
          records: state.records.filter((r) => r.date !== date),
        })),

      getRecordByDate: (date) => {
        return get().records.find((r) => r.date === date);
      },

      addLeaveRequest: (request) =>
        set((state) => ({
          leaveRequests: [...state.leaveRequests, request],
        })),

      cancelLeaveRequest: (id) =>
        set((state) => ({
          leaveRequests: state.leaveRequests.filter((r) => r.id !== id),
        })),

      approveLeaveRequest: (id) =>
        set((state) => ({
          leaveRequests: state.leaveRequests.map((r) =>
            r.id === id ? { ...r, status: 'approved' as const } : r
          ),
        })),

      rejectLeaveRequest: (id) =>
        set((state) => ({
          leaveRequests: state.leaveRequests.map((r) =>
            r.id === id ? { ...r, status: 'rejected' as const } : r
          ),
        })),

      getLeaveRequests: () => get().leaveRequests,
    }),
    {
      name: 'attendance-storage-vFINAL', // ★ 名前を新しくして古いデータを強制破棄
    }
  )
);



