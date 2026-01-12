import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../../lib/firebase';
import { supabase } from '../../../lib/supabaseClient';
import { 
  onAuthStateChanged, 
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs
} from 'firebase/firestore';
import { 
  ArrowLeft, 
  Home, 
  ShoppingBag, 
  Package, 
  Eye, 
  Heart, 
  TrendingUp, 
  DollarSign,
  Users,
  MessageSquare,
  MessagesSquare,
  Settings,
  Plus,
  Grid,
  BarChart3,
  User as UserIcon,
  Bell,
  CheckCircle,
  MapPin,
  Clock,
  Shield,
  CreditCard,
  ShoppingCart,
  Calendar,
  Filter,
  Search,
  X,
  ChevronRight,
  Menu,
  Store,
  Building,
  BarChart2,
  Wallet,
  Banknote,
  Target,
  Percent,
  Layers,
  Box,
  AlertCircle,
  PackageCheck,
  Truck,
  FileText,
  PieChart,
  LineChart,
  Activity,
  Users as UsersIcon,
  Globe,
  Tag,
  Image,
  Edit,
  Trash2,
  MoreVertical,
  ExternalLink,
  List,
  Grid3x3,
  Check,
  XCircle,
  Truck as TruckIcon,
  ClipboardCheck,
  RefreshCw,
  BellDot,
  PackageX,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Square,
  SquareStack
} from 'lucide-react';
import './VendorDashboard.css';

interface VendorProfile {
  id: string;
  userId: string;
  shopName: string;
  profileImage: string;
  coverImage: string;
  bio: string;
  location: string;
  contactPhone: string;
  businessEmail: string;
  website: string;
  instagramHandle: string;
  facebookPage: string;
  twitterHandle: string;
  businessHours: string;
  returnPolicy: string;
  shippingPolicy: string;
  isActive: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  original_price?: number;
  currency: string;
  images: string[];
  description: string;
  detailed_description?: string;
  category: string;
  subcategory?: string;
  condition: string;
  vendor_id: string;
  vendor_name: string;
  views_count: number;
  likes_count: number;
  sales_count: number;
  inventory: number;
  is_active: boolean;
  is_promoted: boolean;
  created_at: string;
  updated_at: string;
  tags: string[];
  specifications?: Record<string, string>;
  shipping_info?: {
    weight?: number;
    dimensions?: string;
    shipping_cost?: number;
    free_shipping_threshold?: number;
    estimated_delivery?: string;
  };
  warranty_info?: {
    has_warranty: boolean;
    warranty_period?: string;
    warranty_details?: string;
  };
  delivery_campus_ids?: string[];
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  vendor_id: string;
  product_title: string;
  vendor_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
  location_details: any;
  created_at: string;
  updated_at: string;
  user_status: string; // 'pending', 'received', 'cancelled'
  vendor_status: string; // 'pending', 'accepted', 'rejected'
  rejection_reason?: string;
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
  user_old_balance: number;
  user_new_balance: number;
  vendor_old_balance: number;
  vendor_new_balance: number;
  user_status_at_time: string;
  vendor_status_at_time: string;
  description: string;
  rejection_reason?: string;
  metadata: any;
  order_created_at: string;
  transaction_created_at: string;
}

interface VendorBusiness {
  id: string;
  shopName: string;
  profileImage: string;
  isActive: boolean;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  profileImage?: string;
}

interface OrderStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  cancelled: number;
  received: number;
}

