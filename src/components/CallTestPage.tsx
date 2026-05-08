import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { callService } from '../services/callService';
import { sendbirdService } from '../services/sendbirdService';
import './CallTestPage.css';

const CallTestPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [targetUid, setTargetUid] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Auth state
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      if (user) {
        addLog(`✅ Logged in: ${user.uid.substring(0, 12)}...`);
      } else {
        addLog('❌ Not logged in - please login first');
      }
    });
    return unsub;
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  const makeCall = async (video: boolean) => {
    if (!currentUser) {
      addLog('❌ ERROR: You must be logged in');
      return;
    }
    if (!targetUid.trim()) {
      addLog('❌ ERROR: Enter target Firebase UID');
      return;
    }

    setIsLoading(true);
    addLog(`📞 Initiating ${video ? 'VIDEO' : 'VOICE'} call to: ${targetUid.substring(0, 12)}...`);

    try {
      // Direct call to callService
      const success = await callService.initiateCall(targetUid.trim(), video);
      
      if (success) {
        addLog(`✅ Call initiated successfully!`);
        addLog(`⏳ Waiting for ${targetUid.substring(0, 12)}... to answer...`);
        
        // ✅ FIX: Navigate to the new auto-start route
        navigate(`/call/${targetUid.trim()}/startcall`);
      } else {
        addLog(`❌ Call initiation failed - check console for details`);
      }
    } catch (err: any) {
      addLog(`❌ ERROR: ${err.message || 'Unknown error'}`);
      console.error('Call error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Test Sendbird connection
  const testConnection = async () => {
    if (!currentUser) {
      addLog('❌ Login first');
      return;
    }
    
    addLog('🔄 Testing Sendbird connection...');
    try {
      const initialized = await sendbirdService.init(currentUser.uid);
      if (initialized) {
        addLog('✅ Sendbird connected successfully');
      } else {
        addLog('❌ Sendbird connection failed');
      }
    } catch (err: any) {
      addLog(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div className="calltest-container">
      <div className="calltest-header">
        <button className="calltest-back" onClick={() => navigate(-1)}>←</button>
        <h2>📞 CALL TESTER</h2>
      </div>

      {/* User info card */}
      <div className="calltest-card">
        <div className="calltest-row">
          <span className="label">YOU:</span>
          <code className="value">
            {currentUser ? currentUser.uid.substring(0, 16) + '...' : 'NOT LOGGED IN'}
          </code>
        </div>
        
        <button 
          className="calltest-test-btn"
          onClick={testConnection}
          disabled={!currentUser}
        >
          🔌 Test Sendbird Connection
        </button>
      </div>

      {/* Target input card */}
      <div className="calltest-card">
        <label className="calltest-label">Target Firebase UID</label>
        <input
          className="calltest-input"
          type="text"
          value={targetUid}
          onChange={(e) => setTargetUid(e.target.value)}
          placeholder="Paste target user's Firebase UID"
          disabled={isLoading}
        />
        
        <div className="calltest-button-group">
          <button
            className="calltest-btn voice"
            onClick={() => makeCall(false)}
            disabled={isLoading || !targetUid.trim() || !currentUser}
          >
            {isLoading ? '⏳' : '📞'} VOICE CALL
          </button>
          
          <button
            className="calltest-btn video"
            onClick={() => makeCall(true)}
            disabled={isLoading || !targetUid.trim() || !currentUser}
          >
            {isLoading ? '⏳' : '📹'} VIDEO CALL
          </button>
        </div>

        <div className="calltest-note">
          ⚡ Both users must be logged in and have the app open
        </div>
      </div>

      {/* Live logs */}
      <div className="calltest-logs" ref={logRef}>
        {logs.map((log, i) => (
          <div key={i} className="log-line">{log}</div>
        ))}
        {logs.length === 0 && (
          <div className="log-placeholder">— Ready to test calls —</div>
        )}
      </div>

      {/* Quick instructions */}
      <div className="calltest-footer">
        <small>
          1. Login in two browsers<br/>
          2. Copy target's UID from top of this page<br/>
          3. Paste and call
        </small>
      </div>
    </div>
  );
};

export default CallTestPage;