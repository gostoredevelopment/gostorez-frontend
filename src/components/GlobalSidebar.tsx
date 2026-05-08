import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { supabase } from '../lib/supabaseClient';
import { signOut } from 'firebase/auth';
import { useSidebar } from '../contexts/SidebarContext';
import { 
  Home,
  Heart,
  ShoppingCart,
  ShoppingBag,
  MessagesSquare,
  User as UserIcon,
  X,
  RefreshCw,
  Bell,
  Store,
  Sparkle,
  Star,
  LogOut,
  MessageCircle, Video,
  Shield
} from 'lucide-react';

interface GlobalSidebarProps {
  // No props needed - self-contained
}

const GlobalSidebar: React.FC<GlobalSidebarProps> = () => {
  const { isOpen, closeSidebar } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // State for badges
  const [homeBadge, setHomeBadge] = useState(0);
  const [marketBadge, setMarketBadge] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [shopBadge, setShopBadge] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userFirebaseUid, setUserFirebaseUid] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Fetch all data when user logs in
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log('========== AUTH STATE CHANGED ==========');
      console.log('Firebase user object:', user);
      console.log('User UID:', user?.uid);
      
      setCurrentUser(user);
      
      if (user) {
        setUserFirebaseUid(user.uid);
        
        // STEP 1: Fetch user role from Firebase Firestore (like Admin page)
        console.log('STEP 1: Fetching user role from Firestore for UID:', user.uid);
        
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          console.log('Firestore document exists:', userDoc.exists());
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('Firestore user data:', userData);
            console.log('User role from Firestore:', userData.role);
            setUserRole(userData.role || null);
          } else {
            console.log('No user document found in Firestore');
            setUserRole(null);
          }
        } catch (error) {
          console.error('Exception fetching user role from Firestore:', error);
          setUserRole(null);
        }
        
        // STEP 2: Fetch all badges
        console.log('STEP 2: Fetching badges for user');
        await Promise.all([
          fetchHomeBadge(user.uid),
          fetchFavoritesCount(user.uid),
          fetchCartCount(user.uid),
          fetchShopBadge(user.uid),
          fetchMessagesUnread(user.uid),
          fetchNotificationsUnread(user.uid)
        ]);
      } else {
        console.log('No user logged in - resetting all states');
        // Reset all counts
        setHomeBadge(0);
        setFavoritesCount(0);
        setCartCount(0);
        setShopBadge(0);
        setMessagesUnread(0);
        setNotificationsUnread(0);
        setUserRole(null);
      }
      
      console.log('Final userRole state after auth change:', userRole);
      console.log('==========================================');
    });
    return () => unsubscribe();
  }, []);

  // Generate random market badge once on mount (0-19)
  useEffect(() => {
    setMarketBadge(Math.floor(Math.random() * 20));
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        closeSidebar();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeSidebar]);

  // Fetch home badge: new orders + (accepted - received)
  const fetchHomeBadge = async (userId: string) => {
    try {
      // Get all orders for this user
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', userId);

      if (!orders || orders.length === 0) {
        setHomeBadge(0);
        return;
      }

      const orderIds = orders.map(o => o.id);
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('vendor_status, user_status')
        .in('order_id', orderIds);

      if (!orderItems) return;

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
    } catch (error) {
      console.error('Error fetching home badge:', error);
    }
  };

  const fetchFavoritesCount = async (userId: string) => {
    try {
      const { count } = await supabase
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      setFavoritesCount(count || 0);
    } catch (error) {
      console.error('Error fetching favorites count:', error);
    }
  };

  const fetchCartCount = async (userId: string) => {
    try {
      const { count } = await supabase
        .from('carts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      setCartCount(count || 0);
    } catch (error) {
      console.error('Error fetching cart count:', error);
    }
  };

  const fetchShopBadge = async (userId: string) => {
    try {
      const { data: vendorProfiles } = await supabase
        .from('vendor_profiles')
        .select('vendor_id')
        .eq('user_id', userId);

      if (!vendorProfiles || vendorProfiles.length === 0) {
        setShopBadge(0);
        return;
      }

      const vendorIds = vendorProfiles.map(v => v.vendor_id);
      const { count } = await supabase
        .from('order_items')
        .select('*', { count: 'exact', head: true })
        .in('vendor_id', vendorIds)
        .eq('vendor_status', 'pending')
        .neq('user_status', 'cancelled');

      setShopBadge(count || 0);
    } catch (error) {
      console.error('Error fetching shop badge:', error);
    }
  };

  // Messages badge using notification type 'chat'
  const fetchMessagesUnread = async (userId: string) => {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .contains('receiver_ids', [userId])
        .eq('notification_type', 'chat')
        .eq('read', false);

      setMessagesUnread(count || 0);
    } catch (error) {
      console.error('Error fetching messages unread:', error);
    }
  };

  const fetchNotificationsUnread = async (userId: string) => {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .contains('receiver_ids', [userId])
        .eq('read', false);

      setNotificationsUnread(count || 0);
    } catch (error) {
      console.error('Error fetching notifications unread:', error);
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    closeSidebar();
  };

  const handleSignOut = async () => {
    await signOut(auth);
    handleNavigate('/signin');
  };

  // Check if current route matches the button path
  const isActive = (path: string): boolean => {
    if (path === '/user/dashboard' && location.pathname === '/user/dashboard') return true;
    if (path === '/market' && location.pathname === '/market') return true;
    if (path === '/favorites' && location.pathname === '/favorites') return true;
    if (path === '/cart' && location.pathname === '/cart') return true;
    if (path === '/vendor/dashboard' && location.pathname === '/vendor/dashboard') return true;
    if (path === '/vendor-onboarding' && location.pathname === '/vendor-onboarding') return true;
    if (path === '/chats' && location.pathname.startsWith('/chats')) return true;
    if (path === '/notifications' && location.pathname === '/notifications') return true;
    if (path === '/feedbacks' && location.pathname === '/feedbacks') return true;
    if (path === '/admin' && location.pathname === '/admin') return true;
    return false;
  };

  // Log role state on every render for debugging
  console.log('🔍 Current userRole in render:', userRole);
  console.log('🔍 Should show admin button?', userRole === 'admin');

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="sidebar-overlay"
        onClick={closeSidebar}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(155, 72, 25, 0.1)',
          backdropFilter: 'blur(5px)',
          zIndex: 2000,
          animation: 'fadeIn 0.3s ease'
        }}
      />
      
      {/* Sidebar Menu - now scrollable */}
      <div 
        ref={sidebarRef}
        className="sidebar-menu"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          background: '#ffffff',
          borderLeft: '1px solid rgba(155, 72, 25, 0.15)',
          borderRadius: '12px 0 0 12px',
          boxShadow: '-4px 0 20px rgba(155, 72, 25, 0.15)',
          padding: 0,
          width: '280px',
          height: '100%',
          zIndex: 2001,
          animation: 'sidebarSlideIn 0.3s ease',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className="sidebar-header" style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(155, 72, 25, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: '#ffffff',
          zIndex: 10
        }}>
          <h3 className="sidebar-title" style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#9B4819',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>Menu</h3>
          <button 
            className="sidebar-close" 
            onClick={closeSidebar}
            style={{
              background: 'rgba(155, 72, 25, 0.1)',
              border: 'none',
              cursor: 'pointer',
              color: '#9B4819',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(155, 72, 25, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(155, 72, 25, 0.1)';
            }}
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="sidebar-content" style={{
          padding: '8px 0',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'visible'
        }}>
          {/* Home */}
          <button 
            className="sidebar-item"
            onClick={() => handleNavigate('/user/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 20px 12px 14px',
              background: isActive('/user/dashboard') ? 'rgba(155, 72, 25, 0.08)' : 'none',
              border: 'none',
              fontSize: '15px',
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer',
              color: '#333',
              margin: '2px 8px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
              const badge = e.currentTarget.querySelector('.sidebar-badge');
              if (badge) (badge as HTMLElement).style.backgroundColor = 'transparent';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive('/user/dashboard') ? 'rgba(155, 72, 25, 0.08)' : 'none';
              const badge = e.currentTarget.querySelector('.sidebar-badge');
              if (badge) {
                (badge as HTMLElement).style.backgroundColor = isActive('/user/dashboard') ? 'transparent' : 'rgba(155, 72, 25, 0.08)';
              }
            }}
          >
            <Home size={20} color="#9B4819" />
            <span style={{ flex: 1, color: '#333' }}>Home</span>
            {homeBadge > 0 && (
              <span className="sidebar-badge" style={{
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '20px',
                height: '20px',
                padding: '0 6px',
                lineHeight: 1,
                marginLeft: 'auto',
                backgroundColor: isActive('/user/dashboard') ? 'transparent' : 'rgba(155, 72, 25, 0.08)',
                borderRadius: '10px',
                transition: 'background-color 0.2s ease'
              }}>{homeBadge}</span>
            )}
          </button>

          {/* Marketplace */}
          <button 
            className="sidebar-item"
            onClick={() => handleNavigate('/market')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 20px 12px 14px',
              background: isActive('/market') ? 'rgba(155, 72, 25, 0.08)' : 'none',
              border: 'none',
              fontSize: '15px',
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer',
              color: '#333',
              margin: '2px 8px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
              const badge = e.currentTarget.querySelector('.sidebar-badge');
              if (badge) (badge as HTMLElement).style.backgroundColor = 'transparent';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive('/market') ? 'rgba(155, 72, 25, 0.08)' : 'none';
              const badge = e.currentTarget.querySelector('.sidebar-badge');
              if (badge) {
                (badge as HTMLElement).style.backgroundColor = isActive('/market') ? 'transparent' : 'rgba(155, 72, 25, 0.08)';
              }
            }}
          >
            <Store size={20} color="#9B4819" />
            <span style={{ flex: 1, color: '#333' }}>Marketplace</span>
            {marketBadge > 0 && (
              <span className="sidebar-badge" style={{
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '20px',
                height: '20px',
                padding: '0 6px',
                lineHeight: 1,
                marginLeft: 'auto',
                backgroundColor: isActive('/market') ? 'transparent' : 'rgba(155, 72, 25, 0.08)',
                borderRadius: '10px',
                transition: 'background-color 0.2s ease'
              }}>{marketBadge}</span>
            )}
          </button>
          
          {/* Favourites */}
          <button 
            className="sidebar-item"
            onClick={() => handleNavigate('/favorites')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 20px 12px 14px',
              background: isActive('/favorites') ? 'rgba(155, 72, 25, 0.08)' : 'none',
              border: 'none',
              fontSize: '15px',
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer',
              color: '#333',
              margin: '2px 8px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
              const badge = e.currentTarget.querySelector('.sidebar-badge');
              if (badge) (badge as HTMLElement).style.backgroundColor = 'transparent';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive('/favorites') ? 'rgba(155, 72, 25, 0.08)' : 'none';
              const badge = e.currentTarget.querySelector('.sidebar-badge');
              if (badge) {
                (badge as HTMLElement).style.backgroundColor = isActive('/favorites') ? 'transparent' : 'rgba(155, 72, 25, 0.08)';
              }
            }}
          >
            <Heart size={20} color="#9B4819" />
            <span style={{ flex: 1, color: '#333' }}>Favourites</span>
            {favoritesCount > 0 && (
              <span className="sidebar-badge" style={{
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '20px',
                height: '20px',
                padding: '0 6px',
                lineHeight: 1,
                marginLeft: 'auto',
                backgroundColor: isActive('/favorites') ? 'transparent' : 'rgba(155, 72, 25, 0.08)',
                borderRadius: '10px',
                transition: 'background-color 0.2s ease'
              }}>{favoritesCount}</span>
            )}
          </button>
          
          {/* Cart */}
          <button 
            className="sidebar-item"
            onClick={() => handleNavigate('/cart')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 20px 12px 14px',
              background: isActive('/cart') ? 'rgba(155, 72, 25, 0.08)' : 'none',
              border: 'none',
              fontSize: '15px',
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer',
              color: '#333',
              margin: '2px 8px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
              const badge = e.currentTarget.querySelector('.sidebar-badge');
              if (badge) (badge as HTMLElement).style.backgroundColor = 'transparent';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive('/cart') ? 'rgba(155, 72, 25, 0.08)' : 'none';
              const badge = e.currentTarget.querySelector('.sidebar-badge');
              if (badge) {
                (badge as HTMLElement).style.backgroundColor = isActive('/cart') ? 'transparent' : 'rgba(155, 72, 25, 0.08)';
              }
            }}
          >
            <ShoppingCart size={20} color="#9B4819" />
            <span style={{ flex: 1, color: '#333' }}>Cart</span>
            {cartCount > 0 && (
              <span className="sidebar-badge" style={{
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '20px',
                height: '20px',
                padding: '0 6px',
                lineHeight: 1,
                marginLeft: 'auto',
                backgroundColor: isActive('/cart') ? 'transparent' : 'rgba(155, 72, 25, 0.08)',
                borderRadius: '10px',
                transition: 'background-color 0.2s ease'
              }}>{cartCount}</span>
            )}
          </button>

          {/* My Shop */}
          {currentUser && (
            <button 
              className="sidebar-item"
              onClick={() => handleNavigate('/vendor/dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 20px 12px 14px',
                background: isActive('/vendor/dashboard') ? 'rgba(155, 72, 25, 0.08)' : 'none',
                border: 'none',
                fontSize: '15px',
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                color: '#333',
                margin: '2px 8px',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
                const badge = e.currentTarget.querySelector('.sidebar-badge');
                if (badge) (badge as HTMLElement).style.backgroundColor = 'transparent';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isActive('/vendor/dashboard') ? 'rgba(155, 72, 25, 0.08)' : 'none';
                const badge = e.currentTarget.querySelector('.sidebar-badge');
                if (badge) {
                  (badge as HTMLElement).style.backgroundColor = isActive('/vendor/dashboard') ? 'transparent' : 'rgba(155, 72, 25, 0.08)';
                }
              }}
            >
              <ShoppingBag size={20} color="#9B4819" />
              <span style={{ flex: 1, color: '#333' }}>My Shop</span>
              {shopBadge > 0 && (
                <span className="sidebar-badge" style={{
                  color: '#ef4444',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '20px',
                  height: '20px',
                  padding: '0 6px',
                  lineHeight: 1,
                  marginLeft: 'auto',
                  backgroundColor: isActive('/vendor/dashboard') ? 'transparent' : 'rgba(155, 72, 25, 0.08)',
                  borderRadius: '10px',
                  transition: 'background-color 0.2s ease'
                }}>{shopBadge}</span>
              )}
            </button>
          )}
          
          {/* Become a Vendor */}
          {currentUser && (
            <button 
              className="sidebar-item"
              onClick={() => handleNavigate('/vendor-onboarding')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 20px 12px 14px',
                background: isActive('/vendor-onboarding') ? 'rgba(155, 72, 25, 0.08)' : 'none',
                border: 'none',
                fontSize: '15px',
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                color: '#333',
                margin: '2px 8px',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isActive('/vendor-onboarding') ? 'rgba(155, 72, 25, 0.08)' : 'none';
              }}
            >
              <Sparkle size={20} color="#9B4819" />
              <span style={{ flex: 1, color: '#333' }}>Become a Vendor</span>
              <Star size={16} color="#fbbf24" style={{ marginLeft: 'auto' }} />
            </button>
          )}
          
          {/* Messages */}
          <button 
            className="sidebar-item"
            onClick={() => handleNavigate('/chats')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 20px 12px 14px',
              background: isActive('/chats') ? 'rgba(155, 72, 25, 0.08)' : 'none',
              border: 'none',
              fontSize: '15px',
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer',
              color: '#333',
              margin: '2px 8px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
              const badge = e.currentTarget.querySelector('.sidebar-badge');
              if (badge) (badge as HTMLElement).style.backgroundColor = 'transparent';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive('/chats') ? 'rgba(155, 72, 25, 0.08)' : 'none';
              const badge = e.currentTarget.querySelector('.sidebar-badge');
              if (badge) {
                (badge as HTMLElement).style.backgroundColor = isActive('/chats') ? 'transparent' : 'rgba(155, 72, 25, 0.08)';
              }
            }}
          >
            <MessagesSquare size={20} color="#9B4819" />
            <span style={{ flex: 1, color: '#333' }}>Messages</span>
            {messagesUnread > 0 && (
              <span className="sidebar-badge" style={{
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '20px',
                height: '20px',
                padding: '0 6px',
                lineHeight: 1,
                marginLeft: 'auto',
                backgroundColor: isActive('/chats') ? 'transparent' : 'rgba(155, 72, 25, 0.08)',
                borderRadius: '10px',
                transition: 'background-color 0.2s ease'
              }}>{messagesUnread}</span>
            )}
          </button>

          {/* Notifications */}
          <button 
            className="sidebar-item"
            onClick={() => handleNavigate('/notifications')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 20px 12px 14px',
              background: isActive('/notifications') ? 'rgba(155, 72, 25, 0.08)' : 'none',
              border: 'none',
              fontSize: '15px',
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer',
              color: '#333',
              margin: '2px 8px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
              const badge = e.currentTarget.querySelector('.sidebar-badge');
              if (badge) (badge as HTMLElement).style.backgroundColor = 'transparent';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive('/notifications') ? 'rgba(155, 72, 25, 0.08)' : 'none';
              const badge = e.currentTarget.querySelector('.sidebar-badge');
              if (badge) {
                (badge as HTMLElement).style.backgroundColor = isActive('/notifications') ? 'transparent' : 'rgba(155, 72, 25, 0.08)';
              }
            }}
          >
            <Bell size={20} color="#9B4819" />
            <span style={{ flex: 1, color: '#333' }}>Notifications</span>
            {notificationsUnread > 0 && (
              <span className="sidebar-badge" style={{
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '20px',
                height: '20px',
                padding: '0 6px',
                lineHeight: 1,
                marginLeft: 'auto',
                backgroundColor: isActive('/notifications') ? 'transparent' : 'rgba(155, 72, 25, 0.08)',
                borderRadius: '10px',
                transition: 'background-color 0.2s ease'
              }}>{notificationsUnread}</span>
            )}
          </button>


                    {/*open market */}
          <button 
            className="sidebar-item"
            onClick={() => handleNavigate('/OpenMarket')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 20px 12px 14px',
              background: isActive('/feedbacks') ? 'rgba(155, 72, 25, 0.08)' : 'none',
              border: 'none',
              fontSize: '15px',
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer',
              color: '#333',
              margin: '2px 8px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive('/feedbacks') ? 'rgba(155, 72, 25, 0.08)' : 'none';
            }}
          >
            <Video size={20} color="#9B4819" />
            <span style={{ flex: 1, color: '#333' }}>Community</span>
          </button>

          {/* Feedback */}
          <button 
            className="sidebar-item"
            onClick={() => handleNavigate('/feedbacks')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 20px 12px 14px',
              background: isActive('/feedbacks') ? 'rgba(155, 72, 25, 0.08)' : 'none',
              border: 'none',
              fontSize: '15px',
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer',
              color: '#333',
              margin: '2px 8px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive('/feedbacks') ? 'rgba(155, 72, 25, 0.08)' : 'none';
            }}
          >
            <MessageCircle size={20} color="#9B4819" />
            <span style={{ flex: 1, color: '#333' }}>Feedback</span>
          </button>

          {/* ADMIN BUTTON - Only shows when user role from Firestore is exactly "admin" */}
          {userRole === 'admin' && (
            <button 
              className="sidebar-item"
              onClick={() => handleNavigate('/admin')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 20px 12px 14px',
                background: isActive('/admin') ? 'rgba(155, 72, 25, 0.08)' : 'none',
                border: 'none',
                fontSize: '15px',
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                color: '#333',
                margin: '2px 8px',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isActive('/admin') ? 'rgba(155, 72, 25, 0.08)' : 'none';
              }}
            >
              <Shield size={20} color="#9B4819" />
              <span style={{ flex: 1, color: '#333' }}>Admin</span>
            </button>
          )}

          {/* Divider */}
          <div style={{
            height: '1px',
            background: 'rgba(155, 72, 25, 0.1)',
            margin: '12px 20px'
          }} />
          
          {/* My Account */}
          {currentUser && (
            <button 
              className="sidebar-item"
              onClick={() => handleNavigate('/user/profile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 20px 12px 14px',
                background: isActive('/user/dashboard') ? 'rgba(155, 72, 25, 0.08)' : 'none',
                border: 'none',
                fontSize: '15px',
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                color: '#333',
                margin: '2px 8px',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isActive('/user/dashboard') ? 'rgba(155, 72, 25, 0.08)' : 'none';
              }}
            >
              <UserIcon size={20} color="#9B4819" />
              <span style={{ flex: 1, color: '#333' }}>My Account</span>
            </button>
          )}
          
          {/* Sign Out */}
          {currentUser && (
            <button 
              className="sidebar-item"
              onClick={handleSignOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 20px 12px 14px',
                background: 'none',
                border: 'none',
                fontSize: '15px',
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                color: '#ef4444',
                margin: '2px 8px',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
              }}
            >
              <LogOut size={20} color="#ef4444" />
              <span style={{ flex: 1, color: '#ef4444' }}>Sign Out</span>
            </button>
          )}

          {/* Sign In (if not logged in) */}
          {!currentUser && (
            <button 
              className="sidebar-item"
              onClick={() => handleNavigate('/signin')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 20px 12px 14px',
                background: isActive('/signin') ? 'rgba(155, 72, 25, 0.08)' : 'none',
                border: 'none',
                fontSize: '15px',
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                color: '#333',
                margin: '2px 8px',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isActive('/signin') ? 'rgba(155, 72, 25, 0.08)' : 'none';
              }}
            >
              <UserIcon size={20} color="#9B4819" />
              <span style={{ flex: 1, color: '#333' }}>Sign In</span>
            </button>
          )}
          
          {/* Refresh */}
          <button 
            className="sidebar-item"
            onClick={() => window.location.reload()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 20px 12px 14px',
              background: 'none',
              border: 'none',
              fontSize: '15px',
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer',
              color: '#333',
              margin: '2px 8px 16px 8px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(155, 72, 25, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <RefreshCw size={20} color="#9B4819" />
            <span style={{ flex: 1, color: '#333' }}>Refresh</span>
          </button>
        </div>
      </div>

      {/* Add animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes sidebarSlideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .sidebar-item {
          cursor: pointer;
        }
        
        /* Hide scrollbar for cleaner look but keep functionality */
        .sidebar-menu::-webkit-scrollbar {
          width: 4px;
        }
        
        .sidebar-menu::-webkit-scrollbar-track {
          background: rgba(155, 72, 25, 0.05);
        }
        
        .sidebar-menu::-webkit-scrollbar-thumb {
          background: rgba(155, 72, 25, 0.2);
          border-radius: 4px;
        }
        
        .sidebar-menu::-webkit-scrollbar-thumb:hover {
          background: rgba(155, 72, 25, 0.3);
        }
      `}</style>
    </>
  );
};

export default GlobalSidebar;