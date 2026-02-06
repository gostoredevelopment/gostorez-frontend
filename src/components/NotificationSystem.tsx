import React, { useEffect, useState, useCallback } from 'react';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { Bell, X, Check, AlertCircle, Clock, Mail, Smartphone, ExternalLink } from 'lucide-react';
import OneSignal from 'react-onesignal';
import './NotificationSystem.css';

interface Notification {
  id: string;
  title: string;
  body: string;
  notification_type: 'order' | 'chat' | 'system' | 'vendor' | 'promotion';
  read: boolean;
  created_at: string;
  redirect_url?: string;
  data?: Record<string, any>;
  sent_via: string[];
}

interface NotificationSystemProps {
  autoInitialize?: boolean;
  showBell?: boolean;
  maxNotifications?: number;
}

// Global flag to track OneSignal initialization
let oneSignalInitialized = false;

const NotificationSystem: React.FC<NotificationSystemProps> = ({
  autoInitialize = true,
  showBell = true,
  maxNotifications = 100
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [pushStatus, setPushStatus] = useState<'idle' | 'checking' | 'active' | 'failed'>('idle');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // ==================== DEBUG LOGGING ====================
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const log = `[${timestamp}] ${message}`;
    console.log('🔔 NotificationSystem:', log);
    setDebugLogs(prev => [log, ...prev.slice(0, 10)]);
  }, []);

  // ==================== SAFE ONE SIGNAL INITIALIZATION ====================
  const initializeOneSignalSafely = useCallback(async () => {
    try {
      // Prevent multiple initializations globally
      if (oneSignalInitialized) {
        addDebugLog('⚠️ OneSignal already initialized elsewhere, skipping');
        setPushStatus('active');
        return true;
      }

      // Check if window.OneSignal already exists (from CDN or other source)
      if ((window as any).OneSignal && (window as any).OneSignal.initialized) {
        addDebugLog('⚠️ OneSignal SDK already loaded and initialized via CDN');
        oneSignalInitialized = true;
        setPushStatus('active');
        return true;
      }

      setPushStatus('checking');
      addDebugLog('🚀 Starting safe OneSignal initialization...');

      const user = auth.currentUser;
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';

      const initConfig = {
        appId: '8871d2ef-7cda-486e-b53b-53964c531d49',
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/' },
        safari_web_id: 'web.onesignal.auto.xxx',
      };

      // Add localhost configuration only if needed
      if (isLocalhost) {
        Object.assign(initConfig, {
          allowLocalhostAsSecureOrigin: true,
        });
        addDebugLog('🏠 Localhost detected, enabling secure origin');
      }

      // Initialize OneSignal
      await OneSignal.init(initConfig);
      
      oneSignalInitialized = true;
      addDebugLog('✅ OneSignal SDK initialized');

   // Set external user ID if available - USE WINDOW OBJECT
if (user?.uid) {
    try {
        await (window as any).OneSignal.setExternalUserId(user.uid);
        addDebugLog(`👤 Set external user ID: ${user.uid}`);
    } catch (userIdError: any) {
        addDebugLog(`⚠️ Could not set external user ID: ${userIdError.message}`);
    }
}

      // Get current permission
      const currentPermission = Notification.permission;
      setPermission(currentPermission);
      addDebugLog(`🔔 Current permission: ${currentPermission}`);

      // Setup event listeners
      setupOneSignalListeners();
      
      // Show permission prompt if needed
      if (currentPermission === 'default' && isLocalhost) {
        try {
          await OneSignal.Slidedown.promptPush();
          addDebugLog('✅ Shown permission prompt');
        } catch (promptError: any) {
          addDebugLog(`ℹ️ Permission prompt skipped: ${promptError.message}`);
        }
      }

      setPushStatus('active');
      addDebugLog('🎉 OneSignal setup complete');
      return true;

    } catch (error: any) {
      addDebugLog(`❌ OneSignal initialization failed: ${error.message}`);
      setPushStatus('failed');
      return false;
    }
  }, [addDebugLog]);

  // ==================== SETUP EVENT LISTENERS ====================
  const setupOneSignalListeners = useCallback(() => {
    try {
      // Listen for notification clicks
      OneSignal.Notifications.addEventListener('click', (event: any) => {
        const notification = event.notification;
        addDebugLog(`📬 Notification clicked: ${notification?.title}`);
        
        const pushNotification: Notification = {
          id: `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: notification?.title || 'Push Notification',
          body: notification?.body || '',
          notification_type: 'system',
          read: true,
          created_at: new Date().toISOString(),
          redirect_url: notification?.url || notification?.additionalData?.redirect_url,
          data: notification?.additionalData,
          sent_via: ['onesignal']
        };
        
        setNotifications(prev => [pushNotification, ...prev.slice(0, maxNotifications - 1)]);
        
        const redirectUrl = notification?.url || notification?.additionalData?.redirect_url;
        if (redirectUrl) {
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 300);
        }
      });

      // Listen for notification display
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
        const notification = event.notification;
        addDebugLog(`📬 Push notification displayed: ${notification?.title}`);
      });

      addDebugLog('✅ OneSignal event listeners setup');
    } catch (error: any) {
      addDebugLog(`❌ Error setting up listeners: ${error.message}`);
    }
  }, [addDebugLog, maxNotifications]);

  // ==================== LOAD NOTIFICATIONS FROM BACKEND ====================
  const loadNotifications = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }
      
      addDebugLog(`📥 Loading notifications for user: ${user.uid}`);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`target_user_id.eq.${user.uid},receiver_id.eq.${user.uid}`)
        .order('created_at', { ascending: false })
        .limit(maxNotifications);
      
      if (error) {
        addDebugLog(`❌ Error loading notifications: ${error.message}`);
        return;
      }
      
      const validNotifications = (data || []).filter((n): n is Notification => 
        n && n.id && n.title && n.body
      );
      
      addDebugLog(`✅ Loaded ${validNotifications.length} notifications`);
      setNotifications(validNotifications);
      
      const unread = validNotifications.filter(n => !n.read).length;
      setUnreadCount(unread);
      
    } catch (error: any) {
      addDebugLog(`❌ Error in loadNotifications: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [maxNotifications, addDebugLog]);

  // ==================== REAL-TIME NOTIFICATION LISTENER ====================
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    
    addDebugLog('🔗 Setting up real-time notification listener...');
    
    const channel = supabase
      .channel(`notifications-${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `target_user_id=eq.${user.uid}`,
        },
        async (payload) => {
          try {
            const newNotification = payload.new as Notification;
            addDebugLog(`🆕 New notification: ${newNotification.title}`);
            
            setNotifications(prev => {
              if (prev.some(n => n.id === newNotification.id)) {
                return prev;
              }
              return [newNotification, ...prev.slice(0, maxNotifications - 1)];
            });
            
            if (!newNotification.read) {
              setUnreadCount(prev => prev + 1);
              
              if (permission === 'granted' && !newNotification.sent_via?.includes('onesignal')) {
                showBrowserNotification(newNotification);
              }
            }
          } catch (error) {
            addDebugLog(`❌ Error handling real-time notification: ${error}`);
          }
        }
      )
      .subscribe();
    
    return () => {
      addDebugLog('🔌 Cleaning up real-time listener');
      supabase.removeChannel(channel);
    };
  }, [maxNotifications, permission, addDebugLog]);

  // ==================== SHOW BROWSER NOTIFICATION ====================
  const showBrowserNotification = (notification: Notification) => {
    if (!('Notification' in window) || permission !== 'granted') return;
    
    try {
      const options: NotificationOptions = {
        body: notification.body,
        icon: '/logo.png',
        badge: '/badge.png',
        tag: `gostorez-${notification.id}`,
        data: {
          notificationId: notification.id,
          redirect_url: notification.redirect_url,
          ...notification.data
        }
      };
      
      const notif = new Notification(notification.title, options);
      
      notif.onclick = () => {
        window.focus();
        markAsRead(notification.id);
        
        if (notification.redirect_url) {
          window.location.href = notification.redirect_url;
        }
        
        setShowDropdown(false);
      };
      
    } catch (error) {
      addDebugLog(`❌ Error showing browser notification: ${error}`);
    }
  };

  // ==================== AUTH & INITIALIZATION ====================
  useEffect(() => {
    addDebugLog('🔐 Setting up auth state listener...');
    
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        addDebugLog(`👤 User logged in: ${user.uid}`);
        
        await loadNotifications();
        
        if (autoInitialize && pushStatus === 'idle') {
          await initializeOneSignalSafely();
        }
      } else {
        addDebugLog('👤 User logged out');
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
      }
    });
    
    return () => {
      addDebugLog('🔌 Cleaning up auth listener');
      unsubscribe();
    };
  }, [autoInitialize, loadNotifications, initializeOneSignalSafely, pushStatus, addDebugLog]);

  // ==================== NOTIFICATION ACTIONS ====================
  const markAsRead = async (notificationId: string) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      await supabase
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .or(`target_user_id.eq.${user.uid},receiver_id.eq.${user.uid}`);
      
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      addDebugLog(`✅ Marked as read: ${notificationId}`);
      
    } catch (error: any) {
      addDebugLog(`❌ Error marking as read: ${error.message}`);
    }
  };

  const markAllAsRead = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      await supabase
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .or(`target_user_id.eq.${user.uid},receiver_id.eq.${user.uid}`);
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      
      addDebugLog('✅ Marked all notifications as read');
      
    } catch (error: any) {
      addDebugLog(`❌ Error marking all as read: ${error.message}`);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .or(`target_user_id.eq.${user.uid},receiver_id.eq.${user.uid}`);
      
      const notificationToDelete = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      if (notificationToDelete && !notificationToDelete.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      addDebugLog(`🗑️ Deleted notification: ${notificationId}`);
      
    } catch (error: any) {
      addDebugLog(`❌ Error deleting notification: ${error.message}`);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    if (notification.redirect_url) {
      window.open(notification.redirect_url, '_blank');
    }
    
    setShowDropdown(false);
  };

  // ==================== HELPER FUNCTIONS ====================
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    const icons = {
      order: '🛍️',
      chat: '💬',
      vendor: '🏪',
      system: '📢',
      promotion: '🎉'
    };
    return icons[type as keyof typeof icons] || '📢';
  };

  const getDeliveryMethodIcons = (sentVia: string[]) => {
    return sentVia.map(method => {
      switch (method) {
        case 'email':
          return (
            <span key="email" className="icon-wrapper" data-tooltip="Email">
              <Mail size={12} className="text-blue-500 mr-1" />
            </span>
          );
        case 'onesignal':
          return (
            <span key="push" className="icon-wrapper" data-tooltip="Push Notification">
              <Smartphone size={12} className="text-green-500 mr-1" />
            </span>
          );
        case 'sms':
          return (
            <span key="sms" className="icon-wrapper" data-tooltip="SMS">
              <Smartphone size={12} className="text-purple-500 mr-1" />
            </span>
          );
        default:
          return null;
      }
    }).filter(Boolean);
  };

  const requestPushPermission = async () => {
    try {
      addDebugLog('🔄 Manually requesting push permission...');
      
      if (!(window as any).OneSignal) {
        await initializeOneSignalSafely();
      }
      
      await OneSignal.Slidedown.promptPush();
      addDebugLog('✅ Permission requested');
      
    } catch (error: any) {
      addDebugLog(`❌ Error requesting permission: ${error.message}`);
    }
  };

  const clearDebugLogs = () => {
    setDebugLogs([]);
  };

  // ==================== RENDER ====================
  if (loading && notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-system">
      {/* Notification Bell */}
      {showBell && (
        <div className="notification-bell-container">
          <button
            className="notification-bell"
            onClick={() => setShowDropdown(!showDropdown)}
            aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
            title={`${unreadCount} unread | Push: ${pushStatus}`}
            disabled={loading}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            {pushStatus === 'active' && (
              <span className="push-status-indicator active" title="Push notifications active">
                🔔
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <div className="notification-dropdown">
              <div className="dropdown-header">
                <h3>Notifications</h3>
                <div className="dropdown-actions">
                  {permission !== 'granted' && pushStatus !== 'active' && (
                    <button 
                      onClick={requestPushPermission}
                      className="enable-push-btn"
                    >
                      <Bell size={14} /> Enable
                    </button>
                  )}
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="mark-all-btn"
                    >
                      <Check size={14} /> Mark all
                    </button>
                  )}
                  <button 
                    onClick={() => setShowPanel(true)}
                    className="view-all-btn"
                  >
                    View All
                  </button>
                  <button 
                    onClick={() => setShowDropdown(false)}
                    className="close-btn"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="no-notifications">
                    <Bell size={32} />
                    <p>No notifications yet</p>
                    {pushStatus !== 'active' && (
                      <button 
                        onClick={requestPushPermission}
                        className="enable-push-btn-small"
                      >
                        Enable push notifications
                      </button>
                    )}
                  </div>
                ) : (
                  notifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className={`notification-item ${!notification.read ? 'unread' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="notification-icon">
                        {getNotificationIcon(notification.notification_type)}
                      </div>
                      <div className="notification-content">
                        <h4>{notification.title}</h4>
                        <p>{notification.body}</p>
                        <div className="notification-meta">
                          <span className="time">
                            <Clock size={12} /> {formatTime(notification.created_at)}
                          </span>
                          {notification.sent_via && notification.sent_via.length > 0 && (
                            <div className="delivery-methods">
                              {getDeliveryMethodIcons(notification.sent_via)}
                            </div>
                          )}
                          {notification.redirect_url && (
                            <ExternalLink size={12} className="ml-1" />
                          )}
                        </div>
                      </div>
                      {!notification.read && <div className="unread-dot"></div>}
                      <button
                        className="delete-notification-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        title="Delete"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 5 && (
                <div className="dropdown-footer">
                  <button onClick={() => setShowPanel(true)}>
                    See all notifications ({notifications.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full Notification Panel */}
      {showPanel && (
        <div className="notification-panel-overlay" onClick={() => setShowPanel(false)}>
          <div className="notification-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <h2>Notifications</h2>
              <div className="panel-actions">
                <div className="panel-stats">
                  <span className="total-count">{notifications.length} total</span>
                  {unreadCount > 0 && (
                    <span className="unread-count">{unreadCount} unread</span>
                  )}
                  <span className={`push-status ${pushStatus}`}>
                    Push: {pushStatus === 'active' ? '✅' : '❌'}
                  </span>
                </div>
                <div className="panel-buttons">
                  <button 
                    onClick={requestPushPermission}
                    className="panel-btn"
                    disabled={pushStatus === 'active'}
                  >
                    <Bell size={16} /> Enable Push
                  </button>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="panel-btn">
                      <Check size={16} /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowPanel(false)} className="panel-btn close">
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="panel-body">
              {/* Debug Info */}
              <details className="debug-section">
                <summary>Debug Information</summary>
                <div className="debug-grid">
                  <div className="debug-item">
                    <span className="debug-label">Push Status:</span>
                    <span className={`debug-value ${pushStatus}`}>{pushStatus}</span>
                  </div>
                  <div className="debug-item">
                    <span className="debug-label">Permission:</span>
                    <span className={`debug-value ${permission}`}>{permission}</span>
                  </div>
                  <div className="debug-item">
                    <span className="debug-label">User:</span>
                    <span className="debug-value">
                      {auth.currentUser?.uid?.substring(0, 8) || 'Not logged in'}
                    </span>
                  </div>
                  <div className="debug-item">
                    <span className="debug-label">Hostname:</span>
                    <span className="debug-value">
                      {window.location.hostname}
                    </span>
                  </div>
                </div>
                
                {/* Debug Logs */}
                <div className="debug-logs">
                  <div className="debug-logs-header">
                    <h5>Recent Logs</h5>
                    <button onClick={clearDebugLogs} className="clear-logs-btn">
                      Clear
                    </button>
                  </div>
                  <div className="debug-logs-content">
                    {debugLogs.length === 0 ? (
                      <p className="no-logs">No recent logs</p>
                    ) : (
                      debugLogs.map((log, index) => (
                        <div key={index} className="debug-log">
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </details>

              {/* Notifications List */}
              {notifications.length === 0 ? (
                <div className="empty-state">
                  <Bell size={48} />
                  <h3>No notifications yet</h3>
                  <p>Your notifications will appear here when you receive messages, orders, or updates.</p>
                  {pushStatus !== 'active' && (
                    <button 
                      onClick={requestPushPermission}
                      className="enable-push-btn-large"
                    >
                      <Bell size={16} /> Enable Push Notifications
                    </button>
                  )}
                </div>
              ) : (
                <div className="panel-list">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`panel-notification-item ${!notification.read ? 'unread' : ''}`}
                    >
                      <div className="panel-item-icon">
                        {getNotificationIcon(notification.notification_type)}
                      </div>
                      <div className="panel-item-content">
                        <div className="panel-item-header">
                          <h4>{notification.title}</h4>
                          <div className="panel-item-actions">
                            {!notification.read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="mark-read-btn"
                                title="Mark as read"
                              >
                                <Check size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="delete-btn"
                              title="Delete"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                        <p className="panel-item-body">{notification.body}</p>
                        <div className="panel-item-meta">
                          <div className="meta-left">
                            <span className="type">{notification.notification_type}</span>
                            <span className="time">
                              <Clock size={12} /> {formatTime(notification.created_at)}
                            </span>
                            {notification.sent_via && notification.sent_via.length > 0 && (
                              <span className="delivery-methods">
                                via {notification.sent_via.join(', ')}
                              </span>
                            )}
                          </div>
                          {notification.redirect_url && (
                            <button
                              onClick={() => window.open(notification.redirect_url!, '_blank')}
                              className="action-btn"
                            >
                              <ExternalLink size={12} /> Open
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel-footer">
              <div className="push-info">
                <p>
                  <strong>Push Status:</strong>
                  <span className={`status ${pushStatus === 'active' ? 'connected' : 'disconnected'}`}>
                    {pushStatus === 'active' ? '✅ Active' : '❌ Enable for instant alerts'}
                  </span>
                </p>
                <p className="init-info">
                  <small>OneSignal initialized: {oneSignalInitialized ? 'Yes' : 'No'}</small>
                </p>
                {pushStatus !== 'active' && (
                  <button 
                    onClick={requestPushPermission}
                    className="enable-push-btn-footer"
                  >
                    <Bell size={14} /> Enable Push Notifications
                  </button>
                )}
              </div>
              <button onClick={() => setShowPanel(false)} className="close-panel-btn">
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationSystem;