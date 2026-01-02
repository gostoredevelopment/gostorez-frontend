import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { supabase } from '../../lib/supabaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  Home,
  Bell,
  ShoppingCart,
  Heart,
  Package,
  Wallet,
  Clock,
  Plus,
  Send,
  ShoppingBag,
  Store,
  RefreshCw,
  ChevronRight,
  Eye,
  EyeOff,
  Star,
  MessageSquare,
  History,
  Users,
  Database,
  Gift,
  User,
  Settings,
  HelpCircle,
  CheckCheck,
  Truck,
  Wifi,
  Zap,
  Smartphone,
  Trophy,
  HandHeart,
  Tv,
  Camera,
  Music,
  Coffee,
  BookOpen,
  CreditCard,
  TrendingUp,
  Shield,
  Globe
} from 'lucide-react';
import './UserDashboard.css';

// Types
interface UserProfile {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: string;
  isVerified: boolean;
  createdAt: string;
  profileImage?: string;
  bio?: string;
  location?: string;
  availableBalance?: number;
  pendingBalance?: number;
  currency?: string;
}

interface DashboardStat {
  id: string;
  label: string;
  value: number;
  icon: React.ReactNode;
}

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
}

interface UtilityItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  route: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  currency: string;
  images: string[];
  vendor_id: string;
  vendor_name: string;
  created_at: string;
  category?: string;
  condition?: string;
  inventory?: number;
  is_promoted?: boolean;
  views_count?: number;
  likes_count?: number;
  sales_count?: number;
}

interface VendorProfile {
  id: string;
  vendor_id: string;
  shop_name: string;
  profile_image: string;
  cover_image?: string;
  rating: number;
  followers_count: number;
  completed_trades: number;
  is_verified: boolean;
  online_status: boolean;
}

const UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showBalance, setShowBalance] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStat[]>([
    { id: 'processed', label: 'Processed', value: 0, icon: <CheckCheck size={14} /> },
    { id: 'pending', label: 'Pending', value: 0, icon: <Clock size={14} /> },
    { id: 'delivered', label: 'Delivered', value: 0, icon: <Truck size={14} /> },
    { id: 'cart', label: 'In Cart', value: 0, icon: <ShoppingCart size={14} /> },
    { id: 'favorites', label: 'Favorites', value: 0, icon: <Heart size={14} /> },
    { id: 'reviews', label: 'Reviews', value: 0, icon: <Star size={14} /> }
  ]);
  
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: '1', type: 'success', title: 'Order Processing', message: 'Your order is being processed', time: '2 min ago', isRead: false },
    { id: '2', type: 'warning', title: 'Storage Alert', message: 'Your storage is at 85%', time: '1 hour ago', isRead: false }
  ]);
  
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [utilityFeatureUnavailable, setUtilityFeatureUnavailable] = useState<string | null>(null);
  const [vendorProfiles, setVendorProfiles] = useState<Record<string, VendorProfile>>({});
  const [cartStatus, setCartStatus] = useState<{ [key: string]: boolean }>({});

  // Utility items - TOTAL 20 ITEMS (10 existing + 10 new)
  const utilities: UtilityItem[] = useMemo(() => [
    // Original 10 items
    { id: 'orders', name: 'My Orders', icon: <Package size={16} />, route: '/orders' },
    { id: 'transactions', name: 'Transaction History', icon: <History size={16} />, route: '/transactions' },
    { id: 'shop', name: 'My Shop', icon: <Store size={16} />, route: '/vendor/dashboard' },
    { id: 'storage', name: 'Storage', icon: <Database size={16} />, route: '/storage' },
    { id: 'cart', name: 'Cart', icon: <ShoppingCart size={16} />, route: '/cart' },
    { id: 'favorites', name: 'Favorites', icon: <Heart size={16} />, route: '/favorites' },
    { id: 'invite', name: 'Invite & Earn', icon: <Users size={16} />, route: '/invite' },
    { id: 'profile', name: 'My Profile', icon: <User size={16} />, route: '/user/profile' },
    { id: 'settings', name: 'Settings', icon: <Settings size={16} />, route: '/settings' },
    { id: 'help', name: 'Help & Support', icon: <HelpCircle size={16} />, route: '/help' },
    
    // NEW 10 items added
    { id: 'data', name: 'Data', icon: <Wifi size={16} />, route: '/services/data' },
    { id: 'airtime', name: 'Airtime', icon: <Smartphone size={16} />, route: '/services/airtime' },
    { id: 'electricity', name: 'Electricity', icon: <Zap size={16} />, route: '/services/electricity' },
    { id: 'giftcard', name: 'Gift Cards', icon: <Gift size={16} />, route: '/services/giftcards' },
    { id: 'betting', name: 'Betting', icon: <Trophy size={16} />, route: '/services/betting' },
    { id: 'charity', name: 'Charity', icon: <HandHeart size={16} />, route: '/services/charity' },
    { id: 'tv', name: 'TV Sub', icon: <Tv size={16} />, route: '/services/tv' },
    { id: 'music', name: 'Music', icon: <Music size={16} />, route: '/services/music' },
    { id: 'coffee', name: 'Coffee', icon: <Coffee size={16} />, route: '/services/coffee' },
    { id: 'books', name: 'Books', icon: <BookOpen size={16} />, route: '/services/books' }
  ], []);

  // Initialize user balance in Firestore users collection
  const initializeUserBalance = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const updates: any = {};
        let needsUpdate = false;
        
        // Check if balance fields exist, if not add them
        if (userData.availableBalance === undefined) {
          updates.availableBalance = 0;
          needsUpdate = true;
        }
        if (userData.pendingBalance === undefined) {
          updates.pendingBalance = 0;
          needsUpdate = true;
        }
        if (userData.currency === undefined) {
          updates.currency = 'NGN';
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await updateDoc(userRef, updates);
          console.log('User balance fields initialized');
        }
        
        // Update user profile with balance data
        const updatedProfile: UserProfile = {
          id: userId,
          email: userData.email || '',
          phone: userData.phone || '',
          name: userData.name || 'User',
          role: userData.role || 'user',
          isVerified: userData.isVerified || false,
          createdAt: userData.createdAt?.toDate().toISOString() || new Date().toISOString(),
          profileImage: userData.profileImage || '',
          bio: userData.bio || '',
          location: userData.location || '',
          availableBalance: userData.availableBalance || 0,
          pendingBalance: userData.pendingBalance || 0,
          currency: userData.currency || 'NGN'
        };
        
        setUserProfile(updatedProfile);
      }
    } catch (error) {
      console.error('Error initializing user balance:', error);
    }
  };

  // Fetch user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await initializeUserBalance(user.uid);
        await fetchUserStats(user.uid);
        await fetchTopProducts();
      } else {
        navigate('/signin');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  // Fetch vendor profiles in batch
  const fetchVendorProfiles = async (vendorIds: string[]) => {
    try {
      const uniqueVendorIds = Array.from(new Set(vendorIds));
      if (uniqueVendorIds.length === 0) return {};
      
      const { data: vendorsData, error } = await supabase
        .from('vendor_profiles')
        .select('*')
        .in('vendor_id', uniqueVendorIds);

      if (error) {
        console.error('Error fetching vendor profiles:', error);
        return {};
      }

      const profiles: Record<string, VendorProfile> = {};
      vendorsData?.forEach(vendor => {
        profiles[vendor.vendor_id] = {
          id: vendor.id,
          vendor_id: vendor.vendor_id,
          shop_name: vendor.shop_name || 'Shop',
          profile_image: vendor.profile_image || '',
          cover_image: vendor.cover_image,
          rating: vendor.rating || 0,
          followers_count: vendor.followers_count || 0,
          completed_trades: vendor.completed_trades || 0,
          is_verified: vendor.is_verified || false,
          online_status: vendor.online_status || false
        };
      });

      return profiles;
    } catch (error) {
      console.error('Error in fetchVendorProfiles:', error);
      return {};
    }
  };

  // Fetch top 6 newest products (like FavoritesPage)
  const fetchTopProducts = async () => {
    try {
      // Fetch 6 newest products
      const { data: productsData, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) {
        console.error('Error fetching top products:', error);
        return;
      }

      const products: Product[] = productsData || [];
      setRecommendedProducts(products);
      
      // Fetch vendor profiles for all products
      const vendorIds = products.map(p => p.vendor_id).filter(Boolean);
      const profiles = await fetchVendorProfiles(vendorIds);
      setVendorProfiles(profiles);
      
    } catch (error) {
      console.error('Error fetching top products:', error);
      setRecommendedProducts([]);
    }
  };

  const fetchUserStats = async (userId: string) => {
    try {
      // Cart count
      const { count: cartCount } = await supabase
        .from('carts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Favorites count
      const { count: favoritesCount } = await supabase
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Processed orders count (completed)
      const { count: processedCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'delivered');

      // Pending orders count
      const { count: pendingCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['pending', 'processing']);

      // Delivered orders count
      const { count: deliveredCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'delivered');

      // Reviews count
      const { count: reviewsCount } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      setStats([
        { id: 'processed', label: 'Processed', value: processedCount || 0, icon: <CheckCheck size={14} /> },
        { id: 'pending', label: 'Pending', value: pendingCount || 0, icon: <Clock size={14} /> },
        { id: 'delivered', label: 'Delivered', value: deliveredCount || 0, icon: <Truck size={14} /> },
        { id: 'cart', label: 'In Cart', value: cartCount || 0, icon: <ShoppingCart size={14} /> },
        { id: 'favorites', label: 'Favorites', value: favoritesCount || 0, icon: <Heart size={14} /> },
        { id: 'reviews', label: 'Reviews', value: reviewsCount || 0, icon: <Star size={14} /> }
      ]);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'NGN'): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPrice = (price: number) => `₦${price.toLocaleString('en-NG')}`;

  const formatUserName = (name: string): string => {
    const parts = name.split(' ');
    return parts.slice(0, 2).join(' ');
  };

  const handleShopClick = async () => {
    if (!auth.currentUser) {
      navigate('/signin');
      return;
    }

    try {
      // Check if user already has a vendor profile
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('user_id', auth.currentUser.uid);

      if (error) {
        console.error('Error checking vendor profile:', error);
        navigate('/vendor-onboarding');
        return;
      }

      if (data && data.length > 0) {
        // User has a shop, go to vendor dashboard
        navigate('/vendor/dashboard');
      } else {
        // No shop, prompt to create one
        if (window.confirm('You don\'t have a shop yet. Would you like to create one?')) {
          navigate('/vendor-onboarding');
        }
      }
    } catch (error) {
      console.error('Error in shop click handler:', error);
      navigate('/vendor-onboarding');
    }
  };

  const handleUtilityClick = (utility: UtilityItem) => {
    // Check if route exists
    const existingRoutes = [
      '/orders',
      '/transactions',
      '/vendor/dashboard',
      '/storage',
      '/cart',
      '/favorites',
      '/invite',
      '/user/profile',
      '/settings',
      '/help',
      '/services/data',
      '/services/airtime',
      '/services/electricity',
      '/services/giftcards',
      '/services/betting',
      '/services/charity',
      '/services/tv',
      '/services/music',
      '/services/coffee',
      '/services/books'
    ];
    
    if (existingRoutes.includes(utility.route)) {
      navigate(utility.route);
    } else {
      setUtilityFeatureUnavailable(utility.name);
      setTimeout(() => setUtilityFeatureUnavailable(null), 3000);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    if (userProfile) {
      await fetchUserStats(userProfile.id);
      await fetchTopProducts();
    }
    setTimeout(() => setLoading(false), 500);
  };

  // Handle product click to navigate to vendor shop
  const handleProductClick = (vendorId: string, productId: string) => {
    navigate(`/vendor/${vendorId}`, { 
      state: { 
        initialProductId: productId,
        fromDashboard: true 
      } 
    });
  };

  // Handle vendor click
  const handleVendorClick = (vendorId: string) => {
    navigate(`/vendor/${vendorId}`);
  };

  const cartCount = stats.find(s => s.id === 'cart')?.value || 0;
  const favoritesCount = stats.find(s => s.id === 'favorites')?.value || 0;

  if (loading && !userProfile) {
    return (
      <div className="userdashboard-loading">
        <div className="userdashboard-loading-spinner">
          <RefreshCw className="userdashboard-animate-spin" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="userdashboard-container">
      {/* Fixed Header */}
      <header className="userdashboard-header">
        <div className="userdashboard-header-left">
          {userProfile?.profileImage ? (
            <img 
              src={userProfile.profileImage} 
              alt="User" 
              className="userdashboard-avatar"
              onClick={() => navigate('/user/profile')}
            />
          ) : (
            <div 
              className="userdashboard-avatar-placeholder"
              onClick={() => navigate('/user/profile')}
            >
              {userProfile?.name?.charAt(0) || 'U'}
            </div>
          )}
          <div className="userdashboard-welcome">
            <span className="userdashboard-welcome-text">Welcome back,</span>
            <span className="userdashboard-user-name">{userProfile ? formatUserName(userProfile.name) : 'User'}</span>
          </div>
        </div>
        
        <div className="userdashboard-header-right">
          <button 
            className="userdashboard-notification-btn"
            onClick={() => navigate('/notifications')}
          >
            <Bell size={18} />
          </button>
          
          <button 
            className="userdashboard-refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'userdashboard-animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Balance Section */}
      <section className="userdashboard-balance-section">
        <div className="userdashboard-balance-container">
          <div className="userdashboard-balance-left">
            <div className="userdashboard-balance-label">Available Balance</div>
            <div className="userdashboard-balance-amount">
              {showBalance ? formatCurrency(userProfile?.availableBalance || 0, userProfile?.currency) : '••••••'}
            </div>
            
            {/* Icons under available balance */}
            <div className="userdashboard-balance-actions">
              <button 
                className="userdashboard-fund-btn"
                onClick={() => navigate('/wallet/fund')}
              >
                <Plus size={14} />
              </button>
              <button 
                className="userdashboard-transfer-btn"
                onClick={() => navigate('/transfer')}
              >
                <Send size={14} />
              </button>
              <button 
                className="userdashboard-eye-btn"
                onClick={() => setShowBalance(!showBalance)}
              >
                {showBalance ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          </div>
          
          <div className="userdashboard-balance-right">
            <div className="userdashboard-balance-label">Pending Balance</div>
            <div className="userdashboard-balance-amount">
              {showBalance ? formatCurrency(userProfile?.pendingBalance || 0, userProfile?.currency) : '••••••'}
            </div>
            <div className="userdashboard-balance-subtext">Unprocessed funds</div>
          </div>
        </div>
      </section>

      {/* Stats Section - 6 stats */}
      <section className="userdashboard-stats-section">
        <div className="userdashboard-stats-grid">
          {stats.map(stat => (
            <div key={stat.id} className="userdashboard-stat-card">
              <div className="userdashboard-stat-icon">{stat.icon}</div>
              <div className="userdashboard-stat-content">
                <div className="userdashboard-stat-value">{stat.value}</div>
                <div className="userdashboard-stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section className="userdashboard-notifications-section">
        <div className="userdashboard-notifications-header">
          <h3 className="userdashboard-section-title">Notifications</h3>
          <ChevronRight size={14} />
        </div>
        
        <div className="userdashboard-notifications-list">
          {notifications.map(notification => (
            <div 
              key={notification.id} 
              className={`userdashboard-notification-item ${notification.isRead ? '' : 'unread'}`}
            >
              <div className="userdashboard-notification-icon">
                {notification.type === 'success' && <Star size={12} />}
                {notification.type === 'warning' && <Bell size={12} />}
              </div>
              <div className="userdashboard-notification-content">
                <div className="userdashboard-notification-title">{notification.title}</div>
                <div className="userdashboard-notification-message">{notification.message}</div>
              </div>
              <div className="userdashboard-notification-time">{notification.time}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Utilities - TOTAL 20 items */}
      <section className="userdashboard-utilities-section">
        <div className="userdashboard-utilities-header">
          <h3 className="userdashboard-section-title">Quick Actions</h3>
          <ChevronRight size={14} />
        </div>
        
        <div className="userdashboard-utilities-grid">
          {utilities.map(utility => (
            <button
              key={utility.id}
              className="userdashboard-utility-card"
              onClick={() => handleUtilityClick(utility)}
            >
              <div className="userdashboard-utility-icon">{utility.icon}</div>
              <span className="userdashboard-utility-name">{utility.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Top Products Section - Displayed like FavoritesPage */}
      <section className="userdashboard-topproducts-section">
        <div className="userdashboard-topproducts-header">
          <h3 className="userdashboard-section-title">Newest Products</h3>
          <button 
            className="userdashboard-view-all-btn"
            onClick={() => navigate('/marketplace')}
          >
            See More
          </button>
        </div>
        
        {recommendedProducts.length === 0 ? (
          <div className="userdashboard-empty-products">
            <ShoppingBag size={48} className="userdashboard-empty-products-icon" />
            <h3 className="userdashboard-empty-products-title">No products yet</h3>
            <p className="userdashboard-empty-products-subtitle">
              Check back later for new products
            </p>
          </div>
        ) : (
          <div className="userdashboard-topproducts-list">
            {recommendedProducts.map((product) => {
              const vendor = vendorProfiles[product.vendor_id];
              
              return (
                <div 
                  key={product.id} 
                  className="userdashboard-topproduct-item"
                  onClick={() => handleProductClick(product.vendor_id, product.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Product Image */}
                  <div className="userdashboard-topproduct-image">
                    {product.images && product.images[0] ? (
                      <img 
                        src={product.images[0]} 
                        alt={product.title}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="userdashboard-topproduct-noimage">
                        <ShoppingBag size={24} />
                      </div>
                    )}
                    
                    {/* Promoted badge */}
                    {product.is_promoted && (
                      <div className="userdashboard-topproduct-promotedbadge">
                        Promoted
                      </div>
                    )}
                  </div>
                  
                  {/* Product Info - EXACTLY like FavoritesPage */}
                  <div className="userdashboard-topproduct-details">
                    <div className="userdashboard-topproduct-top">
                      <h3 className="userdashboard-topproduct-title">
                        {product.title || 'Product'}
                      </h3>
                      <div className="userdashboard-topproduct-price">
                        {formatPrice(product.price || 0)}
                      </div>
                    </div>
                    
                    <div className="userdashboard-topproduct-bottom">
                      <div className="userdashboard-topproduct-info">
                        {product.category && (
                          <span className="userdashboard-topproduct-category">
                            {product.category}
                          </span>
                        )}
                        {product.condition && (
                          <span className="userdashboard-topproduct-condition">
                            {product.condition}
                          </span>
                        )}
                      </div>
                      
                      {/* Stats */}
                      <div className="userdashboard-topproduct-stats">
                        <div className="userdashboard-topproduct-stat">
                          <Eye size={10} />
                          <span>{product.views_count || 0}</span>
                        </div>
                        <div className="userdashboard-topproduct-stat">
                          <Heart size={10} />
                          <span>{product.likes_count || 0}</span>
                        </div>
                        <div className="userdashboard-topproduct-stat">
                          <Package size={10} />
                          <span>{product.inventory || 0}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Vendor info - EXACTLY like FavoritesPage */}
                    {vendor && (
                      <div 
                        className="userdashboard-topproduct-shopinfo" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVendorClick(product.vendor_id);
                        }}
                      >
                        {vendor.profile_image ? (
                          <img 
                            src={vendor.profile_image} 
                            alt={vendor.shop_name} 
                            className="userdashboard-topproduct-shoplogo"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="userdashboard-topproduct-shoplogo userdashboard-topproduct-shoplogo-placeholder">
                            {vendor.shop_name?.charAt(0) || 'S'}
                          </div>
                        )}
                        <span className="userdashboard-topproduct-shopname">{vendor.shop_name || 'Shop'}</span>
                        {vendor.is_verified && <span className="userdashboard-topproduct-shopverified">✓</span>}
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div 
                      className="userdashboard-topproduct-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="userdashboard-topproduct-actionbtn cart"
                        onClick={() => navigate(`/vendor/${product.vendor_id}`, { 
                          state: { initialProductId: product.id } 
                        })}
                      >
                        <ShoppingBag size={12} />
                        View Product
                      </button>
                      
                      {product.vendor_id && (
                        <button
                          className="userdashboard-topproduct-actionbtn view"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVendorClick(product.vendor_id);
                          }}
                        >
                          <Store size={12} />
                          Visit Shop
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Feature Unavailable Modal */}
      {utilityFeatureUnavailable && (
        <div className="userdashboard-feature-modal">
          {utilityFeatureUnavailable} is currently unavailable.<br />
          Contact support and check back later.<br />
          Thank you!
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="userdashboard-bottom-nav">
        <button className="userdashboard-nav-btn" onClick={() => navigate('/market')}>
          <ShoppingBag size={16} />
          <span>Market</span>
        </button>
        
        <button className="userdashboard-nav-btn" onClick={handleShopClick}>
          <Store size={16} />
          <span>Shops</span>
        </button>
        
        <button className="userdashboard-nav-btn" onClick={() => navigate('/cart')}>
          <ShoppingCart size={16} />
          <span>Cart</span>
          {cartCount > 0 && <span className="userdashboard-nav-badge">{cartCount}</span>}
        </button>
        
        <button className="userdashboard-nav-btn" onClick={() => navigate('/favorites')}>
          <Heart size={16} />
          <span>Favorites</span>
          {favoritesCount > 0 && <span className="userdashboard-nav-badge">{favoritesCount}</span>}
        </button>
        
        <button className="userdashboard-nav-btn" onClick={() => navigate('/chats')}>
          <MessageSquare size={16} />
          <span>Messages</span>
        </button>
      </nav>
    </div>
  );
};

export default UserDashboard;