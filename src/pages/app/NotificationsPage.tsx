import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import type { NotificationItem } from '../../types/argus';

export const NotificationsPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(() => {
    setLoading(true);
    apiFetch<NotificationItem[]>('/api/notifications')
      .then(setItems)
      .finally(() => setLoading(false));
  }, [apiFetch]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markOne = async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAll = async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <AppShell
      breadcrumb="Notifications"
      action={
        items.some((i) => !i.is_read) ? (
          <button
            type="button"
            onClick={markAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#F4F7FC] border border-[#1E3354] hover:border-[#65B9FF] rounded-md whitespace-nowrap"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        ) : undefined
      }
    >
      <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-[#8796AB]">Loading notifications...</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-[#F4F7FC]">No notifications yet</p>
            <p className="text-xs text-[#8796AB]">
              Events such as target verifications, assessment completions, critical findings, and report generation appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1E3354]">
            {items.map((n) => (
              <div
                key={n.id}
                className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  n.is_read ? 'opacity-75' : 'bg-[#142A49]/25'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[11px] text-[#65B9FF]">{n.type}</span>
                    {!n.is_read && <span className="text-[11px] font-medium text-[#F0A43A]">Unread</span>}
                  </div>
                  <p className="text-sm font-medium text-[#F4F7FC]">{n.title}</p>
                  <p className="text-xs text-[#8796AB]">{n.message}</p>
                  <p className="font-mono text-[11px] text-[#8796AB]/80 tabular-nums">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {n.link && (
                    <Link
                      to={n.link}
                      onClick={() => !n.is_read && markOne(n.id)}
                      className="text-xs font-medium text-[#65B9FF] hover:underline"
                    >
                      Open →
                    </Link>
                  )}
                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => markOne(n.id)}
                      className="text-xs text-[#8796AB] hover:text-[#F4F7FC]"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};