// Helper functions
const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const VendorDashboard: React.FC = () => {
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vendorBusinesses, setVendorBusinesses] = useState<VendorBusiness[]>([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [loading, setLoading] = useState(true);
  const [showShopPopup, setShowShopPopup] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [supabaseStats, setSupabaseStats] = useState<{
    followers_count: number;
    likes_count: number;
    sales_count: number;
    total_revenue: number;
    pending_balance: number;
    available_balance: number;
    virtual_account: string;
  } | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    cancelled: 0,
    received: 0
  });
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const navigate = useNavigate();

  const fetchUserProfile = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfile({
          id: userId,
          email: userData.email || '',
          name: userData.name || 'User',
          profileImage: userData.profileImage || ''
        });
      } else {
        setUserProfile({
          id: userId,
          email: currentUser?.email || '',
          name: currentUser?.displayName || 'User',
          profileImage: currentUser?.photoURL || ''
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile({
        id: userId,
        email: currentUser?.email || '',
        name: currentUser?.displayName || 'User',
        profileImage: currentUser?.photoURL || ''
      });
    }
  };

  const fetchSupabaseStats = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('followers_count, likes_count, sales_count, total_revenue, pending_balance, available_balance, virtual_account')
        .eq('vendor_id', vendorId)
        .single();

      if (error) throw error;

      setSupabaseStats({
        followers_count: data.followers_count || 0,
        likes_count: data.likes_count || 0,
        sales_count: data.sales_count || 0,
        total_revenue: data.total_revenue || 0,
        pending_balance: data.pending_balance || 0,
        available_balance: data.available_balance || 0,
        virtual_account: data.virtual_account || `VND${Date.now().toString().slice(8)}`
      });
    } catch (error) {
      console.error('Error fetching supabase stats:', error);
      setSupabaseStats({
        followers_count: 0,
        likes_count: 0,
        sales_count: 0,
        total_revenue: 0,
        pending_balance: 0,
        available_balance: 0,
        virtual_account: `VND${Date.now().toString().slice(8)}`
      });
    }
  };

  const fetchOrders = async (vendorId: string) => {
    try {
      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(orderItems || []);

      const stats: OrderStats = {
        total: orderItems?.length || 0,
        pending: orderItems?.filter(item => 
          item.vendor_status === 'pending' && item.user_status !== 'cancelled'
        ).length || 0,
        accepted: orderItems?.filter(item => item.vendor_status === 'accepted').length || 0,
        rejected: orderItems?.filter(item => item.vendor_status === 'rejected').length || 0,
        cancelled: orderItems?.filter(item => item.user_status === 'cancelled').length || 0,
        received: orderItems?.filter(item => item.user_status === 'received').length || 0
      };
      setOrderStats(stats);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    }
  };

  const fetchTransactions = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('transaction_created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    }
  };

  const fetchProductsFromSupabase = async (vendorId: string) => {
    try {
      const { data: productsData, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const transformedProducts: Product[] = (productsData || []).map(product => ({
        ...product,
        original_price: product.original_price || product.price,
        detailed_description: product.detailed_description || product.description,
        subcategory: product.subcategory || '',
        condition: product.condition || 'new',
        updated_at: product.updated_at || product.created_at || new Date().toISOString(),
        tags: product.tags || [],
        specifications: product.specifications || {},
        shipping_info: product.shipping_info || {},
        warranty_info: product.warranty_info,
        delivery_campus_ids: product.delivery_campus_ids || []
      }));

      setProducts(transformedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    }
  };

  const handleAcceptOrder = async (orderItemId: string) => {
    if (!vendorProfile) return;
    
    setProcessingOrder(orderItemId);
    try {
      const { error: updateError } = await supabase
        .from('order_items')
        .update({ 
          vendor_status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderItemId);

      if (updateError) throw updateError;

      await fetchOrders(vendorProfile.id);
      
      const orderItem = orders.find(item => item.id === orderItemId);
      if (orderItem) {
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            order_id: orderItem.order_id,
            order_number: orderItem.order_id,
            product_id: orderItem.product_id,
            user_id: '',
            user_name: 'Customer',
            vendor_id: vendorProfile.id,
            vendor_name: vendorProfile.shopName,
            transaction_type: 'order_accepted',
            amount: orderItem.total_price,
            description: `Order accepted for ${orderItem.product_title}`,
            user_status_at_time: orderItem.user_status,
            vendor_status_at_time: 'accepted',
            order_created_at: orderItem.created_at,
            transaction_created_at: new Date().toISOString()
          });

        if (transactionError) console.error('Transaction record error:', transactionError);
      }
    } catch (error) {
      console.error('Error accepting order:', error);
      alert('Failed to accept order. Please try again.');
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleRejectOrder = async (orderItemId: string) => {
    if (!vendorProfile || !rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setProcessingOrder(orderItemId);
    try {
      const { error: updateError } = await supabase
        .from('order_items')
        .update({ 
          vendor_status: 'rejected',
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderItemId);

      if (updateError) throw updateError;

      const orderItem = orders.find(item => item.id === orderItemId);
      if (orderItem) {
        const { error: vendorBalanceError } = await supabase.rpc('update_vendor_balance', {
          vendor_id: vendorProfile.id,
          amount_change: -orderItem.total_price,
          balance_type: 'pending'
        });

        if (vendorBalanceError) console.error('Vendor balance update error:', vendorBalanceError);
      }

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          order_id: orderItem?.order_id || '',
          order_number: orderItem?.order_id || '',
          product_id: orderItem?.product_id || '',
          user_id: '',
          user_name: 'Customer',
          vendor_id: vendorProfile.id,
          vendor_name: vendorProfile.shopName,
          transaction_type: 'order_rejected',
          amount: orderItem?.total_price || 0,
          description: `Order rejected: ${rejectionReason}`,
          user_status_at_time: orderItem?.user_status || 'pending',
          vendor_status_at_time: 'rejected',
          rejection_reason: rejectionReason,
          order_created_at: orderItem?.created_at || new Date().toISOString(),
          transaction_created_at: new Date().toISOString()
        });

      if (transactionError) console.error('Transaction record error:', transactionError);

      await fetchOrders(vendorProfile.id);
      await fetchSupabaseStats(vendorProfile.id);
      
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting order:', error);
      alert('Failed to reject order. Please try again.');
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleMarkDelivered = async (orderItemId: string) => {
    if (!vendorProfile) return;
    
    setProcessingOrder(orderItemId);
    try {
      const orderItem = orders.find(item => item.id === orderItemId);
      if (!orderItem) throw new Error('Order not found');

      const { error: updateError } = await supabase
        .from('order_items')
        .update({ 
          updated_at: new Date().toISOString()
        })
        .eq('id', orderItemId);

      if (updateError) throw updateError;

      const { error: vendorBalanceError } = await supabase.rpc('update_vendor_balance', {
        vendor_id: vendorProfile.id,
        amount_change: -orderItem.total_price,
        balance_type: 'pending'
      });

      if (vendorBalanceError) throw vendorBalanceError;

      const { error: vendorAvailableError } = await supabase.rpc('update_vendor_balance', {
        vendor_id: vendorProfile.id,
        amount_change: orderItem.total_price,
        balance_type: 'available'
      });

      if (vendorAvailableError) throw vendorAvailableError;

      const { error: productError } = await supabase.rpc('increment_product_sales', {
        product_id: orderItem.product_id,
        increment_amount: orderItem.quantity
      });

      if (productError) throw productError;

      const { error: vendorStatsError } = await supabase.rpc('update_vendor_stats', {
        vendor_id_param: vendorProfile.id,
        sales_increment: orderItem.quantity,
        revenue_increment: orderItem.total_price
      });

      if (vendorStatsError) throw vendorStatsError;

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          order_id: orderItem.order_id,
          order_number: orderItem.order_id,
          product_id: orderItem.product_id,
          user_id: '',
          user_name: 'Customer',
          vendor_id: vendorProfile.id,
          vendor_name: vendorProfile.shopName,
          transaction_type: 'delivery_completed',
          amount: orderItem.total_price,
          description: `Delivery completed for ${orderItem.product_title}`,
          user_status_at_time: 'received',
          vendor_status_at_time: 'delivered',
          order_created_at: orderItem.created_at,
          transaction_created_at: new Date().toISOString()
        });

      if (transactionError) console.error('Transaction record error:', transactionError);

      await fetchOrders(vendorProfile.id);
      await fetchSupabaseStats(vendorProfile.id);
      await fetchProductsFromSupabase(vendorProfile.id);
      
      alert('Delivery marked as completed. Funds transferred to available balance.');
    } catch (error) {
      console.error('Error marking delivery:', error);
      alert('Failed to mark delivery. Please try again.');
    } finally {
      setProcessingOrder(null);
    }
  };

  const loadVendorProfile = async (vendorId: string) => {
    try {
      const vendorDoc = await getDoc(doc(db, 'vendors', vendorId));
      
      if (!vendorDoc.exists()) {
        navigate('/vendor/onboarding');
        return null;
      }

      const vendorData = vendorDoc.data();
      const profile: VendorProfile = {
        id: vendorDoc.id,
        userId: vendorData.userId,
        shopName: vendorData.shopName || '',
        profileImage: vendorData.profileImage || '',
        coverImage: vendorData.coverImage || '',
        bio: vendorData.bio || '',
        location: vendorData.location || '',
        contactPhone: vendorData.contactPhone || '',
        businessEmail: vendorData.businessEmail || '',
        website: vendorData.website || '',
        instagramHandle: vendorData.instagramHandle || '',
        facebookPage: vendorData.facebookPage || '',
        twitterHandle: vendorData.twitterHandle || '',
        businessHours: vendorData.businessHours || '',
        returnPolicy: vendorData.returnPolicy || '',
        shippingPolicy: vendorData.shippingPolicy || '',
        isActive: vendorData.isActive || false,
        onboardingCompleted: vendorData.onboardingCompleted || false,
        createdAt: vendorData.createdAt?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: vendorData.updatedAt?.toDate().toISOString() || new Date().toISOString()
      };

      setVendorProfile(profile);
      return profile;
    } catch (error) {
      console.error('Error loading vendor profile:', error);
      navigate('/vendor/onboarding');
      return null;
    }
  };

  const loadVendorBusinesses = async (userId: string): Promise<VendorBusiness[]> => {
    try {
      const vendorsQuery = query(
        collection(db, 'vendors'),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      
      const vendorsSnapshot = await getDocs(vendorsQuery);
      const businesses: VendorBusiness[] = vendorsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          shopName: data.shopName || '',
          profileImage: data.profileImage || '',
          isActive: data.isActive || false
        };
      });

      setVendorBusinesses(businesses);
      return businesses;
    } catch (error) {
      console.error('Error loading vendor businesses:', error);
      setVendorBusinesses([]);
      return [];
    }
  };

  const loadInitialData = async (userId: string) => {
    try {
      setLoading(true);
      
      const businesses = await loadVendorBusinesses(userId);
      
      if (businesses.length > 0) {
        await loadVendorProfile(businesses[0].id);
        await fetchOrders(businesses[0].id);
        await fetchTransactions(businesses[0].id);
        await fetchProductsFromSupabase(businesses[0].id);
        await fetchSupabaseStats(businesses[0].id);
      } else {
        navigate('/vendor/onboarding');
        return;
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user.uid);
        await loadInitialData(user.uid);
      } else {
        navigate('/signin');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (vendorProfile && activeTab === 'products') {
      fetchProductsFromSupabase(vendorProfile.id);
    }
  }, [activeTab, vendorProfile]);

  const handleShopSwitch = async (vendorId: string) => {
    if (!vendorId || vendorId === vendorProfile?.id) {
      setShowShopPopup(false);
      return;
    }

    setLoading(true);
    setShowShopPopup(false);
    
    try {
      await loadVendorProfile(vendorId);
      await fetchOrders(vendorId);
      await fetchTransactions(vendorId);
      await fetchProductsFromSupabase(vendorId);
      await fetchSupabaseStats(vendorId);
    } catch (error) {
      console.error('Error switching shop:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !vendorProfile) {
    return (
      <div className="vendash-loading-state">
        <div className="vendash-spinner-loader"></div>
        <div>Loading your dashboard...</div>
      </div>
    );
  }

  if (!vendorProfile) {
    return (
      <div className="vendash-loading-state">
        <Building size={32} />
        <h3>No Shop Found</h3>
        <p>Create your shop to get started</p>
        <button 
          className="vendash-primary-action-button"
          onClick={() => navigate('/vendor/onboarding')}
        >
          <Plus size={12} /> Create Your Shop
        </button>
      </div>
    );
  }

  return (
    <div className="vendash-container">
      {/* Header */}
      <header className="vendash-header-main">
        <div className="vendash-user-section">
          {userProfile?.profileImage ? (
            <img 
              src={userProfile.profileImage} 
              alt="Profile" 
              className="vendash-user-avatar"
            />
          ) : (
            <div className="vendash-user-avatar">
              <UserIcon size={12} />
            </div>
          )}
          <span className="vendash-username-text">
            {userProfile?.name || currentUser?.email?.split('@')[0] || 'Vendor'}
          </span>
        </div>
        
        <h1 className="vendash-header-title">My Shop</h1>
        
        <div className="vendash-header-actions">
          <button 
            className="vendash-header-btn"
            onClick={() => navigate('/notifications')}
          >
            <Bell size={16} />
            {orderStats.pending > 0 && (
              <span className="vendash-notification-badge">{orderStats.pending}</span>
            )}
          </button>
          
          <button 
            className="vendash-header-btn"
            onClick={() => navigate('/vendor/settings')}
          >
            <Settings size={16} />
          </button>
          
          <button 
            className="vendash-header-btn"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="vendash-main-content">
        {/* Shop Background Image Section */}
        <section className="vendash-shop-background-section">
          {vendorProfile.coverImage && (
            <img 
              src={vendorProfile.coverImage} 
              alt="Shop background" 
              className="vendash-shop-cover-image"
            />
          )}
          <div className="vendash-shop-overlay-content">
            {/* Shop Identity Card - Aligned to right */}
            <section className="vendash-shop-identity-card">
              <div className="vendash-shop-header-row">
                <div className="vendash-shop-logo-wrapper">
                  {vendorProfile.profileImage ? (
                    <img 
                      src={vendorProfile.profileImage} 
                      alt={vendorProfile.shopName}
                      className="vendash-shop-logo-image"
                    />
                  ) : (
                    <div className="vendash-shop-logo-fallback">
                      {vendorProfile.shopName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {vendorBusinesses.length > 1 && (
                    <button 
                      className="vendash-switch-shop-button"
                      onClick={() => setShowShopPopup(true)}
                    >
                      <Store size={12} />
                    </button>
                  )}
                </div>
                
                <div className="vendash-shop-info-details">
                  <h2 className="vendash-shop-name-text">{vendorProfile.shopName}</h2>
                  <p className="vendash-shop-bio-text">{vendorProfile.bio || 'No bio yet'}</p>
                  <div className="vendash-shop-location-row">
                    <MapPin size={10} />
                    <span>{vendorProfile.location || 'No location set'}</span>
                  </div>
                </div>
              </div>
              
              {/* Shop Stats Grid - ADDED BACK */}
              <div className="vendash-shop-stats-grid">
                <div className="vendash-shop-stat-item">
                  <span className="vendash-shop-stat-label-text">
                    <Users size={10} /> Followers
                  </span>
                  <span className="vendash-shop-stat-value-number">
                    {supabaseStats?.followers_count || 0}
                  </span>
                </div>
                <div className="vendash-shop-stat-item">
                  <span className="vendash-shop-stat-label-text">
                    <Heart size={10} /> Likes
                  </span>
                  <span className="vendash-shop-stat-value-number">
                    {supabaseStats?.likes_count || 0}
                  </span>
                </div>
                <div className="vendash-shop-stat-item">
                  <span className="vendash-shop-stat-label-text">
                    <ShoppingCart size={10} /> Sales
                  </span>
                  <span className="vendash-shop-stat-value-number">
                    {supabaseStats?.sales_count || 0}
                  </span>
                </div>
                <div className="vendash-shop-stat-item">
                  <span className="vendash-shop-stat-label-text">
                    <DollarSign size={10} /> Revenue
                  </span>
                  <span className="vendash-shop-stat-value-number">
                    {formatPrice(supabaseStats?.total_revenue || 0)}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </section>

        {/* Balance Overview Section - ADDED BACK */}
        <section className="vendash-balance-overview-section">
          <h3 className="vendash-section-title-heading">
            <DollarSign size={12} /> Balance Overview
          </h3>
          <div className="vendash-balance-cards-grid">
            <div className="vendash-balance-card-item vendash-balance-card-pending">
              <div className="vendash-balance-icon-container">
                <Clock size={16} />
              </div>
              <div className="vendash-balance-info-content">
                <h4>Pending</h4>
                <p className={`vendash-balance-amount-value ${supabaseStats ? '' : 'loading'}`}>
                  {supabaseStats ? formatPrice(supabaseStats.pending_balance) : '-.-'}
                </p>
                <small>Awaiting confirmation</small>
              </div>
            </div>
            
            <div className="vendash-balance-card-item vendash-balance-card-available">
              <div className="vendash-balance-icon-container">
                <Wallet size={16} />
              </div>
              <div className="vendash-balance-info-content">
                <h4>Available</h4>
                <p className={`vendash-balance-amount-value ${supabaseStats ? '' : 'loading'}`}>
                  {supabaseStats ? formatPrice(supabaseStats.available_balance) : '-.-'}
                </p>
                <small>Ready to withdraw</small>
              </div>
            </div>

            <div className="vendash-balance-card-item vendash-balance-card-revenue">
              <div className="vendash-balance-icon-container">
                <Banknote size={16} />
              </div>
              <div className="vendash-balance-info-content">
                <h4>Total Revenue</h4>
                <p className="vendash-balance-amount-value">
                  {formatPrice(supabaseStats?.total_revenue || 0)}
                </p>
                <small>All-time earnings</small>
              </div>
            </div>

            <div className="vendash-balance-card-item vendash-balance-card-account">
              <div className="vendash-balance-icon-container">
                <CreditCard size={16} />
              </div>
              <div className="vendash-balance-info-content">
                <h4>Account</h4>
                <p className={`vendash-account-number-text ${supabaseStats ? '' : 'loading'}`}>
                  {supabaseStats?.virtual_account || 'VND---'}
                </p>
                <small>Business account</small>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs Navigation - Orders first */}
        <nav className="vendash-tabs-navigation">
          <button 
            className={`vendash-tab-button ${activeTab === 'orders' ? 'vendash-tab-button-active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <ShoppingCart size={14} />
            <span>Orders</span>
            {orderStats.pending > 0 && (
              <span className="vendash-tab-notification">{orderStats.pending}</span>
            )}
          </button>
          <button 
            className={`vendash-tab-button ${activeTab === 'transactions' ? 'vendash-tab-button-active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            <FileText size={14} />
            <span>Transactions</span>
          </button>
          <button 
            className={`vendash-tab-button ${activeTab === 'products' ? 'vendash-tab-button-active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <Package size={14} />
            <span>Products</span>
          </button>
          <button 
            className={`vendash-tab-button ${activeTab === 'overview' ? 'vendash-tab-button-active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Grid size={14} />
            <span>Overview</span>
          </button>
          <button 
            className={`vendash-tab-button ${activeTab === 'analytics' ? 'vendash-tab-button-active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={14} />
            <span>Analytics</span>
          </button>
        </nav>

        {/* Tab Content */}
        <div className="vendash-tab-content-area">
          {activeTab === 'orders' && (
            <OrdersTab 
              orders={orders}
              orderStats={orderStats}
              onAcceptOrder={handleAcceptOrder}
              onRejectOrder={handleRejectOrder}
              onMarkDelivered={handleMarkDelivered}
              processingOrder={processingOrder}
              rejectionReason={rejectionReason}
              onRejectionReasonChange={setRejectionReason}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsTab transactions={transactions} />
          )}

          {activeTab === 'products' && (
            <ProductsTab 
              products={products}
              onAddProduct={() => navigate('/vendor/add-product')}
              onEditProduct={(productId) => navigate(`/vendor/edit-product/${productId}`)}
              onDeleteProduct={async (productId) => {
                if (window.confirm('Are you sure you want to delete this product?')) {
                  try {
                    const { error } = await supabase
                      .from('products')
                      .delete()
                      .eq('id', productId);

                    if (error) throw error;
                    
                    if (vendorProfile) {
                      fetchProductsFromSupabase(vendorProfile.id);
                    }
                  } catch (error) {
                    console.error('Error deleting product:', error);
                    alert('Failed to delete product');
                  }
                }
              }}
            />
          )}

          {activeTab === 'overview' && (
            <OverviewTab 
              vendorProfile={vendorProfile}
              products={products}
              orderStats={orderStats}
              supabaseStats={supabaseStats}
              onAddProduct={() => navigate('/vendor/add-product')}
              onViewProducts={() => setActiveTab('products')}
              onViewOrders={() => setActiveTab('orders')}
            />
          )}

          {activeTab === 'analytics' && <AnalyticsTab />}
        </div>
      </main>

      {/* Shop Switch Popup */}
      {showShopPopup && (
        <div className="vendash-popup-overlay-bg" onClick={() => setShowShopPopup(false)}>
          <div className="vendash-shop-popup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vendash-popup-header-section">
              <h3>Switch Shop</h3>
              <button 
                className="vendash-close-popup-button"
                onClick={() => setShowShopPopup(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="vendash-shops-list-container">
              {vendorBusinesses.map(shop => (
                <div 
                  key={shop.id} 
                  className={`vendash-shop-list-item ${shop.id === vendorProfile.id ? 'vendash-shop-list-item-active' : ''}`}
                  onClick={() => handleShopSwitch(shop.id)}
                >
                  <div className="vendash-shop-logo-small-image">
                    {shop.profileImage ? (
                      <img src={shop.profileImage} alt={shop.shopName} />
                    ) : (
                      <div className="vendash-shop-logo-small-fallback">
                        {shop.shopName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="vendash-shop-details-content">
                    <h4>{shop.shopName}</h4>
                    <span className="vendash-shop-status-text">
                      {shop.isActive ? 'Active' : 'Inactive'}
                      {shop.id === vendorProfile.id && ' • Current'}
                    </span>
                  </div>
                  <div className="vendash-shop-arrow-icon">
                    <ChevronRight size={16} />
                  </div>
                </div>
              ))}
            </div>
            <div className="vendash-popup-footer-section">
              <button 
                className="vendash-create-shop-action-button"
                onClick={() => {
                  setShowShopPopup(false);
                  navigate('/vendor/onboarding');
                }}
              >
                <Plus size={14} /> Create New Shop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation - Updated with Market and SquareStack icon */}
      <nav className="bottom-navigation">
        <button className="nav-button" onClick={() => navigate('/user/dashboard')}>
          <Home className="nav-icon" size={20} />
          <span className="nav-label">Home</span>
        </button>
        <button className="nav-button" onClick={() => navigate('/cart')}>
          <ShoppingCart className="nav-icon" size={20} />
          <span className="nav-label">Buy</span>
        </button>
        <button className="nav-button" onClick={() => navigate('/market')}>
          <ShoppingBag className="nav-icon" size={20} />
          <span className="nav-label">Market</span>
        </button>
        <button className="nav-button" onClick={() => navigate('/favorites')}>
          <Heart className="nav-icon" size={20} />
          <span className="nav-label">Favorites</span>
        </button>
        <button className="nav-button active">
          <MessagesSquare className="nav-icon" size={20} />
          <span className="nav-label">Messages</span>
        </button>
      </nav>
    </div>
  );
};

// Tab Components
const OrdersTab: React.FC<{
  orders: OrderItem[];
  orderStats: OrderStats;
  onAcceptOrder: (orderId: string) => Promise<void>;
  onRejectOrder: (orderId: string) => Promise<void>;
  onMarkDelivered: (orderId: string) => Promise<void>;
  processingOrder: string | null;
  rejectionReason: string;
  onRejectionReasonChange: (reason: string) => void;
}> = ({ 
  orders, 
  orderStats, 
  onAcceptOrder, 
  onRejectOrder, 
  onMarkDelivered,
  processingOrder,
  rejectionReason,
  onRejectionReasonChange
}) => {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const getStatusColor = (vendorStatus: string, userStatus: string) => {
    if (userStatus === 'cancelled') return '#dc2626';
    if (vendorStatus === 'rejected') return '#ef4444';
    if (vendorStatus === 'accepted' && userStatus === 'received') return '#10b981';
    if (vendorStatus === 'accepted') return '#3b82f6';
    if (vendorStatus === 'pending') return '#f59e0b';
    return '#6b7280';
  };

  const getStatusText = (vendorStatus: string, userStatus: string) => {
    if (userStatus === 'cancelled') return 'Cancelled by Buyer';
    if (vendorStatus === 'rejected') return 'Rejected by You';
    if (vendorStatus === 'accepted' && userStatus === 'received') return 'Ready for Delivery';
    if (vendorStatus === 'accepted') return 'Accepted';
    if (vendorStatus === 'pending') return 'Pending Review';
    return 'Unknown';
  };

  return (
    <div className="vendash-orders-tab">
      {/* Order Stats - Icon and text on same line */}
      <div className="vendash-order-stats-grid">
        <div className="vendash-order-stat-card">
          <div className="vendash-order-stat-content-inline">
            <ClipboardCheck size={12} />
            <span>Total</span>
            <p className="vendash-order-stat-value">{orderStats.total}</p>
          </div>
        </div>
        <div className="vendash-order-stat-card">
          <div className="vendash-order-stat-content-inline">
            <AlertTriangle size={12} />
            <span>Pending</span>
            <p className="vendash-order-stat-value">{orderStats.pending}</p>
          </div>
        </div>
        <div className="vendash-order-stat-card">
          <div className="vendash-order-stat-content-inline">
            <Check size={12} />
            <span>Accepted</span>
            <p className="vendash-order-stat-value">{orderStats.accepted}</p>
          </div>
        </div>
        <div className="vendash-order-stat-card">
          <div className="vendash-order-stat-content-inline">
            <CheckCircle size={12} />
            <span>Received</span>
            <p className="vendash-order-stat-value">{orderStats.received}</p>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="vendash-orders-list">
        {orders.length === 0 ? (
          <div className="vendash-empty-state-container">
            <div className="vendash-empty-icon-container">
              <ShoppingCart size={24} />
            </div>
            <h4>No Orders Yet</h4>
            <p>When customers purchase your products, orders will appear here</p>
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className="vendash-order-item">
              <div 
                className="vendash-order-header"
                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              >
                <div className="vendash-order-title-section">
                  <h4 className="vendash-order-product-title">{order.product_title}</h4>
                  <div 
                    className="vendash-order-status-badge"
                    style={{ backgroundColor: getStatusColor(order.vendor_status, order.user_status) }}
                  >
                    {getStatusText(order.vendor_status, order.user_status)}
                  </div>
                </div>
                <div className="vendash-order-price-section">
                  <p className="vendash-order-price">{formatPrice(order.total_price)}</p>
                  <span className="vendash-order-quantity">x{order.quantity}</span>
                  {expandedOrder === order.id ? (
                    <ChevronUp size={12} className="vendash-order-expand-icon" />
                  ) : (
                    <ChevronDown size={12} className="vendash-order-expand-icon" />
                  )}
                </div>
              </div>

              {expandedOrder === order.id && (
                <div className="vendash-order-details">
                  {/* Alternating row colors like Excel */}
                  <div className="vendash-order-detail-row vendash-order-detail-row-alt">
                    <span className="vendash-order-detail-label">Order ID:</span>
                    <span className="vendash-order-detail-value">{order.order_id}</span>
                  </div>
                  <div className="vendash-order-detail-row">
                    <span className="vendash-order-detail-label">Unit Price:</span>
                    <span className="vendash-order-detail-value">{formatPrice(order.unit_price)}</span>
                  </div>
                  <div className="vendash-order-detail-row vendash-order-detail-row-alt">
                    <span className="vendash-order-detail-label">Quantity:</span>
                    <span className="vendash-order-detail-value">{order.quantity}</span>
                  </div>
                  <div className="vendash-order-detail-row">
                    <span className="vendash-order-detail-label">Total Price:</span>
                    <span className="vendash-order-detail-value">{formatPrice(order.total_price)}</span>
                  </div>
                  <div className="vendash-order-detail-row vendash-order-detail-row-alt">
                    <span className="vendash-order-detail-label">Order Date:</span>
                    <span className="vendash-order-detail-value">{formatDate(order.created_at)}</span>
                  </div>
                  <div className="vendash-order-detail-row">
                    <span className="vendash-order-detail-label">Buyer Status:</span>
                    <span className="vendash-order-detail-value">{order.user_status}</span>
                  </div>
                  <div className="vendash-order-detail-row vendash-order-detail-row-alt">
                    <span className="vendash-order-detail-label">Your Status:</span>
                    <span className="vendash-order-detail-value">{order.vendor_status}</span>
                  </div>
                  
                  {order.location_details && (
                    <div className="vendash-order-detail-row">
                      <span className="vendash-order-detail-label">Delivery Location:</span>
                      <span className="vendash-order-detail-value">
                        {order.location_details.delivery_location || 'N/A'}
                      </span>
                    </div>
                  )}

                  {order.rejection_reason && (
                    <div className="vendash-order-detail-row vendash-order-detail-row-alt">
                      <span className="vendash-order-detail-label">Rejection Reason:</span>
                      <span className="vendash-order-detail-value">{order.rejection_reason}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="vendash-order-actions">
                    {order.user_status === 'cancelled' ? (
                      <div className="vendash-order-cancelled-note">
                        Order was cancelled by the buyer
                      </div>
                    ) : order.vendor_status === 'pending' ? (
                      <>
                        <button
                          className="vendash-order-action-btn vendash-accept-btn"
                          onClick={() => onAcceptOrder(order.id)}
                          disabled={processingOrder === order.id}
                        >
                          {processingOrder === order.id ? (
                            <RefreshCw size={12} className="vendash-spinning-icon" />
                          ) : (
                            <Check size={12} />
                          )}
                          <span>Accept Order</span>
                        </button>
                        <button
                          className="vendash-order-action-btn vendash-reject-btn"
                          onClick={() => {
                            if (!rejectionReason.trim() && window.confirm('Reject without reason?')) {
                              onRejectionReasonChange('No reason provided');
                              setTimeout(() => onRejectOrder(order.id), 100);
                            } else {
                              onRejectOrder(order.id);
                            }
                          }}
                          disabled={processingOrder === order.id}
                        >
                          {processingOrder === order.id ? (
                            <RefreshCw size={12} className="vendash-spinning-icon" />
                          ) : (
                            <X size={12} />
                          )}
                          <span>Reject Order</span>
                        </button>
                        <div className="vendash-rejection-reason-input">
                          <input
                            type="text"
                            placeholder="Reason for rejection (optional)"
                            value={rejectionReason}
                            onChange={(e) => onRejectionReasonChange(e.target.value)}
                            className="vendash-reason-input"
                          />
                        </div>
                      </>
                    ) : order.vendor_status === 'accepted' && order.user_status === 'received' ? (
                      <button
                        className="vendash-order-action-btn vendash-deliver-btn"
                        onClick={() => onMarkDelivered(order.id)}
                        disabled={processingOrder === order.id}
                      >
                        {processingOrder === order.id ? (
                          <RefreshCw size={12} className="vendash-spinning-icon" />
                        ) : (
                          <TruckIcon size={12} />
                        )}
                        <span>Mark as Delivered</span>
                      </button>
                    ) : order.vendor_status === 'accepted' ? (
                      <div className="vendash-waiting-received">
                        Waiting for buyer to mark as received
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const TransactionsTab: React.FC<{
  transactions: Transaction[];
}> = ({ transactions }) => {
  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'order_accepted': return '#3b82f6';
      case 'order_rejected': return '#ef4444';
      case 'delivery_completed': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getTransactionTypeText = (type: string) => {
    switch (type) {
      case 'order_accepted': return 'Order Accepted';
      case 'order_rejected': return 'Order Rejected';
      case 'delivery_completed': return 'Delivery Completed';
      default: return type;
    }
  };

  return (
    <div className="vendash-transactions-tab">
      <div className="vendash-section-header-row">
        <h3 className="vendash-section-title-heading">Transaction History</h3>
        <p>View all your financial transactions</p>
      </div>

      {transactions.length === 0 ? (
        <div className="vendash-empty-state-container">
          <div className="vendash-empty-icon-container">
            <FileText size={24} />
          </div>
          <h4>No Transactions Yet</h4>
          <p>Transaction history will appear here when orders are processed</p>
        </div>
      ) : (
        <div className="vendash-transactions-list">
          {transactions.map(transaction => (
            <div key={transaction.id} className="vendash-transaction-item">
              <div className="vendash-transaction-header">
                <div className="vendash-transaction-type-section">
                  <div 
                    className="vendash-transaction-type-badge"
                    style={{ backgroundColor: getTransactionTypeColor(transaction.transaction_type) }}
                  >
                    {getTransactionTypeText(transaction.transaction_type)}
                  </div>
                  <span className="vendash-transaction-order">Order: {transaction.order_number}</span>
                </div>
                <div className="vendash-transaction-amount-section">
                  <p className="vendash-transaction-amount">{formatPrice(transaction.amount)}</p>
                  <span className="vendash-transaction-date">
                    {formatDate(transaction.transaction_created_at)}
                  </span>
                </div>
              </div>
              
              <div className="vendash-transaction-details">
                <div className="vendash-transaction-detail-row vendash-transaction-detail-row-alt">
                  <span className="vendash-transaction-detail-label">Description:</span>
                  <span className="vendash-transaction-detail-value">{transaction.description}</span>
                </div>
                <div className="vendash-transaction-detail-row">
                  <span className="vendash-transaction-detail-label">Buyer Status:</span>
                  <span className="vendash-transaction-detail-value">{transaction.user_status_at_time}</span>
                </div>
                <div className="vendash-transaction-detail-row vendash-transaction-detail-row-alt">
                  <span className="vendash-transaction-detail-label">Your Status:</span>
                  <span className="vendash-transaction-detail-value">{transaction.vendor_status_at_time}</span>
                </div>
                <div className="vendash-transaction-detail-row">
                  <span className="vendash-transaction-detail-label">Date:</span>
                  <span className="vendash-transaction-detail-value">{formatDate(transaction.transaction_created_at)}</span>
                </div>
                {transaction.rejection_reason && (
                  <div className="vendash-transaction-detail-row vendash-transaction-detail-row-alt">
                    <span className="vendash-transaction-detail-label">Rejection Reason:</span>
                    <span className="vendash-transaction-detail-value">{transaction.rejection_reason}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ProductsTab: React.FC<{
  products: Product[];
  onAddProduct: () => void;
  onEditProduct: (productId: string) => void;
  onDeleteProduct: (productId: string) => Promise<void>;
}> = ({ products, onAddProduct, onEditProduct, onDeleteProduct }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [productFilter, setProductFilter] = useState<'all' | 'active' | 'inactive' | 'promoted'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high' | 'popular'>('newest');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  useEffect(() => {
    filterAndSortProducts();
  }, [products, productFilter, sortBy]);

  const filterAndSortProducts = () => {
    let filtered = [...products];

    if (productFilter !== 'all') {
      if (productFilter === 'active') {
        filtered = filtered.filter(product => product.is_active);
      } else if (productFilter === 'inactive') {
        filtered = filtered.filter(product => !product.is_active);
      } else if (productFilter === 'promoted') {
        filtered = filtered.filter(product => product.is_promoted);
      }
    }

    switch (sortBy) {
      case 'price_low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price_high':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'popular':
        filtered.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
    }

    setFilteredProducts(filtered);
  };

  return (
    <div className="vendash-products-tab">
      <div className="vendash-tab-header-row">
        <div>
          <h3 className="vendash-section-title-heading">Product Management</h3>
          <p>Manage your products and inventory</p>
        </div>
        <button className="vendash-add-product-button" onClick={onAddProduct}>
          <Plus size={12} />
          <span>Add Product</span>
        </button>
      </div>

      {/* Product Controls */}
      <div className="vendash-products-controls">
        <div className="vendash-view-toggle">
          <button 
            className={`vendash-view-btn ${viewMode === 'grid' ? 'vendash-view-btn-active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            <Grid3x3 size={12} />
            <span>Grid</span>
          </button>
          <button 
            className={`vendash-view-btn ${viewMode === 'list' ? 'vendash-view-btn-active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <List size={12} />
            <span>List</span>
          </button>
        </div>

        <div className="vendash-filter-controls">
          <select 
            className="vendash-filter-select"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value as any)}
          >
            <option value="all">All Products</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="promoted">Promoted</option>
          </select>

          <select 
            className="vendash-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="newest">Newest First</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="popular">Most Popular</option>
          </select>
        </div>
      </div>

      {/* Product Count */}
      <div className="vendash-products-count">
        <span>{filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}</span>
        {productFilter !== 'all' && (
          <button 
            className="vendash-clear-filter-btn"
            onClick={() => setProductFilter('all')}
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Products Display */}
      {filteredProducts.length === 0 ? (
        <div className="vendash-empty-state-container">
          <div className="vendash-empty-icon-container">
            <ShoppingBag size={24} />
          </div>
          <h4>No Products Found</h4>
          <p>{productFilter !== 'all' ? 'Try changing your filter' : 'Start by adding your first product'}</p>
          <button className="vendash-cta-primary-button" onClick={onAddProduct}>
            <Plus size={12} /> Add Product Now
          </button>
        </div>
      ) : (
        <div className={`vendash-products-display ${viewMode === 'grid' ? 'vendash-products-grid-view' : 'vendash-products-list-view'}`}>
          {filteredProducts.map((product) => (
            <div key={product.id} className="vendash-product-item-rectangular">
              <div className="vendash-product-image-container">
                {product.images && product.images[0] ? (
                  <img 
                    src={product.images[0]} 
                    alt={product.title}
                    className="vendash-product-main-image"
                  />
                ) : (
                  <div className="vendash-product-image-placeholder">
                    <Package size={24} />
                  </div>
                )}
                
                <div className={`vendash-product-status-badge ${product.is_active ? 'vendash-product-active' : 'vendash-product-inactive'}`}>
                  {product.is_active ? 'Active' : 'Inactive'}
                </div>
                
                {product.is_promoted && (
                  <div className="vendash-product-promoted-badge">
                    🔥 Promoted
                  </div>
                )}
              </div>
              
              <div className="vendash-product-info-section">
                <div className="vendash-product-header">
                  <h4 className="vendash-product-name">{product.title}</h4>
                  <div className="vendash-product-price">
                    {formatPrice(product.price)}
                  </div>
                </div>
                
                <div className="vendash-product-stats-row">
                  <div className="vendash-product-stat">
                    <Eye size={10} />
                    <span>{product.views_count}</span>
                  </div>
                  <div className="vendash-product-stat">
                    <Heart size={10} />
                    <span>{product.likes_count}</span>
                  </div>
                  <div className="vendash-product-stat">
                    <ShoppingCart size={10} />
                    <span>{product.sales_count}</span>
                  </div>
                </div>
                
                <div className="vendash-product-inventory-info">
                  <span className="vendash-inventory-label">Stock:</span>
                  <span className="vendash-inventory-value">
                    {product.inventory} units
                  </span>
                </div>
                
                <div className="vendash-product-revenue-info">
                  <span className="vendash-revenue-label">Revenue:</span>
                  <span className="vendash-revenue-value">
                    {formatPrice(product.price * product.sales_count)}
                  </span>
                </div>
                
                <div className="vendash-product-actions">
                  <button 
                    className="vendash-product-action-btn vendash-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditProduct(product.id);
                    }}
                  >
                    <Edit size={10} />
                    <span>Edit</span>
                  </button>
                  
                  <button 
                    className="vendash-product-action-btn vendash-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProduct(product.id);
                    }}
                  >
                    <Trash2 size={10} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const OverviewTab: React.FC<{
  vendorProfile: VendorProfile;
  products: Product[];
  orderStats: OrderStats;
  supabaseStats: any;
  onAddProduct: () => void;
  onViewProducts: () => void;
  onViewOrders: () => void;
}> = ({ vendorProfile, products, orderStats, supabaseStats, onAddProduct, onViewProducts, onViewOrders }) => {
  
  const stats = {
    totalViews: products.reduce((sum, product) => sum + product.views_count, 0),
    totalLikes: products.reduce((sum, product) => sum + product.likes_count, 0),
    totalSales: products.reduce((sum, product) => sum + product.sales_count, 0),
    totalRevenue: products.reduce((sum, product) => sum + (product.price * product.sales_count), 0),
    totalProducts: products.length,
    activeProducts: products.filter(p => p.is_active).length
  };

  return (
    <div className="vendash-overview-tab">
      <div className="vendash-stats-grid-overview">
        <div className="vendash-stat-card-item">
          <div className="vendash-stat-icon-wrapper">
            <Package size={14} />
          </div>
          <div className="vendash-stat-details-content">
            <h3>Total Products</h3>
            <p className="vendash-stat-number-value">{stats.totalProducts}</p>
          </div>
        </div>
        <div className="vendash-stat-card-item">
          <div className="vendash-stat-icon-wrapper">
            <Eye size={14} />
          </div>
          <div className="vendash-stat-details-content">
            <h3>Total Views</h3>
            <p className="vendash-stat-number-value">{stats.totalViews}</p>
          </div>
        </div>
        <div className="vendash-stat-card-item">
          <div className="vendash-stat-icon-wrapper">
            <Heart size={14} />
          </div>
          <div className="vendash-stat-details-content">
            <h3>Product Likes</h3>
            <p className="vendash-stat-number-value">{stats.totalLikes}</p>
          </div>
        </div>
        <div className="vendash-stat-card-item">
          <div className="vendash-stat-icon-wrapper">
            <ShoppingCart size={14} />
          </div>
          <div className="vendash-stat-details-content">
            <h3>Total Orders</h3>
            <p className="vendash-stat-number-value">{orderStats.total}</p>
          </div>
        </div>
        <div className="vendash-stat-card-item">
          <div className="vendash-stat-icon-wrapper">
            <CheckCircle size={14} />
          </div>
          <div className="vendash-stat-details-content">
            <h3>Accepted Orders</h3>
            <p className="vendash-stat-number-value">{orderStats.accepted}</p>
          </div>
        </div>
        <div className="vendash-stat-card-item">
          <div className="vendash-stat-icon-wrapper">
            <DollarSign size={14} />
          </div>
          <div className="vendash-stat-details-content">
            <h3>Total Revenue</h3>
            <p className="vendash-stat-number-value">{formatPrice(stats.totalRevenue)}</p>
          </div>
        </div>
      </div>

      <div className="vendash-quick-actions-section">
        <h3 className="vendash-section-title-heading">Quick Actions</h3>
        <div className="vendash-actions-grid-buttons">
          <button className="vendash-action-button-item" onClick={onAddProduct}>
            <Plus size={14} />
            <span>Add Product</span>
          </button>
          <button className="vendash-action-button-item" onClick={onViewOrders}>
            <ShoppingCart size={14} />
            <span>View Orders ({orderStats.pending} pending)</span>
          </button>
          <button className="vendash-action-button-item" onClick={() => window.location.href = '/vendor/settings'}>
            <Settings size={14} />
            <span>Shop Settings</span>
          </button>
          <button className="vendash-action-button-item" onClick={() => window.location.href = '/vendor/balance'}>
            <Wallet size={14} />
            <span>Balance Details</span>
          </button>
        </div>
      </div>

      <div className="vendash-products-display-section">
        <div className="vendash-section-header-row">
          <h3 className="vendash-section-title-heading">Recent Products</h3>
          <button className="vendash-view-all-button" onClick={onViewProducts}>
            View All <ChevronRight size={12} />
          </button>
        </div>
        
        {products.length > 0 ? (
          <div className="vendash-products-grid-container">
            {products.slice(0, 4).map(product => (
              <div key={product.id} className="vendash-product-card-item">
                <div className="vendash-product-image-wrapper">
                  {product.images && product.images[0] ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.title}
                      className="vendash-product-image-display"
                    />
                  ) : (
                    <div className="vendash-product-image-placeholder">
                      <Package size={24} />
                    </div>
                  )}
                  <div className={`vendash-product-badge-status vendash-product-badge-${product.is_active ? 'active' : 'inactive'}`}>
                    {product.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <div className="vendash-product-info-content">
                  <h4 className="vendash-product-title-text">{product.title}</h4>
                  <p className="vendash-product-price-amount">{formatPrice(product.price)}</p>
                  <div className="vendash-product-stats-row">
                    <div className="vendash-product-stat-item">
                      <Eye size={10} />
                      <span>{product.views_count}</span>
                    </div>
                    <div className="vendash-product-stat-item">
                      <Heart size={10} />
                      <span>{product.likes_count}</span>
                    </div>
                    <div className="vendash-product-stat-item">
                      <ShoppingCart size={10} />
                      <span>{product.sales_count}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="vendash-empty-state-container">
            <div className="vendash-empty-icon-container">
              <Package size={24} />
            </div>
            <h4>No Products Yet</h4>
            <p>Start adding products to your shop</p>
            <button className="vendash-cta-primary-button" onClick={onAddProduct}>
              <Plus size={12} /> Add First Product
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AnalyticsTab: React.FC = () => (
  <div className="vendash-analytics-tab">
    <div className="vendash-section-header-row">
      <h3 className="vendash-section-title-heading">Business Analytics</h3>
      <p>Track your shop performance</p>
    </div>
    <div className="vendash-analytics-grid-container">
      <div className="vendash-analytics-card-item">
        <div className="vendash-analytics-icon-container">
          <BarChart2 size={20} />
        </div>
        <h4>Sales Performance</h4>
        <p>Detailed sales analytics</p>
        <div className="vendash-coming-soon-badge">Coming Soon</div>
      </div>
      <div className="vendash-analytics-card-item">
        <div className="vendash-analytics-icon-container">
          <Users size={20} />
        </div>
        <h4>Customer Insights</h4>
        <p>Understand your customers</p>
        <div className="vendash-coming-soon-badge">Coming Soon</div>
      </div>
      <div className="vendash-analytics-card-item">
        <div className="vendash-analytics-icon-container">
          <TrendingUp size={20} />
        </div>
        <h4>Growth Metrics</h4>
        <p>Track growth trends</p>
        <div className="vendash-coming-soon-badge">Coming Soon</div>
      </div>
      <div className="vendash-analytics-card-item">
        <div className="vendash-analytics-icon-container">
          <DollarSign size={20} />
        </div>
        <h4>Revenue Reports</h4>
        <p>Download financial reports</p>
        <div className="vendash-coming-soon-badge">Coming Soon</div>
      </div>
    </div>
  </div>
);

export default VendorDashboard;