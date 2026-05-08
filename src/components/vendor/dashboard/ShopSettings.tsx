import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../../lib/firebase';
import { supabase } from '../../../lib/supabaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import imageCompression from 'browser-image-compression';
import {
  ArrowLeft,
  Save,
  X,
  Edit2,
  Store,
  Package,
  MapPin,
  Star,
  Camera,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Filter,
  Eye,
  Heart,
  ShoppingCart,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Globe,
  Mail,
  Phone,
  Instagram,
  Facebook,
  Twitter,
  Users,
  Truck,
  Shield,
  FileText,
  Image as ImageIcon,
  Grid,
  List,
  Edit,
  Delete,
  Power,
  PowerOff,
  Zap,
  CreditCard,
  Wallet,
  Banknote,
  Settings as SettingsIcon,
  User,
  MessageCircle,
  Copy,
  Check,
  XCircle,
  Calendar,
  Tag,
  Box,
  PackageCheck,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Home,
  ShoppingBag,
  MessageSquare,
  Bell,
  HelpCircle,
  LogOut,
  Menu,
  Download,
  Upload as UploadIcon,
  RotateCcw,
  EyeOff,
  Eye as EyeIcon,
  Star as StarIcon,
  ThumbsUp,
  ThumbsDown,
  Flag,
  MoreHorizontal,
  Archive,
  Move,
  Award,
  Crown,
  Flame,
  Sparkles,
  Gift,
  QrCode,
  Scan,
  Wifi,
  Bluetooth,
  Smartphone,
  Tablet,
  Laptop,
  Computer,
  Watch,
  Headphones,
  Speaker,
  Mic,
  Video,
  Camera as CameraIcon,
  Printer,
  Monitor,
  Tv,
  Gamepad,
  Keyboard,
  Mouse,
  HardDrive,
  Cpu,
  Battery,
  Sun,
  Moon,
  Cloud,
  Wind,
  Droplets,
  Thermometer,
  Umbrella,
  Compass,
  Navigation,
  Map,
  Circle,
  Square,
  Triangle,
  Hexagon,
  Octagon,
  Pentagon,
  Diamond,
  Shield as ShieldIcon,
  ShieldCheck,
  ShieldAlert,
  ShieldBan
} from 'lucide-react';
import './ShopSettings.css';

// ========== INTERFACES ==========

interface VendorProfile {
  id: string;
  vendor_id: string;
  user_id: string;
  shop_name: string;
  bio: string;
  location: string;
  contact_phone: string;
  business_email: string;
  website: string;
  instagram_handle: string;
  facebook_page: string;
  twitter_handle: string;
  business_hours: string;
  return_policy: string;
  shipping_policy: string;
  profile_image: string;
  cover_image: string;
  logo_url: string;
  followers_count: number;
  likes_count: number;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
  sales_count: number;
  total_revenue: number;
  total_products: number;
  total_sales: number;
  average_rating: number;
  rating_count: number;
  pending_balance: number;
  available_balance: number;
  virtual_account: string;
  balance: number;
  total_earnings: number;
  total_withdrawals: number;
  last_withdrawal_date: string | null;
}

interface Product {
  id: string;
  vendor_id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  variations: any;
  inventory: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category: string;
  condition: string;
  tags: string[];
  views_count: number;
  likes_count: number;
  sales_count: number;
  is_promoted: boolean;
  promotion_ends_at: string | null;
  vendor_logo: string | null;
  vendor_name: string;
  user_id: string;
  cart_count: number;
  delivery_campus_ids?: number[];
}

interface DeliveryLocation {
  vendor_id: string;
  campus_id: number;
  delivery_fee: number;
  delivery_radius_m: number;
  campus_name?: string;
}

interface Follower {
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar: string;
  followed_at: string;
}

interface Campus {
  id: number;
  name: string;
}

interface Review {
  id: string;
  product_id: string;
  vendor_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  review_text: string;
  order_item_id: string;
  created_at: string;
  product_title?: string;
}

interface VendorBusiness {
  id: string;
  vendor_id: string;
  shop_name: string;
  profile_image: string;
  is_active: boolean;
}

// ========== HELPER FUNCTIONS ==========

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
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 400,
    useWebWorker: true,
  };
  return await imageCompression(file, options);
};

const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
};

// ========== MAIN COMPONENT ==========

