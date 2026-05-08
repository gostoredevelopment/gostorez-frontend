import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { supabase } from '../lib/supabaseClient';
import { notificationService } from '../services/notificationService';
import { ArrowLeft, Send, MessageCircle, HelpCircle, Star, X, CheckCircle, AlertCircle, ChevronUp, MessageSquare, Bug, Lightbulb, ThumbsUp, Loader, Clock } from 'lucide-react';
import './Feedback.css';

interface Feedback {
  id: string;
  question: string;
  answer: string;
  sender_id: string;
  sender_name: string;
  feedback_type: string;
  approved: boolean;
  created_at: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  order_index: number;
  is_active: boolean;
}

interface FeedbackSupport {
  id: string;
  email: string;
  user_id: string;
}

type TabType = 'send' | 'feedbacks' | 'faq';

const Feedback: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('send');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userName, setUserName] = useState('');
  
  // Send feedback state
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState<'complaint' | 'bug' | 'suggestion' | 'feature' | 'other'>('other');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState('');
  const [sendError, setSendError] = useState('');
  
  // Local in-app notification state (not from database)
  const [showLocalToast, setShowLocalToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // User's own feedbacks state
  const [userFeedbacks, setUserFeedbacks] = useState<Feedback[]>([]);
  const [loadingUserFeedbacks, setLoadingUserFeedbacks] = useState(false);
  
  // Feedbacks list state (approved feedbacks from all users)
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  
  // FAQ state
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  
  // Refs for scroll
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const notificationSentRef = useRef<Set<string>>(new Set());

  // Get current user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserName(userDoc.data().name || user.email?.split('@')[0] || 'User');
          } else {
            setUserName(user.email?.split('@')[0] || 'User');
          }
        } catch (err) {
          setUserName(user.email?.split('@')[0] || 'User');
        }
        // Load user's own feedbacks
        await loadUserFeedbacks(user.uid);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load feedbacks when tab changes
  useEffect(() => {
    if (activeTab === 'feedbacks') {
      loadFeedbacks();
    } else if (activeTab === 'faq') {
      loadFaqs();
    }
  }, [activeTab]);

  // Handle scroll snap
  useEffect(() => {
    if (contentRef.current) {
      const scrollToTab = () => {
        if (!contentRef.current) return;
        const tabIndex = activeTab === 'send' ? 0 : activeTab === 'feedbacks' ? 1 : 2;
        const scrollPosition = tabIndex * contentRef.current.clientWidth;
        contentRef.current.scrollTo({ left: scrollPosition, behavior: 'smooth' });
      };
      scrollToTab();
    }
  }, [activeTab]);

  // Cleanup toast timeout
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleScroll = () => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      if (contentRef.current) {
        const scrollPosition = contentRef.current.scrollLeft;
        const width = contentRef.current.clientWidth;
        const newTabIndex = Math.round(scrollPosition / width);
        const newTab: TabType = newTabIndex === 0 ? 'send' : newTabIndex === 1 ? 'feedbacks' : 'faq';
        if (newTab !== activeTab) setActiveTab(newTab);
      }
    }, 100);
  };

  // Load user's own feedbacks (all, regardless of approved status)
  const loadUserFeedbacks = async (userId: string) => {
    setLoadingUserFeedbacks(true);
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .eq('sender_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUserFeedbacks(data || []);
    } catch (err) {
      console.error('Error loading user feedbacks:', err);
    } finally {
      setLoadingUserFeedbacks(false);
    }
  };

  const loadFeedbacks = async () => {
    setLoadingFeedbacks(true);
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .eq('approved', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setFeedbacks(data || []);
    } catch (err) {
      console.error('Error loading feedbacks:', err);
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  const loadFaqs = async () => {
    setLoadingFaqs(true);
    try {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      setFaqs(data || []);
    } catch (err) {
      console.error('Error loading FAQs:', err);
    } finally {
      setLoadingFaqs(false);
    }
  };

  // Get all support recipients from feedback_support table
  const getSupportRecipients = async (): Promise<FeedbackSupport[]> => {
    try {
      const { data, error } = await supabase
        .from('feedback_support')
        .select('*');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching support recipients:', error);
      return [];
    }
  };

  // Send ONE notification to each recipient (handles push + email + in-app in one call)
  const sendToSupportRecipients = async (feedbackText: string, feedbackType: string, senderName: string, senderEmail: string) => {
    const recipients = await getSupportRecipients();
    
    if (recipients.length === 0) {
      console.warn('No support recipients found');
      return;
    }
    
    const notificationTitle = `New ${feedbackType} feedback from ${senderName}`;
    const notificationBody = `${senderName} (${senderEmail}) submitted: "${feedbackText.substring(0, 150)}${feedbackText.length > 150 ? '...' : ''}"`;
    
    // Send ONE notification per recipient (combines push + email in single call)
    for (const recipient of recipients) {
      // Create unique key for this recipient to prevent double sending
      const recipientKey = `${recipient.user_id}-${recipient.email}-${Date.now()}`;
      if (notificationSentRef.current.has(recipientKey)) {
        console.log(`Skipping duplicate for ${recipient.email}`);
        continue;
      }
      notificationSentRef.current.add(recipientKey);
      
      // Prepare single notification data with both target_user_id AND email
      const notificationData: any = {
        title: notificationTitle,
        body: notificationBody,
        notification_type: 'system',
        redirect_url: '/admin/feedbacks',
        data: {
          type: 'feedback',
          feedback_type: feedbackType,
          from_user: senderName,
          from_email: senderEmail,
          feedback_text: feedbackText,
          timestamp: new Date().toISOString()
        }
      };
      
      // Add BOTH target_user_id AND email in ONE call
      if (recipient.user_id) {
        notificationData.target_user_id = recipient.user_id;
      }
      
      if (recipient.email) {
        notificationData.email = recipient.email;
      }
      
      try {
        // ONE call that handles push + email + in-app
        await notificationService.sendNotification(notificationData);
        console.log(`✅ Single notification sent to ${recipient.email} (${recipient.user_id}) - handles push + email`);
        
      } catch (err) {
        console.error(`❌ Error sending to ${recipient.email}:`, err);
      }
    }
  };

  // Show local toast notification (not from database, just inline JS)
  const showLocalToastNotification = (message: string) => {
    setToastMessage(message);
    setShowLocalToast(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setShowLocalToast(false);
      setToastMessage('');
    }, 4000);
  };

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) {
      setSendError('Please enter your feedback');
      return;
    }
    if (!currentUser) {
      setSendError('Please sign in to send feedback');
      return;
    }
    
    setSending(true);
    setSendError('');
    setSendSuccess('');
    notificationSentRef.current.clear();
    
    try {
      // Insert feedback into database
      const { error } = await supabase
        .from('feedbacks')
        .insert({
          question: feedbackText.trim(),
          sender_id: currentUser.uid,
          sender_name: userName,
          sender_email: currentUser.email,
          feedback_type: feedbackType,
          approved: false,
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      console.log('✅ Feedback saved successfully');
      
      // Send ONE notification to support recipients (handles push + email)
      await sendToSupportRecipients(feedbackText, feedbackType, userName, currentUser.email || '');
      
      // Show local in-app notification (hardcoded, not from database) - ONLY for the sender
      showLocalToastNotification('Received! We\'ll get back to you soon.');
      
      // Reload user's feedbacks to show the new one
      await loadUserFeedbacks(currentUser.uid);
      
      setSendSuccess('Feedback sent! Thank you for your input.');
      setFeedbackText('');
      setFeedbackType('other');
      
      setTimeout(() => setSendSuccess(''), 3000);
    } catch (err: any) {
      console.error('❌ Error sending feedback:', err);
      setSendError(err.message || 'Failed to send feedback');
    } finally {
      setSending(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'complaint': return <AlertCircle size={14} />;
      case 'bug': return <Bug size={14} />;
      case 'suggestion': return <Lightbulb size={14} />;
      case 'feature': return <Star size={14} />;
      default: return <MessageSquare size={14} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'complaint': return 'Complaint';
      case 'bug': return 'Bug Report';
      case 'suggestion': return 'Suggestion';
      case 'feature': return 'Feature Request';
      default: return 'Other';
    }
  };

  const getStatusLabel = (feedback: Feedback) => {
    if (feedback.answer && feedback.answer.trim()) {
      return { text: 'Answered', className: 'answered', icon: <CheckCircle size={12} /> };
    } else if (feedback.approved) {
      return { text: 'Approved', className: 'approved', icon: <CheckCircle size={12} /> };
    } else {
      return { text: 'Pending', className: 'pending', icon: <Clock size={12} /> };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="feedback-loading">
        <div className="feedback-spinner"></div>
      </div>
    );
  }

  return (
    <div className="feedback-container">
      {/* Local in-app notification toast (hardcoded, not from database) - ONLY for sender */}
      {showLocalToast && (
        <div 
          style={{
            position: 'fixed',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#28a745',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: '500',
            zIndex: 10000,
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            animation: 'fadeInDown 0.3s ease, fadeOutUp 0.3s ease 3.7s forwards'
          }}
        >
          <CheckCircle size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="feedback-header">
        <button className="feedback-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </button>
        <h1 className="feedback-title">Help & Support</h1>
        <div className="feedback-header-placeholder" />
      </div>

      {/* Tabs */}
      <div className="feedback-tabs">
        <button 
          className={`feedback-tab ${activeTab === 'send' ? 'active' : ''}`}
          onClick={() => setActiveTab('send')}
        >
          <Send size={14} />
          <span>Send</span>
        </button>
        <button 
          className={`feedback-tab ${activeTab === 'feedbacks' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedbacks')}
        >
          <MessageCircle size={14} />
          <span>Feedbacks</span>
        </button>
        <button 
          className={`feedback-tab ${activeTab === 'faq' ? 'active' : ''}`}
          onClick={() => setActiveTab('faq')}
        >
          <HelpCircle size={14} />
          <span>FAQ</span>
        </button>
      </div>

      {/* Scrollable Content */}
      <div 
        ref={contentRef}
        className="feedback-scroll-content"
        onScroll={handleScroll}
      >
        {/* Send Feedback Tab */}
        <div className="feedback-panel">
          <div className="feedback-send-container">
            <div className="feedback-type-row">
              <button 
                className={`feedback-type-btn ${feedbackType === 'complaint' ? 'active complaint' : ''}`}
                onClick={() => setFeedbackType('complaint')}
              >
                <AlertCircle size={14} />
                Complaint
              </button>
              <button 
                className={`feedback-type-btn ${feedbackType === 'bug' ? 'active bug' : ''}`}
                onClick={() => setFeedbackType('bug')}
              >
                <Bug size={14} />
                Bug
              </button>
              <button 
                className={`feedback-type-btn ${feedbackType === 'suggestion' ? 'active suggestion' : ''}`}
                onClick={() => setFeedbackType('suggestion')}
              >
                <Lightbulb size={14} />
                Suggestion
              </button>
              <button 
                className={`feedback-type-btn ${feedbackType === 'feature' ? 'active feature' : ''}`}
                onClick={() => setFeedbackType('feature')}
              >
                <Star size={14} />
                Feature
              </button>
            </div>

            <textarea
              className="feedback-textarea"
              placeholder="Type your feedback here...&#10;&#10;Examples:&#10;• The app is slow when loading product images&#10;• Add personalized support&#10;• Improve search filters&#10;• Add wishlist sharing feature"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={6}
            />

            {sendError && (
              <div className="feedback-error">
                <AlertCircle size={14} />
                {sendError}
              </div>
            )}

            {sendSuccess && (
              <div className="feedback-success">
                <CheckCircle size={14} />
                {sendSuccess}
              </div>
            )}

            <button 
              className="feedback-submit"
              onClick={handleSendFeedback}
              disabled={sending || !feedbackText.trim()}
            >
              {sending ? (
                <>
                  <Loader size={14} className="spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Send Feedback
                </>
              )}
            </button>

            <p className="feedback-note">
              Your feedback helps us improve GoStorez. All feedback is reviewed before being published.
            </p>

            {/* User's Own Feedbacks Section */}
            <div className="user-feedbacks-section">
              <div className="user-feedbacks-header">
                <h4>Your Submitted Feedbacks</h4>
              </div>
              
              {loadingUserFeedbacks ? (
                <div className="user-feedbacks-loading">
                  <div className="feedback-spinner-small"></div>
                  <span>Loading your feedbacks...</span>
                </div>
              ) : userFeedbacks.length === 0 ? (
                <div className="user-feedbacks-empty">
                  <MessageSquare size={24} />
                  <p>You haven't submitted any feedback yet.</p>
                </div>
              ) : (
                <div className="user-feedbacks-list">
                  {userFeedbacks.map((feedback) => {
                    const status = getStatusLabel(feedback);
                    return (
                      <div key={feedback.id} className="user-feedback-card">
                        <div className="user-feedback-header">
                          <div className="user-feedback-type">
                            {getTypeIcon(feedback.feedback_type)}
                            <span>{getTypeLabel(feedback.feedback_type)}</span>
                          </div>
                          <div className={`user-feedback-status ${status.className}`}>
                            {status.icon}
                            <span>{status.text}</span>
                          </div>
                        </div>
                        <div className="user-feedback-question">{feedback.question}</div>
                        <div className="user-feedback-date">{formatDate(feedback.created_at)}</div>
                        {feedback.answer && (
                          <div className="user-feedback-answer">
                            <div className="user-feedback-answer-label">
                              <ThumbsUp size={12} />
                              <span>Response from GoStorez</span>
                            </div>
                            <p>{feedback.answer}</p>
                          </div>
                        )}
                        {!feedback.answer && status.text === 'Pending' && (
                          <div className="user-feedback-pending-note">
                            <Clock size={12} />
                            <span>Awaiting response from our support team...</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feedbacks Tab (Public Approved Feedbacks) */}
        <div className="feedback-panel">
          <div className="feedback-list-container">
            <div className="public-feedbacks-header">
              <h4>Community Feedbacks</h4>
              <p>Approved feedbacks from our community</p>
            </div>
            {loadingFeedbacks ? (
              <div className="feedback-loading-state">
                <div className="feedback-spinner-small"></div>
                <span>Loading feedbacks...</span>
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="feedback-empty">
                <MessageCircle size={32} />
                <p>No feedbacks yet</p>
                <span>Be the first to share your thoughts!</span>
              </div>
            ) : (
              feedbacks.map((feedback) => (
                <div key={feedback.id} className="feedback-card">
                  <div className="feedback-card-header">
                    <div className="feedback-card-type">
                      {getTypeIcon(feedback.feedback_type)}
                      <span>{getTypeLabel(feedback.feedback_type)}</span>
                    </div>
                    <span className="feedback-card-date">{formatDate(feedback.created_at)}</span>
                  </div>
                  <div className="feedback-card-question">{feedback.question}</div>
                  {feedback.answer && (
                    <div className="feedback-card-answer">
                      <div className="feedback-answer-label">
                        <ThumbsUp size={12} />
                        <span>Response from GoStorez</span>
                      </div>
                      <p>{feedback.answer}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* FAQ Tab */}
        <div className="feedback-panel">
          <div className="faq-container">
            {loadingFaqs ? (
              <div className="feedback-loading-state">
                <div className="feedback-spinner-small"></div>
                <span>Loading FAQs...</span>
              </div>
            ) : faqs.length === 0 ? (
              <div className="feedback-empty">
                <HelpCircle size={32} />
                <p>No FAQs available</p>
                <span>Check back later for updates!</span>
              </div>
            ) : (
              faqs.map((faq) => (
                <div key={faq.id} className="faq-item">
                  <button 
                    className={`faq-question ${expandedFaq === faq.id ? 'expanded' : ''}`}
                    onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                  >
                    <span>{faq.question}</span>
                    <div className={`faq-icon ${expandedFaq === faq.id ? 'rotated' : ''}`}>
                      <ChevronUp size={16} />
                    </div>
                  </button>
                  {expandedFaq === faq.id && (
                    <div className="faq-answer">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Feedback;