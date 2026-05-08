// ============================================
// notificationService.ts - Direct OneSignal integration
// ============================================

export interface NotificationRequest {
  title: string;
  body: string;
  target_user_id?: string;        // Single user
  target_user_ids?: string[];      // Multiple users
  email?: string;                  // Single email
  email_list?: string[];           // Multiple emails
  notification_type?: 'order' | 'chat' | 'system' | 'vendor' | 'promotion';
  redirect_url?: string;
  data?: Record<string, any>;
  imageUrl?: string;
}

export interface PushResult {
  success: boolean;
  count: number;
  error?: string;
  response?: any;
}

export interface EmailResult {
  success: boolean;
  count: number;
  error?: string;
}

export interface NotificationResponse {
  success: boolean;
  message: string;
  channels: string[];
  notificationId?: string;
  targetUsers?: number;
  emails?: number;
  error?: string;
  timestamp: string;
  results?: {
    push?: PushResult;
    email?: EmailResult;
  };
}

class NotificationService {
  private static instance: NotificationService;
  private backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000' // Your backend URL for emails only
  
  // OneSignal direct configuration
  private onesignalAppId = '8871d2ef-7cda-486e-b53b-53964c531d49';
  private onesignalApiKey = 'os_v2_app_rby5f3343jeg5nj3koleyuy5jhakz2afmpausi5ukse5f6sckn5c3x7runtpvrxa27hmgyhbpo2mvryd2lx2qwgskpmpkteigrgsvbq';

  private constructor() {
    console.log('🔧 NotificationService initialized with direct OneSignal');
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Main method to send notifications
   * Push: Direct to OneSignal API
   * Email: Through backend
   */
  async sendNotification(request: NotificationRequest): Promise<NotificationResponse> {
    console.log('📨 NotificationService received request:', request);

    const startTime = Date.now();
    const channels: string[] = [];
    
    let pushResult: PushResult | undefined;
    let emailResult: EmailResult | undefined;

    try {
      // Validate request
      if (!request.title || !request.body) {
        throw new Error('Title and body are required');
      }

      // Extract target users
      const targetUserIds: string[] = [];
      if (request.target_user_ids && Array.isArray(request.target_user_ids)) {
        targetUserIds.push(...request.target_user_ids);
      } else if (request.target_user_id) {
        targetUserIds.push(request.target_user_id);
      }

      // Extract emails
      const emailList: string[] = [];
      if (request.email_list && Array.isArray(request.email_list)) {
        emailList.push(...request.email_list);
      } else if (request.email) {
        emailList.push(request.email);
      }

      if (targetUserIds.length === 0 && emailList.length === 0) {
        throw new Error('No recipients specified');
      }

      // ============ SEND PUSH NOTIFICATIONS DIRECT TO ONESIGNAL ============
      if (targetUserIds.length > 0) {
        console.log(`📱 Sending push to ${targetUserIds.length} user(s) via direct OneSignal API`);
        
        try {
          // Prepare OneSignal payload exactly as in your working curl command
          const onesignalPayload = {
            app_id: this.onesignalAppId,
            include_aliases: {
              external_id: targetUserIds
            },
            target_channel: 'push',
            contents: {
              en: request.body
            },
            headings: {
              en: request.title
            },
            ...(request.redirect_url && { url: request.redirect_url }),
            ...(request.data && { data: request.data })
          };

          console.log('📤 OneSignal payload:', JSON.stringify(onesignalPayload, null, 2));

          // Call OneSignal API directly
          const pushResponse = await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: {
              'Authorization': `Key ${this.onesignalApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(onesignalPayload)
          });

          const responseData = await pushResponse.json();
          
          if (pushResponse.ok) {
            pushResult = {
              success: true,
              count: targetUserIds.length,
              response: responseData
            };
            channels.push('onesignal');
            console.log('✅ OneSignal push successful:', responseData);
          } else {
            pushResult = {
              success: false,
              count: 0,
              error: JSON.stringify(responseData),
              response: responseData
            };
            console.error('❌ OneSignal push failed:', responseData);
          }
        } catch (pushError: any) {
          console.error('❌ OneSignal push exception:', pushError);
          pushResult = {
            success: false,
            count: 0,
            error: pushError.message
          };
        }
      }

      // ============ SEND EMAIL NOTIFICATIONS VIA BACKEND ============
      if (emailList.length > 0) {
        console.log(`📧 Sending email to ${emailList.length} recipient(s) via backend`);
        
        try {
          const emailResponse = await fetch(`${this.backendUrl}/api/notifications/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              title: request.title,
              body: request.body,
              receiver_ids: targetUserIds, 
              notification_type: request.notification_type || 'system',
              email_list: emailList,
              redirect_url: request.redirect_url,
              data: request.data || {}
            })
          });

          if (emailResponse.ok) {
            const emailResultData = await emailResponse.json();
            emailResult = {
              success: true,
              count: emailList.length
            };
            channels.push('email');
            console.log(`✅ Email: ${emailList.length} emails sent successfully`);
          } else {
            const errorText = await emailResponse.text();
            emailResult = {
              success: false,
              count: 0,
              error: `HTTP ${emailResponse.status}: ${errorText}`
            };
            console.error('❌ Email failed:', errorText);
          }
        } catch (emailError: any) {
          console.error('❌ Email error:', emailError);
          emailResult = {
            success: false,
            count: 0,
            error: emailError.message
          };
        }
      }

      // Build response
      const response: NotificationResponse = {
        success: channels.length > 0,
        message: channels.length > 0 
          ? `Notification sent via ${channels.join(', ')}` 
          : 'Failed to send via any channel',
        channels,
        targetUsers: targetUserIds.length,
        emails: emailList.length,
        timestamp: new Date().toISOString()
      };

      if (pushResult || emailResult) {
        response.results = {};
        if (pushResult) response.results.push = pushResult;
        if (emailResult) response.results.email = emailResult;
      }

      if (response.success) {
        response.notificationId = `notif_${Date.now()}`;
      }

      console.log(`✅ NotificationService completed in ${Date.now() - startTime}ms`, response);
      return response;

    } catch (error: any) {
      console.error('❌ NotificationService error:', error);
      
      return {
        success: false,
        message: error.message,
        channels: [],
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Helper to check OneSignal subscription status
   */
  async checkUserPushStatus(userId: string): Promise<boolean> {
    try {
      // You could implement this by calling OneSignal API to check subscription
      // For now, return true as we're sending directly
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send a test notification (convenience method)
   */
  async sendTestNotification(
    title: string, 
    body: string, 
    targets: { users?: string[], emails?: string[] }
  ): Promise<NotificationResponse> {
    return this.sendNotification({
      title,
      body,
      target_user_ids: targets.users,
      email_list: targets.emails,
      notification_type: 'system',
      data: { test: true }
    });
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();