const ShopSettings: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'business' | 'products' | 'delivery' | 'followers' | 'reviews'>('business');
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<VendorProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>([]);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [filteredFollowers, setFilteredFollowers] = useState<Follower[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | 'active' | 'inactive' | 'promoted'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high' | 'popular'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{type: 'product' | 'location' | 'follower', id: string} | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Partial<DeliveryLocation>>({});
  const [uploadingImage, setUploadingImage] = useState<'profile' | 'cover' | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vendorBusinesses, setVendorBusinesses] = useState<VendorBusiness[]>([]);
  const [showShopPopup, setShowShopPopup] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [followerSearch, setFollowerSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<Campus[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(() => {
    return localStorage.getItem('lastSelectedShopId');
  });
  const [searching, setSearching] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [selectedCampuses, setSelectedCampuses] = useState<Campus[]>([]);

  // Form state for edit mode
  const [formData, setFormData] = useState<Partial<VendorProfile>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await loadVendorBusinesses(user.uid);
        await loadLocationData();
      } else {
        navigate('/signin');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const loadVendorBusinesses = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('vendor_id, shop_name, profile_image, is_active')
        .eq('user_id', userId);

      if (error) throw error;
      
      const businesses = (data || []).map(v => ({
        id: v.vendor_id,
        vendor_id: v.vendor_id,
        shop_name: v.shop_name || 'Unnamed Shop',
        profile_image: v.profile_image || '',
        is_active: v.is_active || false
      }));
      
      setVendorBusinesses(businesses);
      
      if (businesses.length > 0) {
        let targetVendorId = selectedShopId;
        
        if (!targetVendorId || !businesses.some(b => b.vendor_id === targetVendorId)) {
          targetVendorId = businesses[0].vendor_id;
        }
        
        if (targetVendorId) {
          localStorage.setItem('lastSelectedShopId', targetVendorId);
          setSelectedShopId(targetVendorId);
          await loadVendorData(targetVendorId);
        }
      } else {
        navigate('/vendor/onboarding');
      }
    } catch (error) {
      console.error('Error loading vendor businesses:', error);
    }
  };

  const loadVendorData = async (vendorId: string) => {
    try {
      setLoading(true);
      
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();

      if (vendorError) throw vendorError;
      if (!vendorData) {
        navigate('/vendor/onboarding');
        return;
      }

      setVendorProfile(vendorData);
      setOriginalProfile(vendorData);
      setFormData(vendorData);

      await loadProducts(vendorId);
      await loadDeliveryLocations(vendorId);
      await loadFollowers(vendorId);
      await loadReviews(vendorId);

    } catch (error) {
      console.error('Error loading vendor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShopSwitch = async (vendorId: string) => {
    if (vendorId === vendorProfile?.vendor_id) {
      setShowShopPopup(false);
      return;
    }
    
    setShowShopPopup(false);
    localStorage.setItem('lastSelectedShopId', vendorId);
    setSelectedShopId(vendorId);
    await loadVendorData(vendorId);
  };

  const loadProducts = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
      filterAndSortProducts(data || [], productFilter, sortBy, productSearch);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadDeliveryLocations = async (vendorId: string) => {
    try {
      const { data: locationData, error: locationError } = await supabase
        .from('vendor_delivery_locations')
        .select('*')
        .eq('vendor_id', vendorId);

      if (locationError) throw locationError;

      if (locationData && locationData.length > 0) {
        const campusIds = locationData.map(loc => loc.campus_id);
        
        const { data: campusesData, error: campusesError } = await supabase
          .from('campuses')
          .select('id, name')
          .in('id', campusIds);

        if (campusesError) throw campusesError;

        const locationsWithNames = locationData.map(loc => {
          const campus = campusesData?.find(c => c.id === loc.campus_id);
          return {
            ...loc,
            campus_name: campus?.name || `Campus ${loc.campus_id}`
          };
        });

        setDeliveryLocations(locationsWithNames);
      } else {
        setDeliveryLocations([]);
      }
    } catch (error) {
      console.error('Error loading delivery locations:', error);
    }
  };

  const loadFollowers = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('vendor_follow')
        .select(`
          user_id,
          created_at,
          users!vendor_follow_user_id_fkey (
            name,
            email,
            avatar_url
          )
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const followersList = (data || []).map((item: any) => ({
        user_id: item.user_id,
        user_name: item.users?.name || 'Unknown User',
        user_email: item.users?.email || '',
        user_avatar: item.users?.avatar_url || '',
        followed_at: item.created_at
      }));

      setFollowers(followersList);
      setFilteredFollowers(followersList);
    } catch (error) {
      console.error('Error loading followers:', error);
      setFollowers([]);
      setFilteredFollowers([]);
    }
  };

  const loadReviews = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const productIds = data.map(r => r.product_id);
        const { data: productsData } = await supabase
          .from('products')
          .select('id, title')
          .in('id', productIds);

        const reviewsWithProducts = data.map(review => ({
          ...review,
          product_title: productsData?.find(p => p.id === review.product_id)?.title || 'Unknown Product'
        }));
        setReviews(reviewsWithProducts);
      } else {
        setReviews([]);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  };

  const loadLocationData = async () => {
    try {
      const { data: campusesData } = await supabase
        .from('campuses')
        .select('id, name')
        .order('name');
      
      setCampuses(campusesData || []);
    } catch (error) {
      console.error('Error loading location data:', error);
    }
  };

  const filterAndSortProducts = (
    productsList: Product[],
    filter: string,
    sort: string,
    search: string
  ) => {
    let filtered = [...productsList];

    if (search) {
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (filter !== 'all') {
      if (filter === 'active') {
        filtered = filtered.filter(p => p.is_active);
      } else if (filter === 'inactive') {
        filtered = filtered.filter(p => !p.is_active);
      } else if (filter === 'promoted') {
        filtered = filtered.filter(p => p.is_promoted);
      }
    }

    switch (sort) {
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

  useEffect(() => {
    filterAndSortProducts(products, productFilter, sortBy, productSearch);
  }, [products, productFilter, sortBy, productSearch]);

  useEffect(() => {
    if (followerSearch) {
      const filtered = followers.filter(f => 
        f.user_name.toLowerCase().includes(followerSearch.toLowerCase()) ||
        f.user_email.toLowerCase().includes(followerSearch.toLowerCase())
      );
      setFilteredFollowers(filtered);
    } else {
      setFilteredFollowers(followers);
    }
  }, [followerSearch, followers]);

  const handleEdit = () => {
    setEditMode(true);
    setFormData(vendorProfile || {});
    setSaveSuccess(false);
  };

  const handleCancel = () => {
    setEditMode(false);
    setFormData(originalProfile || {});
    if (vendorProfile) {
      setVendorProfile({ ...originalProfile! });
    }
  };

  const handleSaveBusinessInfo = async () => {
    if (!vendorProfile) return;

    setSaving(true);
    try {
      const updates = {
        shop_name: formData.shop_name,
        bio: formData.bio,
        location: formData.location,
        contact_phone: formData.contact_phone,
        business_email: formData.business_email,
        website: formData.website,
        instagram_handle: formData.instagram_handle,
        facebook_page: formData.facebook_page,
        twitter_handle: formData.twitter_handle,
        business_hours: formData.business_hours,
        return_policy: formData.return_policy,
        shipping_policy: formData.shipping_policy,
        profile_image: formData.profile_image,
        cover_image: formData.cover_image,
        logo_url: formData.logo_url,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('vendor_profiles')
        .update(updates)
        .eq('vendor_id', vendorProfile.vendor_id);

      if (error) throw error;

      setVendorProfile({ ...vendorProfile, ...formData } as VendorProfile);
      setOriginalProfile({ ...vendorProfile, ...formData } as VendorProfile);
      setEditMode(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving business info:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB');
      return;
    }

    setUploadingImage(type);

    try {
      const compressedFile = await compressImage(file);
      const base64Data = await fileToDataURL(compressedFile);
      
      setFormData({
        ...formData,
        [type === 'profile' ? 'profile_image' : 'cover_image']: base64Data
      });
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process image');
    } finally {
      setUploadingImage(null);
    }
  };

  const handleRemoveImage = (type: 'profile' | 'cover') => {
    setFormData({
      ...formData,
      [type === 'profile' ? 'profile_image' : 'cover_image']: ''
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedCampuses([]);
    if (product.delivery_campus_ids && product.delivery_campus_ids.length > 0) {
      const productCampuses = campuses.filter(c => product.delivery_campus_ids?.includes(c.id));
      setSelectedCampuses(productCampuses);
    }
    setLocationSearch('');
    setLocationSuggestions([]);
    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    if (!selectedProduct) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({
          title: selectedProduct.title,
          description: selectedProduct.description,
          price: selectedProduct.price,
          inventory: selectedProduct.inventory,
          category: selectedProduct.category,
          condition: selectedProduct.condition,
          tags: selectedProduct.tags,
          is_active: selectedProduct.is_active,
          is_promoted: selectedProduct.is_promoted,
          delivery_campus_ids: selectedCampuses.map(c => c.id),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      if (selectedCampuses.length > 0) {
        await supabase
          .from('product_delivery_locations')
          .delete()
          .eq('product_id', selectedProduct.id);

        const deliveryLocations = selectedCampuses.map(campus => ({
          product_id: selectedProduct.id,
          campus_id: campus.id
        }));

        const { error: locationError } = await supabase
          .from('product_delivery_locations')
          .insert(deliveryLocations);

        if (locationError) throw locationError;
      }

      if (vendorProfile) {
        await loadProducts(vendorProfile.vendor_id);
      }

      setShowProductModal(false);
      setSelectedProduct(null);
      setSelectedCampuses([]);
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product changes');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      if (vendorProfile) {
        await loadProducts(vendorProfile.vendor_id);
      }

      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  };

  const handleToggleProductStatus = async (productId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (error) throw error;

      if (vendorProfile) {
        await loadProducts(vendorProfile.vendor_id);
      }
    } catch (error) {
      console.error('Error toggling product status:', error);
    }
  };

  const handleToggleProductCampus = (campus: Campus) => {
    const isSelected = selectedCampuses.some(c => c.id === campus.id);
    if (isSelected) {
      setSelectedCampuses(prev => prev.filter(c => c.id !== campus.id));
    } else {
      setSelectedCampuses(prev => [...prev, campus]);
    }
  };

  const searchLocations = (query: string) => {
    const lowercaseQuery = query.toLowerCase().trim();
    
    setSearching(true);
    
    setTimeout(() => {
      if (lowercaseQuery === '') {
        const sortedCampuses = [...campuses].sort((a, b) => a.name.localeCompare(b.name));
        setLocationSuggestions(sortedCampuses.slice(0, 15));
        setSearching(false);
        return;
      }

      const filteredCampuses = campuses.filter(campus => 
        campus.name.toLowerCase().includes(lowercaseQuery)
      );

      setLocationSuggestions(filteredCampuses.slice(0, 12));
      setSearching(false);
    }, 150);
  };

  const handleLocationSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setLocationSearch(query);
    searchLocations(query);
    setShowLocationDropdown(true);
  };

  const handleLocationSearchFocus = () => {
    if (locationSearch === '' && campuses.length > 0) {
      const sortedCampuses = [...campuses].sort((a, b) => a.name.localeCompare(b.name));
      setLocationSuggestions(sortedCampuses.slice(0, 15));
      setShowLocationDropdown(true);
    }
  };

  const handleAddLocation = () => {
    setEditingLocation({
      vendor_id: vendorProfile?.vendor_id,
      campus_id: undefined,
      delivery_fee: 0,
      delivery_radius_m: 5000
    });
    setLocationSearch('');
    setLocationSuggestions([]);
    setShowLocationModal(true);
  };

  const handleEditLocation = (location: DeliveryLocation) => {
    setEditingLocation(location);
    setLocationSearch('');
    setLocationSuggestions([]);
    setShowLocationModal(true);
  };

  const handleSaveLocation = async () => {
    if (!vendorProfile || !editingLocation.campus_id) return;

    try {
      const locationData = {
        vendor_id: vendorProfile.vendor_id,
        campus_id: editingLocation.campus_id,
        delivery_fee: editingLocation.delivery_fee || 0,
        delivery_radius_m: editingLocation.delivery_radius_m || 5000
      };

      const existingLocation = deliveryLocations.find(l => l.campus_id === editingLocation.campus_id);

      if (existingLocation) {
        const { error } = await supabase
          .from('vendor_delivery_locations')
          .update({
            delivery_fee: locationData.delivery_fee,
            delivery_radius_m: locationData.delivery_radius_m
          })
          .eq('vendor_id', vendorProfile.vendor_id)
          .eq('campus_id', editingLocation.campus_id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vendor_delivery_locations')
          .insert([locationData]);

        if (error) throw error;
      }

      await loadDeliveryLocations(vendorProfile.vendor_id);
      setShowLocationModal(false);
      setEditingLocation({});
      setLocationSearch('');
      setLocationSuggestions([]);
    } catch (error) {
      console.error('Error saving delivery location:', error);
      alert('Failed to save delivery location');
    }
  };

  const handleDeleteLocation = async (campusId: number) => {
    if (!vendorProfile) return;

    try {
      const { error } = await supabase
        .from('vendor_delivery_locations')
        .delete()
        .eq('vendor_id', vendorProfile.vendor_id)
        .eq('campus_id', campusId);

      if (error) throw error;

      await loadDeliveryLocations(vendorProfile.vendor_id);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting delivery location:', error);
      alert('Failed to delete delivery location');
    }
  };

  const handleRemoveFollower = async (userId: string) => {
    if (!vendorProfile) return;

    try {
      const { error } = await supabase
        .from('vendor_follow')
        .delete()
        .eq('vendor_id', vendorProfile.vendor_id)
        .eq('user_id', userId);

      if (error) throw error;

      await loadFollowers(vendorProfile.vendor_id);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error removing follower:', error);
      alert('Failed to remove follower');
    }
  };

  const handleMessageFollower = (userId: string) => {
    navigate(`/chats?user=${userId}`);
  };

  const renderBusinessTab = () => (
    <div className="shopsettings-business-tab">
      <div className="shopsettings-images-section">
        <div className="shopsettings-cover-image-container">
          {editMode ? (
            <>
              {formData.cover_image ? (
                <img src={formData.cover_image} alt="Cover" className="shopsettings-cover-image" />
              ) : (
                <div className="shopsettings-cover-placeholder">
                  <ImageIcon size={24} />
                  <span>Cover Image</span>
                </div>
              )}
              <div className="shopsettings-image-actions">
                <label className="shopsettings-image-upload-btn">
                  <Camera size={14} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'cover')}
                    disabled={uploadingImage === 'cover'}
                    style={{ display: 'none' }}
                  />
                </label>
                {formData.cover_image && (
                  <button
                    className="shopsettings-image-remove-btn"
                    onClick={() => handleRemoveImage('cover')}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {uploadingImage === 'cover' && (
                <div className="shopsettings-image-uploading">
                  <RefreshCw size={20} className="shopsettings-spinning" />
                </div>
              )}
            </>
          ) : (
            vendorProfile?.cover_image ? (
              <img src={vendorProfile.cover_image} alt="Cover" className="shopsettings-cover-image" />
            ) : (
              <div className="shopsettings-cover-placeholder">
                <ImageIcon size={24} />
                <span>No Cover Image</span>
              </div>
            )
          )}
        </div>

        <div className="shopsettings-profile-image-container">
          <div className="shopsettings-profile-image-wrapper">
            {editMode ? (
              <>
                {formData.profile_image ? (
                  <img src={formData.profile_image} alt="Profile" className="shopsettings-profile-image" />
                ) : (
                  <div className="shopsettings-profile-placeholder">
                    {vendorProfile?.shop_name?.charAt(0) || 'S'}
                  </div>
                )}
                <div className="shopsettings-profile-actions">
                  <label className="shopsettings-profile-upload-btn">
                    <Camera size={12} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'profile')}
                      disabled={uploadingImage === 'profile'}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {formData.profile_image && (
                    <button
                      className="shopsettings-profile-remove-btn"
                      onClick={() => handleRemoveImage('profile')}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                {uploadingImage === 'profile' && (
                  <div className="shopsettings-profile-uploading">
                    <RefreshCw size={16} className="shopsettings-spinning" />
                  </div>
                )}
              </>
            ) : (
              vendorProfile?.profile_image ? (
                <img src={vendorProfile.profile_image} alt="Profile" className="shopsettings-profile-image" />
              ) : (
                <div className="shopsettings-profile-placeholder">
                  {vendorProfile?.shop_name?.charAt(0) || 'S'}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <div className="shopsettings-form-section">
        <h3 className="shopsettings-section-title">Business Information</h3>
        
        <div className="shopsettings-form-grid">
          <div className="shopsettings-form-group">
            <label>Shop Name *</label>
            {editMode ? (
              <input
                type="text"
                name="shop_name"
                value={formData.shop_name || ''}
                onChange={handleInputChange}
                placeholder="Your shop name"
                className="shopsettings-form-input"
              />
            ) : (
              <div className="shopsettings-form-value">{vendorProfile?.shop_name}</div>
            )}
          </div>

          <div className="shopsettings-form-group full-width">
            <label>Bio</label>
            {editMode ? (
              <textarea
                name="bio"
                value={formData.bio || ''}
                onChange={handleInputChange}
                placeholder="Describe your shop"
                rows={3}
                className="shopsettings-form-textarea"
              />
            ) : (
              <div className="shopsettings-form-value">{vendorProfile?.bio || 'No bio provided'}</div>
            )}
          </div>

          <div className="shopsettings-form-group">
            <label>Location</label>
            {editMode ? (
              <input
                type="text"
                name="location"
                value={formData.location || ''}
                onChange={handleInputChange}
                placeholder="City, State"
                className="shopsettings-form-input"
              />
            ) : (
              <div className="shopsettings-form-value">{vendorProfile?.location || 'Not set'}</div>
            )}
          </div>

          <div className="shopsettings-form-group">
            <label>Contact Phone</label>
            {editMode ? (
              <input
                type="tel"
                name="contact_phone"
                value={formData.contact_phone || ''}
                onChange={handleInputChange}
                placeholder="+234 XXX XXX XXXX"
                className="shopsettings-form-input"
              />
            ) : (
              <div className="shopsettings-form-value">{vendorProfile?.contact_phone || 'Not set'}</div>
            )}
          </div>

          <div className="shopsettings-form-group">
            <label>Business Email</label>
            {editMode ? (
              <input
                type="email"
                name="business_email"
                value={formData.business_email || ''}
                onChange={handleInputChange}
                placeholder="business@example.com"
                className="shopsettings-form-input"
              />
            ) : (
              <div className="shopsettings-form-value">{vendorProfile?.business_email || 'Not set'}</div>
            )}
          </div>

          <div className="shopsettings-form-group">
            <label>Website</label>
            {editMode ? (
              <input
                type="url"
                name="website"
                value={formData.website || ''}
                onChange={handleInputChange}
                placeholder="https://example.com"
                className="shopsettings-form-input"
              />
            ) : (
              <div className="shopsettings-form-value">
                {vendorProfile?.website ? (
                  <a href={vendorProfile.website} target="_blank" rel="noopener noreferrer">
                    {vendorProfile.website}
                  </a>
                ) : 'Not set'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="shopsettings-form-section">
        <h3 className="shopsettings-section-title">Social Media</h3>
        
        <div className="shopsettings-form-grid">
          <div className="shopsettings-form-group">
            <label>Instagram</label>
            {editMode ? (
              <input
                type="text"
                name="instagram_handle"
                value={formData.instagram_handle || ''}
                onChange={handleInputChange}
                placeholder="@username"
                className="shopsettings-form-input"
              />
            ) : (
              <div className="shopsettings-form-value">{vendorProfile?.instagram_handle || 'Not set'}</div>
            )}
          </div>

          <div className="shopsettings-form-group">
            <label>Facebook</label>
            {editMode ? (
              <input
                type="text"
                name="facebook_page"
                value={formData.facebook_page || ''}
                onChange={handleInputChange}
                placeholder="facebook.com/yourpage"
                className="shopsettings-form-input"
              />
            ) : (
              <div className="shopsettings-form-value">{vendorProfile?.facebook_page || 'Not set'}</div>
            )}
          </div>

          <div className="shopsettings-form-group">
            <label>Twitter</label>
            {editMode ? (
              <input
                type="text"
                name="twitter_handle"
                value={formData.twitter_handle || ''}
                onChange={handleInputChange}
                placeholder="@handle"
                className="shopsettings-form-input"
              />
            ) : (
              <div className="shopsettings-form-value">{vendorProfile?.twitter_handle || 'Not set'}</div>
            )}
          </div>
        </div>
      </div>

      <div className="shopsettings-form-section">
        <h3 className="shopsettings-section-title">Business Policies</h3>
        
        <div className="shopsettings-form-grid">
          <div className="shopsettings-form-group full-width">
            <label>Business Hours</label>
            {editMode ? (
              <textarea
                name="business_hours"
                value={formData.business_hours || ''}
                onChange={handleInputChange}
                placeholder="e.g., Mon-Fri: 9AM-6PM, Sat: 10AM-4PM, Sun: Closed"
                rows={2}
                className="shopsettings-form-textarea"
              />
            ) : (
              <div className="shopsettings-form-value">{vendorProfile?.business_hours || 'Not set'}</div>
            )}
          </div>

          <div className="shopsettings-form-group full-width">
            <label>Return Policy</label>
            {editMode ? (
              <textarea
                name="return_policy"
                value={formData.return_policy || ''}
                onChange={handleInputChange}
                placeholder="Describe your return policy"
                rows={3}
                className="shopsettings-form-textarea"
              />
            ) : (
              <div className="shopsettings-form-value">{vendorProfile?.return_policy || 'No return policy set'}</div>
            )}
          </div>

          <div className="shopsettings-form-group full-width">
            <label>Shipping Policy</label>
            {editMode ? (
              <textarea
                name="shipping_policy"
                value={formData.shipping_policy || ''}
                onChange={handleInputChange}
                placeholder="Describe your shipping policy"
                rows={3}
                className="shopsettings-form-textarea"
              />
            ) : (
              <div className="shopsettings-form-value">{vendorProfile?.shipping_policy || 'No shipping policy set'}</div>
            )}
          </div>
        </div>
      </div>

      <div className="shopsettings-stats-summary">
        <h3 className="shopsettings-section-title">Shop Statistics</h3>
        <div className="shopsettings-stats-grid">
          <div className="shopsettings-stat-card">
            <div className="shopsettings-stat-icon" style={{ background: '#9B481910', color: '#9B4819' }}>
              <Users size={16} />
            </div>
            <div className="shopsettings-stat-content">
              <div className="shopsettings-stat-value">{vendorProfile?.followers_count || 0}</div>
              <div className="shopsettings-stat-label">Followers</div>
            </div>
          </div>
          <div className="shopsettings-stat-card">
            <div className="shopsettings-stat-icon" style={{ background: '#ef444410', color: '#ef4444' }}>
              <Heart size={16} />
            </div>
            <div className="shopsettings-stat-content">
              <div className="shopsettings-stat-value">{vendorProfile?.likes_count || 0}</div>
              <div className="shopsettings-stat-label">Likes</div>
            </div>
          </div>
          <div className="shopsettings-stat-card">
            <div className="shopsettings-stat-icon" style={{ background: '#10b98110', color: '#10b981' }}>
              <ShoppingCart size={16} />
            </div>
            <div className="shopsettings-stat-content">
              <div className="shopsettings-stat-value">{vendorProfile?.sales_count || 0}</div>
              <div className="shopsettings-stat-label">Sales</div>
            </div>
          </div>
          <div className="shopsettings-stat-card">
            <div className="shopsettings-stat-icon" style={{ background: '#3b82f610', color: '#3b82f6' }}>
              <Star size={16} />
            </div>
            <div className="shopsettings-stat-content">
              <div className="shopsettings-stat-value">{vendorProfile?.average_rating?.toFixed(1) || '0.0'}</div>
              <div className="shopsettings-stat-label">Rating</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProductsTab = () => (
    <div className="shopsettings-products-tab">
      <div className="shopsettings-products-controls">
        <div className="shopsettings-search-box">
          <Search size={14} className="shopsettings-search-icon" />
          <input
            type="text"
            placeholder="Search products..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="shopsettings-search-input"
          />
        </div>

        <div className="shopsettings-filter-controls">
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value as any)}
            className="shopsettings-filter-select"
          >
            <option value="all">All Products</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="promoted">Promoted</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="shopsettings-sort-select"
          >
            <option value="newest">Newest First</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="popular">Most Popular</option>
          </select>

          <div className="shopsettings-view-toggle">
            <button
              className={`shopsettings-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={12} />
            </button>
            <button
              className={`shopsettings-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List size={12} />
            </button>
          </div>
        </div>
      </div>

      <div className="shopsettings-products-count">
        <span>{filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}</span>
        <button
          className="shopsettings-add-product-btn"
          onClick={() => navigate('/vendor/add-product')}
        >
          <Plus size={12} />
          <span>Add Product</span>
        </button>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="shopsettings-empty-state">
          <Package size={32} />
          <h4>No Products Found</h4>
          <p>{productSearch || productFilter !== 'all' ? 'Try changing your filters' : 'Start by adding your first product'}</p>
          <button className="shopsettings-primary-btn" onClick={() => navigate('/vendor/add-product')}>
            <Plus size={12} /> Add Product
          </button>
        </div>
      ) : (
        <div className={`shopsettings-products-display ${viewMode === 'grid' ? 'shopsettings-grid-view' : 'shopsettings-list-view'}`}>
          {filteredProducts.map(product => (
            <div key={product.id} className="shopsettings-product-card">
              <div className="shopsettings-product-image-container">
                {product.images && product.images[0] ? (
                  <img src={product.images[0]} alt={product.title} className="shopsettings-product-image" />
                ) : (
                  <div className="shopsettings-product-image-placeholder">
                    <Package size={24} />
                  </div>
                )}
                <div className={`shopsettings-product-status-badge ${product.is_active ? 'active' : 'inactive'}`}>
                  {product.is_active ? 'Active' : 'Inactive'}
                </div>
                {product.is_promoted && (
                  <div className="shopsettings-product-promoted-badge">
                    <Zap size={10} /> Promoted
                  </div>
                )}
              </div>

              <div className="shopsettings-product-info">
                <div className="shopsettings-product-header">
                  <h4 className="shopsettings-product-title">{product.title}</h4>
                  <div className="shopsettings-product-price">{formatPrice(product.price)}</div>
                </div>

                <div className="shopsettings-product-stats">
                  <div className="shopsettings-product-stat">
                    <Eye size={10} />
                    <span>{product.views_count || 0}</span>
                  </div>
                  <div className="shopsettings-product-stat">
                    <Heart size={10} />
                    <span>{product.likes_count || 0}</span>
                  </div>
                  <div className="shopsettings-product-stat">
                    <ShoppingCart size={10} />
                    <span>{product.sales_count || 0}</span>
                  </div>
                </div>

                <div className="shopsettings-product-details">
                  <div className="shopsettings-product-detail">
                    <span className="shopsettings-detail-label">Stock:</span>
                    <span className="shopsettings-detail-value">{product.inventory} units</span>
                  </div>
                  <div className="shopsettings-product-detail">
                    <span className="shopsettings-detail-label">Category:</span>
                    <span className="shopsettings-detail-value">{product.category || 'Uncategorized'}</span>
                  </div>
                  <div className="shopsettings-product-detail">
                    <span className="shopsettings-detail-label">Condition:</span>
                    <span className="shopsettings-detail-value">{product.condition || 'N/A'}</span>
                  </div>
                </div>

                <div className="shopsettings-product-actions">
                  <button
                    className="shopsettings-product-action-btn edit"
                    onClick={() => handleEditProduct(product)}
                  >
                    <Edit size={10} />
                    <span>Edit</span>
                  </button>
                  <button
                    className={`shopsettings-product-action-btn ${product.is_active ? 'deactivate' : 'activate'}`}
                    onClick={() => handleToggleProductStatus(product.id, product.is_active)}
                  >
                    {product.is_active ? <PowerOff size={10} /> : <Power size={10} />}
                    <span>{product.is_active ? 'Deactivate' : 'Activate'}</span>
                  </button>
                  <button
                    className="shopsettings-product-action-btn delete"
                    onClick={() => {
                      setDeleteTarget({ type: 'product', id: product.id });
                      setShowDeleteConfirm(true);
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

  const renderDeliveryTab = () => (
    <div className="shopsettings-delivery-tab">
      <div className="shopsettings-delivery-header">
        <h3 className="shopsettings-section-title">Delivery Locations</h3>
        <button className="shopsettings-add-location-btn" onClick={handleAddLocation}>
          <Plus size={14} />
          <span>Add Location</span>
        </button>
      </div>

      {deliveryLocations.length === 0 ? (
        <div className="shopsettings-empty-state">
          <MapPin size={32} />
          <h4>No Delivery Locations</h4>
          <p>Add campus locations where you deliver</p>
          <button className="shopsettings-primary-btn" onClick={handleAddLocation}>
            <Plus size={12} /> Add Location
          </button>
        </div>
      ) : (
        <div className="shopsettings-delivery-list">
          {deliveryLocations.map(location => (
            <div key={location.campus_id} className="shopsettings-delivery-item">
              <div className="shopsettings-delivery-item-main">
                <div className="shopsettings-delivery-icon">
                  <MapPin size={16} color="#9B4819" />
                </div>
                <div className="shopsettings-delivery-info">
                  <h4 className="shopsettings-delivery-campus">
                    {location.campus_name}
                  </h4>
                  <div className="shopsettings-delivery-details">
                    <div className="shopsettings-delivery-detail">
                      <span>Delivery Fee:</span>
                      <strong>{formatPrice(location.delivery_fee)}</strong>
                    </div>
                    <div className="shopsettings-delivery-detail">
                      <span>Radius:</span>
                      <strong>{location.delivery_radius_m}m</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div className="shopsettings-delivery-actions">
                <button
                  className="shopsettings-delivery-action-btn edit"
                  onClick={() => handleEditLocation(location)}
                >
                  <Edit size={12} />
                </button>
                <button
                  className="shopsettings-delivery-action-btn delete"
                  onClick={() => {
                    setDeleteTarget({ type: 'location', id: location.campus_id.toString() });
                    setShowDeleteConfirm(true);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderFollowersTab = () => (
    <div className="shopsettings-followers-tab">
      <div className="shopsettings-followers-header">
        <h3 className="shopsettings-section-title">Shop Followers</h3>
        <div className="shopsettings-followers-count">
          <Users size={14} />
          <span>{followers.length} {followers.length === 1 ? 'Follower' : 'Followers'}</span>
        </div>
      </div>

      <div className="shopsettings-followers-search">
        <Search size={14} className="shopsettings-followers-search-icon" />
        <input
          type="text"
          placeholder="Search followers by name or email..."
          value={followerSearch}
          onChange={(e) => setFollowerSearch(e.target.value)}
          className="shopsettings-followers-search-input"
        />
        {followerSearch && (
          <button
            className="shopsettings-followers-clear-search"
            onClick={() => setFollowerSearch('')}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {filteredFollowers.length === 0 ? (
        <div className="shopsettings-empty-state">
          <Users size={32} />
          <h4>No Followers Found</h4>
          <p>
            {followerSearch 
              ? 'No followers match your search' 
              : 'Your shop has no followers yet'}
          </p>
        </div>
      ) : (
        <div className="shopsettings-followers-list">
          {filteredFollowers.map(follower => (
            <div key={follower.user_id} className="shopsettings-follower-item">
              <div className="shopsettings-follower-item-main">
                <div className="shopsettings-follower-avatar">
                  {follower.user_avatar ? (
                    <img src={follower.user_avatar} alt={follower.user_name} />
                  ) : (
                    <div className="shopsettings-follower-avatar-fallback">
                      {follower.user_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="shopsettings-follower-info">
                  <h4 className="shopsettings-follower-name">{follower.user_name}</h4>
                  <div className="shopsettings-follower-email">{follower.user_email}</div>
                  <div className="shopsettings-follower-date">
                    <Clock size={10} />
                    <span>Following since {formatDate(follower.followed_at)}</span>
                  </div>
                </div>
              </div>
              <div className="shopsettings-follower-actions">
                <button
                  className="shopsettings-follower-action-btn message"
                  onClick={() => handleMessageFollower(follower.user_id)}
                  title="Send message"
                >
                  <MessageCircle size={14} />
                </button>
                <button
                  className="shopsettings-follower-action-btn remove"
                  onClick={() => {
                    setDeleteTarget({ type: 'follower', id: follower.user_id });
                    setShowDeleteConfirm(true);
                  }}
                  title="Remove follower"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderReviewsTab = () => (
    <div className="shopsettings-reviews-tab">
      <div className="shopsettings-reviews-header">
        <h3 className="shopsettings-section-title">Customer Reviews</h3>
        <div className="shopsettings-rating-summary">
          <div className="shopsettings-average-rating">
            <span className="shopsettings-rating-value">{vendorProfile?.average_rating?.toFixed(1) || '0.0'}</span>
            <div className="shopsettings-stars">
              {[1, 2, 3, 4, 5].map(star => (
                <StarIcon
                  key={star}
                  size={12}
                  fill={star <= (vendorProfile?.average_rating || 0) ? '#f59e0b' : 'none'}
                  color={star <= (vendorProfile?.average_rating || 0) ? '#f59e0b' : '#ccc'}
                />
              ))}
            </div>
          </div>
          <div className="shopsettings-rating-count">{vendorProfile?.rating_count || 0} reviews</div>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="shopsettings-empty-state">
          <MessageCircle size={32} />
          <h4>No Reviews Yet</h4>
          <p>Customer reviews will appear here</p>
        </div>
      ) : (
        <div className="shopsettings-reviews-list">
          {reviews.map(review => (
            <div key={review.id} className="shopsettings-review-item">
              <div className="shopsettings-review-header">
                <div className="shopsettings-reviewer">
                  <div className="shopsettings-reviewer-avatar">
                    {review.user_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h4 className="shopsettings-reviewer-name">{review.user_name || 'Anonymous'}</h4>
                    <span className="shopsettings-review-date">{formatDate(review.created_at)}</span>
                  </div>
                </div>
                <div className="shopsettings-review-rating">
                  {[1, 2, 3, 4, 5].map(star => (
                    <StarIcon
                      key={star}
                      size={10}
                      fill={star <= review.rating ? '#f59e0b' : 'none'}
                      color={star <= review.rating ? '#f59e0b' : '#ccc'}
                    />
                  ))}
                </div>
              </div>
              
              <div className="shopsettings-review-product">
                <Package size={10} />
                <span>{review.product_title || 'Unknown Product'}</span>
              </div>
              
              <p className="shopsettings-review-text">{review.review_text || 'No review text provided.'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading && !vendorProfile) {
    return (
      <div className="shopsettings-loading">
        <div className="shopsettings-loading-spinner">
          <RefreshCw className="shopsettings-spin" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="shopsettings-container">
      <header className="shopsettings-header">
        <div className="shopsettings-header-left">
          <button className="shopsettings-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="shopsettings-header-title">Shop Settings</h1>
        </div>

        <div className="shopsettings-header-right">
          {vendorBusinesses.length > 1 && (
            <button 
              className="shopsettings-shop-switch-btn"
              onClick={() => setShowShopPopup(true)}
            >
              <Store size={14} />
              <span>Switch Shop</span>
            </button>
          )}
          
          {!editMode ? (
            activeTab === 'business' && (
              <button className="shopsettings-edit-btn" onClick={handleEdit}>
                <Edit2 size={16} />
                <span>Edit</span>
              </button>
            )
          ) : (
            <div className="shopsettings-edit-actions">
              <button
                className="shopsettings-save-btn"
                onClick={handleSaveBusinessInfo}
                disabled={saving}
              >
                {saving ? <RefreshCw size={14} className="shopsettings-spinning" /> : <Save size={14} />}
                <span>Save</span>
              </button>
              <button
                className="shopsettings-cancel-btn"
                onClick={handleCancel}
                disabled={saving}
              >
                <X size={14} />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {saveSuccess && (
        <div className="shopsettings-success-notification">
          <CheckCircle size={16} />
          <span>Settings updated successfully!</span>
        </div>
      )}

      <nav className="shopsettings-tabs">
        <button
          className={`shopsettings-tab ${activeTab === 'business' ? 'active' : ''}`}
          onClick={() => setActiveTab('business')}
        >
          <Store size={14} />
          <span>Business Info</span>
        </button>
        <button
          className={`shopsettings-tab ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          <Package size={14} />
          <span>Products</span>
        </button>
        <button
          className={`shopsettings-tab ${activeTab === 'delivery' ? 'active' : ''}`}
          onClick={() => setActiveTab('delivery')}
        >
          <Truck size={14} />
          <span>Delivery</span>
        </button>
        <button
          className={`shopsettings-tab ${activeTab === 'followers' ? 'active' : ''}`}
          onClick={() => setActiveTab('followers')}
        >
          <Users size={14} />
          <span>Followers</span>
          {followers.length > 0 && (
            <span className="shopsettings-tab-badge">{followers.length}</span>
          )}
        </button>
        <button
          className={`shopsettings-tab ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          <Star size={14} />
          <span>Reviews</span>
        </button>
      </nav>

      <div className="shopsettings-content">
        {activeTab === 'business' && renderBusinessTab()}
        {activeTab === 'products' && renderProductsTab()}
        {activeTab === 'delivery' && renderDeliveryTab()}
        {activeTab === 'followers' && renderFollowersTab()}
        {activeTab === 'reviews' && renderReviewsTab()}
      </div>

      {showProductModal && selectedProduct && (
        <div className="shopsettings-modal-overlay">
          <div className="shopsettings-product-modal">
            <div className="shopsettings-modal-header">
              <h3>Edit Product: {selectedProduct.title}</h3>
              <button onClick={() => setShowProductModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="shopsettings-modal-body">
              <div className="shopsettings-product-form">
                <div className="shopsettings-form-group">
                  <label>Product Title</label>
                  <input
                    type="text"
                    value={selectedProduct.title}
                    onChange={(e) => setSelectedProduct({ ...selectedProduct, title: e.target.value })}
                    className="shopsettings-form-input"
                  />
                </div>

                <div className="shopsettings-form-group">
                  <label>Description</label>
                  <textarea
                    value={selectedProduct.description || ''}
                    onChange={(e) => setSelectedProduct({ ...selectedProduct, description: e.target.value })}
                    rows={3}
                    className="shopsettings-form-textarea"
                  />
                </div>

                <div className="shopsettings-form-row">
                  <div className="shopsettings-form-group">
                    <label>Price (NGN)</label>
                    <input
                      type="number"
                      value={selectedProduct.price}
                      onChange={(e) => setSelectedProduct({ ...selectedProduct, price: parseInt(e.target.value) })}
                      className="shopsettings-form-input"
                    />
                  </div>

                  <div className="shopsettings-form-group">
                    <label>Inventory</label>
                    <input
                      type="number"
                      value={selectedProduct.inventory}
                      onChange={(e) => setSelectedProduct({ ...selectedProduct, inventory: parseInt(e.target.value) })}
                      className="shopsettings-form-input"
                    />
                  </div>
                </div>

                <div className="shopsettings-form-row">
                  <div className="shopsettings-form-group">
                    <label>Category</label>
                    <input
                      type="text"
                      value={selectedProduct.category || ''}
                      onChange={(e) => setSelectedProduct({ ...selectedProduct, category: e.target.value })}
                      className="shopsettings-form-input"
                      placeholder="e.g., Electronics"
                    />
                  </div>

                  <div className="shopsettings-form-group">
                    <label>Condition</label>
                    <select
                      value={selectedProduct.condition || 'new'}
                      onChange={(e) => setSelectedProduct({ ...selectedProduct, condition: e.target.value })}
                      className="shopsettings-form-select"
                    >
                      <option value="new">New</option>
                      <option value="like-new">Like New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="used">Used</option>
                    </select>
                  </div>
                </div>

                <div className="shopsettings-form-group">
                  <label>Tags (comma separated)</label>
                  <input
                    type="text"
                    value={selectedProduct.tags?.join(', ') || ''}
                    onChange={(e) => setSelectedProduct({
                      ...selectedProduct,
                      tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                    })}
                    className="shopsettings-form-input"
                    placeholder="e.g., laptop, gaming, used"
                  />
                </div>

                <div className="shopsettings-form-group">
                  <label>Available for Delivery at these Campuses</label>
                  <div className="shopsettings-location-search-box">
                    <Search size={14} className="shopsettings-location-search-icon" />
                    <input
                      type="text"
                      placeholder="Search campuses..."
                      value={locationSearch}
                      onChange={handleLocationSearchChange}
                      onFocus={handleLocationSearchFocus}
                      className="shopsettings-location-search-input"
                    />
                  </div>

                  {showLocationDropdown && locationSuggestions.length > 0 && (
                    <div className="shopsettings-location-suggestions">
                      {searching && (
                        <div className="shopsettings-location-searching">
                          <RefreshCw size={12} className="shopsettings-spinning" />
                          <span>Searching...</span>
                        </div>
                      )}
                      {!searching && locationSuggestions.map(campus => {
                        const isSelected = selectedCampuses.some(c => c.id === campus.id);
                        return (
                          <div
                            key={campus.id}
                            className={`shopsettings-location-suggestion-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleToggleProductCampus(campus)}
                          >
                            <div className="shopsettings-location-suggestion-checkbox">
                              {isSelected && <Check size={10} />}
                            </div>
                            <div className="shopsettings-location-suggestion-details">
                              <span className="shopsettings-location-suggestion-name">
                                {campus.name}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedCampuses.length > 0 && (
                    <div className="shopsettings-selected-campuses">
                      <h4>Selected Campuses ({selectedCampuses.length})</h4>
                      <div className="shopsettings-selected-list">
                        {selectedCampuses.map(campus => (
                          <div key={campus.id} className="shopsettings-selected-item">
                            <span>{campus.name}</span>
                            <button
                              className="shopsettings-selected-remove"
                              onClick={() => handleToggleProductCampus(campus)}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="shopsettings-form-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedProduct.is_active}
                      onChange={(e) => setSelectedProduct({ ...selectedProduct, is_active: e.target.checked })}
                    />
                    <span>Product is active and visible to customers</span>
                  </label>
                </div>

                <div className="shopsettings-form-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedProduct.is_promoted || false}
                      onChange={(e) => setSelectedProduct({ ...selectedProduct, is_promoted: e.target.checked })}
                    />
                    <span>Promote this product</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="shopsettings-modal-footer">
              <button className="shopsettings-modal-btn cancel" onClick={() => setShowProductModal(false)}>
                Cancel
              </button>
              <button className="shopsettings-modal-btn save" onClick={handleSaveProduct}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showLocationModal && (
        <div className="shopsettings-modal-overlay">
          <div className="shopsettings-location-modal">
            <div className="shopsettings-modal-header">
              <h3>{editingLocation.campus_id ? 'Edit Location' : 'Add Delivery Location'}</h3>
              <button onClick={() => setShowLocationModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="shopsettings-modal-body">
              <div className="shopsettings-location-form">
                <div className="shopsettings-form-group">
                  <label>Campus</label>
                  <div className="shopsettings-location-search-box">
                    <Search size={14} className="shopsettings-location-search-icon" />
                    <input
                      type="text"
                      placeholder="Search for a campus..."
                      value={locationSearch}
                      onChange={handleLocationSearchChange}
                      onFocus={handleLocationSearchFocus}
                      className="shopsettings-location-search-input"
                    />
                  </div>

                  {showLocationDropdown && locationSuggestions.length > 0 && (
                    <div className="shopsettings-location-suggestions">
                      {searching && (
                        <div className="shopsettings-location-searching">
                          <RefreshCw size={12} className="shopsettings-spinning" />
                          <span>Searching...</span>
                        </div>
                      )}
                      {!searching && locationSuggestions.map(campus => (
                        <div
                          key={campus.id}
                          className={`shopsettings-location-suggestion-item ${editingLocation.campus_id === campus.id ? 'selected' : ''}`}
                          onClick={() => {
                            setEditingLocation({ ...editingLocation, campus_id: campus.id });
                            setLocationSearch('');
                            setLocationSuggestions([]);
                            setShowLocationDropdown(false);
                          }}
                        >
                          <div className="shopsettings-location-suggestion-details">
                            <span className="shopsettings-location-suggestion-name">{campus.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="shopsettings-form-group">
                  <label>Delivery Fee (NGN)</label>
                  <input
                    type="number"
                    value={editingLocation.delivery_fee || 0}
                    onChange={(e) => setEditingLocation({ ...editingLocation, delivery_fee: parseInt(e.target.value) })}
                    className="shopsettings-form-input"
                  />
                </div>

                <div className="shopsettings-form-group">
                  <label>Delivery Radius (meters)</label>
                  <input
                    type="number"
                    value={editingLocation.delivery_radius_m || 5000}
                    onChange={(e) => setEditingLocation({ ...editingLocation, delivery_radius_m: parseInt(e.target.value) })}
                    className="shopsettings-form-input"
                  />
                </div>
              </div>
            </div>
            <div className="shopsettings-modal-footer">
              <button className="shopsettings-modal-btn cancel" onClick={() => setShowLocationModal(false)}>
                Cancel
              </button>
              <button
                className="shopsettings-modal-btn save"
                onClick={handleSaveLocation}
                disabled={!editingLocation.campus_id}
              >
                Save Location
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && deleteTarget && (
        <div className="shopsettings-modal-overlay">
          <div className="shopsettings-confirm-modal">
            <div className="shopsettings-confirm-header">
              <AlertTriangle size={16} color="#f59e0b" />
              <h3>Confirm Delete</h3>
              <button onClick={() => setShowDeleteConfirm(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="shopsettings-confirm-body">
              <p>
                Are you sure you want to delete this {deleteTarget.type}?
                {deleteTarget.type === 'product' && ' This action cannot be undone.'}
              </p>
            </div>
            <div className="shopsettings-confirm-footer">
              <button className="shopsettings-confirm-btn cancel" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                className="shopsettings-confirm-btn delete"
                onClick={() => {
                  if (deleteTarget.type === 'product') {
                    handleDeleteProduct(deleteTarget.id);
                  } else if (deleteTarget.type === 'location') {
                    handleDeleteLocation(parseInt(deleteTarget.id));
                  } else if (deleteTarget.type === 'follower') {
                    handleRemoveFollower(deleteTarget.id);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showShopPopup && (
        <div className="shopsettings-popup-overlay" onClick={() => setShowShopPopup(false)}>
          <div className="shopsettings-shop-popup" onClick={(e) => e.stopPropagation()}>
            <div className="shopsettings-popup-header">
              <h3>Switch Shop</h3>
              <button onClick={() => setShowShopPopup(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="shopsettings-shops-list">
              {vendorBusinesses.map(shop => (
                <div
                  key={shop.vendor_id}
                  className={`shopsettings-shop-item ${shop.vendor_id === vendorProfile?.vendor_id ? 'active' : ''}`}
                  onClick={() => handleShopSwitch(shop.vendor_id)}
                >
                  <div className="shopsettings-shop-logo">
                    {shop.profile_image ? (
                      <img src={shop.profile_image} alt={shop.shop_name} />
                    ) : (
                      <div className="shopsettings-shop-logo-fallback">
                        {shop.shop_name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="shopsettings-shop-info">
                    <h4>{shop.shop_name}</h4>
                    <span className="shopsettings-shop-status">
                      {shop.is_active ? 'Active' : 'Inactive'}
                      {shop.vendor_id === vendorProfile?.vendor_id && ' • Current'}
                    </span>
                  </div>
                  <ChevronRight size={16} className="shopsettings-shop-arrow" />
                </div>
              ))}
            </div>
            <div className="shopsettings-popup-footer">
              <button
                className="shopsettings-create-shop-btn"
                onClick={() => {
                  setShowShopPopup(false);
                  navigate('/vendor-onboarding');
                }}
              >
                <Plus size={14} /> Create New Shop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopSettings;