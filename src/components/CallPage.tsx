import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { sendbirdService } from '../services/sendbirdService';
import { supabase } from '../lib/supabaseClient';
import './CallPage.css';

// Import audio files
import ringingSound from '../assets/audios/ringing.mp3';
import startSound from '../assets/audios/start.mp3';
import endSound from '../assets/audios/end.mp3';

const CallPage: React.FC = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('initializing');
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [incomingCallInfo, setIncomingCallInfo] = useState<any>(null);
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [otherPartyProfile, setOtherPartyProfile] = useState<{ name: string; avatar: string } | null>(null);
  const [myProfile, setMyProfile] = useState<{ name: string; avatar: string } | null>(null);
  const [callType, setCallType] = useState<'video' | 'voice'>('video');
  const [callDuration, setCallDuration] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const [callLogId, setCallLogId] = useState<string | null>(null);
  
  // Audio refs
  const ringingAudioRef = useRef<HTMLAudioElement | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const endAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const soundPlayedRef = useRef({ ringing: false, start: false, end: false });

  // ========== DATABASE FUNCTIONS ==========
  
  // Create call log (caller only)
  const createCallLog = async (callerId: string, calleeId: string, type: string) => {
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .insert([{
          caller_id: callerId,
          callee_id: calleeId,
          duration: 0,
          status: 'not_reachable',
          call_type: type
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating call log:', error);
        return null;
      }
      console.log('Call log created:', data.id);
      return data.id;
    } catch (error) {
      console.error('Error creating call log:', error);
      return null;
    }
  };

  // Update call log status and duration
  const updateCallLog = async (logId: string, status: string, duration?: number) => {
    if (!logId) return;
    try {
      const updateData: any = { status };
      if (duration !== undefined) {
        updateData.duration = duration;
      }
      await supabase
        .from('call_logs')
        .update(updateData)
        .eq('id', logId);
      console.log('Call log updated:', status, duration);
    } catch (error) {
      console.error('Error updating call log:', error);
    }
  };

  // Get the most recent call log where callee_id matches and status is not_reachable
  const getCallLogByCallee = async (calleeId: string) => {
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select('id')
        .eq('callee_id', calleeId)
        .eq('status', 'not_reachable')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        return null;
      }
      return data?.id || null;
    } catch (error) {
      return null;
    }
  };

  // Check call status from database
  const checkCallStatus = async () => {
    if (!callLogId) return;
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select('status, duration')
        .eq('id', callLogId)
        .single();
      
      if (error) return;
      
      // Update UI based on database status (does not interfere with normal call flow)
      if (data.status === 'not_reachable') {
        if (status !== 'connecting' && status !== 'ringing' && status !== 'calling') {
          setStatus('connecting');
        }
      } 
      else if (data.status === 'connected' && !timerStarted) {
        setTimerStarted(true);
        setStatus('connected');
        
        // Start timer
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
        
        // Stop ringing sound
        if (ringingAudioRef.current) {
          ringingAudioRef.current.pause();
          ringingAudioRef.current.currentTime = 0;
        }
        if (audioIntervalRef.current) {
          clearInterval(audioIntervalRef.current);
          audioIntervalRef.current = null;
        }
        
        // Play start sound
        startAudioRef.current?.play().catch(e => console.log('Start error:'));
      } 
      else if (data.status === 'completed' && timerStarted) {
        setTimerStarted(false);
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
        setStatus('completed');
        setTimeout(() => {
          navigate(-1);
        }, 1000);
      }
      else if (data.status === 'cancelled') {
        setStatus('cancelled');
        setTimeout(() => navigate(-1), 1000);
      }
      else if (data.status === 'declined') {
        setStatus('declined');
        setTimeout(() => navigate(-1), 1000);
      }
    } catch (error) {
      console.error('Error checking call status:', error);
    }
  };

  // Initialize audio
  useEffect(() => {
    ringingAudioRef.current = new Audio(ringingSound);
    startAudioRef.current = new Audio(startSound);
    endAudioRef.current = new Audio(endSound);

    if (ringingAudioRef.current) {
      ringingAudioRef.current.loop = true;
      ringingAudioRef.current.volume = 0.7;
    }
    if (startAudioRef.current) {
      startAudioRef.current.volume = 0.7;
    }
    if (endAudioRef.current) {
      endAudioRef.current.volume = 0.7;
    }

    return () => {
      if (ringingAudioRef.current) {
        ringingAudioRef.current.pause();
        ringingAudioRef.current = null;
      }
      if (startAudioRef.current) {
        startAudioRef.current.pause();
        startAudioRef.current = null;
      }
      if (endAudioRef.current) {
        endAudioRef.current.pause();
        endAudioRef.current = null;
      }
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
    };
  }, []);

  // Play sound based on status
  useEffect(() => {
    if (!ringingAudioRef.current) return;

    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }

    if (status === 'ringing') {
      const playRing = () => {
        if (ringingAudioRef.current && status === 'ringing') {
          ringingAudioRef.current.play().catch(e => console.log('🔊 Ringing retry...'));
        }
      };
      playRing();
      audioIntervalRef.current = setInterval(playRing, 2000);
      soundPlayedRef.current.ringing = true;
    } else if (ringingAudioRef.current) {
      ringingAudioRef.current.pause();
      ringingAudioRef.current.currentTime = 0;
      soundPlayedRef.current.ringing = false;
    }

    if (status === 'connected' && !soundPlayedRef.current.start) {
      if (ringingAudioRef.current) {
        ringingAudioRef.current.pause();
        ringingAudioRef.current.currentTime = 0;
      }
      startAudioRef.current?.play().catch(e => console.log('🔊 Start error:'));
      soundPlayedRef.current.start = true;
      soundPlayedRef.current.end = false;
    } else if (status === 'ended' && !soundPlayedRef.current.end) {
      if (ringingAudioRef.current) {
        ringingAudioRef.current.pause();
        ringingAudioRef.current.currentTime = 0;
      }
      if (startAudioRef.current) {
        startAudioRef.current.pause();
        startAudioRef.current.currentTime = 0;
      }
      endAudioRef.current?.play().catch(e => console.log('🔊 End error:'));
      soundPlayedRef.current.end = true;
      soundPlayedRef.current.start = false;
    }

    return () => {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
    };
  }, [status]);

  // Fetch user profile by Firebase UID
  const fetchUserProfile = async (uid: string) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('name, avatar_url')
        .eq('firebase_uid', uid)
        .maybeSingle();

      if (userData) {
        return {
          name: userData.name || 'User',
          avatar: userData.avatar_url || ''
        };
      }

      const { data: vendorData } = await supabase
        .from('vendor_profiles')
        .select('shop_name, profile_image')
        .eq('user_id', uid)
        .maybeSingle();

      if (vendorData) {
        return {
          name: vendorData.shop_name || 'Shop',
          avatar: vendorData.profile_image || ''
        };
      }

      return { name: uid.substring(0, 6), avatar: '' };
    } catch (error) {
      return { name: uid.substring(0, 6), avatar: '' };
    }
  };

  // Wait for auth
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (loggedInUser) => {
      if (loggedInUser) {
        setUser(loggedInUser);
        const profile = await fetchUserProfile(loggedInUser.uid);
        setMyProfile(profile);
        setStatus('idle');
      } else {
        setError('You must be logged in');
      }
    });
    return () => unsubscribe();
  }, []);

  // Initialize calls
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      await sendbirdService.init(user.uid);

      const pending = sendbirdService.getPendingIncomingCall();
      if (pending) {
        setCallType(pending.isVideoCall ? 'video' : 'voice');
        const profile = await fetchUserProfile(pending.caller?.userId);
        setOtherPartyProfile(profile);
        setIncomingCallInfo({
          callerId: pending.caller?.userId,
          call: pending
        });
        setStatus('ringing');
        
        // Get call log created by caller
        const logId = await getCallLogByCallee(user.uid);
        if (logId) {
          setCallLogId(logId);
          if (statusCheckIntervalRef.current) clearInterval(statusCheckIntervalRef.current);
          statusCheckIntervalRef.current = setInterval(checkCallStatus, 500);
        }
      }

      const originalHandler = sendbirdService.onIncomingCall;
      sendbirdService.onIncomingCall = async (incomingCall) => {
        setCallType(incomingCall.isVideoCall ? 'video' : 'voice');
        const profile = await fetchUserProfile(incomingCall.caller?.userId);
        setOtherPartyProfile(profile);
        setIncomingCallInfo({
          callerId: incomingCall.caller?.userId,
          call: incomingCall
        });
        setStatus('ringing');
        
        // Get call log created by caller
        const logId = await getCallLogByCallee(user.uid);
        if (logId) {
          setCallLogId(logId);
          if (statusCheckIntervalRef.current) clearInterval(statusCheckIntervalRef.current);
          statusCheckIntervalRef.current = setInterval(checkCallStatus, 500);
        }
      };

      return () => {
        sendbirdService.onIncomingCall = originalHandler;
      };
    };

    init();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  // Monitor call status
  useEffect(() => {
    if (!currentCall) return;

    intervalRef.current = setInterval(() => {
      if (currentCall.isOngoing) {
        setStatus('connected');
      } else if (currentCall.isEnded) {
        setStatus('ended');
        setCurrentCall(null);
      }
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentCall]);

  const startCallInternal = async (isVideo: boolean) => {
    if (!userId || !user) return;

    try {
      setStatus('calling');
      setCallType(isVideo ? 'video' : 'voice');
      
      const profile = await fetchUserProfile(userId);
      setOtherPartyProfile(profile);

      // ========== ADDED: Create call log (caller only) ==========
      const logId = await createCallLog(user.uid, userId, isVideo ? 'video' : 'voice');
      setCallLogId(logId);
      
      if (statusCheckIntervalRef.current) clearInterval(statusCheckIntervalRef.current);
      statusCheckIntervalRef.current = setInterval(checkCallStatus, 500);

      const call = await sendbirdService.makeCall(userId, isVideo);
      if (call) {
        setCurrentCall(call);
        
        if (isVideo) {
          if (localVideo.current) call.setLocalMediaView(localVideo.current);
          if (remoteVideo.current) call.setRemoteMediaView(remoteVideo.current);
        }
      } else {
        setError('Call failed - user may be offline');
        if (logId) updateCallLog(logId, 'failed');
      }
    } catch (err: any) {
      setError(err.message);
      if (callLogId) updateCallLog(callLogId, 'failed');
    }
  };

  const startVoiceCall = () => startCallInternal(false);
  const startVideoCall = () => startCallInternal(true);

  const answerCall = async () => {
    if (!incomingCallInfo?.call) return;

    try {
      const call = incomingCallInfo.call;
      
      // ========== ADDED: Update database status to connected ==========
      const logId = await getCallLogByCallee(user.uid);
      if (logId) {
        await updateCallLog(logId, 'connected');
        setCallLogId(logId);
      }
      
      await sendbirdService.acceptCall(call, callType === 'video');
      
      setCurrentCall(call);
      setIncomingCallInfo(null);
      
      if (callType === 'video') {
        if (localVideo.current) call.setLocalMediaView(localVideo.current);
        if (remoteVideo.current) call.setRemoteMediaView(remoteVideo.current);
      }
      
      setStatus('connected');
    } catch (err) {
      setError('Failed to answer call');
    }
  };

  const endCall = async () => {
    // ========== ADDED: Update database based on who ends ==========
    if (callLogId) {
      if (timerStarted) {
        // Call was connected, save as completed with duration
        await updateCallLog(callLogId, 'completed', callDuration);
      } else if (status === 'ringing') {
        // Callee ends before answering -> declined
        await updateCallLog(callLogId, 'declined', 0);
      } else if (status === 'calling') {
        // Caller ends before answer -> cancelled
        await updateCallLog(callLogId, 'cancelled', 0);
      }
    }
    
    // Stop timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    if (currentCall) {
      await sendbirdService.endCall(currentCall);
      setCurrentCall(null);
    } else if (incomingCallInfo?.call) {
      await sendbirdService.endCall(incomingCallInfo.call);
      setIncomingCallInfo(null);
    }
    
    setTimerStarted(false);
    setStatus('ended');
    setTimeout(() => navigate(-1), 500);
  };

  const goBack = () => {
    navigate(-1);
  };

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get UI status text
  const getUIStatus = () => {
    if (status === 'connecting') return 'Connecting...';
    if (status === 'connected') return 'Connected';
    if (status === 'completed') return 'Call ended';
    if (status === 'cancelled') return 'Call cancelled';
    if (status === 'declined') return 'Call declined';
    if (status === 'failed') return 'Call failed';
    if (status === 'ringing') return 'Incoming call...';
    if (status === 'calling') return 'Calling...';
    return status;
  };

  if (error) {
    return (
      <div className="callpage">
        <div className="callpage-box">
          <div className="callpage-err-icon">❌</div>
          <p className="callpage-err-msg">{error}</p>
          <button onClick={goBack} className="callpage-btn callpage-btn2">←</button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="callpage">
        <div className="callpage-box">⏳</div>
      </div>
    );
  }

  const displayProfile = (status === 'ringing' || status === 'calling' || status === 'connecting' || status === 'connected') ? otherPartyProfile : null;

  return (
    <div className="callpage">
      <div className="callpage-media">
        {callType === 'video' ? (
          <>
            <video ref={remoteVideo} autoPlay playsInline className="callpage-remote" />
            <video ref={localVideo} autoPlay playsInline muted className="callpage-local" />
          </>
        ) : (
          <div className="callpage-voice">
            <div className="callpage-avatar-lg">
              {displayProfile?.avatar ? (
                <img src={displayProfile.avatar} alt={displayProfile.name} />
              ) : (
                <span>{displayProfile?.name?.charAt(0) || '?'}</span>
              )}
            </div>
            <div className="callpage-voice-text">
              {status === 'ringing' ? `${displayProfile?.name || 'User'} is calling...` : 
               status === 'calling' ? `Calling ${displayProfile?.name || 'User'}...` :
               status === 'connecting' ? `Connecting to ${displayProfile?.name || 'User'}...` :
               status === 'connected' ? displayProfile?.name || 'Connected' : getUIStatus()}
            </div>
            {status === 'connected' && (
              <div className="callpage-duration">{formatDuration(callDuration)}</div>
            )}
          </div>
        )}
      </div>

      {callType === 'video' && displayProfile && (
        <div className="callpage-overlay">
          <div className="callpage-badge">
            {displayProfile.avatar ? (
              <img src={displayProfile.avatar} alt={displayProfile.name} className="callpage-avatar-sm" />
            ) : (
              <div className="callpage-avatar-placeholder-sm">{displayProfile.name?.charAt(0) || '?'}</div>
            )}
            <span>
              {status === 'ringing' ? `${displayProfile.name} is calling...` : 
               status === 'calling' ? `Calling ${displayProfile.name}...` :
               status === 'connecting' ? `Connecting to ${displayProfile.name}...` :
               displayProfile.name}
            </span>
            {status === 'connected' && (
              <span className="callpage-duration-sm">{formatDuration(callDuration)}</span>
            )}
          </div>
        </div>
      )}

      <div className="callpage-info">
        <div className="callpage-info-item">
          {myProfile?.avatar ? (
            <img src={myProfile.avatar} className="callpage-avatar-xs" alt="you" />
          ) : (
            <div className="callpage-avatar-placeholder-xs">{myProfile?.name?.charAt(0) || 'U'}</div>
          )}
          <span>{myProfile?.name || user?.uid?.substring(0, 6)}</span>
        </div>
        <div className={`callpage-badge-sm callpage-${status}`}>{getUIStatus()}</div>
        {status === 'connected' && (
          <div className="callpage-duration-sm">{formatDuration(callDuration)}</div>
        )}
        <div>{callType === 'video' ? '📹' : '📞'}</div>
      </div>

      <div className="callpage-actions">
        {userId && status === 'idle' && !incomingCallInfo && (
          <>
            <button onClick={startVoiceCall} className="callpage-btn callpage-btn1">📞 Voice</button>
            <button onClick={startVideoCall} className="callpage-btn callpage-btn2">📹 Video</button>
          </>
        )}

        {incomingCallInfo && (
          <>
            <button onClick={answerCall} className="callpage-btn callpage-btn-success">✅ Answer</button>
            <button onClick={endCall} className="callpage-btn callpage-btn-danger">❌ Decline</button>
          </>
        )}

        {(currentCall || incomingCallInfo) && (
          <button onClick={endCall} className="callpage-btn callpage-btn-danger">❌ End</button>
        )}

        <button onClick={goBack} className="callpage-btn callpage-btn2">←</button>
      </div>
    </div>
  );
};

export default CallPage;