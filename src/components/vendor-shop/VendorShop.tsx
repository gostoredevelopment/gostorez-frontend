import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { supabase } from '../../lib/supabaseClient';
import { 
  ArrowLeft, 
  Heart, 
  Eye, 
  ShoppingCart, 
  Package, 
  Star, 
  CheckCircle, 
  Users, 
  TrendingUp,
  ShoppingBag,
  User as UserIcon,
  MessageCircle,
  Share2,
  Grid3x3,
  List,
  Shield,
  Truck,
  Tag,
  Home,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  MapPin,
  Mail,
  Phone,
  Globe,
  Instagram,
  Facebook,
  Twitter,
  Award,
  Calendar,
  DollarSign,
  Percent,
  Check,
  ThumbsUp,
  BarChart3,
  TrendingDown,
  ShoppingCart as CartIcon,
  Package as PackageIcon,
  Star as StarIcon,
  Users as UsersIcon,
  Eye as EyeIcon,
  Heart as HeartIcon,
  Truck as TruckIcon,
  Shield as ShieldIcon,
  Home as HomeIcon,
  Clock as ClockIcon,
  Filter as FilterIcon,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  MapPin as MapPinIcon,
  Mail as MailIcon,
  Phone as PhoneIcon,
  Globe as GlobeIcon,
  Instagram as InstagramIcon,
  Facebook as FacebookIcon,
  Twitter as TwitterIcon,
  Award as AwardIcon,
  Calendar as CalendarIcon,
  DollarSign as DollarSignIcon,
  Percent as PercentIcon,
  Check as CheckIcon,
  ThumbsUp as ThumbsUpIcon,
  BarChart3 as BarChart3Icon,
  TrendingDown as TrendingDownIcon,
  Plug,
  PlugZap,
  MessageSquare,
  Copy,
  Zap,
  PackageOpen
} from 'lucide-react';
import './VendorShop.css';
import FollowVendor from './FollowVendor';

type ProductCondition = 'new' | 'like_new' | 'used_good' | 'used_fair' | 'for_parts' | string;

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
  condition: ProductCondition;
  vendor_id: string;
  vendor_name: string;
  vendor_logo?: string;
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
  user_id: string;
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
  description: string;
  created_at: string;
  user_id: string;
  response_time?: string;
  response_rate?: number;
  delivery_campus_ids?: string[];
  contact_email?: string;
  contact_phone?: string;
  social_media?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    website?: string;
  };
  policies?: {
    return_policy?: string;
    shipping_policy?: string;
    payment_methods?: string[];
  };
  bio?: string;
  location?: string;
  business_hours?: string;
  average_rating?: number;
  rating_count?: number;
  total_products?: number;
  total_sales?: number;
  logo_url?: string;
  return_policy?: string;
  shipping_policy?: string;
  total_views?: number;
  total_likes?: number;
  total_revenue?: number;
  business_email?: string;
  instagram_handle?: string;
  facebook_page?: string;
  twitter_handle?: string;
  website?: string;
  sales_count?: number;
}

interface Review {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
  helpful_count: number;
  vendor_id: string;
}

interface VendorStat {
  total_products: number;
  total_sales: number;
  total_views: number;
  total_likes: number;
  total_revenue: number;
  average_rating: number;
  followers_count: number;
  response_rate: number;
  response_time: string;
}

interface VendorShopProps {
  vendorId?: string;
  embedded?: boolean;
  onClose?: () => void;
  onProductClick?: (product: Product) => void;
  initialProductId?: string | null;
  isBlurred?: boolean;
  onToggleExpand?: () => void;
}

