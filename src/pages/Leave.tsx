import React, { useState } from 'react';
import { useAttendanceStore, type LeaveRequest } from '../store/attendanceStore';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import '../styles/Leave.css';

const FORMSPREE_ID = 'xnjolobd';

export const Leave: React.FC = () => {
  const { leaveRequests, addLeaveRequest, cancelLeaveRequest, approveLeaveRequest, rejectLeaveRequest } = useAttendanceStore();
  const [formData, setFormData] = useState<{
    date: string;
    type: 'full' | 'half-am' | 'half-pm';
    reason: string;
  }>({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'full',
    reason: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const request: LeaveRequest = {
      id: Date.now().toString(),
      date: formData.date,
      type: formData.type,
      reason: formData.reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    // Formspree にメール送信
    try {
      const response = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: formData.date,
          type: getLeaveTypeLabel(formData.type),
          reason: formData.reason,
          email: 'ex24.kpp@gmail.com',
          _subject: `休暇申請: ${formData.date}`,
        }),
      });
      
      if (response.ok) {
        addLeaveRequest(request);
        setFormData({
          date: format(new Date(), 'yyyy-MM-dd'),
          type: 'full',
          reason: '',
        });
        alert('休暇申請を送信しました。メールが届きます。');
      } else {
        alert('メール送信に失敗しました。もう一度お試しください。');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('エラーが発生しました。');
    }
  };

  const handleCancel = (id: string) => {
    if (confirm('この申請を取り消してもよろしいですか？')) {
      cancelLeaveRequest(id);
    }
  };

  const getLeaveTypeLabel = (type: string): string => {
    switch (type) {
      case 'full':
        return '全日';
      case 'half-am':
        return '午前半日';
      case 'half-pm':
        return '午後半日';
      default:
        return type;
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return '申請中';
      case 'approved':
        return '承認済み';
      case 'rejected':
        return '却下';
      default:
        return status;
    }
  };

  return (
    <div className="leave-container">
      <div className="leave-header">
        <h1>休暇申請</h1>
      </div>

      <form className="leave-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="date">申請日</label>
          <input
            type="date"
            id="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="type">休暇種別</label>
          <select
            id="type"
            value={formData.type}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'full' || value === 'half-am' || value === 'half-pm') {
                setFormData({
                  ...formData,
                  type: value,
                });
              }
            }}
          >
            <option value="full">全日</option>
            <option value="half-am">午前半日</option>
            <option value="half-pm">午後半日</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="reason">理由</label>
          <textarea
            id="reason"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="理由を入力してください"
            rows={4}
          />
        </div>

        <button type="submit" className="btn btn-primary">
          申請を送信
        </button>
      </form>

      <div className="requests-section">
        <h2>申請履歴</h2>
        {leaveRequests.length > 0 ? (
          <div className="requests-list">
            {leaveRequests
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              .map((request) => {
                const requestDate = new Date(request.date);
                const dateLabel = format(requestDate, 'M月d日（EEEE）', { locale: ja });

                return (
                  <div key={request.id} className="request-card">
                    <div className="request-header">
                      <div>
                        <div className="request-date">{dateLabel}</div>
                        <div className="request-type">
                          {getLeaveTypeLabel(request.type)}
                        </div>
                      </div>
                      <div className={`status status-${request.status}`}>
                        {getStatusLabel(request.status)}
                      </div>
                    </div>
                    <div className="request-reason">{request.reason}</div>
                    {request.status === 'pending' && (
                      <div className="request-actions">
                        <button
                          className="btn btn-small btn-success"
                          onClick={() => approveLeaveRequest(request.id)}
                        >
                          承認
                        </button>
                        <button
                          className="btn btn-small btn-danger"
                          onClick={() => rejectLeaveRequest(request.id)}
                        >
                          却下
                        </button>
                        <button
                          className="btn btn-small btn-secondary"
                          onClick={() => handleCancel(request.id)}
                        >
                          取り消す
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="no-requests">
            <p>申請履歴がありません</p>
          </div>
        )}
      </div>
    </div>
  );
};
