import React, { useState, useEffect } from 'react';
import { 
  Send, Bell, Mail, Smartphone, CheckCircle, XCircle, 
  AlertCircle, Loader, RefreshCw, Database, Server, Wifi, Users 
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { notificationService, NotificationResponse } from '../services/notificationService';
import './TestNotification.css';

interface TestResult {
  step: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: string;
  details?: any;
}

const TestNotification: React.FC = () => {
  const [title, setTitle] = useState('Production Test');
  const [body, setBody] = useState('This is a production test notification');
  
  // Support for multiple emails
  const [emailInput, setEmailInput] = useState('israechidozie3@gmail.com, builders785@gmail.com');
  const [emailList, setEmailList] = useState<string[]>(['israechidozie3@gmail.com', 'builders785@gmail.com']);
  
  // Support for multiple user IDs
  const [userIdInput, setUserIdInput] = useState('uKCPqGH4TwNICOdptJxsY487kJm2, s7OG1hobkyY1UAAkk2uPPH5P6dP2');
  const [userIdList, setUserIdList] = useState<string[]>(['uKCPqGH4TwNICOdptJxsY487kJm2', 's7OG1hobkyY1UAAkk2uPPH5P6dP2']);
  
  const [notificationType, setNotificationType] = useState<'order' | 'chat' | 'system' | 'vendor'>('system');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [latestResponse, setLatestResponse] = useState<NotificationResponse | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Initialize auth
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUserId(user.uid);
        setIsAuthReady(true);
        addResult('AUTH', 'success', `Logged in: ${user.uid.substring(0, 12)}...`);
        
        // Set default user ID to current user
        if (userIdList.length === 1 && userIdList[0] === 'uKCPqGH4TwNICOdptJxsY487kJm2') {
          setUserIdList([user.uid]);
          setUserIdInput(user.uid);
        }
      } else {
        setCurrentUserId('');
        setIsAuthReady(false);
        addResult('AUTH', 'error', 'Not logged in');
      }
    });

    return () => unsubscribe();
  }, []);

  const addResult = (step: string, status: TestResult['status'], message: string, details?: any) => {
    const result: TestResult = {
      step,
      status,
      message,
      timestamp: new Date().toLocaleTimeString(),
      details
    };
    
    console.log(`${getStatusEmoji(status)} [${result.timestamp}] ${step}: ${message}`, details || '');
    setResults(prev => [result, ...prev.slice(0, 20)]);
  };

  const getStatusEmoji = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'pending': return '⏳';
      default: return 'ℹ️';
    }
  };

  const parseCommaSeparated = (input: string): string[] => {
    return input.split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };

  const handleEmailChange = (value: string) => {
    setEmailInput(value);
    setEmailList(parseCommaSeparated(value));
  };

  const handleUserIdChange = (value: string) => {
    setUserIdInput(value);
    setUserIdList(parseCommaSeparated(value));
  };

  const sendNotification = async () => {
    if (!isAuthReady) {
      addResult('VALIDATION', 'error', 'Please log in first');
      return;
    }

    if (emailList.length === 0 && userIdList.length === 0) {
      addResult('VALIDATION', 'error', 'At least one email or user ID required');
      return;
    }

    setIsSending(true);
    setResults([]);
    
    const requestId = `test_${Date.now()}`;
    
    addResult('START', 'pending', '🚀 Starting notification test');
    addResult('TARGETS', 'success', `Targeting: ${userIdList.length} users, ${emailList.length} emails`);

    // Prepare notification data
    const notificationData = {
      title,
      body,
      notification_type: notificationType,
      redirect_url: redirectUrl || undefined,
      data: {
        test: true,
        timestamp: new Date().toISOString(),
        source: 'TestNotification',
        requestId
      }
    };

    // Add target users - service will handle both formats
    if (userIdList.length > 0) {
      if (userIdList.length === 1) {
        Object.assign(notificationData, { target_user_id: userIdList[0] });
      } else {
        Object.assign(notificationData, { target_user_ids: userIdList });
      }
    }

    // Add emails - service will handle both formats
    if (emailList.length > 0) {
      if (emailList.length === 1) {
        Object.assign(notificationData, { email: emailList[0] });
      } else {
        Object.assign(notificationData, { email_list: emailList });
      }
    }

    addResult('SENDING', 'pending', '📤 Sending to NotificationService...');

    try {
      // Call the service - it handles all backend communication
      const response = await notificationService.sendNotification(notificationData);
      
      setLatestResponse(response);
      
      if (response.success) {
        addResult('SUCCESS', 'success', 
          `✅ Success via ${response.channels.join(', ')}`, 
          { 
            channels: response.channels,
            users: response.targetUsers,
            emails: response.emails,
            results: response.results
          }
        );
      } else {
        addResult('FAILED', 'error', `❌ Failed: ${response.error || response.message}`);
      }
      
    } catch (error: any) {
      addResult('ERROR', 'error', `❌ Error: ${error.message}`);
      console.error('❌ Service error:', error);
      
    } finally {
      setIsSending(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setLatestResponse(null);
  };

  const getSuccessCount = () => results.filter(r => r.status === 'success').length;
  const getErrorCount = () => results.filter(r => r.status === 'error').length;

  return (
    <div className="test-notification-container">
      <div className="test-header">
        <h1><Bell size={24} /> Notification System Test</h1>
        <p className="subtitle">✅ SIMPLE SERVICE PATTERN - Direct backend calls via service</p>
      </div>

      <div className="test-grid">
        {/* Left Column: Configuration */}
        <div className="config-section">
          <h2><Send size={20} /> Test Configuration</h2>
          
          <div className="form-group">
            <label>Notification Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter notification title"
            />
          </div>

          <div className="form-group">
            <label>Notification Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter notification message"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>
              <Mail size={14} /> Recipient Emails (comma separated)
            </label>
            <input
              type="text"
              value={emailInput}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              className="mono-input"
            />
            <small>{emailList.length} email(s) - {emailList.length > 1 ? 'Batch send' : 'Single email'}</small>
          </div>

          <div className="form-group">
            <label>
              <Users size={14} /> Target User IDs (comma separated)
            </label>
            <input
              type="text"
              value={userIdInput}
              onChange={(e) => handleUserIdChange(e.target.value)}
              placeholder="user_id_1, user_id_2"
              className="mono-input"
            />
            <small>{userIdList.length} user(s) - {userIdList.length > 1 ? 'Individual sends' : 'Single user'}</small>
          </div>

          <div className="form-group">
            <label>Notification Type</label>
            <select 
              value={notificationType} 
              onChange={(e) => setNotificationType(e.target.value as any)}
            >
              <option value="system">System</option>
              <option value="order">Order</option>
              <option value="chat">Chat</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>

          <div className="form-group">
            <label>Redirect URL (Optional)</label>
            <input
              type="url"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div className="form-group">
            <label>Current User ID</label>
            <input
              type="text"
              value={currentUserId ? `${currentUserId.substring(0, 16)}...` : 'Not logged in'}
              readOnly
              disabled
              className="mono-input"
            />
            <small>Will be used as default target</small>
          </div>

          <div className="action-buttons">
            <button 
              onClick={sendNotification} 
              disabled={isSending || !isAuthReady || (emailList.length === 0 && userIdList.length === 0)}
              className="send-btn"
            >
              {isSending ? (
                <><Loader size={16} className="spin" /> Sending...</>
              ) : (
                <><Send size={16} /> Send Notification</>
              )}
            </button>
            
            <button onClick={clearResults} className="clear-btn" disabled={isSending}>
              <RefreshCw size={16} /> Clear
            </button>
          </div>

          {!isAuthReady && (
            <div className="auth-warning">
              <AlertCircle size={16} />
              <p>Please log in to send notifications</p>
            </div>
          )}
        </div>

        {/* Right Column: Results & Logs */}
        <div className="results-section">
          <div className="results-header">
            <h2><Database size={20} /> Results</h2>
            <div className="stats">
              <span className="stat success"><CheckCircle size={14} /> {getSuccessCount()}</span>
              <span className="stat error"><XCircle size={14} /> {getErrorCount()}</span>
              <span className="stat total"><Bell size={14} /> {results.length}</span>
            </div>
          </div>

          {latestResponse && (
            <div className={`response-summary ${latestResponse.success ? 'success' : 'error'}`}>
              <div className="summary-header">
                <h3>{latestResponse.success ? '✅ Success' : '❌ Failed'}</h3>
                <span className="timestamp">{new Date(latestResponse.timestamp).toLocaleTimeString()}</span>
              </div>
              
              <p>{latestResponse.message}</p>
              
              {latestResponse.success && (
                <div className="channels">
                  <strong>Channels:</strong>
                  <div className="channel-tags">
                    {latestResponse.channels?.map((channel, idx) => (
                      <span key={idx} className={`channel-tag ${channel}`}>
                        {channel === 'email' && <Mail size={12} />}
                        {channel === 'onesignal' && <Smartphone size={12} />}
                        {channel}
                      </span>
                    ))}
                  </div>
                  <div className="recipient-stats">
                    <span>👥 Users: {latestResponse.targetUsers || 0}</span>
                    <span>📧 Emails: {latestResponse.emails || 0}</span>
                  </div>
                  
                  {latestResponse.results && (
                    <div className="detailed-results">
                      <strong>Details:</strong>
                      {latestResponse.results.push && (
                        <div className={`push-result ${latestResponse.results.push.success ? 'success' : 'error'}`}>
                          Push: {latestResponse.results.push.success 
                            ? `✅ ${latestResponse.results.push.count} sent` 
                            : `❌ ${latestResponse.results.push.error || 'Failed'}`}
                        </div>
                      )}
                      {latestResponse.results.email && (
                        <div className={`email-result ${latestResponse.results.email.success ? 'success' : 'error'}`}>
                          Email: {latestResponse.results.email.success 
                            ? `✅ ${latestResponse.results.email.count} sent` 
                            : `❌ ${latestResponse.results.email.error || 'Failed'}`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="results-list">
            <h3>Step-by-Step Log</h3>
            {results.length === 0 ? (
              <div className="empty-results">
                <Bell size={32} />
                <p>No test results yet. Click "Send Notification" to start.</p>
              </div>
            ) : (
              <div className="results-scroll">
                {results.map((result, index) => (
                  <div key={index} className={`result-item ${result.status}`}>
                    <div className="result-header">
                      <span className="result-status">{getStatusEmoji(result.status)}</span>
                      <span className="result-step">{result.step}</span>
                      <span className="result-time">{result.timestamp}</span>
                    </div>
                    <div className="result-message">{result.message}</div>
                    {result.details && (
                      <button 
                        className="view-details-btn"
                        onClick={() => console.log('Details:', result.details)}
                      >
                        View Details
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="debug-info">
        <h3><Server size={16} /> System Status</h3>
        <div className="info-grid">
          <div className="info-item">
            <strong>Architecture:</strong> Service → Backend API
          </div>
          <div className="info-item">
            <strong>Auth:</strong> {isAuthReady ? '✅' : '❌'}
          </div>
          <div className="info-item">
            <strong>Backend URL:</strong> http://localhost:3000
          </div>
          <div className="info-item">
            <strong>Push API:</strong> /api/notifications/send
          </div>
          <div className="info-item">
            <strong>Email API:</strong> /api/notifications/create
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestNotification;