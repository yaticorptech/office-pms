import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { notificationsApi } from '../services/resources.js';

const NotificationContext = createContext(null);

// Phase 1 has no websockets, so the bell polls. 45s keeps it feeling live without
// hammering the API, and every local action refreshes immediately anyway.
const POLL_INTERVAL = 45000;

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const response = await notificationsApi.list({ limit: 12 });
      setItems(response.data);
      setUnreadCount(response.meta?.unreadCount ?? 0);
    } catch {
      // A failed poll is not worth interrupting the user for; the next tick retries.
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const refreshCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await notificationsApi.unreadCount();
      setUnreadCount(response.data.unreadCount);
    } catch {
      // Ignore — polling continues.
    }
  }, [isAuthenticated]);

  // Reset on sign-out so one user's notifications never linger for the next.
  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setUnreadCount(0);
      return undefined;
    }

    refresh();
    const timer = setInterval(refreshCount, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [isAuthenticated, user?._id, refresh, refreshCount]);

  const markRead = useCallback(async (id) => {
    // Optimistic: the panel closes immediately on click, so waiting would feel broken.
    setItems((current) =>
      current.map((item) => (item._id === id ? { ...item, read: true } : item)),
    );
    setUnreadCount((current) => Math.max(current - 1, 0));
    try {
      await notificationsApi.markRead(id);
    } catch {
      refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    try {
      await notificationsApi.markAllRead();
    } catch {
      refresh();
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ items, unreadCount, loading, refresh, markRead, markAllRead }),
    [items, unreadCount, loading, refresh, markRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside a NotificationProvider');
  return context;
};
