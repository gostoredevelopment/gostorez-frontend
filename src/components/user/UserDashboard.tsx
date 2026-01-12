import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { supabase } from '../../lib/supabaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Bell,
  ShoppingCart,
  Heart,
  Package,
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
  Wallet,
  Clock,
  Phone,
  XCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  Star as StarIcon,
  MessageCircle,
  PhoneCall,
  X,
  Loader,
  CreditCard,
  TrendingUp,
  Shield,
  Globe,
  Home,
  Plus
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
  active: boolean;
}

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'pending';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  orderId?: string;
  vendorId?: string;
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
  contact_phone?: string;
  pending_balance?: number;
  available_balance?: number;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  vendor_id: string;
  vendor_name: string;
  product_title: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
  vendor_status: 'pending' | 'accepted' | 'rejected';
  user_status: 'pending' | 'received' | 'cancelled';
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  product_image?: string;
  vendor_phone?: string;
  response_time_minutes?: number;
}

interface OrderGroup {
  order_id: string;
  order_number: string;
  created_at: string;
  total_amount: number;
  items: OrderItem[];
  vendors: string[];
}

interface Transaction {
  id: string;
  order_id: string;
  order_number: string;
  product_id: string;
  user_id: string;
  user_name: string;
  vendor_id: string;
  vendor_name: string;
  transaction_type: string;
  amount: number;
  description: string;
  user_status_at_time: string;
  vendor_status_at_time: string;
  rejection_reason?: string;
  order_created_at: string;
  transaction_created_at: string;
}

const UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showBalance, setShowBalance] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStat[]>([
    { id: 'pending', label: 'Pending Orders', value: 0, icon: <Clock size={14} />, active: false },
    { id: 'processed', label: 'Processed Orders', value: 0, icon: <CheckCheck size={14} />, active: false },
    { id: 'received', label: 'Received Orders', value: 0, icon: <Truck size={14} />, active: false },
    { id: 'cart', label: 'In Cart', value: 0, icon: <ShoppingCart size={14} />, active: false },
    { id: 'favorites', label: 'Favorites', value: 0, icon: <Heart size={14} />, active: false },
    { id: 'rating', label: 'Rating', value: 0, icon: <Star size={14} />, active: false }
  ]);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  const [displayedOrders, setDisplayedOrders] = useState<OrderItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [vendorProfiles, setVendorProfiles] = useState<Record<string, VendorProfile>>({});
  const [activeTab, setActiveTab] = useState<string>('');
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<{show: boolean, orderItem?: OrderItem, reason: string}>({show: false, reason: ''});
  const [showReceiveConfirm, setShowReceiveConfirm] = useState<{show: boolean, orderItem?: OrderItem}>({show: false});
  const [showReview, setShowReview] = useState<{show: boolean, orderItem?: OrderItem}>({show: false});
  const [reviewData, setReviewData] = useState({rating: 5, review: ''});
  const [featureUnavailable, setFeatureUnavailable] = useState<string | null>(null);
  const [expandedOrderGroups, setExpandedOrderGroups] = useState<Set<string>>(new Set());
  const [orderStats, setOrderStats] = useState({
    new: 0,
    total: 0,
    accepted: 0,
    received: 0,
    cancelled: 0
  });
  
  const reviewPresets = [
    {rating: 5, text: 'Excellent product! Highly recommended'},
    {rating: 4, text: 'Very good quality, satisfied with purchase'},
    {rating: 3, text: 'Good product, meets expectations'},
    {rating: 2, text: 'Below average, needs improvement'},
    {rating: 1, text: 'Poor quality, would not recommend'}
  ];
  
  const cancelReasons = [
    'No longer interested',
    'Vendor response too slow',
    'Found better price elsewhere',
    'Changed my mind',
    'Product not needed anymore',
    'Financial constraints'
  ];

  // Utility items
  const utilities: UtilityItem[] = useMemo(() => [
    { id: 'orders', name: 'My Orders', icon: <Package size={16} />, route: '#orders' },
    { id: 'transactions', name: 'Transaction History', icon: <History size={16} />, route: '#transactions' },
    { id: 'shop', name: 'My Shop', icon: <Store size={16} />, route: '/vendor/dashboard' },
    { id: 'storage', name: 'Storage', icon: <Database size={16} />, route: '#storage' },
    { id: 'cart', name: 'Cart', icon: <ShoppingCart size={16} />, route: '/cart' },
    { id: 'favorites', name: 'Favorites', icon: <Heart size={16} />, route: '/favorites' },
    { id: 'invite', name: 'Invite & Earn', icon: <Users size={16} />, route: '#invite' },
    { id: 'profile', name: 'My Profile', icon: <User size={16} />, route: '#profile' },
    { id: 'settings', name: 'Settings', icon: <Settings size={16} />, route: '#settings' },
    { id: 'help', name: 'Help & Support', icon: <HelpCircle size={16} />, route: '#help' },
    { id: 'data', name: 'Data', icon: <Wifi size={16} />, route: '#data' },
    { id: 'airtime', name: 'Airtime', icon: <Smartphone size={16} />, route: '#airtime' },
    { id: 'electricity', name: 'Electricity', icon: <Zap size={16} />, route: '#electricity' },
    { id: 'giftcard', name: 'Gift Cards', icon: <Gift size={16} />, route: '#giftcards' },
    { id: 'betting', name: 'Betting', icon: <Trophy size={16} />, route: '#betting' },
    { id: 'charity', name: 'Charity', icon: <HandHeart size={16} />, route: '#charity' },
    { id: 'tv', name: 'TV Sub', icon: <Tv size={16} />, route: '#tv' },
    { id: 'music', name: 'Music', icon: <Music size={16} />, route: '#music' },
    { id: 'coffee', name: 'Coffee', icon: <Coffee size={16} />, route: '#coffee' },
    { id: 'books', name: 'Books', icon: <BookOpen size={16} />, route: '#books' }
  ], []);

  // Calculate order group progress percentage
  const calculateOrderGroupProgress = (items: OrderItem[]): number => {
    if (items.length === 0) return 0;
    
    const processedItems = items.filter(item => 
      item.vendor_status === 'accepted' || 
      item.vendor_status === 'rejected' || 
      item.user_status === 'cancelled' || 
      item.user_status === 'received'
    ).length;
    
    return Math.round((processedItems / items.length) * 100);
  };

  // Fetch user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await fetchUserData(user.uid);
        await fetchUserStats(user.uid);
        await fetchNotifications(user.uid);
        await fetchOrderGroups(user.uid);
        await fetchTransactions(user.uid);
        await fetchTopProducts();
      } else {
        navigate('/signin');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const fetchUserData = async (userId: string) => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('firebase_uid', userId)
        .single();

      if (error) throw error;

      const profile: UserProfile = {
        id: userData.id,
        email: userData.email || '',
        phone: userData.phone || '',
        name: userData.name || 'User',
        role: userData.user_type || 'user',
        isVerified: userData.is_active || false,
        createdAt: userData.created_at || new Date().toISOString(),
        profileImage: userData.avatar_url || '',
        availableBalance: Number(userData.balance) || 0,
        pendingBalance: 0,
        currency: 'NGN'
      };

      setUserProfile(profile);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchUserStats = async (userId: string) => {
    try {
      // Get all order items for user
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', userId);

      let pendingCount = 0;
      let processedCount = 0;
      let receivedCount = 0;
      let ratingAvg = 0;

      if (orders && orders.length > 0) {
        const orderIds = orders.map(order => order.id);
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        if (orderItems) {
          // PENDING: Vendor hasn't accepted/rejected AND user hasn't cancelled
          pendingCount = orderItems.filter(item => 
            item.vendor_status === 'pending' && item.user_status !== 'cancelled'
          ).length;

          // PROCESSED: Vendor has accepted OR rejected
          processedCount = orderItems.filter(item => 
            item.vendor_status === 'accepted' || item.vendor_status === 'rejected'
          ).length;

          // RECEIVED: User marked as received
          receivedCount = orderItems.filter(item => item.user_status === 'received').length;
        }

        // Get average rating
        const { data: reviews } = await supabase
          .from('reviews')
          .select('rating')
          .eq('user_id', userId);

        if (reviews && reviews.length > 0) {
          const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
          ratingAvg = Math.round((totalRating / reviews.length) * 10) / 10;
        }
      }

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

      setStats([
        { id: 'pending', label: 'Pending Orders', value: pendingCount, icon: <Clock size={14} />, active: false },
        { id: 'processed', label: 'Processed Orders', value: processedCount, icon: <CheckCheck size={14} />, active: false },
        { id: 'received', label: 'Received Orders', value: receivedCount, icon: <Truck size={14} />, active: false },
        { id: 'cart', label: 'In Cart', value: cartCount || 0, icon: <ShoppingCart size={14} />, active: false },
        { id: 'favorites', label: 'Favorites', value: favoritesCount || 0, icon: <Heart size={14} />, active: false },
        { id: 'rating', label: 'Rating', value: ratingAvg, icon: <Star size={14} />, active: false }
      ]);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchNotifications = async (userId: string) => {
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const notificationsList: Notification[] = [];
      
      if (!orders || orders.length === 0) {
        setNotifications([{
          id: 'notif-welcome',
          type: 'info',
          title: 'Welcome!',
          message: 'No orders yet. Start shopping!',
          time: 'Just now',
          isRead: false
        }]);
        return;
      }

      const orderIds = orders.map(order => order.id);
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      if (!orderItems) {
        setNotifications([{
          id: 'notif-welcome',
          type: 'info',
          title: 'Welcome!',
          message: 'No orders yet. Start shopping!',
          time: 'Just now',
          isRead: false
        }]);
        return;
      }

      // NEW ORDERS: Created but vendor hasn't responded
      const newOrders = orderItems.filter(item => 
        item.vendor_status === 'pending' && item.user_status !== 'cancelled'
      ).length;

      if (newOrders > 0) {
        notificationsList.push({
          id: 'notif-new',
          type: 'pending',
          title: 'New Orders',
          message: `${newOrders} new order${newOrders > 1 ? 's' : ''} waiting for vendor`,
          time: 'Just now',
          isRead: false
        });
      }

      // Accepted
      const acceptedCount = orderItems.filter(item => item.vendor_status === 'accepted').length;
      if (acceptedCount > 0) {
        notificationsList.push({
          id: 'notif-accepted',
          type: 'success',
          title: 'Accepted Orders',
          message: `${acceptedCount} order${acceptedCount > 1 ? 's' : ''} accepted by vendors`,
          time: 'Recently',
          isRead: false
        });
      }

      // Rejected
      const rejectedCount = orderItems.filter(item => item.vendor_status === 'rejected').length;
      if (rejectedCount > 0) {
        notificationsList.push({
          id: 'notif-rejected',
          type: 'warning',
          title: 'Rejected Orders',
          message: `${rejectedCount} order${rejectedCount > 1 ? 's' : ''} rejected by vendors`,
          time: 'Recently',
          isRead: false
        });
      }

      // Cancelled
      const cancelledCount = orderItems.filter(item => item.user_status === 'cancelled').length;
      if (cancelledCount > 0) {
        notificationsList.push({
          id: 'notif-cancelled',
          type: 'info',
          title: 'Cancelled Orders',
          message: `${cancelledCount} order${cancelledCount > 1 ? 's' : ''} cancelled`,
          time: 'Recently',
          isRead: false
        });
      }

      // Received
      const receivedCount = orderItems.filter(item => item.user_status === 'received').length;
      if (receivedCount > 0) {
        notificationsList.push({
          id: 'notif-received',
          type: 'success',
          title: 'Received Orders',
          message: `${receivedCount} order${receivedCount > 1 ? 's' : ''} received successfully`,
          time: 'Recently',
          isRead: false
        });
      }

      if (notificationsList.length === 0) {
        notificationsList.push({
          id: 'notif-welcome',
          type: 'info',
          title: 'Welcome!',
          message: 'No orders yet. Start shopping!',
          time: 'Just now',
          isRead: false
        });
      }

      setNotifications(notificationsList);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchOrderGroups = async (userId: string) => {
    try {
      // Get all orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        setOrderGroups([]);
        setDisplayedOrders([]);
        setOrderStats({ new: 0, total: 0, accepted: 0, received: 0, cancelled: 0 });
        return;
      }

      // Get all order items for these orders
      const orderIds = orders.map(order => order.id);
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;

      // Group by order
      const groups: OrderGroup[] = [];
      const allOrderItems: OrderItem[] = [];
      let totalNew = 0;
      let totalAccepted = 0;
      let totalReceived = 0;
      let totalCancelled = 0;

      for (const order of orders) {
        const items = orderItems?.filter(item => item.order_id === order.id) || [];
        
        if (items.length > 0) {
          // Fetch product images and vendor info
          const itemsWithDetails = await Promise.all(
            items.map(async (item) => {
              const { data: product } = await supabase
                .from('products')
                .select('images')
                .eq('id', item.product_id)
                .single();

              const { data: vendorProfile } = await supabase
                .from('vendor_profiles')
                .select('*')
                .eq('vendor_id', item.vendor_id)
                .single();

              // Update counts
              if (item.vendor_status === 'pending' && item.user_status !== 'cancelled') totalNew++;
              if (item.vendor_status === 'accepted') totalAccepted++;
              if (item.user_status === 'received') totalReceived++;
              if (item.user_status === 'cancelled') totalCancelled++;

              return {
                ...item,
                product_image: product?.images?.[0] || '',
                vendor_phone: vendorProfile?.contact_phone || '',
                vendor_name: vendorProfile?.shop_name || item.vendor_name
              };
            })
          );

          allOrderItems.push(...itemsWithDetails);

          // Get unique vendors
          const vendorIds = Array.from(new Set(items.map(item => item.vendor_id)));
          
          groups.push({
            order_id: order.id,
            order_number: order.order_number || `ORD${order.id.slice(0, 8).toUpperCase()}`,
            created_at: order.created_at,
            total_amount: Number(order.total_amount) || 0,
            items: itemsWithDetails,
            vendors: vendorIds
          });
        }
      }

      setOrderGroups(groups);
      setDisplayedOrders(allOrderItems);
      setOrderStats({
        new: totalNew,
        total: allOrderItems.length,
        accepted: totalAccepted,
        received: totalReceived,
        cancelled: totalCancelled
      });
    } catch (error) {
      console.error('Error fetching order groups:', error);
      setOrderGroups([]);
      setDisplayedOrders([]);
      setOrderStats({ new: 0, total: 0, accepted: 0, received: 0, cancelled: 0 });
    }
  };

  const fetchTransactions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('transaction_created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    }
  };

  const fetchTopProducts = async () => {
    try {
      const { data: productsData, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      const products: Product[] = productsData || [];
      setRecommendedProducts(products);
      
      const vendorIds = products.map(p => p.vendor_id).filter(Boolean);
      const { data: vendorsData } = await supabase
        .from('vendor_profiles')
        .select('*')
        .in('vendor_id', vendorIds);

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
          online_status: vendor.online_status || false,
          contact_phone: vendor.contact_phone || '',
          pending_balance: vendor.pending_balance || 0,
          available_balance: vendor.available_balance || 0
        };
      });

      setVendorProfiles(profiles);
    } catch (error) {
      console.error('Error fetching top products:', error);
      setRecommendedProducts([]);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleNotificationClick = () => {
    setActiveTab('orders');
    setTimeout(() => {
      const ordersSection = document.getElementById('orders-section');
      if (ordersSection) {
        window.scrollTo({
          top: ordersSection.offsetTop - 30,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  const handleUtilityClick = (utility: UtilityItem) => {
    if (utility.id === 'orders') {
      setActiveTab('orders');
      setTimeout(() => {
        const ordersSection = document.getElementById('orders-section');
        if (ordersSection) {
          window.scrollTo({
            top: ordersSection.offsetTop - 30,
            behavior: 'smooth'
          });
        }
      }, 100);
    } else if (utility.id === 'transactions') {
      setActiveTab('transactions');
      setTimeout(() => {
        const transactionsSection = document.getElementById('transactions-section');
        if (transactionsSection) {
          window.scrollTo({
            top: transactionsSection.offsetTop - 30,
            behavior: 'smooth'
          });
        }
      }, 100);
    } else if (utility.id === 'shop') {
      navigate('/vendor/dashboard');
    } else if (utility.id === 'cart') {
      navigate('/cart');
    } else if (utility.id === 'favorites') {
      navigate('/favorites');
    } else {
      setFeatureUnavailable(utility.name);
      setTimeout(() => setFeatureUnavailable(null), 3000);
    }
  };

  const handleStatClick = (statId: string) => {
    const updatedStats = stats.map(stat => ({
      ...stat,
      active: stat.id === statId ? !stat.active : false
    }));
    
    setStats(updatedStats);

    // Filter orders based on active stat
    if (statId === 'pending') {
      const filtered = getAllOrderItems().filter(item => 
        item.vendor_status === 'pending' && item.user_status !== 'cancelled'
      );
      setDisplayedOrders(updatedStats.find(s => s.id === statId)?.active ? filtered : getAllOrderItems());
    } else if (statId === 'processed') {
      const filtered = getAllOrderItems().filter(item => 
        item.vendor_status === 'accepted' || item.vendor_status === 'rejected'
      );
      setDisplayedOrders(updatedStats.find(s => s.id === statId)?.active ? filtered : getAllOrderItems());
    } else if (statId === 'received') {
      const filtered = getAllOrderItems().filter(item => item.user_status === 'received');
      setDisplayedOrders(updatedStats.find(s => s.id === statId)?.active ? filtered : getAllOrderItems());
    } else {
      setDisplayedOrders(getAllOrderItems());
    }
  };

  const getAllOrderItems = () => {
    return orderGroups.flatMap(group => group.items);
  };

  const handlePingVendor = async (orderItem: OrderItem) => {
    setProcessingAction(`ping-${orderItem.id}`);
    try {
      setTimeout(() => {
        setProcessingAction(null);
        const successDiv = document.createElement('div');
        successDiv.className = 'order-action-success';
        successDiv.textContent = 'Vendor notified successfully';
        successDiv.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 10px 20px;
          border-radius: 5px;
          z-index: 10000;
        `;
        document.body.appendChild(successDiv);
        setTimeout(() => document.body.removeChild(successDiv), 2000);
      }, 500);
    } catch (error) {
      console.error('Error pinging vendor:', error);
      setProcessingAction(null);
    }
  };

  const handleChatVendor = async (orderItem: OrderItem) => {
    setProcessingAction(`chat-${orderItem.id}`);
    try {
      await navigator.clipboard.writeText(orderItem.vendor_id);
      
      const successDiv = document.createElement('div');
      successDiv.className = 'order-action-success';
      successDiv.textContent = 'Secured chat ID copied! Redirecting...';
      successDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10000;
      `;
      document.body.appendChild(successDiv);
      
      setTimeout(() => {
        document.body.removeChild(successDiv);
        navigate('/chats');
      }, 1500);
    } catch (error) {
      console.error('Error copying chat ID:', error);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCallVendor = (orderItem: OrderItem) => {
    if (orderItem.vendor_phone) {
      window.location.href = `tel:${orderItem.vendor_phone}`;
    } else {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'order-action-error';
      errorDiv.textContent = 'Vendor phone not available';
      errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10000;
      `;
      document.body.appendChild(errorDiv);
      setTimeout(() => document.body.removeChild(errorDiv), 2000);
    }
  };

  // CANCEL ORDER: Only allowed when vendor_status is 'pending'
  const handleCancelOrder = async (orderItem: OrderItem, reason: string) => {
    setProcessingAction(`cancel-${orderItem.id}`);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, balance')
        .eq('firebase_uid', currentUser.uid)
        .single();

      if (userError) throw userError;
      if (!userData) throw new Error('User data not found');

      // Update order item status
      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          user_status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderItem.id);

      if (updateError) throw updateError;

      // CRITICAL: Move funds from vendor's pending balance back to user's balance
      // This happens regardless of vendor action because money belongs to user
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_profiles')
        .select('pending_balance, vendor_id')
        .eq('vendor_id', orderItem.vendor_id)
        .single();

      if (vendorError) {
        console.error('Vendor data fetch error:', vendorError);
        // Continue anyway, we'll still update user balance
      }

      if (vendorData) {
        const currentVendorPendingBalance = Number(vendorData.pending_balance) || 0;
        const newVendorPendingBalance = Math.max(0, currentVendorPendingBalance - orderItem.total_price);

        // Update vendor's pending balance (deduct)
        await supabase
          .from('vendor_profiles')
          .update({ 
            pending_balance: newVendorPendingBalance,
            updated_at: new Date().toISOString()
          })
          .eq('vendor_id', orderItem.vendor_id);
      }

      // Update user's available balance (add back)
      const currentUserBalance = Number(userData.balance) || 0;
      const newUserBalance = currentUserBalance + orderItem.total_price;

      await supabase
        .from('users')
        .update({ 
          balance: newUserBalance,
          updated_at: new Date().toISOString()
        })
        .eq('firebase_uid', currentUser.uid);

      // Update local state
      setUserProfile(prev => prev ? {
        ...prev,
        availableBalance: newUserBalance
      } : null);

      // Create transaction record
      try {
        await supabase
          .from('transactions')
          .insert({
            order_id: orderItem.order_id,
            order_number: orderGroups.find(g => g.order_id === orderItem.order_id)?.order_number || orderItem.order_id,
            product_id: orderItem.product_id,
            user_id: currentUser.uid,
            user_name: userProfile?.name || 'User',
            vendor_id: orderItem.vendor_id,
            vendor_name: orderItem.vendor_name,
            transaction_type: 'order_cancelled',
            amount: orderItem.total_price,
            description: `Order cancelled by user: ${reason}`,
            user_status_at_time: 'cancelled',
            vendor_status_at_time: orderItem.vendor_status,
            rejection_reason: reason,
            order_created_at: orderItem.created_at,
            transaction_created_at: new Date().toISOString()
          });
      } catch (transactionError) {
        console.error('Transaction record error (non-critical):', transactionError);
      }

      // Refresh all data
      await fetchUserData(currentUser.uid);
      await fetchUserStats(currentUser.uid);
      await fetchNotifications(currentUser.uid);
      await fetchOrderGroups(currentUser.uid);
      await fetchTransactions(currentUser.uid);

      setShowCancelConfirm({show: false, reason: ''});
      setProcessingAction(null);
      
      // Show success message
      const successDiv = document.createElement('div');
      successDiv.className = 'order-action-success';
      successDiv.textContent = 'Order cancelled successfully! Funds returned to your account.';
      successDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 128, 0, 0.9);
        color: white;
        padding: 12px 24px;
        border-radius: 5px;
        z-index: 10000;
        text-align: center;
        font-weight: 600;
      `;
      document.body.appendChild(successDiv);
      setTimeout(() => document.body.removeChild(successDiv), 3000);

    } catch (error) {
      console.error('Error cancelling order:', error);
      setProcessingAction(null);
      
      // Show error message
      const errorDiv = document.createElement('div');
      errorDiv.className = 'order-action-error';
      errorDiv.textContent = 'Error cancelling order. Please try again.';
      errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 0, 0, 0.9);
        color: white;
        padding: 12px 24px;
        border-radius: 5px;
        z-index: 10000;
        text-align: center;
        font-weight: 600;
      `;
      document.body.appendChild(errorDiv);
      setTimeout(() => document.body.removeChild(errorDiv), 3000);
    }
  };

  // RECEIVE ORDER: Only allowed when vendor_status is 'accepted'
  const handleReceiveOrder = async (orderItem: OrderItem) => {
    setProcessingAction(`receive-${orderItem.id}`);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');

      // Update order item status
      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          user_status: 'received',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderItem.id);

      if (updateError) throw updateError;

      // CRITICAL: Move funds from vendor's pending balance to vendor's available balance
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_profiles')
        .select('pending_balance, available_balance, vendor_id')
        .eq('vendor_id', orderItem.vendor_id)
        .single();

      if (vendorError) throw vendorError;
      if (!vendorData) throw new Error('Vendor data not found');

      const currentVendorPendingBalance = Number(vendorData.pending_balance) || 0;
      const currentVendorAvailableBalance = Number(vendorData.available_balance) || 0;
      
      const newVendorPendingBalance = Math.max(0, currentVendorPendingBalance - orderItem.total_price);
      const newVendorAvailableBalance = currentVendorAvailableBalance + orderItem.total_price;
      
      // Update vendor's balances
      const { error: vendorUpdateError } = await supabase
        .from('vendor_profiles')
        .update({
          pending_balance: newVendorPendingBalance,
          available_balance: newVendorAvailableBalance,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', orderItem.vendor_id);

      if (vendorUpdateError) throw vendorUpdateError;

      // Create transaction record
      try {
        await supabase
          .from('transactions')
          .insert({
            order_id: orderItem.order_id,
            order_number: orderGroups.find(g => g.order_id === orderItem.order_id)?.order_number || orderItem.order_id,
            product_id: orderItem.product_id,
            user_id: currentUser.uid,
            user_name: userProfile?.name || 'User',
            vendor_id: orderItem.vendor_id,
            vendor_name: orderItem.vendor_name,
            transaction_type: 'order_received',
            amount: orderItem.total_price,
            description: 'Order marked as received by buyer',
            user_status_at_time: 'received',
            vendor_status_at_time: orderItem.vendor_status,
            order_created_at: orderItem.created_at,
            transaction_created_at: new Date().toISOString()
          });
      } catch (transactionError) {
        console.error('Transaction record error (non-critical):', transactionError);
      }

      // Refresh all data
      await fetchUserData(currentUser.uid);
      await fetchUserStats(currentUser.uid);
      await fetchNotifications(currentUser.uid);
      await fetchOrderGroups(currentUser.uid);
      await fetchTransactions(currentUser.uid);

      setShowReceiveConfirm({show: false});
      setShowReview({show: true, orderItem});
      setProcessingAction(null);
      
      // Show success message
      const successDiv = document.createElement('div');
      successDiv.className = 'order-action-success';
      successDiv.textContent = 'Order received successfully! Funds transferred to vendor.';
      successDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 128, 0, 0.9);
        color: white;
        padding: 12px 24px;
        border-radius: 5px;
        z-index: 10000;
        text-align: center;
        font-weight: 600;
      `;
      document.body.appendChild(successDiv);
      setTimeout(() => document.body.removeChild(successDiv), 3000);

    } catch (error) {
      console.error('Error receiving order:', error);
      setProcessingAction(null);
      
      // Show error message
      const errorDiv = document.createElement('div');
      errorDiv.className = 'order-action-error';
      errorDiv.textContent = 'Error receiving order. Please try again.';
      errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 0, 0, 0.9);
        color: white;
        padding: 12px 24px;
        border-radius: 5px;
        z-index: 10000;
        text-align: center;
        font-weight: 600;
      `;
      document.body.appendChild(errorDiv);
      setTimeout(() => document.body.removeChild(errorDiv), 3000);
    }
  };

  const handleSubmitReview = async () => {
    if (!showReview.orderItem || !reviewData.review.trim()) return;

    setProcessingAction(`review-${showReview.orderItem.id}`);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');

      // Insert review
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          product_id: showReview.orderItem.product_id,
          vendor_id: showReview.orderItem.vendor_id,
          user_id: currentUser.uid,
          user_name: userProfile?.name || 'User',
          rating: reviewData.rating,
          review_text: reviewData.review,
          order_item_id: showReview.orderItem.id,
          created_at: new Date().toISOString()
        });

      if (reviewError) throw reviewError;

      // Refresh data
      await fetchUserData(currentUser.uid);
      await fetchUserStats(currentUser.uid);

      setShowReview({show: false});
      setReviewData({rating: 5, review: ''});
      setProcessingAction(null);
      
      // Show success message
      const successDiv = document.createElement('div');
      successDiv.className = 'order-action-success';
      successDiv.textContent = 'Review submitted successfully!';
      successDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 128, 0, 0.9);
        color: white;
        padding: 12px 24px;
        border-radius: 5px;
        z-index: 10000;
        text-align: center;
        font-weight: 600;
      `;
      document.body.appendChild(successDiv);
      setTimeout(() => document.body.removeChild(successDiv), 2000);

    } catch (error) {
      console.error('Error submitting review:', error);
      setProcessingAction(null);
    }
  };

  const handleProductClick = (vendorId: string, productId: string) => {
    navigate(`/vendor/${vendorId}`, { 
      state: { 
        initialProductId: productId,
        fromDashboard: true 
      } 
    });
  };

  const handleVendorClick = (vendorId: string) => {
    navigate(`/vendor/${vendorId}`);
  };

  const toggleOrderGroup = (orderId: string) => {
    const newExpanded = new Set(expandedOrderGroups);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrderGroups(newExpanded);
  };

  const cartCount = stats.find(s => s.id === 'cart')?.value || 0;
  const favoritesCount = stats.find(s => s.id === 'favorites')?.value || 0;
  const pendingOrdersCount = stats.find(s => s.id === 'pending')?.value || 0;

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
              onClick={() => navigate('#profile')}
            />
          ) : (
            <div 
              className="userdashboard-avatar-placeholder"
              onClick={() => navigate('#profile')}
            >
              {userProfile?.name?.charAt(0) || 'U'}
            </div>
          )}
          <div className="userdashboard-welcome">
            <span className="userdashboard-welcome-text">Welcome back,</span>
            <span className="userdashboard-user-name">{userProfile ? userProfile.name.split(' ')[0] : 'User'}</span>
          </div>
        </div>
        
        <div className="userdashboard-header-right">
          <button 
            className="userdashboard-notification-btn"
            onClick={handleNotificationClick}
          >
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className="userdashboard-notification-badge">{notifications.length}</span>
            )}
          </button>
          
          <button 
            className="userdashboard-refresh-btn"
            onClick={async () => {
              setLoading(true);
              if (auth.currentUser) {
                await fetchUserData(auth.currentUser.uid);
                await fetchUserStats(auth.currentUser.uid);
                await fetchNotifications(auth.currentUser.uid);
                await fetchOrderGroups(auth.currentUser.uid);
                await fetchTransactions(auth.currentUser.uid);
              }
              setLoading(false);
            }}
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
            
            <div className="userdashboard-balance-actions">
              <button 
                className="userdashboard-fund-btn"
                onClick={() => navigate('#fund')}
              >
                <Wallet size={14} />
              </button>
              <button 
                className="userdashboard-transfer-btn"
                onClick={() => navigate('#transfer')}
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

      {/* Stats Section */}
      <section className="userdashboard-stats-section">
        <div className="userdashboard-stats-grid">
          {stats.map(stat => (
            <div 
              key={stat.id} 
              className={`userdashboard-stat-card ${stat.active ? 'active' : ''}`}
              onClick={() => handleStatClick(stat.id)}
            >
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
        <div className="userdashboard-notifications-header" onClick={handleNotificationClick}>
          <h3 className="userdashboard-section-title">Notifications</h3>
          <ChevronRight size={14} />
          {notifications.length > 0 && (
            <span className="userdashboard-notification-count">{notifications.length}</span>
          )}
        </div>
        
        <div className="userdashboard-notifications-list">
          {(showAllNotifications ? notifications : notifications.slice(0, 3)).map(notification => (
            <div 
              key={notification.id} 
              className={`userdashboard-notification-item ${notification.isRead ? '' : 'unread'}`}
              onClick={handleNotificationClick}
            >
              <div className="userdashboard-notification-icon">
                {notification.type === 'success' && <CheckCircle size={12} />}
                {notification.type === 'warning' && <AlertTriangle size={12} />}
                {notification.type === 'info' && <Info size={12} />}
                {notification.type === 'pending' && <Clock size={12} />}
              </div>
              <div className="userdashboard-notification-content">
                <div className="userdashboard-notification-title">{notification.title}</div>
                <div className="userdashboard-notification-message">{notification.message}</div>
              </div>
              <div className="userdashboard-notification-time">{notification.time}</div>
            </div>
          ))}
          {notifications.length > 3 && !showAllNotifications && (
            <div 
              className="userdashboard-notification-more"
              onClick={() => setShowAllNotifications(true)}
            >
              Show {notifications.length - 3} more notifications
            </div>
          )}
          {showAllNotifications && (
            <div 
              className="userdashboard-notification-less"
              onClick={() => setShowAllNotifications(false)}
            >
              Show less
            </div>
          )}
        </div>
      </section>

      {/* Utilities */}
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

      {/* Orders Section */}
      {activeTab === 'orders' && (
        <section id="orders-section" className="userdashboard-orders-section">
          <div className="userdashboard-orders-header">
            <h3 className="userdashboard-section-title">My Orders</h3>
            <span className="userdashboard-orders-count">{displayedOrders.length} item{displayedOrders.length !== 1 ? 's' : ''}</span>
          </div>
          
          {/* Order Stats */}
          <div className="userdashboard-order-stats-overview">
            <div className="userdashboard-order-stat-overview-card">
              <div className="userdashboard-order-stat-overview-icon"><Package size={12} /></div>
              <div className="userdashboard-order-stat-overview-content">
                <div className="userdashboard-order-stat-overview-value">{orderStats.new}</div>
                <div className="userdashboard-order-stat-overview-label">New Orders</div>
              </div>
            </div>
            <div className="userdashboard-order-stat-overview-card">
              <div className="userdashboard-order-stat-overview-icon"><Package size={12} /></div>
              <div className="userdashboard-order-stat-overview-content">
                <div className="userdashboard-order-stat-overview-value">{orderStats.total}</div>
                <div className="userdashboard-order-stat-overview-label">Total Orders</div>
              </div>
            </div>
            <div className="userdashboard-order-stat-overview-card">
              <div className="userdashboard-order-stat-overview-icon"><CheckCircle size={12} /></div>
              <div className="userdashboard-order-stat-overview-content">
                <div className="userdashboard-order-stat-overview-value">{orderStats.accepted}</div>
                <div className="userdashboard-order-stat-overview-label">Accepted</div>
              </div>
            </div>
            <div className="userdashboard-order-stat-overview-card">
              <div className="userdashboard-order-stat-overview-icon"><Truck size={12} /></div>
              <div className="userdashboard-order-stat-overview-content">
                <div className="userdashboard-order-stat-overview-value">{orderStats.received}</div>
                <div className="userdashboard-order-stat-overview-label">Received</div>
              </div>
            </div>
            <div className="userdashboard-order-stat-overview-card">
              <div className="userdashboard-order-stat-overview-icon"><XCircle size={12} /></div>
              <div className="userdashboard-order-stat-overview-content">
                <div className="userdashboard-order-stat-overview-value">{orderStats.cancelled}</div>
                <div className="userdashboard-order-stat-overview-label">Cancelled</div>
              </div>
            </div>
          </div>
          
          {/* Order Groups */}
          <div className="userdashboard-order-groups">
            {orderGroups.length === 0 ? (
              <div className="userdashboard-empty-state">
                <div className="userdashboard-empty-icon">
                  <Package size={32} />
                </div>
                <h4>No Orders Yet</h4>
                <p>When you make purchases, your orders will appear here</p>
              </div>
            ) : (
              orderGroups.map(group => {
                const progressPercentage = calculateOrderGroupProgress(group.items);
                
                return (
                  <div key={group.order_id} className="userdashboard-order-group">
                    <div 
                      className="userdashboard-order-group-header"
                      onClick={() => toggleOrderGroup(group.order_id)}
                    >
                      <div className="userdashboard-order-group-info">
                        <h4>Order #{group.order_number}</h4>
                        <span className="userdashboard-order-date">{formatDate(group.created_at)}</span>
                        <span className="userdashboard-order-amount">{formatCurrency(group.total_amount)}</span>
                        <span className="userdashboard-order-vendors">{group.vendors.length} vendor{group.vendors.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="userdashboard-order-group-progress">
                        <div className="userdashboard-progress-bar">
                          <div 
                            className="userdashboard-progress-fill" 
                            style={{ width: `${progressPercentage}%` }}
                          ></div>
                        </div>
                        <div className="userdashboard-progress-text">{progressPercentage}%</div>
                      </div>
                      <div className="userdashboard-order-group-toggle">
                        {expandedOrderGroups.has(group.order_id) ? (
                          <ChevronRight size={12} className="rotated" />
                        ) : (
                          <ChevronRight size={12} />
                        )}
                      </div>
                    </div>
                    
                    {expandedOrderGroups.has(group.order_id) && (
                      <div className="userdashboard-order-group-items">
                        {group.items.map(item => (
                          <div key={item.id} className="userdashboard-order-item">
                            <div className="userdashboard-order-item-header">
                              <div className="userdashboard-order-item-image">
                                {item.product_image ? (
                                  <img src={item.product_image} alt={item.product_title} />
                                ) : (
                                  <div className="userdashboard-order-item-noimage">
                                    <Package size={24} />
                                  </div>
                                )}
                              </div>
                              <div className="userdashboard-order-item-info">
                                <h5>{item.product_title}</h5>
                                <div className="userdashboard-order-item-details">
                                  <span>ID: {item.product_id.slice(0, 8)}</span>
                                  <span>{item.quantity} × {formatCurrency(item.unit_price)}</span>
                                </div>
                                <div className="userdashboard-order-item-status">
                                  <span className={`userdashboard-order-status-badge status-${item.vendor_status}`}>
                                    Vendor: {item.vendor_status}
                                  </span>
                                  <span className={`userdashboard-order-status-badge status-${item.user_status}`}>
                                    You: {item.user_status}
                                  </span>
                                </div>
                              </div>
                              <div className="userdashboard-order-item-price">
                                {formatCurrency(item.total_price)}
                              </div>
                            </div>
                            
                            {/* Vendor Info */}
                            <div className="userdashboard-order-vendor-info">
                              <div className="userdashboard-order-vendor-details">
                                <div className="userdashboard-order-vendor-name">
                                  <strong>Vendor:</strong> {item.vendor_name}
                                </div>
                                <div className="userdashboard-order-vendor-actions">
                                  <button
                                    className="userdashboard-vendor-action-btn"
                                    onClick={() => handleProductClick(item.vendor_id, item.product_id)}
                                  >
                                    <ShoppingBag size={10} />
                                    View Product
                                  </button>
                                  <button
                                    className="userdashboard-vendor-action-btn"
                                    onClick={() => handleVendorClick(item.vendor_id)}
                                  >
                                    <Store size={10} />
                                    Visit Shop
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Order Actions - CORRECT FLOW BASED ON YOUR SPECIFICATION */}
                            <div className="userdashboard-order-item-actions">
                              {item.user_status === 'cancelled' ? (
                                <div className="userdashboard-order-cancelled">
                                  Order was cancelled by you
                                </div>
                              ) : item.user_status === 'received' ? (
                                <div className="userdashboard-order-received">
                                  Order received successfully
                                </div>
                              ) : item.vendor_status === 'rejected' ? (
                                <div className="userdashboard-order-rejected">
                                  {item.rejection_reason 
                                    ? `Order rejected by vendor: ${item.rejection_reason}`
                                    : 'Order rejected by vendor'
                                  }
                                </div>
                              ) : (
                                <>
                                  {/* Ping, Chat, Call - Always enabled */}
                                  <button
                                    className="userdashboard-order-action-btn ping"
                                    onClick={() => handlePingVendor(item)}
                                    disabled={processingAction === `ping-${item.id}`}
                                  >
                                    {processingAction === `ping-${item.id}` ? (
                                      <Loader size={12} className="userdashboard-spinning" />
                                    ) : (
                                      <Bell size={12} />
                                    )}
                                    <span>Ping Vendor</span>
                                  </button>
                                  
                                  <button
                                    className="userdashboard-order-action-btn chat"
                                    onClick={() => handleChatVendor(item)}
                                    disabled={processingAction === `chat-${item.id}`}
                                  >
                                    {processingAction === `chat-${item.id}` ? (
                                      <Loader size={12} className="userdashboard-spinning" />
                                    ) : (
                                      <MessageCircle size={12} />
                                    )}
                                    <span>Chat</span>
                                  </button>
                                  
                                  <button
                                    className="userdashboard-order-action-btn call"
                                    onClick={() => handleCallVendor(item)}
                                    disabled={!item.vendor_phone}
                                  >
                                    <PhoneCall size={12} />
                                    <span>Call</span>
                                  </button>
                                  
                                  {/* CORRECT FLOW: Cancel button only when vendor_status is 'pending' */}
                                  {item.vendor_status === 'pending' && (
                                    <button
                                      className="userdashboard-order-action-btn cancel"
                                      onClick={() => setShowCancelConfirm({show: true, orderItem: item, reason: ''})}
                                      disabled={processingAction?.startsWith('cancel')}
                                    >
                                      <XCircle size={12} />
                                      <span>Cancel Order</span>
                                    </button>
                                  )}
                                  
                                  {/* CORRECT FLOW: Receive Order button only when vendor_status is 'accepted' */}
                                  {item.vendor_status === 'accepted' && (
                                    <button
                                      className="userdashboard-order-action-btn receive"
                                      onClick={() => setShowReceiveConfirm({show: true, orderItem: item})}
                                      disabled={processingAction?.startsWith('receive')}
                                    >
                                      <CheckCircle size={12} />
                                      <span>Receive Order</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                            
                            {/* Additional Info */}
                            {item.rejection_reason && (
                              <div className="userdashboard-order-rejection">
                                <strong>Rejection Reason:</strong> {item.rejection_reason}
                              </div>
                            )}
                            
                            {item.response_time_minutes && (
                              <div className="userdashboard-order-response-time">
                                <strong>Response Time:</strong> {item.response_time_minutes} minutes
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Transactions Section */}
      {activeTab === 'transactions' && (
        <section id="transactions-section" className="userdashboard-transactions-section">
          <div className="userdashboard-transactions-header">
            <h3 className="userdashboard-section-title">Transaction History</h3>
          </div>
          
          <div className="userdashboard-transactions-list">
            {transactions.length === 0 ? (
              <div className="userdashboard-empty-state">
                <div className="userdashboard-empty-icon">
                  <CreditCard size={32} />
                </div>
                <h4>No Transactions Yet</h4>
                <p>Your transaction history will appear here</p>
              </div>
            ) : (
              transactions.map(transaction => (
                <div key={transaction.id} className="userdashboard-transaction-item">
                  <div className="userdashboard-transaction-header">
                    <div className="userdashboard-transaction-type">
                      <span className={`userdashboard-transaction-type-badge type-${transaction.transaction_type}`}>
                        {transaction.transaction_type.replace('_', ' ')}
                      </span>
                      <span className="userdashboard-transaction-order">
                        Order: {transaction.order_number?.slice(0, 8) || 'N/A'}
                      </span>
                    </div>
                    <div className="userdashboard-transaction-amount">
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>
                  
                  <div className="userdashboard-transaction-details">
                    <div className="userdashboard-transaction-detail">
                      <span>Vendor:</span>
                      <span>{transaction.vendor_name}</span>
                    </div>
                    <div className="userdashboard-transaction-detail">
                      <span>Description:</span>
                      <span>{transaction.description}</span>
                    </div>
                    <div className="userdashboard-transaction-detail">
                      <span>Date:</span>
                      <span>{formatDate(transaction.transaction_created_at)}</span>
                    </div>
                    {transaction.rejection_reason && (
                      <div className="userdashboard-transaction-detail">
                        <span>Rejection Reason:</span>
                        <span>{transaction.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Top Products Section */}
      <section className="userdashboard-topproducts-section">
        <div className="userdashboard-topproducts-header">
          <h3 className="userdashboard-section-title">Newest Products</h3>
          <button 
            className="userdashboard-view-all-btn"
            onClick={() => navigate('/market')}
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
                    
                    {product.is_promoted && (
                      <div className="userdashboard-topproduct-promotedbadge">
                        Promoted
                      </div>
                    )}
                  </div>
                  
                  <div className="userdashboard-topproduct-details">
                    <div className="userdashboard-topproduct-top">
                      <h3 className="userdashboard-topproduct-title">
                        {product.title || 'Product'}
                      </h3>
                      <div className="userdashboard-topproduct-price">
                        {formatCurrency(product.price || 0)}
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
                    
                    <div 
                      className="userdashboard-topproduct-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="userdashboard-topproduct-actionbtn cart"
                        onClick={() => handleProductClick(product.vendor_id, product.id)}
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

      {/* Modals */}
      {showCancelConfirm.show && showCancelConfirm.orderItem && (
        <div className="userdashboard-modal-overlay">
          <div className="userdashboard-confirm-modal">
            <div className="userdashboard-confirm-header">
              <AlertTriangle size={16} color="#f59e0b" />
              <h3>Cancel Order</h3>
              <button onClick={() => setShowCancelConfirm({show: false, reason: ''})}>
                <X size={16} />
              </button>
            </div>
            <div className="userdashboard-confirm-body">
              <p>Are you sure you want to cancel this order?</p>
              <div className="userdashboard-order-details-confirm">
                <div><strong>Product:</strong> {showCancelConfirm.orderItem.product_title}</div>
                <div><strong>Unit Price:</strong> {formatCurrency(showCancelConfirm.orderItem.unit_price)}</div>
                <div><strong>Quantity:</strong> {showCancelConfirm.orderItem.quantity}</div>
                <div><strong>Total:</strong> {formatCurrency(showCancelConfirm.orderItem.total_price)}</div>
              </div>
              <p className="userdashboard-confirm-note">
                <Info size={12} color="#f59e0b" /> 
                Funds will be returned to your account from vendor's pending balance.
              </p>
              <div className="userdashboard-cancel-reason">
                <label>Reason for cancellation (required):</label>
                <select 
                  value={showCancelConfirm.reason}
                  onChange={(e) => setShowCancelConfirm({...showCancelConfirm, reason: e.target.value})}
                >
                  <option value="">Select a reason</option>
                  {cancelReasons.map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="userdashboard-confirm-actions">
              <button 
                className="userdashboard-confirm-btn no"
                onClick={() => setShowCancelConfirm({show: false, reason: ''})}
              >
                No, Keep Order
              </button>
              <button 
                className="userdashboard-confirm-btn yes"
                onClick={() => handleCancelOrder(showCancelConfirm.orderItem!, showCancelConfirm.reason)}
                disabled={!showCancelConfirm.reason.trim() || processingAction?.startsWith('cancel')}
              >
                {processingAction?.startsWith('cancel') ? (
                  <>
                    <Loader size={12} className="userdashboard-spinning" />
                    Cancelling...
                  </>
                ) : (
                  'Yes, Cancel Order'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReceiveConfirm.show && showReceiveConfirm.orderItem && (
        <div className="userdashboard-modal-overlay">
          <div className="userdashboard-confirm-modal">
            <div className="userdashboard-confirm-header">
              <CheckCircle size={16} color="#10b981" />
              <h3>Receive Order</h3>
              <button onClick={() => setShowReceiveConfirm({show: false})}>
                <X size={16} />
              </button>
            </div>
            <div className="userdashboard-confirm-body">
              <p>Are you sure you have received this order?</p>
              <div className="userdashboard-order-details-confirm">
                <div><strong>Product:</strong> {showReceiveConfirm.orderItem.product_title}</div>
                <div><strong>Unit Price:</strong> {formatCurrency(showReceiveConfirm.orderItem.unit_price)}</div>
                <div><strong>Quantity:</strong> {showReceiveConfirm.orderItem.quantity}</div>
                <div><strong>Total:</strong> {formatCurrency(showReceiveConfirm.orderItem.total_price)}</div>
              </div>
              <p className="userdashboard-confirm-note">
                <AlertTriangle size={12} color="#f59e0b" /> 
                Funds will be transferred to vendor's available balance and cannot be reversed.
              </p>
            </div>
            <div className="userdashboard-confirm-actions">
              <button 
                className="userdashboard-confirm-btn no"
                onClick={() => setShowReceiveConfirm({show: false})}
              >
                Not Yet
              </button>
              <button 
                className="userdashboard-confirm-btn yes"
                onClick={() => handleReceiveOrder(showReceiveConfirm.orderItem!)}
                disabled={processingAction?.startsWith('receive')}
              >
                {processingAction?.startsWith('receive') ? (
                  <>
                    <Loader size={12} className="userdashboard-spinning" />
                    Processing...
                  </>
                ) : (
                  'Yes, I Received It'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReview.show && showReview.orderItem && (
        <div className="userdashboard-modal-overlay">
          <div className="userdashboard-review-modal">
            <div className="userdashboard-review-header">
              <StarIcon size={16} color="#f59e0b" />
              <h3>Rate Your Purchase</h3>
              <button onClick={() => setShowReview({show: false})}>
                <X size={16} />
              </button>
            </div>
            <div className="userdashboard-review-body">
              <p>Please rate <strong>{showReview.orderItem.product_title}</strong></p>
              
              <div className="userdashboard-rating-section">
                <label>Rating:</label>
                <div className="userdashboard-stars">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      className={`userdashboard-star-btn ${star <= reviewData.rating ? 'active' : ''}`}
                      onClick={() => setReviewData({...reviewData, rating: star})}
                    >
                      <StarIcon size={20} fill={star <= reviewData.rating ? '#f59e0b' : 'none'} />
                    </button>
                  ))}
                </div>
                <div className="userdashboard-rating-presets">
                  {reviewPresets.map(preset => (
                    <button
                      key={preset.rating}
                      className={`userdashboard-preset-btn ${reviewData.rating === preset.rating ? 'active' : ''}`}
                      onClick={() => setReviewData({rating: preset.rating, review: preset.text})}
                    >
                      {preset.text}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="userdashboard-review-input">
                <label>Your Review:</label>
                <textarea 
                  value={reviewData.review}
                  onChange={(e) => setReviewData({...reviewData, review: e.target.value})}
                  placeholder="Share your experience..."
                  rows={3}
                />
              </div>
            </div>
            <div className="userdashboard-review-actions">
              <button 
                className="userdashboard-review-submit"
                onClick={handleSubmitReview}
                disabled={!reviewData.review.trim() || processingAction?.startsWith('review')}
              >
                {processingAction?.startsWith('review') ? (
                  <>
                    <Loader size={12} className="userdashboard-spinning" />
                    Submitting...
                  </>
                ) : (
                  'Submit Review'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature Unavailable */}
      {featureUnavailable && (
        <div className="userdashboard-feature-modal">
          {featureUnavailable} not found check back later.<br />
          Contact support.
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-navigation">
        <button className="nav-button" onClick={() => navigate('/market')}>
          <ShoppingBag className="nav-icon" size={16} />
          <span className="nav-label">Market</span>
        </button>
        <button className="nav-button" onClick={() => navigate('/cart')}>
          <ShoppingCart className="nav-icon" size={16} />
          <span className="nav-label">Buy</span>
          {cartCount > 0 && <span className="userdashboard-nav-badge">{cartCount}</span>}
        </button>
        <button className="nav-button" onClick={() => navigate('/vendor/dashboard')}>
          <Store className="nav-icon" size={16} />
          <span className="nav-label">Sell</span>
        </button>
        <button className="nav-button" onClick={() => navigate('/favorites')}>
          <Heart className="nav-icon" size={16} />
          <span className="nav-label">Favorites</span>
          {favoritesCount > 0 && <span className="userdashboard-nav-badge">{favoritesCount}</span>}
        </button>
        <button className="nav-button" onClick={() => navigate('/chats')}>
          <MessageSquare className="nav-icon" size={16} />
          <span className="nav-label">Chats</span>
        </button>
      </nav>
    </div>
  );
};

export default UserDashboard;