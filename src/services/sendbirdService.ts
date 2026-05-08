import SendBird from 'sendbird';
import SendBirdCall, { DirectCall } from 'sendbird-calls';

const APP_ID = 'EAD39A85-9AE6-4F29-BA11-2395C28A279B';

class SendbirdService {
  private static instance: SendbirdService;
  private sb: any = null;
  private currentUser: any = null;
  private currentCall: DirectCall | null = null;
  private initPromise: Promise<boolean> | null = null;
  private pendingIncomingCall: DirectCall | null = null;
  
  public onIncomingCall: (call: DirectCall) => void = () => {};

  public static getInstance(): SendbirdService {
    if (!SendbirdService.instance) {
      SendbirdService.instance = new SendbirdService();
    }
    return SendbirdService.instance;
  }

  async init(userId: string): Promise<boolean> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise(async (resolve) => {
      try {
        console.log('🟡 Initializing Sendbird for user:', userId);
        
        this.sb = new SendBird({ appId: APP_ID });
        
        await new Promise((res, rej) => {
          this.sb.connect(userId, null, (user: any, error: any) => {
            if (error) {
              console.error('❌ Chat connection failed:', error);
              rej(error);
            } else {
              console.log('✅ Chat connected:', user.userId);
              this.currentUser = user;
              res(user);
            }
          });
        });

        SendBirdCall.init(APP_ID);
        
        await new Promise((res, rej) => {
          SendBirdCall.authenticate({ userId }, (result: any, error: any) => {
            if (error) {
              console.error('❌ Call auth failed:', error);
              rej(error);
            } else {
              console.log('✅ Call auth successful');
              res(result);
            }
          });
        });
        
        await SendBirdCall.connectWebSocket();
        console.log('✅ WebSocket connected');
        
        this.setupCallListeners();
        
        console.log('✅ Sendbird fully initialized');
        resolve(true);
      } catch (error) {
        console.error('❌ Init failed:', error);
        resolve(false);
      }
    });
    
    return this.initPromise;
  }

  private setupCallListeners() {
    SendBirdCall.removeListener('UNIQUE_HANDLER_ID');
    
    SendBirdCall.addListener('UNIQUE_HANDLER_ID', {
      onRinging: (call: DirectCall) => {
        console.log('📞 Incoming call from:', call.caller?.userId);
        this.currentCall = call;
        this.setPendingIncomingCall(call);
        this.onIncomingCall(call);
      }
    });
  }

  setPendingIncomingCall(call: DirectCall) {
    console.log('📞 Storing pending incoming call from:', call.caller?.userId);
    this.pendingIncomingCall = call;
  }

  getPendingIncomingCall(): DirectCall | null {
    const call = this.pendingIncomingCall;
    if (call) {
      console.log('📞 Retrieving pending incoming call');
      this.pendingIncomingCall = null;
    }
    return call;
  }

  async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('✅ Microphone permission granted');
      return true;
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      return false;
    }
  }

  async makeCall(calleeId: string, video: boolean): Promise<DirectCall | null> {
    try {
      console.log(`📤 Making ${video ? 'video' : 'voice'} call to:`, calleeId);
      
      // For voice calls, ensure microphone permission first
      if (!video) {
        const hasPermission = await this.requestMicrophonePermission();
        if (!hasPermission) {
          throw new Error('Microphone access required for voice calls');
        }
      }
      
      const localVideoEl = document.getElementById('local-video') as HTMLVideoElement;
      const remoteVideoEl = document.getElementById('remote-video') as HTMLVideoElement;
      
      const call = await SendBirdCall.dial({
        userId: calleeId,
        isVideoCall: video,
        callOption: { 
          audioEnabled: true, 
          videoEnabled: video,
          localMediaView: video ? localVideoEl : undefined,
          remoteMediaView: video ? remoteVideoEl : undefined
        }
      });
      
      console.log('✅ Call initiated successfully:', call.callId);
      this.currentCall = call;
      return call;
    } catch (error) {
      console.error('❌ Call failed:', error);
      return null;
    }
  }

  async acceptCall(call: DirectCall, video: boolean): Promise<void> {
    try {
      console.log('✅ Accepting call:', call.callId);
      
      // For voice calls, ensure microphone permission first
      if (!video) {
        const hasPermission = await this.requestMicrophonePermission();
        if (!hasPermission) {
          throw new Error('Microphone access required to answer call');
        }
      }
      
      const localVideoEl = document.getElementById('local-video') as HTMLVideoElement;
      const remoteVideoEl = document.getElementById('remote-video') as HTMLVideoElement;
      
      await call.accept({
        callOption: { 
          audioEnabled: true, 
          videoEnabled: video,
          localMediaView: video ? localVideoEl : undefined,
          remoteMediaView: video ? remoteVideoEl : undefined
        }
      });
      
      console.log('✅ Call accepted successfully');
    } catch (error) {
      console.error('❌ Accept failed:', error);
      throw error;
    }
  }

  async endCall(call: DirectCall): Promise<void> {
    try {
      console.log('❌ Ending call:', call?.callId);
      if (call) {
        await call.end();
      }
      this.currentCall = null;
      this.pendingIncomingCall = null;
    } catch (error) {
      console.error('❌ End call failed:', error);
    }
  }

  async logout(): Promise<void> {
    try {
      console.log('🔄 Logging out from Sendbird');
      
      if (this.currentCall) {
        await this.endCall(this.currentCall);
      }
      
      if (this.sb) {
        await this.sb.disconnect();
      }
      
      SendBirdCall.deauthenticate();
      SendBirdCall.removeListener('UNIQUE_HANDLER_ID');
      
      this.currentUser = null;
      this.currentCall = null;
      this.pendingIncomingCall = null;
      this.initPromise = null;
      
      console.log('✅ Sendbird logged out');
    } catch (error) {
      console.error('❌ Logout failed:', error);
    }
  }

  getCurrentCall(): DirectCall | null {
    return this.currentCall;
  }

  getCurrentUser(): any {
    return this.currentUser;
  }

  isInCall(): boolean {
    return this.currentCall !== null && !this.currentCall.isEnded;
  }
}

export const sendbirdService = SendbirdService.getInstance();