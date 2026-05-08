import React, { useEffect, useState, useRef, useCallback } from 'react';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { X, Bell, ExternalLink } from 'lucide-react';
import './InAppNotification.css';
import notificationSound from '../assets/audios/notification.mp3';

interface Notification {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  read: boolean;
  created_at: string;
  redirect_url?: string;
  data?: any;
  target_user_id?: string;
  receiver_id?: string;
  receiver_ids?: string[];
}

interface Toast {
  id: string;              // unique for the toast (can be notification.id)
  notification: Notification;
  timeoutId?: NodeJS.Timeout;
}

const AUTO_DISMISS_MS = 5000; // 5 seconds
const MAX_TOASTS = 3;

const InAppNotification: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const mounted = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(notificationSound);
    audioRef.current.preload = 'auto';
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Get current user ID
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      mounted.current = false;
      toasts.forEach((toast) => {
        if (toast.timeoutId) clearTimeout(toast.timeoutId);
      });
    };
  }, [toasts]);

  // Remove a toast by its id
  const removeToast = useCallback((toastId: string) => {
    setToasts((prev) => {
      const toast = prev.find((t) => t.id === toastId);
      if (toast?.timeoutId) clearTimeout(toast.timeoutId);
      return prev.filter((t) => t.id !== toastId);
    });
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        console.log('Audio play failed:', error);
      });
    }
  }, []);

  // Add a new toast for a notification
  const addToast = useCallback(
    (notification: Notification) => {
      // Avoid duplicates (if notification already in toasts)
      setToasts((prev) => {
        if (prev.some((t) => t.notification.id === notification.id)) {
          return prev;
        }

        // Play sound for new notification
        playNotificationSound();

        const newToast: Toast = {
          id: notification.id,
          notification,
        };

        // Set auto‑dismiss timeout
        const timeoutId = setTimeout(() => {
          removeToast(notification.id);
        }, AUTO_DISMISS_MS);

        newToast.timeoutId = timeoutId;

        // Keep only MAX_TOASTS most recent
        const updated = [newToast, ...prev].slice(0, MAX_TOASTS);
        return updated;
      });
    },
    [removeToast, playNotificationSound]
  );

  // Mark notification as read in the database
  const markAsRead = useCallback(async (notification: Notification) => {
    if (!userId) return;
    try {
      await supabase
        .from('notifications')
        .update({ read: true, updated_at: new Date().toISOString() })
        .eq('id', notification.id)
        .or(`target_user_id.eq.${userId},receiver_id.eq.${userId},receiver_ids.cs.{${userId}}`);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [userId]);

  // Handle click on toast
  const handleToastClick = useCallback(
    async (toast: Toast) => {
      const { notification } = toast;
      // Mark as read (if not already)
      if (!notification.read) {
        await markAsRead(notification);
      }
      // Navigate if redirect_url exists
      if (notification.redirect_url) {
        window.open(notification.redirect_url, '_blank');
      }
      // Dismiss the toast
      removeToast(toast.id);
    },
    [markAsRead, removeToast]
  );

  // Set up realtime subscription
  useEffect(() => {
    if (!userId) return;

  const channel = supabase
  .channel(`inapp-notifications-${userId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      // Remove filter - get all notifications
    },
    (payload) => {
      const notification = payload.new as Notification;
      
      // Check if this notification is for current user
      const isForCurrentUser = 
        notification.receiver_id === userId ||
        (notification.receiver_ids && notification.receiver_ids.includes(userId)) ||
        notification.target_user_id === userId;
      
      if (isForCurrentUser) {
        addToast(notification);
      }
    }
  )
  .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, addToast]);

  // If no user or no toasts, render nothing
  if (!userId || toasts.length === 0) return null;

  return (
    <div className="inapp-notifications">
      {toasts.map((toast) => {
        const { notification, id } = toast;
        return (
          <div
            key={id}
            className={`inapp-notification inapp-notification-${notification.notification_type || 'info'}`}
            onClick={() => handleToastClick(toast)}
          >
            <div className="inapp-notification-content">
              <Bell size={16} />
              <div className="inapp-notification-text">
                <strong>{notification.title}</strong>
                <p>{notification.body}</p>
              </div>
              {notification.redirect_url && (
                <ExternalLink size={14} className="inapp-notification-link-icon" />
              )}
            </div>
            <button
              className="inapp-notification-close"
              onClick={(e) => {
                e.stopPropagation(); // prevent triggering the parent click
                removeToast(id);
              }}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default InAppNotification;