const VendorShop: React.FC<VendorShopProps> = ({
  vendorId: propVendorId,
  embedded = false,
  onClose,
  onProductClick,
  initialProductId = null,
  isBlurred = false,
  onToggleExpand
}) => {
  const params = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const vendorId = propVendorId || params.vendorId;
  
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<VendorStat | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'reviews' | 'about' | 'policies'>('products');
  const [productFilter, setProductFilter] = useState<'all' | 'available' | 'promoted'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high' | 'popular'>('newest');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cartStatus, setCartStatus] = useState<{ [key: string]: boolean }>({});
  const [favoritesStatus, setFavoritesStatus] = useState<{ [key: string]: boolean }>({});
  const [showSortDropdown, setShowSortDropdown] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [dataLoadAttempts, setDataLoadAttempts] = useState<number>(0);
  const [vendorLoadError, setVendorLoadError] = useState<string | null>(null);
  const [productsLoadError, setProductsLoadError] = useState<string | null>(null);
  const [reviewsLoadError, setReviewsLoadError] = useState<string | null>(null);
  const [statsLoadError, setStatsLoadError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔍 VendorShop component mounted');
    console.log('🔍 Vendor ID from props/params:', vendorId);
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔍 Auth state changed:', user?.uid);
      setCurrentUser(user);
    });
    
    return () => {
      console.log('🔍 VendorShop component unmounting');
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (vendorId) {
      console.log('🔍 Vendor ID changed, loading data:', vendorId);
      loadAllVendorData();
    } else {
      console.error('❌ No vendor ID provided');
      setError('No vendor ID provided');
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    console.log('🔍 Products, filter, or sort changed, updating filtered products');
    applyProductFiltersAndSorting();
  }, [products, productFilter, sortBy, viewMode]);

  const loadAllVendorData = async () => {
    console.log('🚀 Starting to load all vendor data');
    setLoading(true);
    setError(null);
    setVendorLoadError(null);
    setProductsLoadError(null);
    setReviewsLoadError(null);
    setStatsLoadError(null);
    setDataLoadAttempts(prev => prev + 1);

    if (!vendorId) {
      console.error('❌ Vendor ID is required but not provided');
      setError('Vendor ID is required');
      setLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadVendorProfileData(),
        loadVendorProductsData(),
        loadVendorReviewsData()
      ]);
      
      calculateVendorStatistics();
      
      if (currentUser) {
        fetchCartAndFavoritesStatus();
      }
      
      console.log('✅ All vendor data loaded successfully');
    } catch (err: any) {
      console.error('❌ Error loading vendor data:', err);
      setError(err.message || 'Failed to load vendor shop data');
    } finally {
      setLoading(false);
      console.log('🔍 Loading completed');
    }
  };

  const loadVendorProfileData = async () => {
    console.log('📋 Loading vendor profile for ID:', vendorId);
    try {
      // First, calculate vendor statistics from products table
      await calculateAndUpdateVendorStats();
      
      // Then fetch the updated vendor profile
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();

      if (vendorError || !vendorData) {
        console.error('❌ Vendor profile error:', vendorError);
        setVendorLoadError(vendorError?.message || 'Vendor not found');
        throw new Error('Vendor not found or error loading vendor profile');
      }

      console.log('✅ Vendor profile loaded:', vendorData);

      const transformedVendor: VendorProfile = {
        ...vendorData,
        shop_name: vendorData.shop_name || 'Unnamed Shop',
        profile_image: vendorData.profile_image || vendorData.logo_url || '',
        cover_image: vendorData.cover_image,
        rating: vendorData.average_rating || 0,
        followers_count: vendorData.followers_count || 0,
        completed_trades: vendorData.sales_count || vendorData.total_sales || 0,
        is_verified: false, // Assuming this field doesn't exist
        online_status: true, // Assuming online status
        description: vendorData.bio || 'This vendor has not provided a shop description yet.',
        user_id: vendorData.user_id || '',
        response_time: 'Within 24 hours',
        response_rate: 95,
        delivery_campus_ids: [],
        contact_email: vendorData.business_email,
        contact_phone: vendorData.contact_phone,
        social_media: {
          instagram: vendorData.instagram_handle,
          facebook: vendorData.facebook_page,
          twitter: vendorData.twitter_handle,
          website: vendorData.website
        },
        policies: {
          return_policy: vendorData.return_policy,
          shipping_policy: vendorData.shipping_policy,
          payment_methods: ['Cash on Delivery', 'Bank Transfer', 'Card Payment']
        },
        bio: vendorData.bio,
        location: vendorData.location,
        business_hours: vendorData.business_hours,
        average_rating: vendorData.average_rating,
        rating_count: vendorData.rating_count,
        total_products: vendorData.total_products,
        total_sales: vendorData.total_sales,
        logo_url: vendorData.logo_url,
        return_policy: vendorData.return_policy,
        shipping_policy: vendorData.shipping_policy,
        total_views: vendorData.total_views || 0,
        total_likes: vendorData.total_likes || 0,
        total_revenue: vendorData.total_revenue || 0,
        business_email: vendorData.business_email,
        instagram_handle: vendorData.instagram_handle,
        facebook_page: vendorData.facebook_page,
        twitter_handle: vendorData.twitter_handle,
        website: vendorData.website,
        sales_count: vendorData.sales_count || vendorData.total_sales || 0
      };

      setVendor(transformedVendor);
      console.log('✅ Vendor profile transformed and set');

    } catch (err: any) {
      console.error('❌ Exception loading vendor profile:', err);
      throw err;
    }
  };

  const calculateAndUpdateVendorStats = async () => {
    console.log('📊 Calculating and updating vendor statistics in database');
    try {
      // First, get all products for this vendor
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('views_count, likes_count, sales_count, price, inventory, is_active')
        .eq('vendor_id', vendorId);

      if (productsError) {
        console.error('❌ Error fetching products for stats:', productsError);
        return;
      }

      // Calculate totals
      const totalProducts = productsData?.length || 0;
      const totalSales = productsData?.reduce((sum, product) => sum + (product.sales_count || 0), 0) || 0;
      const totalViews = productsData?.reduce((sum, product) => sum + (product.views_count || 0), 0) || 0;
      const totalLikes = productsData?.reduce((sum, product) => sum + (product.likes_count || 0), 0) || 0;
      
      // Calculate total revenue (price * sales_count for each product)
      const totalRevenue = productsData?.reduce((sum, product) => {
        return sum + (product.price * (product.sales_count || 0));
      }, 0) || 0;

      // Count active products
      const activeProducts = productsData?.filter(product => product.is_active).length || 0;

      // Get average rating from reviews
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('rating')
        .eq('vendor_id', vendorId);

      const averageRating = reviewsData && reviewsData.length > 0 
        ? reviewsData.reduce((sum, review) => sum + review.rating, 0) / reviewsData.length
        : 0;

      // Update vendor profile with calculated stats
      const { error: updateError } = await supabase
        .from('vendor_profiles')
        .update({
          total_products: activeProducts,
          total_sales: totalSales,
          total_views: totalViews,
          total_likes: totalLikes,
          total_revenue: totalRevenue,
          average_rating: averageRating,
          rating_count: reviewsData?.length || 0,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendorId);

      if (updateError) {
        console.error('❌ Error updating vendor stats:', updateError);
      } else {
        console.log('✅ Vendor stats updated in database');
        console.log('📊 Stats calculated:', {
          totalProducts: activeProducts,
          totalSales,
          totalViews,
          totalLikes,
          totalRevenue,
          averageRating,
          ratingCount: reviewsData?.length || 0
        });
      }
    } catch (err) {
      console.error('❌ Exception calculating vendor stats:', err);
    }
  };

  const loadVendorProductsData = async () => {
    console.log('📦 Loading vendor products for ID:', vendorId);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (productsError) {
        console.error('❌ Products error:', productsError);
        setProductsLoadError(productsError.message);
        setProducts([]);
      } else {
        console.log('✅ Products loaded:', productsData?.length || 0);
        
        const transformedProducts: Product[] = (productsData || []).map(product => ({
          ...product,
          original_price: product.original_price || product.price,
          detailed_description: product.description,
          subcategory: '',
          condition: (product.condition as ProductCondition) || 'new',
          updated_at: product.updated_at || product.created_at || new Date().toISOString(),
          tags: product.tags || [],
          specifications: {},
          shipping_info: {},
          warranty_info: undefined,
          delivery_campus_ids: [],
          vendor_name: product.vendor_name || '',
          vendor_logo: product.vendor_logo,
          views_count: product.views_count || 0,
          likes_count: product.likes_count || 0,
          sales_count: product.sales_count || 0,
          inventory: product.inventory || 0,
          is_promoted: product.is_promoted || false
        }));

        setProducts(transformedProducts);
      }
    } catch (err: any) {
      console.error('❌ Exception loading products:', err);
      setProducts([]);
    }
  };

  const loadVendorReviewsData = async () => {
    console.log('📝 Loading vendor reviews for ID:', vendorId);
    try {
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (reviewsError) {
        console.log('ℹ️ No reviews found or error:', reviewsError.message);
        setReviewsLoadError(reviewsError.message);
        setReviews([]);
      } else {
        console.log('✅ Reviews loaded:', reviewsData?.length || 0);
        
        const transformedReviews: Review[] = (reviewsData || []).map(review => ({
          ...review,
          user_name: 'Customer',
          helpful_count: 0,
          vendor_id: vendorId
        }));

        setReviews(transformedReviews);
      }
    } catch (err: any) {
      console.error('❌ Exception loading reviews:', err);
      setReviews([]);
    }
  };

  const calculateVendorStatistics = () => {
    console.log('📊 Calculating vendor statistics for display');
    try {
      const totalProducts = products.length || 0;
      const totalSales = products.reduce((sum, product) => sum + (product.sales_count || 0), 0);
      const totalViews = products.reduce((sum, product) => sum + (product.views_count || 0), 0);
      const totalLikes = products.reduce((sum, product) => sum + (product.likes_count || 0), 0);
      const followersCount = vendor?.followers_count || 0;
      
      // Calculate total revenue
      const totalRevenue = products.reduce((sum, product) => {
        return sum + (product.price * (product.sales_count || 0));
      }, 0);

      // Calculate average rating
      const averageRating = reviews.length > 0 
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
        : vendor?.average_rating || 0;

      const calculatedStats: VendorStat = {
        total_products: totalProducts,
        total_sales: totalSales,
        total_views: totalViews,
        total_likes: totalLikes,
        total_revenue: totalRevenue,
        followers_count: followersCount,
        average_rating: parseFloat(averageRating.toFixed(1)),
        response_rate: 95,
        response_time: 'Within 24 hours'
      };

      console.log('📊 Calculated stats for display:', calculatedStats);
      setStats(calculatedStats);
    } catch (err) {
      console.error('❌ Error calculating statistics:', err);
      setStatsLoadError('Failed to calculate statistics');
    }
  };

  const fetchCartAndFavoritesStatus = () => {
    console.log('🛒 Fetching cart and favorites status');
    if (!currentUser || products.length === 0) {
      console.log('ℹ️ No user or products, skipping cart/favorites fetch');
      return;
    }

    fetchCartStatus(currentUser.uid, products.map(p => p.id));
    fetchFavoritesStatus(currentUser.uid, products.map(p => p.id));
  };

  const applyProductFiltersAndSorting = () => {
    console.log('🔍 Applying product filters and sorting');
    let filtered = [...products];

    console.log('🔍 Initial products count:', filtered.length);
    console.log('🔍 Current filter:', productFilter);
    console.log('🔍 Current sort:', sortBy);
    console.log('🔍 Current view mode:', viewMode);

    switch (productFilter) {
      case 'available':
        filtered = filtered.filter(product => product.inventory > 0);
        console.log('🔍 After available filter:', filtered.length);
        break;
      case 'promoted':
        filtered = filtered.filter(product => product.is_promoted);
        console.log('🔍 After promoted filter:', filtered.length);
        break;
      case 'all':
      default:
        console.log('🔍 Using all products filter');
        break;
    }

    switch (sortBy) {
      case 'price_low':
        filtered.sort((a, b) => a.price - b.price);
        console.log('🔍 Sorted by price low to high');
        break;
      case 'price_high':
        filtered.sort((a, b) => b.price - a.price);
        console.log('🔍 Sorted by price high to low');
        break;
      case 'popular':
        filtered.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
        console.log('🔍 Sorted by popularity');
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        console.log('🔍 Sorted by newest');
        break;
    }

    console.log('🔍 Final filtered products count:', filtered.length);
    setFilteredProducts(filtered);
  };

  const fetchCartStatus = async (userId: string, productIds: string[]) => {
    console.log('🛒 Fetching cart status for user:', userId);
    try {
      if (productIds.length === 0) {
        console.log('ℹ️ No product IDs to check cart status');
        return;
      }
      
      const { data, error } = await supabase
        .from('carts')
        .select('product_id')
        .eq('user_id', userId)
        .in('product_id', productIds);

      if (error) {
        console.error('❌ Error fetching cart status:', error);
        return;
      }

      const statusMap: { [key: string]: boolean } = {};
      data?.forEach(item => {
        statusMap[item.product_id] = true;
      });

      console.log('✅ Cart status fetched for', Object.keys(statusMap).length, 'products');
      setCartStatus(statusMap);
    } catch (error) {
      console.error('❌ Exception in fetchCartStatus:', error);
    }
  };

  const fetchFavoritesStatus = async (userId: string, productIds: string[]) => {
    console.log('❤️ Fetching favorites status for user:', userId);
    try {
      if (productIds.length === 0) {
        console.log('ℹ️ No product IDs to check favorites status');
        return;
      }
      
      const { data, error } = await supabase
        .from('user_favorites')
        .select('product_id')
        .eq('user_id', userId)
        .in('product_id', productIds);

      if (error) {
        console.error('❌ Error fetching favorites status:', error);
        return;
      }

      const statusMap: { [key: string]: boolean } = {};
      data?.forEach(item => {
        statusMap[item.product_id] = true;
      });

      console.log('✅ Favorites status fetched for', Object.keys(statusMap).length, 'products');
      setFavoritesStatus(statusMap);
    } catch (error) {
      console.error('❌ Exception in fetchFavoritesStatus:', error);
    }
  };

  const handleProductClick = (product: Product, e: React.MouseEvent) => {
    console.log('🖱️ Product clicked:', product.id, product.title);
    e.stopPropagation();
    
    if (onProductClick) {
      console.log('🔗 Using onProductClick callback');
      onProductClick(product);
    } else {
      console.log('🔗 Navigating to product detail page');
      navigate(`/product/${product.id}`);
    }
    
    try {
      supabase.rpc('increment_views', { product_id: product.id });
      console.log('👁️ View count incremented');
    } catch (error) {
      console.error('❌ Error incrementing view count:', error);
    }
  };

  const handleContactVendor = () => {
    console.log('💬 Contact vendor clicked');
    if (!vendor) {
      console.error('❌ No vendor to contact');
      return;
    }
    
    if (!currentUser) {
      console.log('🔒 User not logged in, redirecting to signin');
      navigate('/signin', { state: { from: `/vendor/${vendor.vendor_id}` } });
      return;
    }
    
    console.log('🔗 Navigating to chats with vendor:', vendor.vendor_id);
    navigate(`/chats?vendor=${vendor.vendor_id}`);
  };

  const handleShareShop = async () => {
    console.log('📤 Share shop clicked');
    if (!vendor) {
      console.error('❌ No vendor to share');
      return;
    }
    
    try {
      const shareData = {
        title: `${vendor.shop_name} Shop`,
        text: `Check out ${vendor.shop_name} on GOSTOREz!`,
        url: `${window.location.origin}/vendor/${vendor.vendor_id}`,
      };
      
      if (navigator.share) {
        console.log('📱 Using Web Share API');
        await navigator.share(shareData);
        console.log('✅ Shop shared successfully');
      } else {
        console.log('📋 Using clipboard fallback');
        await navigator.clipboard.writeText(shareData.url);
        alert('📋 Shop link copied to clipboard!');
        console.log('✅ Shop link copied to clipboard');
      }
    } catch (error) {
      console.error('❌ Error sharing shop:', error);
    }
  };

  const handleAddToCart = async (product: Product) => {
    console.log('🛒 Add to cart clicked for product:', product.id);
    if (!currentUser) {
      console.log('🔒 User not logged in, redirecting to signin');
      navigate('/signin', { state: { from: `/vendor/${vendorId}` } });
      return;
    }

    try {
      const { error } = await supabase
        .from('carts')
        .insert({
          user_id: currentUser.uid,
          product_id: product.id,
          vendor_id: product.vendor_id,
          quantity: 1,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('❌ Cart insert error:', error);
        if (error.code === '23505') {
          console.log('ℹ️ Product already in cart, updating quantity');
          const { error: updateError } = await supabase
            .from('carts')
            .update({ quantity: 1 })
            .eq('user_id', currentUser.uid)
            .eq('product_id', product.id);

          if (updateError) {
            console.error('❌ Cart update error:', updateError);
            throw updateError;
          }
          console.log('✅ Cart quantity updated');
        } else {
          throw error;
        }
      } else {
        console.log('✅ Product added to cart');
      }

      setCartStatus(prev => ({
        ...prev,
        [product.id]: true
      }));

      const notification = document.createElement('div');
      notification.className = 'vendorshop-cart-notification';
      notification.innerHTML = `
        <div class="vendorshop-notification-content">
          <span>✅ Added to cart</span>
        </div>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 3000);

      console.log('✅ Cart notification shown');

    } catch (error) {
      console.error('❌ Error adding to cart:', error);
      alert('Failed to add to cart. Please try again.');
    }
  };

  const handleToggleFavorite = async (product: Product) => {
    console.log('❤️ Toggle favorite clicked for product:', product.id);
    if (!currentUser) {
      console.log('🔒 User not logged in, redirecting to signin');
      navigate('/signin', { state: { from: `/vendor/${vendorId}` } });
      return;
    }

    try {
      const isFavorite = favoritesStatus[product.id];
      console.log('❤️ Current favorite status:', isFavorite);
      
      if (isFavorite) {
        console.log('🗑️ Removing from favorites');
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', currentUser.uid)
          .eq('product_id', product.id);

        if (error) {
          console.error('❌ Favorite delete error:', error);
          throw error;
        }
        
        setFavoritesStatus(prev => ({
          ...prev,
          [product.id]: false
        }));
        
        setProducts(prev => prev.map(p => 
          p.id === product.id 
            ? { ...p, likes_count: Math.max(0, p.likes_count - 1) }
            : p
        ));
        
        console.log('✅ Removed from favorites');
      } else {
        console.log('➕ Adding to favorites');
        const { error } = await supabase
          .from('user_favorites')
          .insert({
            user_id: currentUser.uid,
            product_id: product.id,
            vendor_id: product.vendor_id,
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error('❌ Favorite insert error:', error);
          throw error;
        }
        
        setFavoritesStatus(prev => ({
          ...prev,
          [product.id]: true
        }));
        
        setProducts(prev => prev.map(p => 
          p.id === product.id 
            ? { ...p, likes_count: p.likes_count + 1 }
            : p
        ));
        
        console.log('✅ Added to favorites');
      }
    } catch (error) {
      console.error('❌ Error toggling favorite:', error);
    }
  };

  const handleChatWithVendor = async () => {
    console.log('💬 Chat with vendor clicked');
    if (!vendor) {
      console.error('❌ No vendor to chat with');
      return;
    }
    
    // Copy vendor ID to clipboard
    try {
      await navigator.clipboard.writeText(vendor.vendor_id);
      console.log('📋 Vendor ID copied to clipboard:', vendor.vendor_id);
      
      // Show notification
      alert('Shop chat ID copied to clipboard. Redirecting to chats...');
      
      // Redirect to chats page
      setTimeout(() => {
        navigate(`/chats?vendor=${vendor.vendor_id}`);
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error copying vendor ID:', error);
      alert('Failed to copy vendor ID. Please try again.');
    }
  };

  const handleBack = () => {
    console.log('🔙 Back button clicked');
    if (embedded && onClose) {
      console.log('🔗 Using embedded mode close callback');
      onClose();
    } else {
      console.log('🔗 Navigating back');
      navigate(-1);
    }
  };

  const formatPrice = (price: number, currency: string = 'NGN') => {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
    console.log('💰 Formatted price:', price, '->', formatted);
    return formatted;
  };

  const renderStars = (rating: number) => {
    console.log('⭐ Rendering stars for rating:', rating);
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(
          <Star key={i} size={10} fill="#f59e0b" stroke="#f59e0b" />
        );
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(
          <Star key={i} size={10} fill="#f59e0b" stroke="#f59e0b" />
        );
      } else {
        stars.push(
          <Star key={i} size={10} stroke="#d1d5db" />
        );
      }
    }
    
    console.log('⭐ Rendered', stars.length, 'stars');
    return stars;
  };

  const handleFollowChange = (following: boolean) => {
    console.log('👥 Follow change:', following ? 'Now following' : 'Now unfollowing');
    if (vendor) {
      setVendor(prev => prev ? {
        ...prev,
        followers_count: following ? prev.followers_count + 1 : Math.max(0, prev.followers_count - 1)
      } : null);
      console.log('👥 Vendor followers count updated');
    }
  };

  const handleRetryLoad = () => {
    console.log('🔄 Retrying load');
    loadAllVendorData();
  };

  if (loading) {
    console.log('⏳ Showing loading state');
    return (
      <div className="vendorshop-loading-container">
        <div className="vendorshop-loading-spinner-container">
          <div className="vendorshop-loading-spinner"></div>
        </div>
        <div className="vendorshop-loading-text-container">
          <p className="vendorshop-loading-text">Loading vendor shop...</p>
          <p className="vendorshop-loading-subtext">Please wait while we load the shop data</p>
        </div>
        <div className="vendorshop-loading-details">
          <p className="vendorshop-loading-detail">Vendor ID: {vendorId}</p>
          <p className="vendorshop-loading-detail">Attempt: {dataLoadAttempts}</p>
        </div>
      </div>
    );
  }

  if (error || !vendor) {
    console.log('❌ Showing error state:', error);
    return (
      <div className="vendorshop-error-container">
        <div className="vendorshop-error-icon-container">
          <div className="vendorshop-error-icon">⚠️</div>
        </div>
        <div className="vendorshop-error-text-container">
          <h3 className="vendorshop-error-title">Shop Not Found</h3>
          <p className="vendorshop-error-message">
            {error || 'This vendor shop does not exist or has been removed.'}
          </p>
          <div className="vendorshop-error-details">
            {vendorLoadError && <p className="vendorshop-error-detail">Vendor Error: {vendorLoadError}</p>}
            {productsLoadError && <p className="vendorshop-error-detail">Products Error: {productsLoadError}</p>}
            {reviewsLoadError && <p className="vendorshop-error-detail">Reviews Error: {reviewsLoadError}</p>}
          </div>
          <div className="vendorshop-error-actions">
            <button 
              className="vendorshop-error-retry-button"
              onClick={handleRetryLoad}
            >
              Retry Loading
            </button>
            <button 
              className="vendorshop-error-back-button"
              onClick={() => navigate('/market')}
            >
              Back to Marketplace
            </button>
          </div>
        </div>
      </div>
    );
  }

  console.log('✅ Rendering vendor shop for:', vendor.shop_name);
  console.log('📊 Stats:', stats);
  console.log('📦 Products count:', products.length);
  console.log('📝 Reviews count:', reviews.length);

  return (
    <div className={`vendorshop-main-container ${embedded ? 'vendorshop-main-container-embedded' : ''} ${isBlurred ? 'vendorshop-main-container-blurred' : ''}`}>
      
      {/* Cover Image Section */}
      <div className="vendorshop-cover-section-main">
        {vendor.cover_image ? (
          <div 
            className="vendorshop-cover-image-background-main"
            style={{ backgroundImage: `url(${vendor.cover_image})` }}
          />
        ) : (
          <div className="vendorshop-cover-placeholder-main">
            <ShoppingBag size={48} className="vendorshop-cover-placeholder-icon" />
            <span className="vendorshop-cover-placeholder-text">{vendor.shop_name}</span>
          </div>
        )}
        
        {/* Shop Profile Overlay on Cover Image */}
        <div className="vendorshop-shop-profile-overlay-main">
          <div className="vendorshop-shop-profile-card-main">
            <div className="vendorshop-shop-profile-logo-section-main">
              {vendor.logo_url || vendor.profile_image ? (
                <img 
                  src={vendor.logo_url || vendor.profile_image} 
                  alt={vendor.shop_name}
                  className="vendorshop-shop-profile-logo-main"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    console.log('❌ Logo image failed to load, using fallback');
                    target.onerror = null;
                    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(vendor.shop_name)}&background=9B4819&color=fff&size=50`;
                  }}
                />
              ) : (
                <div className="vendorshop-shop-profile-logo-placeholder-main">
                  {vendor.shop_name.charAt(0).toUpperCase()}
                </div>
              )}
              
              <div className="vendorshop-shop-profile-info-main">
                <h1 className="vendorshop-shop-profile-name-main">{vendor.shop_name}</h1>
                <div className="vendorshop-shop-profile-rating-main">
                  <div className="vendorshop-shop-profile-stars-main">
                    {renderStars(vendor.average_rating || vendor.rating || 0)}
                  </div>
                  <span className="vendorshop-shop-profile-rating-text-main">
                    ({vendor.rating_count || 0} reviews)
                  </span>
                </div>
                {vendor.location && (
                  <div className="vendorshop-shop-profile-location-main">
                    <MapPin size={10} className="vendorshop-shop-profile-location-icon" />
                    <span className="vendorshop-shop-profile-location-text">{vendor.location}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="vendorshop-shop-profile-actions-main">
              {/* FollowVendor Component */}
              <FollowVendor 
                vendorId={vendor.vendor_id}
                vendorName={vendor.shop_name}
                onFollowChange={handleFollowChange}
                className="vendorshop-follow-vendor-button-main-class"
              />
              
              {/* Chat with Vendor Button */}
              <button 
                className="vendorshop-chat-vendor-button-main"
                onClick={handleChatWithVendor}
                title="Chat with this vendor"
              >
                <MessageSquare size={12} className="vendorshop-chat-vendor-button-icon" />
                <span className="vendorshop-chat-vendor-button-text">Chat</span>
              </button>
              
              {/* Share Shop Button */}
              <button 
                className="vendorshop-share-shop-button-main"
                onClick={handleShareShop}
                title="Share this shop"
              >
                <Share2 size={12} className="vendorshop-share-shop-button-icon" />
              </button>
            </div>
          </div>
          
          {/* Stats Section on Cover Image */}
          <div className="vendorshop-shop-stats-overlay-main">
            <div className="vendorshop-shop-stat-item-main">
              <Users size={10} className="vendorshop-shop-stat-icon-main" />
              <div className="vendorshop-shop-stat-content-main">
                <div className="vendorshop-shop-stat-value-main">{stats?.followers_count || vendor.followers_count || 0}</div>
              </div>
            </div>
            
            <div className="vendorshop-shop-stat-item-main">
              <Star size={10} className="vendorshop-shop-stat-icon-main" />
              <div className="vendorshop-shop-stat-content-main">
                <div className="vendorshop-shop-stat-value-main">{(vendor.average_rating || 0).toFixed(1)}</div>
              </div>
            </div>
            
            <div className="vendorshop-shop-stat-item-main">
              <ThumbsUp size={10} className="vendorshop-shop-stat-icon-main" />
              <div className="vendorshop-shop-stat-content-main">
                <div className="vendorshop-shop-stat-value-main">{stats?.total_likes || vendor.total_likes || 0}</div>
              </div>
            </div>
            
            <div className="vendorshop-shop-stat-item-main">
              <Eye size={10} className="vendorshop-shop-stat-icon-main" />
              <div className="vendorshop-shop-stat-content-main">
                <div className="vendorshop-shop-stat-value-main">{stats?.total_views || vendor.total_views || 0}</div>
              </div>
            </div>
            
            <div className="vendorshop-shop-stat-item-main">
              <ShoppingBag size={10} className="vendorshop-shop-stat-icon-main" />
              <div className="vendorshop-shop-stat-content-main">
                <div className="vendorshop-shop-stat-value-main">{stats?.total_sales || vendor.total_sales || 0}</div>
              </div>
            </div>
            
            <div className="vendorshop-shop-stat-item-main">
              <DollarSign size={10} className="vendorshop-shop-stat-icon-main" />
              <div className="vendorshop-shop-stat-content-main">
                <div className="vendorshop-shop-stat-value-main">{formatPrice(stats?.total_revenue || vendor.total_revenue || 0)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="vendorshop-tabs-navigation-main">
        <button 
          className={`vendorshop-tab-button-main ${activeTab === 'products' ? 'vendorshop-tab-button-main-active' : ''}`}
          onClick={() => {
            console.log('🔍 Products tab clicked');
            setActiveTab('products');
          }}
        >
          <Grid3x3 size={10} className="vendorshop-tab-icon-main" />
          <span className="vendorshop-tab-text-main">Products</span>
          {products.length > 0 && (
            <span className="vendorshop-tab-badge-main">{products.length}</span>
          )}
        </button>
        
        <button 
          className={`vendorshop-tab-button-main ${activeTab === 'reviews' ? 'vendorshop-tab-button-main-active' : ''}`}
          onClick={() => {
            console.log('🔍 Reviews tab clicked');
            setActiveTab('reviews');
          }}
        >
          <Star size={10} className="vendorshop-tab-icon-main" />
          <span className="vendorshop-tab-text-main">Reviews</span>
          {reviews.length > 0 && (
            <span className="vendorshop-tab-badge-main">{reviews.length}</span>
          )}
        </button>
        
        <button 
          className={`vendorshop-tab-button-main ${activeTab === 'about' ? 'vendorshop-tab-button-main-active' : ''}`}
          onClick={() => {
            console.log('🔍 About tab clicked');
            setActiveTab('about');
          }}
        >
          <Home size={10} className="vendorshop-tab-icon-main" />
          <span className="vendorshop-tab-text-main">About</span>
        </button>
        
        <button 
          className={`vendorshop-tab-button-main ${activeTab === 'policies' ? 'vendorshop-tab-button-main-active' : ''}`}
          onClick={() => {
            console.log('🔍 Policies tab clicked');
            setActiveTab('policies');
          }}
        >
          <Shield size={10} className="vendorshop-tab-icon-main" />
          <span className="vendorshop-tab-text-main">Policies</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="vendorshop-content-area-main">
        {activeTab === 'products' && (
          <div className="vendorshop-products-section-main">
            {/* Products Controls Section */}
            <div className="vendorshop-products-controls-section-main">
              <div className="vendorshop-products-controls-left-section-main">
                <div className="vendorshop-view-mode-toggle-section-main">
                  <button 
                    className={`vendorshop-view-mode-button-main ${viewMode === 'grid' ? 'vendorshop-view-mode-button-main-active' : ''}`}
                    onClick={() => {
                      console.log('🔍 Grid view clicked');
                      setViewMode('grid');
                    }}
                    title="Grid View"
                  >
                    <Grid3x3 size={10} className="vendorshop-view-mode-icon-main" />
                  </button>
                  <button 
                    className={`vendorshop-view-mode-button-main ${viewMode === 'list' ? 'vendorshop-view-mode-button-main-active' : ''}`}
                    onClick={() => {
                      console.log('🔍 List view clicked');
                      setViewMode('list');
                    }}
                    title="List View"
                  >
                    <List size={10} className="vendorshop-view-mode-icon-main" />
                  </button>
                </div>
                
                <div className="vendorshop-filter-controls-section-main">
                  <button 
                    className={`vendorshop-filter-button-main ${productFilter === 'all' ? 'vendorshop-filter-button-main-active' : ''}`}
                    onClick={() => {
                      console.log('🔍 All filter clicked');
                      setProductFilter('all');
                    }}
                  >
                    All
                  </button>
                  <button 
                    className={`vendorshop-filter-button-main ${productFilter === 'available' ? 'vendorshop-filter-button-main-active' : ''}`}
                    onClick={() => {
                      console.log('🔍 Available filter clicked');
                      setProductFilter('available');
                    }}
                  >
                    In Stock
                  </button>
                  <button 
                    className={`vendorshop-filter-button-main ${productFilter === 'promoted' ? 'vendorshop-filter-button-main-active' : ''}`}
                    onClick={() => {
                      console.log('🔍 Promoted filter clicked');
                      setProductFilter('promoted');
                    }}
                  >
                    Promoted
                  </button>
                </div>
              </div>
              
              <div className="vendorshop-sort-controls-section-main">
                <div className="vendorshop-sort-dropdown-section-main">
                  <button 
                    className="vendorshop-sort-trigger-button-main"
                    onClick={() => {
                      console.log('🔍 Sort dropdown clicked');
                      setShowSortDropdown(!showSortDropdown);
                    }}
                  >
                    <Filter size={10} className="vendorshop-sort-icon-main" />
                    <span className="vendorshop-sort-text-main">
                      {sortBy === 'newest' && 'Newest'}
                      {sortBy === 'price_low' && 'Price: Low to High'}
                      {sortBy === 'price_high' && 'Price: High to Low'}
                      {sortBy === 'popular' && 'Most Popular'}
                    </span>
                    {showSortDropdown ? <ChevronUp size={10} className="vendorshop-sort-chevron-main" /> : <ChevronDown size={10} className="vendorshop-sort-chevron-main" />}
                  </button>
                  
                  {showSortDropdown && (
                    <div className="vendorshop-sort-dropdown-menu-main">
                      <button 
                        className={`vendorshop-sort-option-main ${sortBy === 'newest' ? 'vendorshop-sort-option-main-active' : ''}`}
                        onClick={() => {
                          console.log('🔍 Newest sort selected');
                          setSortBy('newest');
                          setShowSortDropdown(false);
                        }}
                      >
                        Newest
                      </button>
                      <button 
                        className={`vendorshop-sort-option-main ${sortBy === 'price_low' ? 'vendorshop-sort-option-main-active' : ''}`}
                        onClick={() => {
                          console.log('🔍 Price low to high sort selected');
                          setSortBy('price_low');
                          setShowSortDropdown(false);
                        }}
                      >
                        Price: Low to High
                      </button>
                      <button 
                        className={`vendorshop-sort-option-main ${sortBy === 'price_high' ? 'vendorshop-sort-option-main-active' : ''}`}
                        onClick={() => {
                          console.log('🔍 Price high to low sort selected');
                          setSortBy('price_high');
                          setShowSortDropdown(false);
                        }}
                      >
                        Price: High to Low
                      </button>
                      <button 
                        className={`vendorshop-sort-option-main ${sortBy === 'popular' ? 'vendorshop-sort-option-main-active' : ''}`}
                        onClick={() => {
                          console.log('🔍 Popular sort selected');
                          setSortBy('popular');
                          setShowSortDropdown(false);
                        }}
                      >
                        Most Popular
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Products Display Section */}
            {filteredProducts.length === 0 ? (
              <div className="vendorshop-empty-products-section-main">
                <ShoppingBag size={32} className="vendorshop-empty-products-icon-main" />
                <h3 className="vendorshop-empty-products-title-main">No products found</h3>
                <p className="vendorshop-empty-products-message-main">
                  {productFilter !== 'all' ? 'Try clearing the filter' : 'This shop has no products yet'}
                </p>
                {productFilter !== 'all' && (
                  <button 
                    className="vendorshop-clear-filter-button-main"
                    onClick={() => {
                      console.log('🔍 Clear filter clicked');
                      setProductFilter('all');
                    }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="vendorshop-products-grid-section-main">
                {filteredProducts.map((product) => {
                  const isInCart = cartStatus[product.id] || false;
                  const isFavorite = favoritesStatus[product.id] || false;
                  const isHighlighted = initialProductId === product.id;
                  
                  console.log('📦 Rendering product card:', product.id, 'Cart:', isInCart, 'Favorite:', isFavorite);
                  
                  return (
                    <div 
                      key={product.id} 
                      className={`vendorshop-product-card-main ${isHighlighted ? 'vendorshop-product-card-main-highlighted' : ''}`}
                      onClick={(e) => handleProductClick(product, e)}
                    >
                      <div className="vendorshop-product-image-container-main">
                        {product.images && product.images[0] ? (
                          <img 
                            src={product.images[0]} 
                            alt={product.title}
                            className="vendorshop-product-image-main"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              console.log('❌ Product image failed to load');
                              target.onerror = null;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="vendorshop-product-image-placeholder-main">
                            <PackageOpen size={20} className="vendorshop-product-image-placeholder-icon" />
                          </div>
                        )}
                        
                        {/* Favorite Button */}
                        <button 
                          className="vendorshop-product-favorite-button-main"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(product);
                          }}
                        >
                          <Heart 
                            size={14} 
                            className="vendorshop-product-favorite-icon-main"
                            fill={isFavorite ? '#ef4444' : 'none'}
                            stroke={isFavorite ? '#ef4444' : '#6b7280'}
                          />
                        </button>
                        
                        {isHighlighted && (
                          <div className="vendorshop-current-product-badge-main">
                            <Star size={8} /> Viewing
                          </div>
                        )}
                        {product.is_promoted && (
                          <div className="vendorshop-promoted-badge-main">
                            <Zap size={8} /> Promoted
                          </div>
                        )}
                        {product.inventory === 0 && (
                          <div className="vendorshop-out-of-stock-badge-main">
                            ⚠️ Out of Stock
                          </div>
                        )}
                        {product.inventory > 0 && product.inventory < 10 && (
                          <div className="vendorshop-low-stock-badge-main">
                            📦 Low Stock
                          </div>
                        )}
                      </div>
                      
                      <div className="vendorshop-product-info-main">
                        <h3 className="vendorshop-product-title-main">
                          {product.title}
                        </h3>
                        
                        <div className="vendorshop-product-price-row-main">
                          <span className="vendorshop-product-price-main">
                            {formatPrice(product.price, product.currency)}
                          </span>
                          {product.original_price && product.original_price > product.price && (
                            <span className="vendorshop-original-price-main">
                              {formatPrice(product.original_price, product.currency)}
                            </span>
                          )}
                        </div>
                        
                        <div className="vendorshop-product-stats-main">
                          <div className="vendorshop-product-stat-main">
                            <Eye size={8} className="vendorshop-product-stat-icon" />
                            <span className="vendorshop-product-stat-value">{product.views_count || 0}</span>
                          </div>
                          <div className="vendorshop-product-stat-main">
                            <Heart size={8} className="vendorshop-product-stat-icon" />
                            <span className="vendorshop-product-stat-value">{product.likes_count || 0}</span>
                          </div>
                          <div className="vendorshop-product-stat-main">
                            <Package size={8} className="vendorshop-product-stat-icon" />
                            <span className="vendorshop-product-stat-value">{product.inventory}</span>
                          </div>
                        </div>
                        
                        <div className="vendorshop-product-details-main">
                          <span className="vendorshop-condition-badge-main">
                            {product.condition ? product.condition.replace('_', ' ') : 'New'}
                          </span>
                          {product.category && (
                            <span className="vendorshop-category-badge-main">
                              {product.category}
                            </span>
                          )}
                        </div>
                        
                        {/* Product Action Buttons */}
                        <div className="vendorshop-product-actions-main">
                          <button 
                            className={`vendorshop-product-action-button-main ${isInCart ? 'vendorshop-product-action-button-main-in-cart' : 'vendorshop-product-action-button-main-add-to-cart'}`}
                            onClick={(e) => {
                              console.log('🛒 Add to cart clicked for product:', product.id);
                              e.stopPropagation();
                              handleAddToCart(product);
                            }}
                          >
                            <ShoppingCart size={10} className="vendorshop-product-action-button-icon" />
                            <span className="vendorshop-product-action-button-text">{isInCart ? 'In Cart' : 'Add to Cart'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="vendorshop-products-list-section-main">
                {filteredProducts.map((product) => {
                  const isInCart = cartStatus[product.id] || false;
                  const isFavorite = favoritesStatus[product.id] || false;
                  const isHighlighted = initialProductId === product.id;
                  
                  console.log('📋 Rendering product list item:', product.id);
                  
                  return (
                    <div 
                      key={product.id} 
                      className={`vendorshop-product-list-item-main ${isHighlighted ? 'vendorshop-product-list-item-main-highlighted' : ''}`}
                      onClick={(e) => handleProductClick(product, e)}
                    >
                      <div className="vendorshop-product-list-image-main">
                        {product.images && product.images[0] ? (
                          <img 
                            src={product.images[0]} 
                            alt={product.title}
                            className="vendorshop-product-list-img-main"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              console.log('❌ List product image failed to load');
                              target.onerror = null;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="vendorshop-product-list-img-placeholder-main">
                            <PackageOpen size={16} className="vendorshop-product-list-img-placeholder-icon" />
                          </div>
                        )}
                      </div>
                      
                      <div className="vendorshop-product-list-details-main">
                        <h3 className="vendorshop-product-list-title-main">
                          {product.title}
                        </h3>
                        
                        <div className="vendorshop-product-list-price-row-main">
                          <span className="vendorshop-product-list-price-main">
                            {formatPrice(product.price, product.currency)}
                          </span>
                          {product.original_price && product.original_price > product.price && (
                            <span className="vendorshop-product-list-original-price-main">
                              {formatPrice(product.original_price, product.currency)}
                            </span>
                          )}
                        </div>
                        
                        <div className="vendorshop-product-list-stats-main">
                          <div className="vendorshop-product-list-stat-main">
                            <Eye size={8} className="vendorshop-product-list-stat-icon" />
                            <span className="vendorshop-product-list-stat-value">{product.views_count || 0}</span>
                          </div>
                          <div className="vendorshop-product-list-stat-main">
                            <Heart size={8} className="vendorshop-product-list-stat-icon" />
                            <span className="vendorshop-product-list-stat-value">{product.likes_count || 0}</span>
                          </div>
                          <div className="vendorshop-product-list-stat-main">
                            <Package size={8} className="vendorshop-product-list-stat-icon" />
                            <span className="vendorshop-product-list-stat-value">{product.inventory}</span>
                          </div>
                        </div>
                        
                        <div className="vendorshop-product-list-description-main">
                          {product.description?.substring(0, 80)}...
                        </div>
                      </div>
                      
                      <div className="vendorshop-product-list-actions-main">
                        {/* Favorite Button */}
                        <button 
                          className="vendorshop-product-list-favorite-button-main"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(product);
                          }}
                        >
                          <Heart 
                            size={14} 
                            className="vendorshop-product-list-favorite-icon-main"
                            fill={isFavorite ? '#ef4444' : 'none'}
                            stroke={isFavorite ? '#ef4444' : '#6b7280'}
                          />
                        </button>
                        
                        <button 
                          className={`vendorshop-product-list-action-button-main ${isInCart ? 'vendorshop-product-list-action-button-main-in-cart' : 'vendorshop-product-list-action-button-main-add-to-cart'}`}
                          onClick={(e) => {
                            console.log('🛒 List add to cart clicked for product:', product.id);
                            e.stopPropagation();
                            handleAddToCart(product);
                          }}
                        >
                          <ShoppingCart size={10} className="vendorshop-product-list-action-button-icon" />
                          <span className="vendorshop-product-list-action-button-text">{isInCart ? 'In Cart' : 'Add'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="vendorshop-reviews-section-main">
            <div className="vendorshop-reviews-header-section-main">
              <h2 className="vendorshop-reviews-title-main">Customer Reviews</h2>
              <div className="vendorshop-reviews-summary-section-main">
                <div className="vendorshop-average-rating-section-main">
                  <div className="vendorshop-rating-number-main">{stats?.average_rating.toFixed(1) || '0.0'}</div>
                  <div className="vendorshop-rating-stars-main">
                    {renderStars(stats?.average_rating || 0)}
                  </div>
                  <p className="vendorshop-reviews-count-main">
                    {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="vendorshop-reviews-list-section-main">
              {reviews.length === 0 ? (
                <div className="vendorshop-no-reviews-section-main">
                  <Star size={32} className="vendorshop-no-reviews-icon-main" />
                  <h3 className="vendorshop-no-reviews-title-main">No reviews yet</h3>
                  <p className="vendorshop-no-reviews-message-main">Be the first to review this vendor!</p>
                </div>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="vendorshop-review-card-main">
                    <div className="vendorshop-review-header-section-main">
                      <div className="vendorshop-reviewer-info-section-main">
                        <div className="vendorshop-reviewer-avatar-main">
                          {review.user_name?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div className="vendorshop-reviewer-details-section-main">
                          <h4 className="vendorshop-reviewer-name-main">
                            {review.user_name || 'Customer'}
                          </h4>
                          <div className="vendorshop-review-rating-section-main">
                            {renderStars(review.rating)}
                          </div>
                        </div>
                      </div>
                      <span className="vendorshop-review-date-main">
                        {new Date(review.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    
                    <p className="vendorshop-review-comment-main">{review.comment}</p>
                    
                    <div className="vendorshop-review-actions-section-main">
                      <button className="vendorshop-helpful-button-main">
                        👍 Helpful ({review.helpful_count})
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="vendorshop-about-section-main">
            <div className="vendorshop-about-content-section-main">
              <div className="vendorshop-about-description-section-main">
                <h3 className="vendorshop-about-title-main">About {vendor.shop_name}</h3>
                <p className="vendorshop-about-text-main">{vendor.description || vendor.bio || 'No description available.'}</p>
              </div>
              
              <div className="vendorshop-shop-details-section-main">
                <h3 className="vendorshop-shop-details-title-main">Shop Details</h3>
                <div className="vendorshop-details-grid-section-main">
                  <div className="vendorshop-detail-item-section-main">
                    <Calendar size={10} className="vendorshop-detail-icon-main" />
                    <div className="vendorshop-detail-content-section-main">
                      <div className="vendorshop-detail-label-main">Member Since</div>
                      <div className="vendorshop-detail-value-main">
                        {new Date(vendor.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long'
                        })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="vendorshop-detail-item-section-main">
                    <MessageCircle size={10} className="vendorshop-detail-icon-main" />
                    <div className="vendorshop-detail-content-section-main">
                      <div className="vendorshop-detail-label-main">Response Rate</div>
                      <div className="vendorshop-detail-value-main">{stats?.response_rate}%</div>
                    </div>
                  </div>
                  
                  <div className="vendorshop-detail-item-section-main">
                    <ShoppingBag size={10} className="vendorshop-detail-icon-main" />
                    <div className="vendorshop-detail-content-section-main">
                      <div className="vendorshop-detail-label-main">Total Products</div>
                      <div className="vendorshop-detail-value-main">{stats?.total_products || vendor.total_products || 0}</div>
                    </div>
                  </div>
                  
                  <div className="vendorshop-detail-item-section-main">
                    <TrendingUp size={10} className="vendorshop-detail-icon-main" />
                    <div className="vendorshop-detail-content-section-main">
                      <div className="vendorshop-detail-label-main">Completed Sales</div>
                      <div className="vendorshop-detail-value-main">{vendor.completed_trades || vendor.sales_count || 0}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="vendorshop-contact-info-section-main">
                <h3 className="vendorshop-contact-info-title-main">Contact Information</h3>
                <div className="vendorshop-contact-details-section-main">
                  {vendor.contact_email && (
                    <div className="vendorshop-contact-detail-section-main">
                      <Mail size={10} className="vendorshop-contact-detail-icon" />
                      <span className="vendorshop-contact-detail-text">{vendor.contact_email}</span>
                    </div>
                  )}
                  
                  {vendor.business_email && !vendor.contact_email && (
                    <div className="vendorshop-contact-detail-section-main">
                      <Mail size={10} className="vendorshop-contact-detail-icon" />
                      <span className="vendorshop-contact-detail-text">{vendor.business_email}</span>
                    </div>
                  )}
                  
                  {vendor.contact_phone && (
                    <div className="vendorshop-contact-detail-section-main">
                      <Phone size={10} className="vendorshop-contact-detail-icon" />
                      <span className="vendorshop-contact-detail-text">{vendor.contact_phone}</span>
                    </div>
                  )}
                  
                  {vendor.location && (
                    <div className="vendorshop-contact-detail-section-main">
                      <MapPin size={10} className="vendorshop-contact-detail-icon" />
                      <span className="vendorshop-contact-detail-text">{vendor.location}</span>
                    </div>
                  )}
                  
                  {vendor.website && (
                    <div className="vendorshop-contact-detail-section-main">
                      <Globe size={10} className="vendorshop-contact-detail-icon" />
                      <a 
                        href={vendor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vendorshop-contact-detail-link"
                      >
                        {vendor.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {vendor.business_hours && (
                <div className="vendorshop-business-hours-section-main">
                  <h3 className="vendorshop-business-hours-title-main">
                    <Clock size={10} className="vendorshop-business-hours-icon" />
                    Business Hours
                  </h3>
                  <pre className="vendorshop-business-hours-text-main">{vendor.business_hours}</pre>
                </div>
              )}

              {vendor.instagram_handle || vendor.facebook_page || vendor.twitter_handle ? (
                <div className="vendorshop-social-section-main">
                  <h3 className="vendorshop-social-title-main">Connect With Us</h3>
                  <div className="vendorshop-social-links-section-main">
                    {vendor.instagram_handle && (
                      <a 
                        href={`https://instagram.com/${vendor.instagram_handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vendorshop-social-link-main vendorshop-instagram-link-main"
                      >
                        <Instagram size={10} className="vendorshop-social-link-icon" />
                        <span className="vendorshop-social-link-text">Instagram</span>
                      </a>
                    )}
                    
                    {vendor.facebook_page && (
                      <a 
                        href={`https://facebook.com/${vendor.facebook_page}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vendorshop-social-link-main vendorshop-facebook-link-main"
                      >
                        <Facebook size={10} className="vendorshop-social-link-icon" />
                        <span className="vendorshop-social-link-text">Facebook</span>
                      </a>
                    )}
                    
                    {vendor.twitter_handle && (
                      <a 
                        href={`https://twitter.com/${vendor.twitter_handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vendorshop-social-link-main vendorshop-twitter-link-main"
                      >
                        <Twitter size={10} className="vendorshop-social-link-icon" />
                        <span className="vendorshop-social-link-text">Twitter</span>
                      </a>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === 'policies' && (
          <div className="vendorshop-policies-section-main">
            <div className="vendorshop-policies-content-section-main">
              {vendor.return_policy ? (
                <div className="vendorshop-policy-card-main">
                  <h3 className="vendorshop-policy-title-main">
                    <Shield size={10} className="vendorshop-policy-icon" />
                    Return Policy
                  </h3>
                  <p className="vendorshop-policy-text-main">{vendor.return_policy}</p>
                </div>
              ) : (
                <div className="vendorshop-policy-card-main">
                  <h3 className="vendorshop-policy-title-main">
                    <Shield size={10} className="vendorshop-policy-icon" />
                    Return Policy
                  </h3>
                  <p className="vendorshop-no-policy-text-main">No return policy specified by this vendor.</p>
                </div>
              )}
              
              {vendor.shipping_policy ? (
                <div className="vendorshop-policy-card-main">
                  <h3 className="vendorshop-policy-title-main">
                    <Truck size={10} className="vendorshop-policy-icon" />
                    Shipping Policy
                  </h3>
                  <p className="vendorshop-policy-text-main">{vendor.shipping_policy}</p>
                </div>
              ) : (
                <div className="vendorshop-policy-card-main">
                  <h3 className="vendorshop-policy-title-main">
                    <Truck size={10} className="vendorshop-policy-icon" />
                    Shipping Policy
                  </h3>
                  <p className="vendorshop-no-policy-text-main">No shipping policy specified by this vendor.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer Section - only show in standalone mode */}
      {!embedded && (
        <footer className="vendorshop-footer-section-main">
          <div className="vendorshop-footer-content-section-main">
            <p className="vendorshop-footer-text-main">© {new Date().getFullYear()} GOSTOREz Enterprise</p>
            <p className="vendorshop-footer-subtext-main">All rights reserved</p>
          </div>
        </footer>
      )}
      
      {/* Debug Information Section */}
      <div className="vendorshop-debug-info-section-main">
        <div className="vendorshop-debug-item-main">
          <span className="vendorshop-debug-label-main">Vendor ID:</span>
          <span className="vendorshop-debug-value-main">{vendorId}</span>
        </div>
        <div className="vendorshop-debug-item-main">
          <span className="vendorshop-debug-label-main">Products:</span>
          <span className="vendorshop-debug-value-main">{products.length}</span>
        </div>
        <div className="vendorshop-debug-item-main">
          <span className="vendorshop-debug-label-main">Reviews:</span>
          <span className="vendorshop-debug-value-main">{reviews.length}</span>
        </div>
        <div className="vendorshop-debug-item-main">
          <span className="vendorshop-debug-label-main">Active Tab:</span>
          <span className="vendorshop-debug-value-main">{activeTab}</span>
        </div>
        <div className="vendorshop-debug-item-main">
          <span className="vendorshop-debug-label-main">View Mode:</span>
          <span className="vendorshop-debug-value-main">{viewMode}</span>
        </div>
      </div>
    </div>
  );
};

export default VendorShop;