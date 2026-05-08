import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { useSidebar } from '../contexts/SidebarContext';
import { 
  Home,
  ShoppingCart,
  ShoppingBag,
  Store,
  Menu
} from 'lucide-react';

const GlobalBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleSidebar } = useSidebar();
  const [isVisible, setIsVisible] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [sellCount, setSellCount] = useState(0);
  const [homeBadge, setHomeBadge] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track user and fetch counts
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await fetchAllCounts(user.uid);
      } else {
        resetAllCounts();
      }
    });

    return () => unsubscribe();
  }, []);

  const resetAllCounts = () => {
    setCartCount(0);
    setSellCount(0);
    setHomeBadge(0);
    setFavoritesCount(0);
    setMessagesUnread(0);
    setNotificationsUnread(0);
  };

  // Fetch all counts in parallel for efficiency
  const fetchAllCounts = async (userId: string) => {
    try {
      // Run all queries in parallel
      const [
        cartResult,
        vendorProfilesResult,
        favoritesResult,
        messagesResult,
        notificationsResult,
        homeBadgeResult
      ] = await Promise.all([
        // Cart count
        supabase.from('carts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        
        // Vendor profiles for sell badge
        supabase.from('vendor_profiles').select('vendor_id').eq('user_id', userId),
        
        // Favorites count
        supabase.from('user_favorites').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        
        // Messages unread (notification type 'chat')
        supabase.from('notifications').select('*', { count: 'exact', head: true })
          .contains('receiver_ids', [userId]).eq('notification_type', 'chat').eq('read', false),
        
        // Notifications unread
        supabase.from('notifications').select('*', { count: 'exact', head: true })
          .contains('receiver_ids', [userId]).eq('read', false),
        
        // Home badge - get orders for user
        supabase.from('orders').select('id').eq('user_id', userId)
      ]);

      // Set cart count
      setCartCount(cartResult.count || 0);

      // Set favorites count
      setFavoritesCount(favoritesResult.count || 0);

      // Set messages unread
      setMessagesUnread(messagesResult.count || 0);

      // Set notifications unread
      setNotificationsUnread(notificationsResult.count || 0);

      // Set sell badge (vendor pending orders)
      if (vendorProfilesResult.data && vendorProfilesResult.data.length > 0) {
        const vendorIds = vendorProfilesResult.data.map(v => v.vendor_id);
        const { count: pending } = await supabase
          .from('order_items')
          .select('*', { count: 'exact', head: true })
          .in('vendor_id', vendorIds)
          .eq('vendor_status', 'pending')
          .neq('user_status', 'cancelled');
        setSellCount(pending || 0);
      } else {
        setSellCount(0);
      }

      // Set home badge: new orders + (accepted - received)
      if (homeBadgeResult.data && homeBadgeResult.data.length > 0) {
        const orderIds = homeBadgeResult.data.map(o => o.id);
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('vendor_status, user_status')
          .in('order_id', orderIds);

        if (orderItems) {
          let newOrders = 0;
          let accepted = 0;
          let received = 0;

          orderItems.forEach(item => {
            if (item.vendor_status === 'pending' && item.user_status !== 'cancelled') {
              newOrders++;
            }
            if (item.vendor_status === 'accepted') {
              accepted++;
            }
            if (item.user_status === 'received') {
              received++;
            }
          });

          const badge = newOrders + (accepted - received);
          setHomeBadge(Math.max(0, badge));
        }
      } else {
        setHomeBadge(0);
      }
    } catch (error) {
      console.error('Error fetching counts:', error);
      resetAllCounts();
    }
  };

  // Calculate total badge sum for menu icon
  const totalBadgeSum = homeBadge + cartCount + favoritesCount + sellCount + messagesUnread + notificationsUnread;

  // Reset hide timer and show nav
  const onActivity = () => {
    setIsVisible(true);
    
    // Clear existing timer
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    // Set new timer to hide after 3 seconds
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 3000);
  };

  // Listen to all types of user activity
  useEffect(() => {
    // Scroll events
    window.addEventListener('scroll', onActivity, { passive: true });
    
    // Mouse events
    window.addEventListener('mousemove', onActivity);
    window.addEventListener('mousedown', onActivity);
    window.addEventListener('mouseenter', onActivity);
    
    // Touch events
    window.addEventListener('touchstart', onActivity);
    window.addEventListener('touchmove', onActivity);
    window.addEventListener('touchend', onActivity);
    
    // Click events
    window.addEventListener('click', onActivity);
    
    // Keyboard events
    window.addEventListener('keydown', onActivity);
    window.addEventListener('keyup', onActivity);

    // Initial timer
    onActivity();

    // Cleanup
    return () => {
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('mousedown', onActivity);
      window.removeEventListener('mouseenter', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('touchmove', onActivity);
      window.removeEventListener('touchend', onActivity);
      window.removeEventListener('click', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('keyup', onActivity);
      
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array - runs once on mount

  // Check if route is active
  const isActive = (path: string) => {
    if (path === '/user/dashboard' && location.pathname === '/user/dashboard') return true;
    if (path === '/cart' && location.pathname === '/cart') return true;
    if (path === '/market' && location.pathname === '/market') return true;
    if (path === '/vendor/dashboard' && location.pathname === '/vendor/dashboard') return true;
    return false;
  };

  // Don't render if no user
  const [currentUser, setCurrentUser] = useState<any>(null);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  if (!currentUser) return null;

  return (
    <>
      <nav 
        className="global-bottom-navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(255, 255, 255, 0.384)',
          borderTop: '1px solid rgba(155, 73, 25, 0)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '1px',
          height: '35px',
          zIndex: 5000,
          backdropFilter: 'blur(10px)',
          boxShadow: '0 -1px 4px rgba(155, 73, 25, 0)',
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease-in-out'
        }}
      >
        {/* 1. HOME - /user/dashboard */}
        <button 
          className={`global-nav-button ${isActive('/user/dashboard') ? 'active' : ''}`}
          onClick={() => navigate('/user/dashboard')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '1px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            flex: 1,
            height: '30px',
            borderRadius: '3px',
            transition: 'background 0.15s ease',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(155, 73, 25, 0.185)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Home size={16} className="global-nav-icon" style={{
            fontSize: '16px',
            lineHeight: 1,
            height: '14px',
            display: 'flex',
            alignItems: 'center',
            color: '#9B4819'
          }} />
          <span className="global-nav-label" style={{
            fontSize: '9px',
            fontWeight: 700,
            color: '#9B4819',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            marginTop: '-1px'
          }}>Home</span>
          {homeBadge > 0 && (
            <span className="bottom-nav-badge" style={{
              position: 'absolute',
              top: 0,
              right: '8px',
              background: '#ef4444',
              color: 'white',
              fontSize: '8px',
              fontWeight: 600,
              minWidth: '12px',
              height: '12px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid white'
            }}>{homeBadge}</span>
          )}
        </button>

        {/* 2. BUY - /cart */}
        <button 
          className={`global-nav-button ${isActive('/cart') ? 'active' : ''}`}
          onClick={() => navigate('/cart')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '1px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            flex: 1,
            height: '30px',
            borderRadius: '3px',
            transition: 'background 0.15s ease',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(155, 73, 25, 0.185)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <ShoppingCart size={16} className="global-nav-icon" style={{
            fontSize: '16px',
            lineHeight: 1,
            height: '14px',
            display: 'flex',
            alignItems: 'center',
            color: '#9B4819'
          }} />
          <span className="global-nav-label" style={{
            fontSize: '9px',
            fontWeight: 700,
            color: '#9B4819',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            marginTop: '-1px'
          }}>Buy</span>
          {cartCount > 0 && (
            <span className="bottom-nav-badge" style={{
              position: 'absolute',
              top: 0,
              right: '8px',
              background: '#ef4444',
              color: 'white',
              fontSize: '8px',
              fontWeight: 600,
              minWidth: '12px',
              height: '12px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid white'
            }}>{cartCount}</span>
          )}
        </button>

        {/* 3. MARKET - /market */}
        <button 
          className={`global-nav-button ${isActive('/market') ? 'active' : ''}`}
          onClick={() => navigate('/market')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '1px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            flex: 1,
            height: '30px',
            borderRadius: '3px',
            transition: 'background 0.15s ease',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(155, 73, 25, 0.185)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Store size={16} className="global-nav-icon" style={{
            fontSize: '16px',
            lineHeight: 1,
            height: '14px',
            display: 'flex',
            alignItems: 'center',
            color: '#9B4819'
          }} />
          <span className="global-nav-label" style={{
            fontSize: '9px',
            fontWeight: 700,
            color: '#9B4819',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            marginTop: '-1px'
          }}>Market</span>
        </button>

        {/* 4. SELL - /vendor/dashboard */}
        <button 
          className={`global-nav-button ${isActive('/vendor/dashboard') ? 'active' : ''}`}
          onClick={() => navigate('/vendor/dashboard')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '1px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            flex: 1,
            height: '30px',
            borderRadius: '3px',
            transition: 'background 0.15s ease',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(155, 73, 25, 0.185)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <ShoppingBag size={16} className="global-nav-icon" style={{
            fontSize: '16px',
            lineHeight: 1,
            height: '14px',
            display: 'flex',
            alignItems: 'center',
            color: '#9B4819'
          }} />
          <span className="global-nav-label" style={{
            fontSize: '9px',
            fontWeight: 700,
            color: '#9B4819',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            marginTop: '-1px'
          }}>Sell</span>
          {sellCount > 0 && (
            <span className="bottom-nav-badge" style={{
              position: 'absolute',
              top: 0,
              right: '8px',
              background: '#ef4444',
              color: 'white',
              fontSize: '8px',
              fontWeight: 600,
              minWidth: '12px',
              height: '12px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid white'
            }}>{sellCount}</span>
          )}
        </button>

        {/* 5. SIDEBAR - opens global sidebar */}
        <button 
          className="global-nav-button"
          onClick={toggleSidebar}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '1px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            flex: 1,
            height: '30px',
            borderRadius: '3px',
            transition: 'background 0.15s ease',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(155, 73, 25, 0.185)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Menu size={16} className="global-nav-icon" style={{
            fontSize: '16px',
            lineHeight: 1,
            height: '14px',
            display: 'flex',
            alignItems: 'center',
            color: '#9B4819'
          }} />
          <span className="global-nav-label" style={{
            fontSize: '9px',
            fontWeight: 700,
            color: '#9B4819',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            marginTop: '-1px'
          }}>Menu</span>
          {totalBadgeSum > 0 && (
            <span className="bottom-nav-badge" style={{
              position: 'absolute',
              top: 0,
              right: '8px',
              background: '#ef4444',
              color: 'white',
              fontSize: '8px',
              fontWeight: 600,
              minWidth: '12px',
              height: '12px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid white'
            }}>{totalBadgeSum > 99 ? '99+' : totalBadgeSum}</span>
          )}
        </button>
      </nav>

      {/* Global styles */}
      <style>{`
        .global-bottom-navigation {
          transform: translateY(0);
          transition: transform 0.3s ease-in-out;
        }
        .global-bottom-navigation.hidden {
          transform: translateY(100%);
        }
        .global-nav-button.active {
          background: rgba(155, 72, 25, 0.1);
        }
        .global-nav-button.active .global-nav-label,
        .global-nav-button.active .global-nav-icon {
          color: #9B4819;
        }
        .bottom-nav-badge {
          position: absolute;
          top: 0;
          right: 8px;
          background: #ef4444;
          color: white;
          font-size: 8px;
          font-weight: 600;
          min-width: 12px;
          height: 12px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid white;
        }
      `}</style>
    </>
  );
};

export default GlobalBottomNav;