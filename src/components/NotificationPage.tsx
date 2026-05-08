import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Bell,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Trash2,
  Package,
  Store,
  ShoppingBag,
  Heart,
  MessageSquare,
  MessagesSquare,
  CheckCircle,
  AlertTriangle,
  Info,
  Clock,
  XCircle,
  Settings,
  Filter,
  SortDesc,
  CheckCheck,
  X,
  Users,
  User,
  Mail,
  Smartphone,
  Calendar
} from 'lucide-react';
import './NotificationPage.css';

interface Notification {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  redirect_url?: string;
  data: any;
  read: boolean;
  created_at: string;
  updated_at: string;
  sender_id?: string;
  receiver_ids: string[];
}

interface FilterOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

const NotificationPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [availableShops, setAvailableShops] = useState<FilterOption[]>([]);

  // Get current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate('/signin');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Fetch notifications when user is available
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // Apply filters and sorting when notifications or filters change
  useEffect(() => {
    let filtered = [...notifications];

    // Apply shop filters
    if (selectedFilters.length > 0) {
      filtered = filtered.filter(notification => {
        const shopName = getShopName(notification);
        return selectedFilters.includes(shopName);
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    setFilteredNotifications(filtered);
  }, [notifications, selectedFilters, sortOrder]);

  // Extract unique shop names for filters
  useEffect(() => {
    const shops = new Map<string, number>();
    
    notifications.forEach(notification => {
      const shopName = getShopName(notification);
      if (shopName && shopName !== 'System' && shopName !== 'Notification') {
        const count = shops.get(shopName) || 0;
        shops.set(shopName, count + 1);
      }
    });

    const shopFilters: FilterOption[] = Array.from(shops.entries()).map(([name, count]) => ({
      id: name,
      label: name,
      count
    }));

    setAvailableShops(shopFilters);
  }, [notifications]);

  // Format time (e.g., "4 min ago", "2 days ago")
  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSec < 60) return 'now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  // Get icon based on notification type
  const getIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'order':
      case 'order_update':
        return <Package size={18} />;
      case 'vendor':
        return <Store size={18} />;
      case 'market':
        return <ShoppingBag size={18} />;
      case 'favorite':
      case 'favourites':
        return <Heart size={18} />;
      case 'message':
      case 'chat':
        return <MessagesSquare size={18} />;
      case 'system':
        return <Settings size={18} />;
      case 'success':
        return <CheckCircle size={18} />;
      case 'warning':
        return <AlertTriangle size={18} />;
      case 'error':
        return <XCircle size={18} />;
      case 'info':
        return <Info size={18} />;
      default:
        return <Bell size={18} />;
    }
  };

  // Get shop name for "to:" field
  const getShopName = (notification: Notification): string => {
    if (notification.data?.shopName) return notification.data.shopName;
    if (notification.data?.vendorName) return notification.data.vendorName;
    if (notification.data?.userName) return notification.data.userName;
    if (notification.notification_type === 'vendor') return 'Vendor Shop';
    if (notification.notification_type === 'system') return 'System';
    return 'Notification';
  };

  // Get recipient type
  const getRecipientType = (notification: Notification): string => {
    if (notification.data?.shopName || notification.data?.vendorName) return 'vendor';
    if (notification.data?.userName) return 'user';
    return 'system';
  };

  // Fetch notifications from database
  const fetchNotifications = async () => {
    if (!user) return;
    
    setRefreshing(true);
    try {
      console.log('Fetching notifications for user:', user.uid);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .contains('receiver_ids', [user.uid])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      console.log('✅ Notifications fetched:', data?.length || 0);
      
      if (data && data.length > 0) {
        setNotifications(data);
      } else {
        // Try with receiver_id as fallback
        const { data: fallbackData } = await supabase
          .from('notifications')
          .select('*')
          .eq('receiver_id', user.uid)
          .order('created_at', { ascending: false });
        
        if (fallbackData && fallbackData.length > 0) {
          console.log('✅ Using fallback data:', fallbackData.length);
          setNotifications(fallbackData);
        } else {
          setNotifications([]);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Mark as read
  const markAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', unreadIds);

      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!window.confirm('Delete this notification?')) return;
    
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  // Handle click
  const handleClick = async (notification: Notification) => {
    if (expandedId === notification.id) {
      setExpandedId(null);
    } else {
      setExpandedId(notification.id);
      if (!notification.read) {
        await markAsRead(notification.id, notification.read);
      }
    }
  };

  // Toggle filter
  const toggleFilter = (shopName: string) => {
    setSelectedFilters(prev => 
      prev.includes(shopName)
        ? prev.filter(f => f !== shopName)
        : [...prev, shopName]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedFilters([]);
  };

  // Toggle sort order
  const toggleSort = () => {
    setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest');
  };

  // Calculate stats
  const unreadCount = notifications.filter(n => !n.read).length;
  const todayCount = notifications.filter(n => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(n.created_at) >= today;
  }).length;

  return (
    <div className="notificationpage-container">
      {/* Header */}
      <header className="notificationpage-header">
        <button className="notificationpage-back-btn" onClick={() => navigate(-1)}>
          <ChevronRight size={20} />
        </button>
        
        <h1 className="notificationpage-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', margin: 0 }}>
  <Bell size={20} style={{ display: 'inline-block' }} />
  <span style={{ fontSize: '18px' }}>My Notifications</span>
</h1>
        <div className="notificationpage-header-actions">
          <button 
            className={`notificationpage-filter-toggle ${showFilterMenu ? 'active' : ''}`}
            onClick={() => setShowFilterMenu(!showFilterMenu)}
          >
            <Filter size={18} />
          </button>
          <button 
            className="notificationpage-refresh-btn" 
            onClick={fetchNotifications}
            disabled={refreshing}
          >
            <RefreshCw size={18} className={refreshing ? 'notificationpage-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Filter Menu */}
      {showFilterMenu && (
        <div className="notificationpage-filter-menu">
          <div className="notificationpage-filter-header">
            <h3>Filter Notifications</h3>
            <button onClick={() => setShowFilterMenu(false)}>
              <X size={16} />
            </button>
          </div>

          {/* Sort Option */}
          <div className="notificationpage-filter-section">
            <label className="notificationpage-filter-label">Sort by</label>
            <button 
              className={`notificationpage-sort-btn ${sortOrder === 'newest' ? 'active' : ''}`}
              onClick={toggleSort}
            >
              <SortDesc size={14} />
              {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
            </button>
          </div>

          {/* Shop Filters */}
          {availableShops.length > 0 && (
            <div className="notificationpage-filter-section">
              <label className="notificationpage-filter-label">Filter by shop</label>
              <div className="notificationpage-filter-options">
                {availableShops.map(shop => (
                  <button
                    key={shop.id}
                    className={`notificationpage-filter-option ${selectedFilters.includes(shop.id) ? 'selected' : ''}`}
                    onClick={() => toggleFilter(shop.id)}
                  >
                    <Store size={12} />
                    <span>{shop.label}</span>
                    <span className="notificationpage-filter-count">{shop.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="notificationpage-filter-actions">
            {unreadCount > 0 && (
              <button 
                className="notificationpage-markall-btn"
                onClick={markAllAsRead}
              >
                <CheckCheck size={14} />
                Mark all as read
              </button>
            )}
            {selectedFilters.length > 0 && (
              <button 
                className="notificationpage-clear-btn"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="notificationpage-stats">
        <div className="notificationpage-stat-item">
          <span className="notificationpage-stat-value">{notifications.length}</span>
          <span className="notificationpage-stat-label">Total</span>
        </div>
        <div className="notificationpage-stat-item">
          <span className="notificationpage-stat-value">{unreadCount}</span>
          <span className="notificationpage-stat-label">Unread</span>
        </div>
        <div className="notificationpage-stat-item">
          <span className="notificationpage-stat-value">{todayCount}</span>
          <span className="notificationpage-stat-label">Today</span>
        </div>
        {selectedFilters.length > 0 && (
          <div className="notificationpage-stat-item notificationpage-filter-indicator">
            <span className="notificationpage-stat-value">{selectedFilters.length}</span>
            <span className="notificationpage-stat-label">Filtered</span>
          </div>
        )}
      </div>

      {/* Notifications List */}
      <div className="notificationpage-list">
        {loading ? (
          <div className="notificationpage-loading">
            <RefreshCw size={40} className="notificationpage-spin" />
            <p>Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notificationpage-empty">
            <Bell size={48} />
            <h3>No notifications</h3>
            <p>
              {notifications.length === 0 
                ? "Component can't find any your notifications at the moment. Please refresh or try again later" 
                : "No notifications match your filters"}
            </p>
            {selectedFilters.length > 0 && (
              <button 
                className="notificationpage-clear-filters"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filteredNotifications.map(notification => {
            const isExpanded = expandedId === notification.id;
            const icon = getIcon(notification.notification_type);
            const shopName = getShopName(notification);
            const recipientType = getRecipientType(notification);
            const timeAgo = getTimeAgo(notification.created_at);
            
            return (
              <div 
                key={notification.id} 
                className={`notificationpage-card ${!notification.read ? 'unread' : ''} ${isExpanded ? 'expanded' : ''}`}
                onClick={() => handleClick(notification)}
              >
                {/* Main row - Always visible */}
                <div className="notificationpage-row">
                  <div className="notificationpage-icon">
                    {icon}
                  </div>
                  
                  <div className="notificationpage-content">
                    <div className="notificationpage-header-row">
                      <div className="notificationpage-type-indicator">
                        {recipientType === 'vendor' && <Store size={12} />}
                        {recipientType === 'user' && <User size={12} />}
                        {recipientType === 'system' && <Settings size={12} />}
                        <span>to: {shopName}</span>
                      </div>
                      <span className="notificationpage-time">{timeAgo}</span>
                    </div>
                    
                    <h3 className="notificationpage-title-text">
                      {notification.title || 'Notification'}
                    </h3>
                    
                    {/* Preview (only when not expanded) */}
                    {!isExpanded && (
                      <p className="notificationpage-preview">
                        {notification.body || notification.data?.message || 'No content'}
                      </p>
                    )}
                  </div>
                  
                  <div className="notificationpage-actions">
                    {!notification.read && (
                      <span className="notificationpage-unread-badge"></span>
                    )}
                    <button 
                      className="notificationpage-delete-btn"
                      onClick={(e) => deleteNotification(notification.id, e)}
                    >
                      <Trash2 size={16} />
                    </button>
                    <button className="notificationpage-expand-btn">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded details (only when expanded) */}
                {isExpanded && (
                  <div className="notificationpage-details">
                    <div className="notificationpage-detail-section">
                      <h4>Message</h4>
                      <p className="notificationpage-full-message">
                        {notification.body || notification.data?.message || 'No content'}
                      </p>
                    </div>

                    <div className="notificationpage-detail-section">
                      <h4>Details</h4>
                      <div className="notificationpage-detail-row">
                        <span>To:</span>
                        <span className="notificationpage-detail-value">
                          {recipientType === 'vendor' && <Store size={12} />}
                          {recipientType === 'user' && <User size={12} />}
                          {recipientType === 'system' && <Settings size={12} />}
                          {shopName}
                        </span>
                      </div>
                      <div className="notificationpage-detail-row">
                        <span>Type:</span>
                        <span className="notificationpage-detail-value">
                          {notification.notification_type || 'General'}
                        </span>
                      </div>
                      <div className="notificationpage-detail-row">
                        <span>Received:</span>
                        <span className="notificationpage-detail-value">
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                      </div>
                      {notification.updated_at !== notification.created_at && (
                        <div className="notificationpage-detail-row">
                          <span>Updated:</span>
                          <span className="notificationpage-detail-value">
                            {getTimeAgo(notification.updated_at)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Delivery Info */}
                    {(notification.receiver_ids?.length > 0 || notification.data?.recipients) && (
                      <div className="notificationpage-detail-section">
                        <h4>Recipients</h4>
                        <div className="notificationpage-recipients">
                          {notification.receiver_ids?.map((id, index) => (
                            <span key={index} className="notificationpage-recipient-badge">
                              <User size={10} />
                              {id.slice(0, 8)}...
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Additional Data */}
                    {notification.data && Object.keys(notification.data).length > 0 && (
                      <div className="notificationpage-detail-section">
                        <h4>Additional Data</h4>
                        <pre className="notificationpage-data-json">
                          {JSON.stringify(notification.data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Action Button */}
                    {notification.redirect_url && (
                      <button 
                        className="notificationpage-redirect-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(notification.redirect_url!);
                        }}
                      >
                        View Details
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationPage;