import { sendbirdService } from './sendbirdService';
import { auth } from '../lib/firebase';

class CallService {
  async initiateCall(targetUserId: string, isVideo: boolean): Promise<boolean> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      
      await sendbirdService.init(user.uid);
      const call = await sendbirdService.makeCall(targetUserId, isVideo);
      
      if (call) {
        window.location.href = `/call/${targetUserId}`;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Call failed:', error);
      return false;
    }
  }
}

export const callService = new CallService();