import React, { useEffect, useState, useCallback } from 'react';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { Bell, X, Check, AlertCircle, Clock, Mail, Smartphone, ExternalLink, Database, Send, Server, Wifi, Loader } from 'lucide-react';
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

interface DiagnosticLog {
  id: string;
  step: string;
  status: 'info' | 'success' | 'error' | 'warning' | 'pending';
  message: string;
  timestamp: string;
  details?: any;
  duration?: number;
}

interface NotificationRequestData {
  title: string;
  body: string;
  target_user_id: string;
  notification_type?: Notification['notification_type'];
  email?: string;
  redirect_url?: string;
  data?: Record<string, any>;
  imageUrl?: string;
  _requestId?: string;
  _sender?: string;
}

interface BackendResponse {
  success: boolean;
  message: string;
  notificationId?: string;
  channels: string[];
  results?: {
    email?: { success: boolean; error?: string };
    onesignal?: { success: boolean; sent: number; failed: number; error?: string };
  };
}

declare global {
  interface Window {
    notificationResponse?: (data: any) => void;
  }
}

let oneSignalInitialized = false;
let notificationProcessingActive = false;
const diagnosticLogs: DiagnosticLog[] = [];

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
  const [diagnostics, setDiagnostics] = useState<DiagnosticLog[]>([]);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [userIdCheckComplete, setUserIdCheckComplete] = useState(false);

  // ==================== CORRECTED USER ID ASSOCIATION FUNCTION ====================
  const checkAndAssociateOneSignalUser = useCallback(async (firebaseUserId: string) => {
    const startTime = Date.now();
    
    try {
      addDiagnostic('USER_ID_CHECK', 'pending', `Checking OneSignal association for Firebase user: ${firebaseUserId}`);
      
      // First ensure OneSignal is initialized
      if (!oneSignalInitialized || !(window as any).OneSignal) {
        addDiagnostic('USER_ID_CHECK', 'warning', 'OneSignal not initialized yet, skipping association check');
        return false;
      }
      
      // FIXED: Correct API path for getting external ID
      let externalUserId: string | undefined | null;
      try {
        externalUserId = OneSignal.User.externalId;
      } catch (getError: any) {
        addDiagnostic('USER_ID_GET', 'warning', `Could not get current external ID: ${getError.message}`);
        externalUserId = null;
      }
      
      if (externalUserId) {
        // User already has an external ID associated
        if (externalUserId === firebaseUserId) {
          addDiagnostic('USER_ID_CHECK', 'success', `Firebase user ID already associated with OneSignal: ${firebaseUserId}`, {
            duration: Date.now() - startTime,
            existingExternalId: externalUserId
          });
          console.log(`✅ Firebase user ${firebaseUserId} already associated with OneSignal`);
          return true;
        } else {
          // Different external ID is already set - this is normal during development
          addDiagnostic('USER_ID_CHECK', 'warning', `OneSignal already has different external ID: ${externalUserId} (Firebase: ${firebaseUserId})`, {
            duration: Date.now() - startTime
          });
          console.log(`⚠️ OneSignal has different external ID (${externalUserId}) than Firebase user (${firebaseUserId})`);
        }
      }
      
      // No external ID set or different ID - associate the Firebase user ID
      addDiagnostic('USER_ID_CHECK', 'info', `Setting external user ID via login(): ${firebaseUserId}`);
      
      try {
        // FIXED: Use login() to set external ID - this is the correct production method
        await OneSignal.login(firebaseUserId);
        
        // Verify the ID was set
        let verifiedExternalId: string | undefined | null;
        try {
          verifiedExternalId = OneSignal.User.externalId;
        } catch {
          verifiedExternalId = null;
        }
        
        if (verifiedExternalId === firebaseUserId) {
          addDiagnostic('USER_ID_CHECK', 'success', `Successfully associated Firebase user with OneSignal: ${firebaseUserId}`, {
            duration: Date.now() - startTime,
            verified: true
          });
          console.log(`✅ Associated Firebase user ${firebaseUserId} with OneSignal`);
          return true;
        } else {
          addDiagnostic('USER_ID_CHECK', 'warning', `login() succeeded but external ID not immediately verifiable`, {
            duration: Date.now() - startTime,
            expected: firebaseUserId,
            actual: verifiedExternalId
          });
          console.log(`⚠️ External ID set but not immediately verifiable`);
          return true; // Still return true as login() succeeded
        }
      } catch (loginError: any) {
        // FIXED: Production fallback for login() errors
        addDiagnostic('USER_ID_CHECK', 'error', `login() failed: ${loginError.message}`, {
          duration: Date.now() - startTime,
          error: loginError.message
        });
        
        // Fallback: Try setExternalUserId as backup (for older SDK versions)
        try {
          addDiagnostic('USER_ID_FALLBACK', 'info', 'Trying fallback method setExternalUserId()');
          await (window as any).OneSignal.setExternalUserId(firebaseUserId);
          addDiagnostic('USER_ID_FALLBACK', 'success', 'Fallback setExternalUserId() succeeded');
          console.log(`✅ Associated Firebase user ${firebaseUserId} via fallback method`);
          return true;
        } catch (fallbackError: any) {
          addDiagnostic('USER_ID_FALLBACK', 'error', `Fallback also failed: ${fallbackError.message}`, {
            duration: Date.now() - startTime,
            error: fallbackError.message
          });
          console.error(`❌ All methods failed for Firebase user ${firebaseUserId}:`, loginError, fallbackError);
          return false;
        }
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      addDiagnostic('USER_ID_CHECK', 'error', `Error in checkAndAssociateOneSignalUser: ${error.message}`, {
        duration,
        error: error.message
      });
      console.error('❌ Error in checkAndAssociateOneSignalUser:', error);
      return false;
    }
  }, []);

  // ==================== DIAGNOSTIC LOGGING SYSTEM ====================
  const addDiagnostic = useCallback((
    step: string, 
    status: DiagnosticLog['status'], 
    message: string, 
    details?: any,
    duration?: number
  ) => {
    const log: DiagnosticLog = {
      id: `diag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      step,
      status,
      message,
      timestamp: new Date().toLocaleTimeString(),
      details,
      duration
    };
    
    const statusEmoji = {
      'info': 'ℹ️',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'pending': '⏳'
    }[status];
    
    console.log(`${statusEmoji} [${log.timestamp}] ${step}: ${message}`, details || '');
    
    diagnosticLogs.push(log);
    setDiagnostics(prev => [log, ...prev.slice(0, 50)]);
  }, []);

  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const log = `[${timestamp}] ${message}`;
    console.log('🔔 NotificationSystem:', log);
    setDebugLogs(prev => [log, ...prev.slice(0, 20)]);
  }, []);

  // ==================== BACKEND NOTIFICATION PROCESSOR ====================
  const processNotificationRequest = useCallback(async (requestData: NotificationRequestData) => {
    const requestId = requestData._requestId || `req_${Date.now()}`;
    const startTime = Date.now();
    
    addDiagnostic('REQUEST_RECEIVED', 'info', 'Notification request received from page', {
      requestId,
      sender: requestData._sender || 'unknown',
      title: requestData.title,
      targetUser: requestData.target_user_id
    });

    setProcessingRequest(requestId);

    try {
      addDiagnostic('VALIDATION', 'pending', 'Validating notification data');
      
      if (!requestData.title || !requestData.body || !requestData.target_user_id) {
        throw new Error('Missing required fields: title, body, or target_user_id');
      }
      
      if (requestData.target_user_id.trim() !== requestData.target_user_id) {
        addDiagnostic('VALIDATION', 'warning', 'Target user ID has trailing spaces, auto-trimming');
        requestData.target_user_id = requestData.target_user_id.trim();
      }
      
      addDiagnostic('VALIDATION', 'success', 'Validation passed', {
        title: requestData.title,
        targetUser: requestData.target_user_id,
        hasEmail: !!requestData.email,
        type: requestData.notification_type || 'system'
      });

      addDiagnostic('BACKEND_API', 'pending', 'Sending to backend API', {
        url: 'http://localhost:5000/api/notifications/send',
        method: 'POST',
        payload: {
          title: requestData.title,
          body: requestData.body,
          target_user_id: requestData.target_user_id,
          notification_type: requestData.notification_type || 'system',
          email: requestData.email,
          redirect_url: requestData.redirect_url,
          data: requestData.data || {},
          _requestId: requestId,
          _source: 'NotificationSystem'
        }
      });

      const apiStartTime = Date.now();
      const response = await fetch('http://localhost:5000/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          title: requestData.title,
          body: requestData.body,
          target_user_id: requestData.target_user_id,
          notification_type: requestData.notification_type || 'system',
          email: requestData.email,
          redirect_url: requestData.redirect_url,
          data: requestData.data || {},
          _requestId: requestId,
          _source: 'NotificationSystem'
        })
      });

      const apiDuration = Date.now() - apiStartTime;
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        addDiagnostic('BACKEND_API', 'error', `Backend API failed (${response.status})`, {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          duration: apiDuration
        });
        
        throw new Error(`Backend error ${response.status}: ${errorData.message || 'Unknown error'}`);
      }

      const backendResult: BackendResponse = await response.json();
      
      addDiagnostic('BACKEND_API', 'success', 'Backend API call successful', {
        duration: apiDuration,
        response: backendResult
      });

      addDiagnostic('PROCESS_RESULTS', 'pending', 'Processing backend response');
      
      const channelsUsed: string[] = [];
      const results: any = {};
      
      if (backendResult.results?.email?.success) {
        channelsUsed.push('email');
        addDiagnostic('EMAIL_SERVICE', 'success', 'Email sent successfully', {
          to: requestData.email,
          success: true
        });
      } else if (backendResult.results?.email) {
        addDiagnostic('EMAIL_SERVICE', 'error', 'Email failed', {
          error: backendResult.results.email.error
        });
      }
      
      if (backendResult.results?.onesignal?.success) {
        channelsUsed.push('onesignal');
        addDiagnostic('ONESIGNAL_PUSH', 'success', 'OneSignal push sent successfully', {
          sent: backendResult.results.onesignal.sent,
          failed: backendResult.results.onesignal.failed
        });
      } else if (backendResult.results?.onesignal) {
        addDiagnostic('ONESIGNAL_PUSH', 'error', 'OneSignal push failed', {
          error: backendResult.results.onesignal.error
        });
      }
      
      if (backendResult.notificationId) {
        addDiagnostic('DATABASE_WRITE', 'success', 'Notification saved to database', {
          notificationId: backendResult.notificationId
        });
      }
      
      if (backendResult.success) {
        const newNotification: Notification = {
          id: backendResult.notificationId || `ns_${Date.now()}`,
          title: requestData.title,
          body: requestData.body,
          notification_type: requestData.notification_type || 'system',
          read: false,
          created_at: new Date().toISOString(),
          redirect_url: requestData.redirect_url,
          data: requestData.data,
          sent_via: channelsUsed
        };
        
        setNotifications(prev => [newNotification, ...prev.slice(0, maxNotifications - 1)]);
        setUnreadCount(prev => prev + 1);
        
        addDiagnostic('LOCAL_UPDATE', 'success', 'Local notification state updated', {
          channels: channelsUsed,
          unreadCount: unreadCount + 1
        });
      }
      
      const totalDuration = Date.now() - startTime;
      const responseData = {
        success: backendResult.success,
        message: backendResult.message || 'Notification processed',
        notificationId: backendResult.notificationId,
        backendResponse: backendResult,
        timestamp: new Date().toISOString(),
        channels: channelsUsed,
        duration: totalDuration,
        diagnostics: diagnostics.slice(0, 10)
      };
      
      window.dispatchEvent(new CustomEvent('notificationResponse', { 
        detail: responseData 
      }));
      
      addDiagnostic('RESPONSE_SENT', 'success', 'Response sent to TestNotification', {
        duration: totalDuration,
        channels: channelsUsed
      });

      addDiagnostic('PROCESS_COMPLETE', 'success', '✅ NOTIFICATION PROCESS COMPLETE', {
        totalDuration,
        steps: [
          '✅ Request received',
          '✅ Validation passed',
          '✅ Backend API called',
          '✅ Results processed',
          '✅ Local state updated',
          '✅ Response sent'
        ]
      });

      return responseData;

    } catch (error: any) {
      const totalDuration = Date.now() - startTime;
      
      addDiagnostic('PROCESS_FAILED', 'error', '❌ NOTIFICATION PROCESS FAILED', {
        error: error.message,
        stack: error.stack,
        duration: totalDuration
      });
      
      const errorResponse = {
        success: false,
        message: 'Notification processing failed',
        error: error.message,
        timestamp: new Date().toISOString(),
        channels: [],
        duration: totalDuration,
        diagnostics: diagnostics.slice(-5)
      };
      
      window.dispatchEvent(new CustomEvent('notificationResponse', { 
        detail: errorResponse 
      }));
      
      return errorResponse;
    } finally {
      setProcessingRequest(null);
    }
  }, [addDiagnostic, diagnostics, maxNotifications, unreadCount]);

  // ==================== EVENT LISTENER FOR NOTIFICATION REQUESTS ====================
  useEffect(() => {
    const handleNotificationRequest = (event: Event) => {
      const customEvent = event as CustomEvent<NotificationRequestData>;
      const requestData = customEvent.detail;
      
      if (!requestData) {
        addDiagnostic('EVENT_ERROR', 'error', 'Received invalid event data');
        return;
      }
      
      if (notificationProcessingActive) {
        addDiagnostic('EVENT_QUEUED', 'warning', 'Another notification is processing, queuing request');
        setTimeout(() => handleNotificationRequest(event), 1000);
        return;
      }
      
      notificationProcessingActive = true;
      
      processNotificationRequest(requestData).finally(() => {
        notificationProcessingActive = false;
      });
    };
    
    window.addEventListener('sendNotification', handleNotificationRequest);
    
    return () => {
      window.removeEventListener('sendNotification', handleNotificationRequest);
    };
  }, [processNotificationRequest, addDiagnostic]);

  // ==================== SAFE ONE SIGNAL INITIALIZATION ====================
  const initializeOneSignalSafely = useCallback(async () => {
    const startTime = Date.now();
    
    try {
      if (oneSignalInitialized) {
        addDiagnostic('ONESIGNAL_INIT', 'warning', 'OneSignal already initialized elsewhere');
        setPushStatus('active');
        return true;
      }

      if ((window as any).OneSignal && (window as any).OneSignal.initialized) {
        addDiagnostic('ONESIGNAL_CHECK', 'info', 'OneSignal SDK already loaded via CDN');
        oneSignalInitialized = true;
        setPushStatus('active');
        return true;
      }

      setPushStatus('checking');
      addDiagnostic('ONESIGNAL_INIT', 'pending', 'Starting OneSignal initialization');

      const user = auth.currentUser;
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';

      const initConfig = {
        appId: '8871d2ef-7cda-486e-b53b-53964c531d49',
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/' },
        safari_web_id: 'web.onesignal.auto.xxx',
      };

      if (isLocalhost) {
        Object.assign(initConfig, {
          allowLocalhostAsSecureOrigin: true,
        });
        addDiagnostic('LOCALHOST_CONFIG', 'info', 'Localhost detected, enabling secure origin');
      }

      addDiagnostic('ONESIGNAL_SDK', 'pending', 'Calling OneSignal.init()');
      await OneSignal.init(initConfig);
      
      oneSignalInitialized = true;
      addDiagnostic('ONESIGNAL_SDK', 'success', 'OneSignal SDK initialized successfully');

      // FIXED: Directly associate user after initialization (production approach)
      if (user?.uid) {
        try {
          // Direct call to associate user - no event listener complexity
          await OneSignal.login(user.uid);
          addDiagnostic('USER_ID_SET', 'success', `External ID set via login(): ${user.uid}`);
          
          // Run the full check to verify
          await checkAndAssociateOneSignalUser(user.uid);
          setUserIdCheckComplete(true);
        } catch (loginError: any) {
          addDiagnostic('USER_ID_SET', 'error', `login() failed initially: ${loginError.message}`);
          // Don't fail the whole initialization - user ID can be set later
        }
      }

      const currentPermission = Notification.permission;
      setPermission(currentPermission);
      addDiagnostic('PERMISSION_CHECK', 'info', `Current permission: ${currentPermission}`);

      setupOneSignalListeners();
      
      if (currentPermission === 'default' && isLocalhost) {
        try {
          await OneSignal.Slidedown.promptPush();
          addDiagnostic('PERMISSION_PROMPT', 'success', 'Shown permission prompt to user');
        } catch (promptError: any) {
          addDiagnostic('PERMISSION_PROMPT', 'warning', `Permission prompt skipped: ${promptError.message}`);
        }
      }

      setPushStatus('active');
      const duration = Date.now() - startTime;
      addDiagnostic('ONESIGNAL_COMPLETE', 'success', '🎉 OneSignal setup complete', {
        duration,
        user: user?.uid,
        permission: currentPermission,
        localhost: isLocalhost
      });
      return true;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      addDiagnostic('ONESIGNAL_FAILED', 'error', `OneSignal initialization failed: ${error.message}`, {
        duration,
        error: error.message
      });
      setPushStatus('failed');
      return false;
    }
  }, [addDiagnostic, checkAndAssociateOneSignalUser]);

  // ==================== SETUP EVENT LISTENERS ====================
  const setupOneSignalListeners = useCallback(() => {
    try {
      OneSignal.Notifications.addEventListener('click', (event: any) => {
        const notification = event.notification;
        addDiagnostic('PUSH_CLICK', 'info', `Push notification clicked: ${notification?.title}`);
        
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

      OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
        const notification = event.notification;
        addDiagnostic('PUSH_DISPLAY', 'info', `Push notification displayed: ${notification?.title}`);
      });

      addDiagnostic('EVENT_LISTENERS', 'success', 'OneSignal event listeners setup complete');
    } catch (error: any) {
      addDiagnostic('EVENT_LISTENERS', 'error', `Error setting up listeners: ${error.message}`);
    }
  }, [addDiagnostic, maxNotifications]);

  // ==================== LOAD NOTIFICATIONS FROM BACKEND ====================
  const loadNotifications = useCallback(async () => {
    const startTime = Date.now();
    
    try {
      const user = auth.currentUser;
      if (!user) {
        addDiagnostic('LOAD_NOTIFICATIONS', 'warning', 'No user logged in, skipping notification load');
        setLoading(false);
        return;
      }
      
      addDiagnostic('LOAD_NOTIFICATIONS', 'pending', `Loading notifications for user: ${user.uid}`);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`target_user_id.eq.${user.uid},receiver_id.eq.${user.uid}`)
        .order('created_at', { ascending: false })
        .limit(maxNotifications);
      
      if (error) {
        addDiagnostic('LOAD_NOTIFICATIONS', 'error', `Error loading notifications: ${error.message}`);
        return;
      }
      
      const validNotifications = (data || []).filter((n): n is Notification => 
        n && n.id && n.title && n.body
      );
      
      const duration = Date.now() - startTime;
      addDiagnostic('LOAD_NOTIFICATIONS', 'success', `Loaded ${validNotifications.length} notifications`, {
        duration,
        count: validNotifications.length
      });
      
      setNotifications(validNotifications);
      
      const unread = validNotifications.filter(n => !n.read).length;
      setUnreadCount(unread);
      
    } catch (error: any) {
      addDiagnostic('LOAD_NOTIFICATIONS', 'error', `Error in loadNotifications: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [maxNotifications, addDiagnostic]);

  // ==================== REAL-TIME NOTIFICATION LISTENER ====================
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    
    addDiagnostic('REALTIME_SETUP', 'pending', 'Setting up real-time notification listener');
    
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
            addDiagnostic('REALTIME_INSERT', 'info', `Real-time: New notification: ${newNotification.title}`);
            
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
            addDiagnostic('REALTIME_ERROR', 'error', `Error handling real-time notification: ${error}`);
          }
        }
      )
      .subscribe();
    
    addDiagnostic('REALTIME_SETUP', 'success', 'Real-time listener active');
    
    return () => {
      addDiagnostic('REALTIME_CLEANUP', 'info', 'Cleaning up real-time listener');
      supabase.removeChannel(channel);
    };
  }, [maxNotifications, permission, addDiagnostic]);

  // ==================== SHOW BROWSER NOTIFICATION ====================
  const showBrowserNotification = (notification: Notification) => {
    if (!('Notification' in window) || permission !== 'granted') {
      addDiagnostic('BROWSER_NOTIFY', 'warning', 'Browser notifications not available or permission denied');
      return;
    }
    
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
      
      addDiagnostic('BROWSER_NOTIFY', 'success', `Browser notification shown: ${notification.title}`);
      
    } catch (error) {
      addDiagnostic('BROWSER_NOTIFY', 'error', `Error showing browser notification: ${error}`);
    }
  };

  // ==================== AUTH & INITIALIZATION ====================
  useEffect(() => {
    addDiagnostic('AUTH_SETUP', 'pending', 'Setting up auth state listener');
    
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        addDiagnostic('AUTH_CHANGE', 'info', `User logged in: ${user.uid}`);
        
        await loadNotifications();
        
        if (autoInitialize && pushStatus === 'idle') {
          await initializeOneSignalSafely();
        }
        
        // FIXED: Run user ID check after auth and initialization
        if (oneSignalInitialized && !userIdCheckComplete) {
          try {
            const result = await checkAndAssociateOneSignalUser(user.uid);
            setUserIdCheckComplete(result);
          } catch (error) {
            addDiagnostic('USER_ID_CHECK', 'error', `Failed to run user ID check in auth effect: ${error}`);
            setUserIdCheckComplete(false);
          }
        }
        
      } else {
        addDiagnostic('AUTH_CHANGE', 'info', 'User logged out');
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        setUserIdCheckComplete(false);
      }
    });
    
    addDiagnostic('AUTH_SETUP', 'success', 'Auth listener active');
    
    return () => {
      addDiagnostic('AUTH_CLEANUP', 'info', 'Cleaning up auth listener');
      unsubscribe();
    };
  }, [autoInitialize, loadNotifications, initializeOneSignalSafely, pushStatus, addDiagnostic, checkAndAssociateOneSignalUser, userIdCheckComplete]);

  // ==================== NOTIFICATION ACTIONS ====================
  const markAsRead = async (notificationId: string) => {
    const startTime = Date.now();
    
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      addDiagnostic('MARK_READ', 'pending', `Marking notification as read: ${notificationId}`);
      
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
      
      const duration = Date.now() - startTime;
      addDiagnostic('MARK_READ', 'success', `Marked as read: ${notificationId}`, { duration });
      
    } catch (error: any) {
      addDiagnostic('MARK_READ', 'error', `Error marking as read: ${error.message}`);
    }
  };

  const markAllAsRead = async () => {
    const startTime = Date.now();
    
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      addDiagnostic('MARK_ALL_READ', 'pending', 'Marking all notifications as read');
      
      await supabase
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .or(`target_user_id.eq.${user.uid},receiver_id.eq.${user.uid}`);
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      
      const duration = Date.now() - startTime;
      addDiagnostic('MARK_ALL_READ', 'success', 'Marked all notifications as read', { 
        duration,
        count: notifications.length
      });
      
    } catch (error: any) {
      addDiagnostic('MARK_ALL_READ', 'error', `Error marking all as read: ${error.message}`);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      addDiagnostic('DELETE_NOTIFICATION', 'pending', `Deleting notification: ${notificationId}`);
      
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
      
      addDiagnostic('DELETE_NOTIFICATION', 'success', `Deleted notification: ${notificationId}`);
      
    } catch (error: any) {
      addDiagnostic('DELETE_NOTIFICATION', 'error', `Error deleting notification: ${error.message}`);
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
      addDiagnostic('REQUEST_PERMISSION', 'pending', 'Manually requesting push permission');
      
      if (!(window as any).OneSignal) {
        await initializeOneSignalSafely();
      }
      
      await OneSignal.Slidedown.promptPush();
      addDiagnostic('REQUEST_PERMISSION', 'success', 'Permission requested from user');
      
    } catch (error: any) {
      addDiagnostic('REQUEST_PERMISSION', 'error', `Error requesting permission: ${error.message}`);
    }
  };

  const clearDebugLogs = () => {
    setDebugLogs([]);
  };

  const clearDiagnostics = () => {
    setDiagnostics([]);
    diagnosticLogs.length = 0;
  };

  // ==================== RENDER ====================
  if (loading && notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-system">
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
            {processingRequest && (
              <span className="processing-indicator" title="Processing notification">
                <Loader size={12} className="spin" />
              </span>
            )}
          </button>

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
                  {processingRequest && (
                    <span className="processing-status">
                      <Loader size={12} className="spin" /> Processing
                    </span>
                  )}
                  <span className={`user-id-check ${userIdCheckComplete ? 'complete' : 'pending'}`}>
                    ID Check: {userIdCheckComplete ? '✅' : '⏳'}
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
              <details className="diagnostic-section">
                <summary>Diagnostic Information</summary>
                <div className="diagnostic-grid">
                  <div className="diagnostic-item">
                    <span className="diagnostic-label">Push Status:</span>
                    <span className={`diagnostic-value ${pushStatus}`}>{pushStatus}</span>
                  </div>
                  <div className="diagnostic-item">
                    <span className="diagnostic-label">Permission:</span>
                    <span className={`diagnostic-value ${permission}`}>{permission}</span>
                  </div>
                  <div className="diagnostic-item">
                    <span className="diagnostic-label">User ID:</span>
                    <span className="diagnostic-value">
                      {auth.currentUser?.uid?.substring(0, 12) || 'Not logged in'}
                    </span>
                  </div>
                  <div className="diagnostic-item">
                    <span className="diagnostic-label">ID Check:</span>
                    <span className={`diagnostic-value ${userIdCheckComplete ? 'success' : 'pending'}`}>
                      {userIdCheckComplete ? 'Complete ✅' : 'Pending ⏳'}
                    </span>
                  </div>
                  <div className="diagnostic-item">
                    <span className="diagnostic-label">Hostname:</span>
                    <span className="diagnostic-value">
                      {window.location.hostname}
                    </span>
                  </div>
                  <div className="diagnostic-item">
                    <span className="diagnostic-label">OneSignal:</span>
                    <span className={`diagnostic-value ${oneSignalInitialized ? 'success' : 'error'}`}>
                      {oneSignalInitialized ? 'Initialized ✅' : 'Not initialized ❌'}
                    </span>
                  </div>
                  <div className="diagnostic-item">
                    <span className="diagnostic-label">Backend URL:</span>
                    <span className="diagnostic-value">
                      http://localhost:5000/api/notifications/send
                    </span>
                  </div>
                </div>
                
                <div className="diagnostic-logs">
                  <div className="diagnostic-logs-header">
                    <h5>Diagnostic Logs</h5>
                    <div className="diagnostic-actions">
                      <button onClick={clearDebugLogs} className="clear-btn">
                        Clear Debug
                      </button>
                      <button onClick={clearDiagnostics} className="clear-btn">
                        Clear Diagnostics
                      </button>
                    </div>
                  </div>
                  <div className="diagnostic-logs-content">
                    {diagnostics.length === 0 ? (
                      <p className="no-logs">No diagnostic logs yet</p>
                    ) : (
                      diagnostics.map((log) => (
                        <div key={log.id} className={`diagnostic-log ${log.status}`}>
                          <span className="log-time">[{log.timestamp}]</span>
                          <span className={`log-status ${log.status}`}>
                            {log.status === 'success' ? '✅' : 
                             log.status === 'error' ? '❌' : 
                             log.status === 'warning' ? '⚠️' : 
                             log.status === 'pending' ? '⏳' : 'ℹ️'}
                          </span>
                          <span className="log-step">{log.step}:</span>
                          <span className="log-message">{log.message}</span>
                          {log.duration && (
                            <span className="log-duration">({log.duration}ms)</span>
                          )}
                          {log.details && (
                            <button 
                              className="log-details-btn"
                              onClick={() => console.log('Details:', log.details)}
                              title="View details in console"
                            >
                              ...
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </details>

              <details className="debug-section">
                <summary>Debug Logs</summary>
                <div className="debug-logs">
                  <div className="debug-logs-header">
                    <h5>Raw Debug Logs</h5>
                    <button onClick={clearDebugLogs} className="clear-btn">
                      Clear
                    </button>
                  </div>
                  <div className="debug-logs-content">
                    {debugLogs.length === 0 ? (
                      <p className="no-logs">No debug logs yet</p>
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
              <div className="system-info">
                <div className="info-row">
                  <div className="info-item">
                    <Database size={12} />
                    <span>Supabase: Connected</span>
                  </div>
                  <div className="info-item">
                    <Send size={12} />
                    <span>Backend: localhost:5000</span>
                  </div>
                  <div className="info-item">
                    <Server size={12} />
                    <span>OneSignal: {oneSignalInitialized ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="info-item">
                    <Wifi size={12} />
                    <span>Realtime: Active</span>
                  </div>
                  <div className="info-item">
                    <Check size={12} />
                    <span>ID Check: {userIdCheckComplete ? 'Complete' : 'Pending'}</span>
                  </div>
                </div>
                <div className="push-info">
                  <p>
                    <strong>Push Status:</strong>
                    <span className={`status ${pushStatus === 'active' ? 'connected' : 'disconnected'}`}>
                      {pushStatus === 'active' ? '✅ Active' : '❌ Enable for instant alerts'}
                    </span>
                  </p>
                  <p className="init-info">
                    <small>Notification processing: {notificationProcessingActive ? 'Active' : 'Idle'}</small>
                    <small> • User ID association: {userIdCheckComplete ? 'Complete' : 'Pending'}</small>
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