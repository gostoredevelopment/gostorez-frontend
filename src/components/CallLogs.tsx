import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

import {
  ArrowLeft,
  Phone,
  Video,
  PhoneMissed,
  PhoneCall,
  PhoneOff,
  Clock,
  User,
  Store,
  Calendar,
  Search,
  Filter,
  X,
  ChevronDown,
  PhoneIncoming,
  PhoneOutgoing,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

import './CallLogs.css';

type CallLog = {
  id: string;
  caller_id: string;
  callee_id: string;
  duration: number;
  status: 'not_reachable' | 'connected' | 'completed' | 'declined' | 'cancelled' | 'failed';
  call_type: 'voice' | 'video';
  created_at: string;
};

type CallWithParticipant = CallLog & {
  participant_name: string;
  participant_avatar?: string;
  participant_type: 'user' | 'vendor';
  is_incoming: boolean;
  formatted_duration: string;
  status_display: string;
  status_icon: React.ReactNode;
};

type FilterType = 'all' | 'voice' | 'video' | 'incoming' | 'outgoing' | 'missed' | 'completed';

export default function CallLogs() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string>('');
  const [callLogs, setCallLogs] = useState<CallWithParticipant[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<CallWithParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [participantCache, setParticipantCache] = useState<Map<string, {
    name: string;
    avatar?: string;
    type: 'user' | 'vendor';
  }>>(new Map());

  // Get user info
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('firebase_uid', currentUser.uid)
            .maybeSingle();

          if (error) throw error;
          if (!data) throw new Error('User not found');
          setSupabaseUserId(data.id);
        } catch (error) {
          console.error('Error getting user ID:', error);
          navigate('/');
        }
      } else {
        navigate('/');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Get participant details
  const getParticipantDetails = useCallback(async (participantId: string): Promise<{
    name: string;
    avatar?: string;
    type: 'user' | 'vendor';
  }> => {
    // Check cache first
    if (participantCache.has(participantId)) {
      return participantCache.get(participantId)!;
    }

    try {
      // Check users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name, avatar_url, user_type')
        .eq('id', participantId)
        .maybeSingle();

      if (!userError && userData) {
        const details = {
          name: userData.name || 'User',
          avatar: userData.avatar_url,
          type: userData.user_type as 'user' | 'vendor' || 'user'
        };
        setParticipantCache(prev => new Map(prev).set(participantId, details));
        return details;
      }

      // Check vendor profiles
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_profiles')
        .select('shop_name, profile_image, user_id')
        .eq('id', participantId)
        .maybeSingle();

      if (!vendorError && vendorData) {
        const details = {
          name: vendorData.shop_name || 'Vendor',
          avatar: vendorData.profile_image,
          type: 'vendor' as const
        };
        setParticipantCache(prev => new Map(prev).set(participantId, details));
        return details;
      }

      // If participantId is a Firebase UID
      const { data: firebaseUserData } = await supabase
        .from('users')
        .select('name, avatar_url, user_type')
        .eq('firebase_uid', participantId)
        .maybeSingle();

      if (firebaseUserData) {
        const details = {
          name: firebaseUserData.name || 'User',
          avatar: firebaseUserData.avatar_url,
          type: firebaseUserData.user_type as 'user' | 'vendor' || 'user'
        };
        setParticipantCache(prev => new Map(prev).set(participantId, details));
        return details;
      }

      return {
        name: 'Unknown User',
        type: 'user'
      };
    } catch (error) {
      console.error('Error fetching participant details:', error);
      return {
        name: 'Unknown User',
        type: 'user'
      };
    }
  }, [participantCache]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    if (seconds <= 0) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Get status display info
  const getStatusInfo = (status: CallLog['status'], isIncoming: boolean) => {
    switch (status) {
      case 'connected':
        return {
          display: 'Connected',
          icon: <CheckCircle size={10} className="call-status-icon success" />,
          className: 'success'
        };
      case 'completed':
        return {
          display: 'Completed',
          icon: <CheckCircle size={10} className="call-status-icon success" />,
          className: 'success'
        };
      case 'declined':
        return {
          display: isIncoming ? 'Declined' : 'Cancelled',
          icon: <XCircle size={10} className="call-status-icon declined" />,
          className: 'declined'
        };
      case 'cancelled':
        return {
          display: 'Cancelled',
          icon: <XCircle size={10} className="call-status-icon cancelled" />,
          className: 'cancelled'
        };
      case 'not_reachable':
        return {
          display: 'Not Reachable',
          icon: <AlertCircle size={10} className="call-status-icon error" />,
          className: 'error'
        };
      case 'failed':
        return {
          display: 'Failed',
          icon: <AlertCircle size={10} className="call-status-icon error" />,
          className: 'error'
        };
      default:
        return {
          display: 'Unknown',
          icon: <AlertCircle size={10} className="call-status-icon" />,
          className: ''
        };
    }
  };

  // Fetch call logs
  const fetchCallLogs = useCallback(async () => {
    if (!supabaseUserId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('call_logs')
        .select('*')
        .or(`caller_id.eq.${supabaseUserId},callee_id.eq.${supabaseUserId}`)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        setCallLogs([]);
        setFilteredLogs([]);
        setLoading(false);
        return;
      }

      // Enrich call logs with participant details
      const enrichedLogs: CallWithParticipant[] = [];
      
      for (const log of data) {
        const isIncoming = log.callee_id === supabaseUserId;
        const participantId = isIncoming ? log.caller_id : log.callee_id;
        const participant = await getParticipantDetails(participantId);
        const statusInfo = getStatusInfo(log.status, isIncoming);
        
        enrichedLogs.push({
          ...log,
          participant_name: participant.name,
          participant_avatar: participant.avatar,
          participant_type: participant.type,
          isIncoming,
          formatted_duration: formatDuration(log.duration),
          status_display: statusInfo.display,
          status_icon: statusInfo.icon
        });
      }

      setCallLogs(enrichedLogs);
      setFilteredLogs(enrichedLogs);
    } catch (error) {
      console.error('Error fetching call logs:', error);
      setError('Failed to load call history');
    } finally {
      setLoading(false);
    }
  }, [supabaseUserId, getParticipantDetails]);

  useEffect(() => {
    if (supabaseUserId) {
      fetchCallLogs();
    }
  }, [supabaseUserId, fetchCallLogs]);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...callLogs];

    // Apply search
    if (searchTerm.trim()) {
      filtered = filtered.filter(log =>
        log.participant_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply filter
    switch (filter) {
      case 'voice':
        filtered = filtered.filter(log => log.call_type === 'voice');
        break;
      case 'video':
        filtered = filtered.filter(log => log.call_type === 'video');
        break;
      case 'incoming':
        filtered = filtered.filter(log => log.is_incoming);
        break;
      case 'outgoing':
        filtered = filtered.filter(log => !log.is_incoming);
        break;
      case 'missed':
        filtered = filtered.filter(log => 
          log.status === 'declined' || 
          log.status === 'not_reachable' || 
          log.status === 'failed'
        );
        break;
      case 'completed':
        filtered = filtered.filter(log => 
          log.status === 'connected' || log.status === 'completed'
        );
        break;
      default:
        break;
    }

    setFilteredLogs(filtered);
  }, [callLogs, searchTerm, filter]);

  const handleCallAgain = (log: CallWithParticipant) => {
    const participantId = log.is_incoming ? log.caller_id : log.callee_id;
    navigate(`/call/${participantId}`);
  };

  const handleBack = () => {
    navigate('/chats');
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const getCallIcon = (log: CallWithParticipant) => {
    if (log.is_incoming) {
      return <PhoneIncoming size={12} className="call-icon incoming" />;
    }
    return <PhoneOutgoing size={12} className="call-icon outgoing" />;
  };

  const getTypeIcon = (callType: string) => {
    return callType === 'voice' ? 
      <Phone size={10} className="type-icon" /> : 
      <Video size={10} className="type-icon" />;
  };

  const getFilterCount = (type: FilterType): number => {
    switch (type) {
      case 'voice':
        return callLogs.filter(l => l.call_type === 'voice').length;
      case 'video':
        return callLogs.filter(l => l.call_type === 'video').length;
      case 'incoming':
        return callLogs.filter(l => l.is_incoming).length;
      case 'outgoing':
        return callLogs.filter(l => !l.is_incoming).length;
      case 'missed':
        return callLogs.filter(l => 
          l.status === 'declined' || 
          l.status === 'not_reachable' || 
          l.status === 'failed'
        ).length;
      case 'completed':
        return callLogs.filter(l => 
          l.status === 'connected' || l.status === 'completed'
        ).length;
      default:
        return callLogs.length;
    }
  };

  if (loading) {
    return (
      <div className="call-logs-loading">
        <div className="call-logs-spinner"></div>
        <p>Loading call history...</p>
      </div>
    );
  }

  return (
    <div className="call-logs-container">
      {/* Header */}
      <div className="call-logs-header">
        <button className="call-logs-back" onClick={handleBack}>
          <ArrowLeft size={16} />
        </button>
        <h1 className="call-logs-title">Call History</h1>
        <div className="call-logs-header-placeholder"></div>
      </div>

      {/* Search Bar */}
      <div className="call-logs-search-section">
        <div className="call-logs-search">
          <Search size={14} className="call-logs-search-icon" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="call-logs-search-input"
          />
          {searchTerm && (
            <button className="call-logs-search-clear" onClick={clearSearch}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter Button */}
        <div className="call-logs-filter-wrapper">
          <button 
            className={`call-logs-filter-btn ${filter !== 'all' ? 'active' : ''}`}
            onClick={() => setShowFilterMenu(!showFilterMenu)}
          >
            <Filter size={14} />
            <span>Filter</span>
            <ChevronDown size={12} />
          </button>

          {showFilterMenu && (
            <div className="call-logs-filter-menu">
              <button 
                className={`filter-option ${filter === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setFilter('all');
                  setShowFilterMenu(false);
                }}
              >
                <span>All Calls</span>
                <span className="filter-count">{getFilterCount('all')}</span>
              </button>
              <button 
                className={`filter-option ${filter === 'voice' ? 'active' : ''}`}
                onClick={() => {
                  setFilter('voice');
                  setShowFilterMenu(false);
                }}
              >
                <Phone size={12} />
                <span>Voice Calls</span>
                <span className="filter-count">{getFilterCount('voice')}</span>
              </button>
              <button 
                className={`filter-option ${filter === 'video' ? 'active' : ''}`}
                onClick={() => {
                  setFilter('video');
                  setShowFilterMenu(false);
                }}
              >
                <Video size={12} />
                <span>Video Calls</span>
                <span className="filter-count">{getFilterCount('video')}</span>
              </button>
              <div className="filter-divider"></div>
              <button 
                className={`filter-option ${filter === 'incoming' ? 'active' : ''}`}
                onClick={() => {
                  setFilter('incoming');
                  setShowFilterMenu(false);
                }}
              >
                <PhoneIncoming size={12} />
                <span>Incoming</span>
                <span className="filter-count">{getFilterCount('incoming')}</span>
              </button>
              <button 
                className={`filter-option ${filter === 'outgoing' ? 'active' : ''}`}
                onClick={() => {
                  setFilter('outgoing');
                  setShowFilterMenu(false);
                }}
              >
                <PhoneOutgoing size={12} />
                <span>Outgoing</span>
                <span className="filter-count">{getFilterCount('outgoing')}</span>
              </button>
              <div className="filter-divider"></div>
              <button 
                className={`filter-option ${filter === 'completed' ? 'active' : ''}`}
                onClick={() => {
                  setFilter('completed');
                  setShowFilterMenu(false);
                }}
              >
                <CheckCircle size={12} />
                <span>Completed</span>
                <span className="filter-count">{getFilterCount('completed')}</span>
              </button>
              <button 
                className={`filter-option ${filter === 'missed' ? 'active' : ''}`}
                onClick={() => {
                  setFilter('missed');
                  setShowFilterMenu(false);
                }}
              >
                <PhoneMissed size={12} />
                <span>Missed</span>
                <span className="filter-count">{getFilterCount('missed')}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="call-logs-error">
          <AlertCircle size={16} />
          <p>{error}</p>
          <button onClick={fetchCallLogs}>Retry</button>
        </div>
      )}

      {/* Call Logs List */}
      <div className="call-logs-list">
        {filteredLogs.length === 0 ? (
          <div className="call-logs-empty">
            {searchTerm || filter !== 'all' ? (
              <>
                <Search size={32} strokeWidth={1} />
                <p>No matching calls found</p>
                <button 
                  className="call-logs-clear-filters"
                  onClick={() => {
                    setSearchTerm('');
                    setFilter('all');
                  }}
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <Phone size={32} strokeWidth={1} />
                <p>No call history yet</p>
                <p className="call-logs-empty-sub">Your call history will appear here</p>
              </>
            )}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="call-logs-item">
              <div className="call-logs-item-left">
                <div className="call-logs-avatar">
                  {log.participant_avatar ? (
                    <img src={log.participant_avatar} alt={log.participant_name} />
                  ) : (
                    <div className="call-logs-avatar-placeholder">
                      {log.participant_type === 'vendor' ? 
                        <Store size={12} /> : 
                        <User size={12} />
                      }
                    </div>
                  )}
                </div>

                <div className="call-logs-details">
                  <div className="call-logs-name-row">
                    <span className="call-logs-name">{log.participant_name}</span>
                    {getCallIcon(log)}
                    <span className="call-logs-type">
                      {getTypeIcon(log.call_type)}
                    </span>
                  </div>
                  
                  <div className="call-logs-meta">
                    <Clock size={10} className="call-logs-meta-icon" />
                    <span className="call-logs-date">
                      {format(parseISO(log.created_at), 'MMM d, h:mm a')}
                    </span>
                    {log.formatted_duration && (
                      <>
                        <span className="call-logs-meta-sep">•</span>
                        <span className="call-logs-duration">
                          {log.formatted_duration}
                        </span>
                      </>
                    )}
                    <span className="call-logs-meta-sep">•</span>
                    {log.status_icon}
                    <span className={`call-logs-status ${log.status_display.toLowerCase()}`}>
                      {log.status_display}
                    </span>
                  </div>
                </div>
              </div>

              <div className="call-logs-item-right">
                <button 
                  className="call-logs-call-btn"
                  onClick={() => handleCallAgain(log)}
                  title="Call again"
                >
                  {log.call_type === 'voice' ? 
                    <Phone size={14} /> : 
                    <Video size={14} />
                  }
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats Footer */}
      {filteredLogs.length > 0 && (
        <div className="call-logs-footer">
          <div className="call-logs-stats">
            <span>{filteredLogs.length} call{filteredLogs.length !== 1 ? 's' : ''}</span>
            {filter !== 'all' && (
              <button 
                className="call-logs-reset-filter"
                onClick={() => setFilter('all')}
              >
                Show all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}