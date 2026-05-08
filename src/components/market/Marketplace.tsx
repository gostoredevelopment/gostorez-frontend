import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import VendorShop from '../vendor-shop/VendorShop';
import ProductDisplay from './ProductDisplay';
import FavoriteButton from './FavoriteButton';
import CartButton from './CartButton';
import ProductClick from './ProductClick';
import './Marketplace.css';

// Import Lucide React icons
import {
  Search,
  Bell,
  Menu,
  Filter,
  ArrowLeft,
  ChevronRight,
  Heart,
  ShoppingCart,
  Eye,
  Package,
  Star,
  CheckCircle,
  Users,
  MessagesSquare,
  TrendingUp,
  Home,
  X,
  MapPin,
  ChevronDown,
  Grid,
  Maximize2,
  Minimize2,
  ArrowRight,
  ShoppingBag,
  AlertCircle,
  RefreshCw,
  User as UserIcon,
  Clock,
  TrendingUp as TrendingIcon
} from 'lucide-react';

// Product interface
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

interface VendorProfile {
  id: string;
  vendor_id: string;
  shop_name: string;
  profile_image: string;
  cover_image: string;
  rating: number;
  followers_count: number;
  completed_trades: number;
  is_verified: boolean;
  online_status: boolean;
  user_id: string;
  response_time?: string;
  response_rate?: number;
  delivery_campus_ids?: string[];
}

interface Campus {
  id: string;
  name: string;
  university: string;
  state: string;
  city: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  description: string;
}

interface SystemNotification {
  id: string;
  message: string;
  type: string;
  icon: string;
  bg_color: string;
  text_color: string;
  is_active: boolean;
  created_at: string;
}

interface UserNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface FilterState {
  searchQuery: string;
  selectedState: string;
  selectedUniversity: string;
  selectedCampus: string;
  selectedCategory: string;
  selectedVendor: string;
  priceRange: [number, number];
  conditionFilter: string;
  sortBy: 'newest' | 'price_low' | 'price_high' | 'popular' | 'trending';
}

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
  website?: string;
  instagramHandle?: string;
  facebookPage?: string;
  twitterHandle?: string;
}

// === ADDED FROM CHATLIST: Firebase User Profile Type ===
type FirebaseUserProfile = {
  name?: string;
  email?: string;
  phone?: string;
  profileImage?: string;
  role?: string;
  isVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
};
// === END ADDED ===

// === ADDED: User Filter Preferences Interface ===
interface UserFilterPreferences {
  lastActiveFilter: FilterState;
  locationPath: string[];
  updatedAt?: string;
}
// === END ADDED ===

// === ADDED: Search History Interface ===
interface SearchHistory {
  id: string;
  user_id: string;
  search_term: string;
  created_at: string;
  frequency?: number;
  updated_at?: string;
}
// === END ADDED ===

// Stack for tracking navigation history
interface NavigationStackItem {
  type: 'product' | 'vendor';
  id: string;
  product?: Product;
  timestamp: number;
}

// === ADDED: Search suggestion types ===
interface SearchSuggestion {
  term: string;
  type: 'recent_user' | 'frequent_user' | 'recent_all' | 'frequent_all';
  frequency?: number;
  created_at?: string;
}
// === END ADDED ===

const Marketplace: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [vendorProfiles, setVendorProfiles] = useState<{ [key: string]: VendorProfile }>({});
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // === ADDED: User filter preferences state ===
  const [userFilterPreferences, setUserFilterPreferences] = useState<UserFilterPreferences | null>(null);
  // === END ADDED ===
  
  // === ADDED: Search timeout ref for debouncing ===
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedSearchRef = useRef<string>('');
  // === END ADDED ===

  // === ADDED: Search suggestions state ===
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggestionsBarVisible, setSuggestionsBarVisible] = useState(true);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  // === END ADDED ===
  
  // Navigation stack for back/forward functionality
  const [navStack, setNavStack] = useState<NavigationStackItem[]>([]);
  const [navStackIndex, setNavStackIndex] = useState(-1);
  
  // Overlay states
  const [showMarketplaceOverlay, setShowMarketplaceOverlay] = useState(false);
  const [showVendorShop, setShowVendorShop] = useState(false);
  const [showProductDisplay, setShowProductDisplay] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [cartStatus, setCartStatus] = useState<{ [key: string]: boolean }>({});
  const [cartStylesLoading, setCartStylesLoading] = useState(true);
  
  // Maximized states
  const [vendorShopMaximized, setVendorShopMaximized] = useState(false);
  const [productDisplayMaximized, setProductDisplayMaximized] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedState: '',
    selectedUniversity: '',
    selectedCampus: '',
    selectedCategory: 'all',
    selectedVendor: '',
    priceRange: [0, 500000],
    conditionFilter: 'all',
    sortBy: 'newest'
  });

  const navigate = useNavigate();
  const marketplaceRef = useRef<HTMLDivElement>(null);
  const vendorShopRef = useRef<HTMLDivElement>(null);
  const productDisplayRef = useRef<HTMLDivElement>(null);
  
  // === ADDED: Filter save timeout ref ===
  const filterSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // === END ADDED ===

  // === ADDED FROM CHATLIST: User Sync Functions ===
  console.log("🔵 Marketplace Component Mounted");

  // Fetch user profile from Firebase Firestore - EXACT COPY FROM CHATLIST
  const fetchFirebaseUserProfile = async (firebaseUid: string): Promise<FirebaseUserProfile> => {
    try {
      console.log("🟡 [Marketplace] Fetching Firebase profile for:", firebaseUid);
      const userDoc = await getDoc(doc(db, 'users', firebaseUid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log("🟡 [Marketplace] Firebase user data found:", userData);
        
        const profile: FirebaseUserProfile = {
          name: userData.name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          profileImage: userData.profileImage || '',
          role: userData.role || 'user',
          isVerified: userData.isVerified || false,
          createdAt: userData.createdAt?.toDate().toISOString() || '',
          updatedAt: userData.updatedAt?.toDate().toISOString() || ''
        };
        
        return profile;
      } else {
        console.log("🟡 [Marketplace] No Firebase user document found");
        // Create basic profile from auth data
        const firebaseUser = auth.currentUser;
        const profile: FirebaseUserProfile = {
          name: firebaseUser?.displayName || '',
          email: firebaseUser?.email || '',
          phone: firebaseUser?.phoneNumber || '',
          profileImage: firebaseUser?.photoURL || '',
          role: 'user',
          isVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        return profile;
      }
    } catch (error) {
      console.error('❌ [Marketplace] Error fetching Firebase user profile:', error);
      const firebaseUser = auth.currentUser;
      const profile: FirebaseUserProfile = {
        name: firebaseUser?.displayName || '',
        email: firebaseUser?.email || '',
        phone: firebaseUser?.phoneNumber || '',
        profileImage: firebaseUser?.photoURL || '',
        role: 'user',
        isVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      return profile;
    }
  };

  // Sync user data from Firebase to Supabase - EXACT COPY FROM CHATLIST
  const syncUserToSupabase = async (firebaseUid: string, firebaseProfile: FirebaseUserProfile) => {
    try {
      console.log("🟡 [Marketplace] Syncing user to Supabase:", firebaseUid);
      
      // Check if user already exists in Supabase
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id, firebase_uid, rooms, room_count')
        .eq('firebase_uid', firebaseUid)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('[Marketplace] Error checking user in Supabase:', checkError);
      }

      const userData = {
        firebase_uid: firebaseUid,
        name: firebaseProfile.name || '',
        email: firebaseProfile.email || '',
        phone: firebaseProfile.phone || '',
        avatar_url: firebaseProfile.profileImage || '',
        user_type: 'user',
        rooms: existingUser?.rooms || [],
        room_count: existingUser?.room_count || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        is_active: true
      };

      if (!existingUser) {
        console.log("🟡 [Marketplace] Inserting new user to Supabase");
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([userData])
          .select()
          .single();

        if (insertError) {
          console.error('❌ [Marketplace] Error inserting user to Supabase:', insertError);
        } else {
          console.log('✅ [Marketplace] User synced to Supabase:', newUser.id);
        }
      } else {
        console.log("🟡 [Marketplace] Updating existing user in Supabase");
        // Update user, including avatar_url
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            avatar_url: userData.avatar_url,
            rooms: userData.rooms,
            room_count: userData.room_count,
            last_seen: userData.last_seen,
            updated_at: userData.updated_at
          })
          .eq('id', existingUser.id);

        if (updateError) {
          console.error('❌ [Marketplace] Error updating user in Supabase:', updateError);
        } else {
          console.log('✅ [Marketplace] User updated in Supabase');
        }
      }
    } catch (error) {
      console.error('❌ [Marketplace] Error in syncUserToSupabase:', error);
    }
  };

  // Function to perform user sync - EXACT LOGIC FROM CHATLIST
  const performUserSync = async () => {
    const user = auth.currentUser;
    if (!user) {
      console.log("🟡 [Marketplace] No user logged in, skipping sync");
      return;
    }

    console.log("🟡 [Marketplace] Performing user sync for:", user.uid);
    
    try {
      // 1. Fetch profile from Firebase Firestore
      const firebaseProfile = await fetchFirebaseUserProfile(user.uid);
      
      // 2. Sync to Supabase (with avatar)
      await syncUserToSupabase(user.uid, firebaseProfile);
      
      console.log("✅ [Marketplace] User sync completed successfully");
    } catch (error) {
      console.error('❌ [Marketplace] Error in performUserSync:', error);
    }
  };
  // === END ADDED FROM CHATLIST ===

  // === ADDED: User Filter Preferences Functions ===
  // Save filter preferences to database
  const saveFilterPreferences = async (currentFilters: FilterState) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      // Create location path array
      const locationPath: string[] = [];
      if (currentFilters.selectedState && currentFilters.selectedState !== 'show_all') {
        locationPath.push(`state:${currentFilters.selectedState}`);
      }
      if (currentFilters.selectedUniversity) {
        locationPath.push(`university:${currentFilters.selectedUniversity}`);
      }
      if (currentFilters.selectedCampus) {
        locationPath.push(`campus:${currentFilters.selectedCampus}`);
      }
      if (currentFilters.selectedCategory !== 'all') {
        locationPath.push(`category:${currentFilters.selectedCategory}`);
      }
      if (currentFilters.selectedVendor) {
        locationPath.push(`vendor:${currentFilters.selectedVendor}`);
      }
      
      const preferences: UserFilterPreferences = {
        lastActiveFilter: currentFilters,
        locationPath,
        updatedAt: new Date().toISOString()
      };
      
      // Save to database
      const { error } = await supabase
        .from('users')
        .update({ 
          user_filter_preferences: preferences,
          updated_at: new Date().toISOString()
        })
        .eq('firebase_uid', user.uid);
      
      if (error) {
        console.error('❌ Error saving filter preferences:', error);
      } else {
        console.log('✅ Filter preferences saved:', preferences);
        setUserFilterPreferences(preferences);
      }
    } catch (error) {
      console.error('❌ Error in saveFilterPreferences:', error);
    }
  };

  // Load filter preferences from database
  const loadFilterPreferences = async (): Promise<UserFilterPreferences | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('user_filter_preferences')
        .eq('firebase_uid', user.uid)
        .maybeSingle();
      
      if (error) {
        console.error('❌ Error loading filter preferences:', error);
        return null;
      }
      
      if (data?.user_filter_preferences) {
        console.log('✅ Loaded filter preferences:', data.user_filter_preferences);
        setUserFilterPreferences(data.user_filter_preferences);
        return data.user_filter_preferences;
      }
      return null;
    } catch (error) {
      console.error('❌ Error in loadFilterPreferences:', error);
      return null;
    }
  };

  // Clear filter preferences from database
  const clearFilterPreferences = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          user_filter_preferences: null,
          updated_at: new Date().toISOString()
        })
        .eq('firebase_uid', user.uid);
      
      if (error) {
        console.error('❌ Error clearing filter preferences:', error);
      } else {
        console.log('✅ Filter preferences cleared');
        setUserFilterPreferences(null);
      }
    } catch (error) {
      console.error('❌ Error in clearFilterPreferences:', error);
    }
  };

  // Load and apply saved filter preferences
  const applySavedFilterPreferences = async () => {
    const preferences = await loadFilterPreferences();
    if (preferences?.lastActiveFilter) {
      // Apply the saved filters
      setFilters(prev => ({
        ...prev,
        ...preferences.lastActiveFilter
      }));
      console.log('✅ Restored filters from user preferences');
      return true;
    }
    return false;
  };
  // === END ADDED ===

  // === FIX 1: Updated search history function with frequency increment ===
  const saveSearch = async (searchTerm: string) => {
    const user = auth.currentUser;
    if (!user || !searchTerm.trim() || searchTerm.trim().length < 2) return;
    
    const trimmedTerm = searchTerm.trim();
    
    // Don't save if it's the same as the last saved search
    if (lastSavedSearchRef.current === trimmedTerm) return;
    
    try {
      console.log(`🔍 Attempting to save search: "${trimmedTerm}" for user: ${user.uid}`);
      
      // Check if this search term already exists for this user
      const { data: existingSearches, error: searchError } = await supabase
        .from('search_history')
        .select('id, search_term, frequency, created_at')
        .eq('user_id', user.uid)
        .eq('search_term', trimmedTerm)
        .maybeSingle();

      if (searchError && searchError.code !== 'PGRST116') {
        console.error('❌ Error checking existing search:', searchError);
        return;
      }

      const now = new Date().toISOString();

      if (existingSearches) {
        // FIX 1: Update frequency and timestamp instead of creating new record
        const currentFrequency = existingSearches.frequency || 1;
        console.log(`🟡 Found existing search, increasing frequency from ${currentFrequency} to ${currentFrequency + 1}`);
        
        const { error: updateError } = await supabase
          .from('search_history')
          .update({ 
            created_at: now,
            frequency: currentFrequency + 1,
            updated_at: now
          })
          .eq('id', existingSearches.id);

        if (updateError) {
          console.error('❌ Error updating search frequency:', updateError);
        } else {
          console.log(`✅ Search frequency updated for: "${trimmedTerm}" (now: ${currentFrequency + 1})`);
          lastSavedSearchRef.current = trimmedTerm;
          
          // Reload suggestions after update
          loadSearchSuggestions();
        }
      } else {
        // Insert new search term with frequency 1
        console.log(`🟡 No existing search found, creating new entry for: "${trimmedTerm}"`);
        
        const { error: insertError } = await supabase
          .from('search_history')
          .insert({
            user_id: user.uid,
            search_term: trimmedTerm,
            created_at: now,
            frequency: 1,
            updated_at: now
          });

        if (insertError) {
          console.error('❌ Error saving search:', insertError);
        } else {
          console.log(`✅ New search saved: "${trimmedTerm}" (frequency: 1)`);
          lastSavedSearchRef.current = trimmedTerm;
          
          // Reload suggestions after insert
          loadSearchSuggestions();
        }
      }
    } catch (error) {
      console.error('❌ Error in saveSearch:', error);
    }
  };

  // === FIX 2: Load search suggestions (2+3+2+3) ===
// === FIX 2: Load search suggestions (5+5+3+3) ===
const loadSearchSuggestions = async () => {
  const user = auth.currentUser;
  
  try {
    console.log("📊 Loading search suggestions...");
    
    // Get user's recent searches (last 5) - INCREASED FROM 2 TO 5
    let userRecent: { search_term: string; created_at: string }[] = [];
    if (user) {
      const { data: userRecentData } = await supabase
        .from('search_history')
        .select('search_term, created_at')
        .eq('user_id', user.uid)
        .order('created_at', { ascending: false })
        .limit(5); // CHANGED FROM 2 TO 5
      
      if (userRecentData) {
        userRecent = userRecentData;
        console.log(`📊 Found ${userRecent.length} user recent searches`);
      }
    }

    // Get user's most frequent searches (top 5) - INCREASED FROM 3 TO 5
    let userFrequent: { search_term: string; frequency: number }[] = [];
    if (user) {
      const { data: userFrequentData } = await supabase
        .from('search_history')
        .select('search_term, frequency')
        .eq('user_id', user.uid)
        .order('frequency', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5); // CHANGED FROM 3 TO 5
      
      if (userFrequentData) {
        userFrequent = userFrequentData;
        console.log(`📊 Found ${userFrequent.length} user frequent searches`);
      }
    }

    // Get recent searches from all users (last 3) - INCREASED FROM 2 TO 3
    const { data: allRecentData } = await supabase
      .from('search_history')
      .select('search_term, created_at')
      .order('created_at', { ascending: false })
      .limit(3); // CHANGED FROM 2 TO 3
    
    if (allRecentData) {
      console.log(`📊 Found ${allRecentData.length} all recent searches`);
    }

    // Get most frequent searches overall (top 3) - KEPT AT 3
    const { data: allFrequentData } = await supabase
      .from('search_history')
      .select('search_term, frequency')
      .order('frequency', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3); // KEPT AT 3
    
    if (allFrequentData) {
      console.log(`📊 Found ${allFrequentData.length} all frequent searches`);
    }

    // Combine all suggestions with deduplication
    const suggestionsMap = new Map<string, SearchSuggestion>();

    // Add user recent (5 items)
    userRecent.forEach(item => {
      suggestionsMap.set(`user_recent_${item.search_term}`, {
        term: item.search_term,
        type: 'recent_user',
        created_at: item.created_at
      });
    });

    // Add user frequent (5 items)
    userFrequent.forEach(item => {
      suggestionsMap.set(`user_frequent_${item.search_term}`, {
        term: item.search_term,
        type: 'frequent_user',
        frequency: item.frequency
      });
    });

    // Add all recent (3 items)
    allRecentData?.forEach(item => {
      if (!suggestionsMap.has(`user_recent_${item.search_term}`) && 
          !suggestionsMap.has(`user_frequent_${item.search_term}`)) {
        suggestionsMap.set(`all_recent_${item.search_term}`, {
          term: item.search_term,
          type: 'recent_all',
          created_at: item.created_at
        });
      }
    });

    // Add all frequent (3 items)
    allFrequentData?.forEach(item => {
      if (!suggestionsMap.has(`user_recent_${item.search_term}`) && 
          !suggestionsMap.has(`user_frequent_${item.search_term}`) &&
          !suggestionsMap.has(`all_recent_${item.search_term}`)) {
        suggestionsMap.set(`all_frequent_${item.search_term}`, {
          term: item.search_term,
          type: 'frequent_all',
          frequency: item.frequency
        });
      }
    });

    // Convert map to array - should have up to 5+5+3+3 = 16 items
    const suggestionsArray = Array.from(suggestionsMap.values());
    
    // Optional: Shuffle if you want random order
    // const shuffledArray = [...suggestionsArray].sort(() => Math.random() - 0.5);
    
    console.log(`✅ Loaded ${suggestionsArray.length} search suggestions:`, 
      suggestionsArray.map(s => `${s.term} (${s.type})`));
    
    setSuggestions(suggestionsArray);
  } catch (error) {
    console.error('❌ Error loading search suggestions:', error);
  }
};

  // Debounced search handler with suggestion loading
  const handleSearchChange = (value: string) => {
    // Update filter immediately for UI responsiveness
    updateFilter('searchQuery', value);
    
    // Show suggestions when typing
    setShowSuggestions(true);
    
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout to save search after user stops typing (800ms debounce)
    searchTimeoutRef.current = setTimeout(() => {
      if (value.trim().length >= 2) {
        saveSearch(value);
      }
    }, 800);
  };

  // Handle search suggestion click
  const handleSuggestionClick = (term: string) => {
    console.log(`🔍 Suggestion clicked: "${term}"`);
    updateFilter('searchQuery', term);
    setShowSuggestions(false);
    saveSearch(term); // Save immediately when clicked
  };

  // Handle click outside suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load suggestions when component mounts and when user changes
  useEffect(() => {
    if (currentUser) {
      loadSearchSuggestions();
    }
  }, [currentUser]);
  // === END ADDED ===

  const fetchUserProfile = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const profile: UserProfile = {
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
          website: userData.website || '',
          instagramHandle: userData.instagramHandle || '',
          facebookPage: userData.facebookPage || '',
          twitterHandle: userData.twitterHandle || ''
        };
        setUserProfile(profile);
      } else {
        const user = auth.currentUser;
        if (user) {
          const fallbackProfile: UserProfile = {
            id: user.uid,
            email: user.email || '',
            phone: user.phoneNumber || '',
            name: user.displayName || 'User',
            role: 'user',
            isVerified: user.emailVerified || false,
            createdAt: user.metadata.creationTime || new Date().toISOString(),
            profileImage: user.photoURL || ''
          };
          setUserProfile(fallbackProfile);
        } else {
          setUserProfile(null);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
    }
  };

  // === MODIFIED AUTH EFFECT: Added user sync and filter preferences ===
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user.uid);
        loadUserNotifications(user.uid);
        
        // === ADDED: Perform user sync to Supabase ===
        await performUserSync();
        
        // === ADDED: Load saved filter preferences ===
        await applySavedFilterPreferences();
        
        // === ADDED: Load search suggestions ===
        await loadSearchSuggestions();
        
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // === ADDED: Extra useEffect to ensure sync happens on page load ===
  useEffect(() => {
    // Run sync when component mounts
    const initSync = async () => {
      console.log("🔵 [Marketplace] Component mounted, checking for user sync...");
      if (auth.currentUser) {
        // Small delay to ensure auth is ready
        setTimeout(async () => {
          await performUserSync();
          // Load filter preferences if not already loaded
          if (!userFilterPreferences) {
            await applySavedFilterPreferences();
          }
          // Load search suggestions
          await loadSearchSuggestions();
        }, 500);
      }
    };
    
    initSync();
    
    // Cleanup timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
  // Rotate product images every 5 seconds
  const rotateProductImages = () => {
    document.querySelectorAll('.product-image-slideshow img').forEach(img => {
      const imagesAttr = img.getAttribute('data-images');
      if (!imagesAttr) return;
      
      const images = JSON.parse(imagesAttr);
      if (images.length <= 1) return;
      
      const currentSrc = img.getAttribute('src');
      const currentIndex = images.indexOf(currentSrc);
      const nextIndex = (currentIndex + 1) % images.length;
      
      img.setAttribute('src', images[nextIndex]);
    });
  };

  const interval = setInterval(rotateProductImages, 10000);
  return () => clearInterval(interval);
}, []);



  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // === ADDED: Perform user sync before loading other data ===
      await performUserSync();
      
      await Promise.all([
        loadProductsWithDelivery(),
        loadVendorProfilesWithDelivery(),
        loadCampuses(),
        loadCategories(),
        loadSystemNotifications()
      ]);
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load marketplace data try again later');
    } finally {
      setLoading(false);
    }
  };

  const loadProductsWithDelivery = async () => {
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      const { data: deliveryData, error: deliveryError } = await supabase
        .from('product_delivery_locations')
        .select('product_id, campus_id');

      if (deliveryError) throw deliveryError;

      const { data: productCategoriesData, error: productCategoriesError } = await supabase
        .from('product_categories')
        .select('product_id, category_id');

      if (productCategoriesError) throw productCategoriesError;

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, slug');

      if (categoriesError) throw categoriesError;

      const categoryMap: { [key: number]: string } = {};
      categoriesData?.forEach(category => {
        categoryMap[category.id] = category.name;
      });

      const productCategoryMap: { [key: string]: string } = {};
      productCategoriesData?.forEach(pc => {
        if (categoryMap[pc.category_id]) {
          productCategoryMap[pc.product_id] = categoryMap[pc.category_id];
        }
      });

      const deliveryMap: { [key: string]: string[] } = {};
      deliveryData?.forEach(delivery => {
        if (!deliveryMap[delivery.product_id]) {
          deliveryMap[delivery.product_id] = [];
        }
        deliveryMap[delivery.product_id].push(delivery.campus_id);
      });

      const productsWithDelivery: Product[] = (productsData || []).map(product => ({
        ...product,
        original_price: product.original_price || product.price,
        detailed_description: product.detailed_description || product.description,
        subcategory: product.subcategory || '',
        condition: (product.condition as ProductCondition) || 'new',
        updated_at: product.updated_at || product.created_at || new Date().toISOString(),
        tags: product.tags || [],
        specifications: product.specifications || {},
        category: productCategoryMap[product.id] || product.category || 'Uncategorized',
        delivery_campus_ids: deliveryMap[product.id] || []
      }));

      setProducts(productsWithDelivery);
    } catch (error) {
      console.error('Error loading products:', error);
      throw error;
    }
  };

  const loadVendorProfilesWithDelivery = async () => {
    try {
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('is_active', true);

      if (vendorError) throw vendorError;

      const { data: deliveryData, error: deliveryError } = await supabase
        .from('vendor_delivery_locations')
        .select('vendor_id, campus_id');

      if (deliveryError) throw deliveryError;

      const deliveryMap: { [key: string]: string[] } = {};
      deliveryData?.forEach(delivery => {
        if (!deliveryMap[delivery.vendor_id]) {
          deliveryMap[delivery.vendor_id] = [];
        }
        deliveryMap[delivery.vendor_id].push(delivery.campus_id);
      });

      const profilesMap: { [key: string]: VendorProfile } = {};
      vendorData?.forEach(profile => {
        profilesMap[profile.vendor_id] = {
          ...profile,
          delivery_campus_ids: deliveryMap[profile.vendor_id] || [],
          rating: profile.rating || 0,
          followers_count: profile.followers_count || 0,
          completed_trades: profile.completed_trades || 0,
          is_verified: profile.is_verified || false,
          online_status: profile.online_status || false,
          response_time: profile.response_time || '1-2 hours',
          response_rate: profile.response_rate || 95
        };
      });

      setVendorProfiles(profilesMap);
    } catch (error) {
      console.error('Error loading vendor profiles:', error);
      throw error;
    }
  };

  const loadCampuses = async () => {
    const { data, error } = await supabase
      .from('campuses')
      .select(`
        id,
        name,
        city,
        universities (name, abbreviation),
        states (name)
      `)
      .order('states(name)');

    if (error) throw error;

    const transformedCampuses: Campus[] = (data || []).map((campus: any) => ({
      id: campus.id,
      name: campus.name,
      university: campus.universities?.name || '',
      state: campus.states?.name || '',
      city: campus.city
    }));
    
    setCampuses(transformedCampuses);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) throw error;
    setCategories(data || []);
  };

  const loadSystemNotifications = async () => {
    const { data, error } = await supabase
      .from('system_notifications')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setSystemNotifications(data || []);
  };

  const loadUserNotifications = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setUserNotifications(data || []);
  };

  const states = useMemo(() => {
    return Array.from(new Set(campuses.map(campus => campus.state))).sort();
  }, [campuses]);

  const universities = useMemo(() => {
    if (!filters.selectedState || filters.selectedState === 'show_all') return [];
    return Array.from(new Set(
      campuses
        .filter(campus => campus.state === filters.selectedState)
        .map(campus => campus.university)
    )).sort();
  }, [campuses, filters.selectedState]);

  const filteredCampuses = useMemo(() => {
    if (!filters.selectedUniversity) return [];
    return campuses
      .filter(campus => campus.university === filters.selectedUniversity)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [campuses, filters.selectedUniversity]);

  const getCampusIdsForState = (stateName: string): string[] => {
    return campuses
      .filter(campus => campus.state === stateName)
      .map(campus => campus.id);
  };

  const getCampusIdsForUniversity = (universityName: string): string[] => {
    return campuses
      .filter(campus => campus.university === universityName)
      .map(campus => campus.id);
  };

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.title?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.vendor_name?.toLowerCase().includes(query) ||
        (product.tags && product.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    if (filters.selectedCampus) {
      filtered = filtered.filter(product => 
        product.delivery_campus_ids?.includes(filters.selectedCampus)
      );
    } else if (filters.selectedUniversity) {
      const campusIds = getCampusIdsForUniversity(filters.selectedUniversity);
      filtered = filtered.filter(product =>
        product.delivery_campus_ids?.some(campusId => campusIds.includes(campusId))
      );
    } else if (filters.selectedState && filters.selectedState !== 'show_all') {
      const campusIds = getCampusIdsForState(filters.selectedState);
      filtered = filtered.filter(product =>
        product.delivery_campus_ids?.some(campusId => campusIds.includes(campusId))
      );
    }

    if (filters.selectedCategory !== 'all') {
      const selectedCategoryName = categories.find(c => c.id.toString() === filters.selectedCategory)?.name;
      if (selectedCategoryName) {
        filtered = filtered.filter(product => product.category === selectedCategoryName);
      }
    }

    if (filters.selectedVendor !== '') {
      filtered = filtered.filter(product => product.vendor_id === filters.selectedVendor);
    }

    filtered = filtered.filter(product =>
      product.price >= filters.priceRange[0] && product.price <= filters.priceRange[1]
    );

    if (filters.conditionFilter !== 'all') {
      filtered = filtered.filter(product => product.condition === filters.conditionFilter);
    }

    switch (filters.sortBy) {
      case 'price_low':
        return [...filtered].sort((a, b) => a.price - b.price);
      case 'price_high':
        return [...filtered].sort((a, b) => b.price - a.price);
      case 'popular':
        return [...filtered].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
      case 'trending':
        return [...filtered].sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
      case 'newest':
      default:
        return [...filtered].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  }, [products, filters, campuses, categories]);

  const addToNavStack = (item: NavigationStackItem) => {
    setNavStack(prev => {
      // Remove any future items if we're going back and then navigating forward
      const newStack = prev.slice(0, navStackIndex + 1);
      newStack.push(item);
      setNavStackIndex(newStack.length - 1);
      return newStack;
    });
  };

  const handleProductClick = (product: Product) => {
    if (product.inventory === 0) return;
    
    // Add to navigation stack
    addToNavStack({
      type: 'product',
      id: product.id,
      product: product,
      timestamp: Date.now()
    });
    
    // Step 1: Show marketplace overlay
    setShowMarketplaceOverlay(true);
    
    // Step 2: Show vendor shop with this product's vendor
    setSelectedVendorId(product.vendor_id);
    setSelectedProduct(product);
    setShowVendorShop(true);
    
    // Step 3: Show product display after a small delay (to ensure vendor shop renders)
    setTimeout(() => {
      setShowProductDisplay(true);
    }, 100);
  };

  const handleVendorClick = (vendorId: string) => {
    // Add to navigation stack
    addToNavStack({
      type: 'vendor',
      id: vendorId,
      timestamp: Date.now()
    });
    
    // Show marketplace overlay and vendor shop
    setShowMarketplaceOverlay(true);
    setSelectedVendorId(vendorId);
    setSelectedProduct(null);
    setShowVendorShop(true);
    setShowProductDisplay(false);
  };

  const handleBack = () => {
    if (navStackIndex > 0) {
      const prevItem = navStack[navStackIndex - 1];
      setNavStackIndex(navStackIndex - 1);
      
      if (prevItem.type === 'vendor') {
        // Go back to vendor shop
        setSelectedVendorId(prevItem.id);
        setSelectedProduct(null);
        setShowVendorShop(true);
        setShowProductDisplay(false);
      } else if (prevItem.type === 'product' && prevItem.product) {
        // Go back to product display
        setSelectedVendorId(prevItem.product.vendor_id);
        setSelectedProduct(prevItem.product);
        setShowVendorShop(true);
        setShowProductDisplay(true);
      }
    }
  };

  const handleForward = () => {
    if (navStackIndex < navStack.length - 1) {
      const nextItem = navStack[navStackIndex + 1];
      setNavStackIndex(navStackIndex + 1);
      
      if (nextItem.type === 'vendor') {
        // Go forward to vendor shop
        setSelectedVendorId(nextItem.id);
        setSelectedProduct(null);
        setShowVendorShop(true);
        setShowProductDisplay(false);
      } else if (nextItem.type === 'product' && nextItem.product) {
        // Go forward to product display
        setSelectedVendorId(nextItem.product.vendor_id);
        setSelectedProduct(nextItem.product);
        setShowVendorShop(true);
        setShowProductDisplay(true);
      }
    }
  };

  // FIXED: Cancel button now works step by step
  const handleCancelStep = () => {
    if (showProductDisplay) {
      // Step 1: Close product display, stay in vendor shop
      setShowProductDisplay(false);
      setProductDisplayMaximized(false);
    } else if (showVendorShop) {
      // Step 2: Close vendor shop, return to marketplace
      setShowVendorShop(false);
      setShowMarketplaceOverlay(false);
      setVendorShopMaximized(false);
      setSelectedVendorId(null);
      setSelectedProduct(null);
      
      // Reset nav stack when fully closed
      setNavStack([]);
      setNavStackIndex(-1);
    }
  };

  // FIXED: Maximize/minimize works for both components
  const handleToggleMaximize = () => {
    if (showProductDisplay) {
      setProductDisplayMaximized(!productDisplayMaximized);
    } else if (showVendorShop) {
      setVendorShopMaximized(!vendorShopMaximized);
    }
  };

  const handleVendorShopProductClick = (product: Product) => {
    // Add to navigation stack
    addToNavStack({
      type: 'product',
      id: product.id,
      product: product,
      timestamp: Date.now()
    });
    
    // Show product display
    setSelectedProduct(product);
    setShowProductDisplay(true);
  };

  const handleBackToVendorShop = () => {
    // Go back to vendor shop from product display
    setShowProductDisplay(false);
    setProductDisplayMaximized(false);
  };

  const handleMarketplaceOverlayClick = () => {
    if (showProductDisplay) {
      // Click outside product display - go back to vendor shop
      handleBackToVendorShop();
    } else if (showVendorShop) {
      // Click outside vendor shop - close everything
      handleCancelStep();
    }

      if (showProductDisplay) {
    handleBackToVendorShop();
  } else if (showVendorShop) {
    handleCancelStep();
  }
  
  };

// Marketplace.tsx - Add this function inside your component
const getCartStylesForProducts = async (userUid: string, productIds: string[]): Promise<{ [key: string]: boolean }> => {
  try {
    if (!userUid || productIds.length === 0) return {};

    // Query the Supabase carts table for this user's cart items[citation:1]
    const { data, error } = await supabase
      .from('carts')
      .select('product_id') // We only need the product IDs
      .eq('user_id', userUid) // Match the logged-in user[citation:4]
      .in('product_id', productIds); // Check for all products on the current page

    if (error) {
      console.error('Error fetching cart:', error);
      return {};
    }

    // Create a map: productId -> true (if in cart)
    const cartStatusMap: { [key: string]: boolean } = {};
    data?.forEach(item => {
      cartStatusMap[item.product_id] = true;
    });

    return cartStatusMap;
  } catch (error) {
    console.error('Error in getCartStylesForProducts:', error);
    return {};
  }
};

const getCartIconStyle = (productId: string): React.CSSProperties => {
  try {
    const cart = JSON.parse(localStorage.getItem('shopping_cart') || '[]');
    const inCart = cart.some((item: any) => item.productId === productId);
    
    return {
      color: inCart ? '#22c55e' : '#6b7280',
    };
  } catch {
    return { color: '#6b7280' };
  }
};

  // Marketplace.tsx - Add this useEffect block
useEffect(() => {
  const fetchCartStatus = async () => {
    const user = auth.currentUser;
    if (!user || filteredProducts.length === 0) {
      setCartStatus({});
      setCartStylesLoading(false);
      return;
    }

    const productIds = filteredProducts.map(p => p.id);
    const statusMap = await getCartStylesForProducts(user.uid, productIds);
    
    setCartStatus(statusMap);
    setCartStylesLoading(false);
  };

  fetchCartStatus();
}, [currentUser, filteredProducts]); 

  // === MODIFIED: Update filter function with auto-save ===
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      
      if (key === 'selectedState') {
        if (value === '' || value === 'show_all') {
          newFilters.selectedUniversity = '';
          newFilters.selectedCampus = '';
          newFilters.selectedCategory = 'all';
          newFilters.selectedVendor = '';
        }
      } else if (key === 'selectedUniversity') {
        if (value === '') {
          newFilters.selectedCampus = '';
          newFilters.selectedCategory = 'all';
          newFilters.selectedVendor = '';
        }
      } else if (key === 'selectedCampus') {
        if (value === '') {
          newFilters.selectedCategory = 'all';
          newFilters.selectedVendor = '';
        }
      } else if (key === 'selectedCategory') {
        if (value === 'all') {
          newFilters.selectedVendor = '';
        }
      }
      
      // === ADDED: Auto-save filter preferences with debounce ===
      if (currentUser) {
        // Clear any existing timeout
        if (filterSaveTimeoutRef.current) {
          clearTimeout(filterSaveTimeoutRef.current);
        }
        
        // Set new timeout to save after 1.5 seconds of inactivity
        filterSaveTimeoutRef.current = setTimeout(() => {
          saveFilterPreferences(newFilters);
        }, 1500);
      }
      // === END ADDED ===
      
      return newFilters;
    });
  };

  // === MODIFIED: Clear location filters with preference clearing ===
  const clearLocationFilters = () => {
    setFilters(prev => {
      const newFilters = {
        ...prev,
        selectedState: '',
        selectedUniversity: '',
        selectedCampus: '',
        selectedCategory: 'all',
        selectedVendor: ''
      };
      
      // === ADDED: Clear filter preferences from database ===
      if (currentUser) {
        clearFilterPreferences();
      }
      // === END ADDED ===
      
      return newFilters;
    });
  };

  // === MODIFIED: Handle location back with auto-save ===
  const handleLocationBack = () => {
    if (filters.selectedVendor && filters.selectedCategory !== 'all') {
      updateFilter('selectedVendor', '');
    } else if (filters.selectedVendor) {
      updateFilter('selectedVendor', '');
    } else if (filters.selectedCategory !== 'all') {
      updateFilter('selectedCategory', 'all');
    } else if (filters.selectedCampus) {
      updateFilter('selectedCampus', '');
    } else if (filters.selectedUniversity) {
      updateFilter('selectedUniversity', '');
    } else if (filters.selectedState && filters.selectedState !== 'show_all') {
      updateFilter('selectedState', 'show_all');
    } else if (filters.selectedState === 'show_all') {
      updateFilter('selectedState', '');
    }
  };

  const handlePathClick = (type: 'state' | 'university' | 'campus' | 'category' | 'vendor') => {
    switch (type) {
      case 'state':
        if (filters.selectedState === 'show_all') {
          updateFilter('selectedState', '');
        } else {
          updateFilter('selectedUniversity', '');
          updateFilter('selectedCampus', '');
          updateFilter('selectedCategory', 'all');
          updateFilter('selectedVendor', '');
        }
        break;
      case 'university':
        updateFilter('selectedCampus', '');
        updateFilter('selectedCategory', 'all');
        updateFilter('selectedVendor', '');
        break;
      case 'campus':
        updateFilter('selectedCategory', 'all');
        updateFilter('selectedVendor', '');
        break;
      case 'category':
        updateFilter('selectedVendor', '');
        break;
    }
  };

  const formatPrice = (price: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const getVendorInfo = (product: Product) => {
    const vendor = vendorProfiles[product.vendor_id];
    return {
      name: vendor?.shop_name || product.vendor_name || 'Local Seller',
      logo: vendor?.profile_image,
      coverImage: vendor?.cover_image,
      rating: vendor?.rating || 0,
      followers: vendor?.followers_count || 0,
      trades: vendor?.completed_trades || 0,
      verified: vendor?.is_verified || false,
      online: vendor?.online_status || false
    };
  };

  const getActiveSystemNotification = () => {
    return systemNotifications.find(notification => notification.is_active);
  };

  const getVendorsForCurrentSelection = useMemo(() => {
    if (!filters.selectedCampus) return [];
    
    let vendorIds: string[] = [];
    
    if (filters.selectedCategory === 'all') {
      vendorIds = Array.from(new Set(
        filteredProducts.map(product => product.vendor_id)
      ));
    } else {
      const selectedCategoryName = categories.find(c => c.id.toString() === filters.selectedCategory)?.name;
      if (selectedCategoryName) {
        vendorIds = Array.from(new Set(
          filteredProducts
            .filter(product => product.category === selectedCategoryName)
            .map(product => product.vendor_id)
        ));
      }
    }
    
    return vendorIds
      .map(vendorId => vendorProfiles[vendorId])
      .filter((vendor): vendor is VendorProfile => vendor !== undefined)
      .sort((a, b) => a.shop_name.localeCompare(b.shop_name));
  }, [filteredProducts, filters.selectedCampus, filters.selectedCategory, vendorProfiles, categories]);

  // FIXED: Calculate overlay dimensions accounting for bottom nav
  const getVendorShopDimensions = (): React.CSSProperties => {
    const bottomNavHeight = 33; // Approximate height of bottom nav
    
    if (vendorShopMaximized) {
      return {
        position: 'fixed',
        width: '100%',
        height: `calc(100% - ${bottomNavHeight}px)`, // Account for bottom nav
        right: '0',
        bottom: `${bottomNavHeight}px`, // Start above bottom nav
        zIndex: 1001,
        transform: 'none',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        backgroundColor: 'white',
        borderRadius: '0',
        display: 'flex',
        flexDirection: 'column'
      };
    }
    
    return {
      position: 'fixed',
      width: '88%',
      height: `calc(88% - ${bottomNavHeight}px)`, // Account for bottom nav
      right: '0',
      bottom: `${bottomNavHeight}px`, // Start above bottom nav
      zIndex: 1001,
      transform: 'none',
      transition: 'all 0.3s ease',
      overflow: 'hidden',
      backgroundColor: 'white',
      borderRadius: '20px 0 0 0',
      display: 'flex',
      flexDirection: 'column'
    };
  };

  const getProductDisplayDimensions = (): React.CSSProperties => {
    const bottomNavHeight = 34; // Approximate height of bottom nav
    
    if (productDisplayMaximized) {
      return {
        position: 'fixed',
        width: '100%',
        height: `calc(100% - ${bottomNavHeight}px)`, // Account for bottom nav
        right: '0',
        bottom: `${bottomNavHeight}px`, // Start above bottom nav
        zIndex: 1002,
        transform: 'none',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        backgroundColor: 'white',
        borderRadius: '0',
        display: 'flex',
        flexDirection: 'column'
      };
    }
    
    return {
      position: 'fixed',
      width: '68%',
      height: `calc(78% - ${bottomNavHeight}px)`, // Account for bottom nav
      right: '0',
      bottom: `${bottomNavHeight}px`, // Start above bottom nav
      zIndex: 1002,
      transform: 'none',
      transition: 'all 0.3s ease',
      overflow: 'hidden',
      backgroundColor: 'white',
      borderRadius: '20px 0 0 0',
      display: 'flex',
      flexDirection: 'column'
    };
  };

  const activeNotification = getActiveSystemNotification();

  if (loading) {
    return (
      <div className="marketplace-loading">
        <div className="loading-spinner">
          <RefreshCw className="animate-spin" size={32} />
        </div>
        <div className="loading-text">Loading marketplace...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="marketplace-error">
        <div className="error-icon">
          <AlertCircle size={48} />
        </div>
        <h3 className="error-title">Unable to load marketplace</h3>
        <p className="error-message">{error}</p>
        <button className="retry-button" onClick={loadAllData} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="marketplace-container">
      {/* Main Marketplace Content */}
      <div 
        ref={marketplaceRef}
        className="marketplace-content"
        style={{
          position: 'relative',
          height: '100vh',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <header className="marketplace-header">
          <div className="header-content">
            <div className="user-profile-section">
              {currentUser ? (
                (userProfile?.profileImage || currentUser.photoURL) ? (
                  <img 
                    className="user-avatar"
                    src={userProfile?.profileImage || currentUser?.photoURL || ''} 
                    alt="User" 
                    onClick={() => navigate('/user/profile')}
                  />
                ) : (
                  <div 
                    className="user-initials-avatar"
                    onClick={() => navigate('/user/profile')}
                  >
                    {((name: string) => {
                      if (!name) return '?';
                      const parts = name.split(/[\s@]/);
                      return parts.slice(0, 2).map((p: string) => p[0]?.toUpperCase() || '').join('');
                    })(userProfile?.name || currentUser.displayName || currentUser.email)}
                  </div>
                )
              ) : (
                <div className="guest-avatar" onClick={() => navigate('/signin')}>
                  <UserIcon size={20} /> Login 
                </div>
              )}
            </div>

            <div className="search-section">
              <div className="search-bar">
                <Search className="search-icon" size={18} />
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search products..."
                  value={filters.searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => {
                    console.log("🔍 Search bar focused, showing suggestions");
                    setShowSuggestions(true);
                  }}
                />
                <div className="search-actions">
                  {/* FIX 3: Eye icon at RIGHT side next to filter icon */}
                  <button 
                    className="suggestion-toggle-button"
                    onClick={() => {
                      console.log(`👁️ Toggling suggestions bar: ${!suggestionsBarVisible ? 'ON' : 'OFF'}`);
                      setSuggestionsBarVisible(!suggestionsBarVisible);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '5px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: suggestionsBarVisible ? '#9B4819' : '#ccc',
                      transition: 'color 0.2s ease'
                    }}
                    title={suggestionsBarVisible ? "Hide suggestions" : "Show suggestions"}
                  >
                    <Eye size={18} />
                  </button>
                  
                  
                </div>
              </div>
            </div>

            <div className="header-actions">
              <button 
                    className="notification-button"
                    onClick={() => setShowSortMenu(!showSortMenu)}
                  >
                    <Filter size={18} />
                  </button>

              <button className="notification-button" onClick={() => window.location.href = '/notifications'} >
                <Bell size={20} />
                {userNotifications.length > 0 && (
                  <span className="notification-badge">{userNotifications.length}</span>
                )}
              </button>
            </div>
          </div>
        </header>

        {showSortMenu && (
          <div className="dropdown-overlay" onClick={() => setShowSortMenu(false)}>
            <div className="sort-dropdown" onClick={(e) => e.stopPropagation()}>
              <h4 className="dropdown-title">Sort By</h4>
              {[
                { value: 'newest', label: 'Newest First', icon: '🆕' },
                { value: 'price_low', label: 'Price: Low to High', icon: '⬇️' },
                { value: 'price_high', label: 'Price: High to Low', icon: '⬆️' },
                { value: 'popular', label: 'Most Popular', icon: '🔥' },
                { value: 'trending', label: 'Trending', icon: '📈' }
              ].map(option => (
                <button
                  key={option.value}
                  className={`sort-option ${filters.sortBy === option.value ? 'sort-option-active' : ''}`}
                  onClick={() => {
                    updateFilter('sortBy', option.value as any);
                    setShowSortMenu(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="location-filter-bar">
          <div className="location-filters">
            {!filters.selectedState && !filters.selectedUniversity && !filters.selectedCampus ? (
              <div className="location-initial-state">
                <span className="welcome-title">Campus Gostorez Marketplace</span>
                <button
                  className="start-filtering-button"
                  onClick={() => updateFilter('selectedState', 'show_all')}
                    style={{
    display: 'flex',
    alignItems: 'center',
    gap: '8px', height: '21px'
  }}
                >
                  
                 <MapPin size={16} />Filter Location
                </button>
              </div>
            ) : filters.selectedState === 'show_all' ? (
              <div className="location-filter-header">
                <button 
                  className="location-back-button"
                  onClick={() => updateFilter('selectedState', '')}
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="location-current-selection">Select State</div>
                <div className="location-options-scroll">
                  {states.map(state => (
                    <button
                      key={state}
                      className="location-option-button"
                      onClick={() => updateFilter('selectedState', state)}
                    >
                      <MapPin size={14} />
                      {state}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="location-filter-header">
                <button 
                  className="location-back-button"
                  onClick={handleLocationBack}
                >
                  <ArrowLeft size={16} />
                </button>
                
                <div className="location-path-scroll">
                  {filters.selectedState && filters.selectedState !== 'show_all' && (
                    <span 
                      className="location-path-item active"
                      onClick={() => handlePathClick('state')}
                    >
                      {filters.selectedState}
                    </span>
                  )}
                  
                  {filters.selectedUniversity && (
                    <>
                      <ChevronRight className="location-path-separator" size={12} />
                      <span 
                        className="location-path-item active"
                        onClick={() => handlePathClick('university')}
                      >
                        {filters.selectedUniversity}
                      </span>
                    </>
                  )}
                  
                  {filters.selectedCampus && (
                    <>
                      <ChevronRight className="location-path-separator" size={12} />
                      <span 
                        className="location-path-item active"
                        onClick={() => handlePathClick('campus')}
                      >
                        {campuses.find(c => c.id === filters.selectedCampus)?.name || filters.selectedCampus}
                      </span>
                    </>
                  )}
                  
                  {filters.selectedCategory !== 'all' && (
                    <>
                      <ChevronRight className="location-path-separator" size={12} />
                      <span 
                        className="location-path-item active"
                        onClick={() => handlePathClick('category')}
                      >
                        {categories.find(c => c.id.toString() === filters.selectedCategory)?.name || 'Category'}
                      </span>
                    </>
                  )}
                  
                  {filters.selectedVendor !== '' && (
                    <>
                      <ChevronRight className="location-path-separator" size={12} />
                      <span 
                        className="location-path-item active"
                        onClick={() => handlePathClick('vendor')}
                      >
                        {vendorProfiles[filters.selectedVendor]?.shop_name || 'Vendor'}
                      </span>
                    </>
                  )}
                </div>
                
                <div className="location-options-scroll">
                  {filters.selectedState && filters.selectedState !== 'show_all' && !filters.selectedUniversity && !filters.selectedCampus && (
                    universities.map(university => (
                      <button
                        key={university}
                        className="location-option-button"
                        onClick={() => updateFilter('selectedUniversity', university)}
                      >
                        <MapPin size={14} />
                        {university}
                      </button>
                    ))
                  )}
                  
                  {filters.selectedUniversity && !filters.selectedCampus && (
                    filteredCampuses.map(campus => (
                      <button
                        key={campus.id}
                        className="location-option-button"
                        onClick={() => updateFilter('selectedCampus', campus.id)}
                      >
                        <MapPin size={14} />
                        {campus.name}
                      </button>
                    ))
                  )}
                  
                  {filters.selectedCampus && filters.selectedCategory === 'all' && filters.selectedVendor === '' && (
                    <>
                      <button
                        className="location-option-button all-categories"
                        onClick={() => updateFilter('selectedCategory', 'all')}
                      >
                        <Grid size={14} />
                        All Categories
                      </button>
                      {categories.map(category => (
                        <button
                          key={category.id}
                          className="location-option-button"
                          onClick={() => updateFilter('selectedCategory', category.id.toString())}
                        >
                          {category.name}
                        </button>
                      ))}
                    </>
                  )}
                  
                  {filters.selectedCampus && filters.selectedCategory !== 'all' && filters.selectedVendor === '' && (
                    getVendorsForCurrentSelection.map(vendor => (
                      <button
                        key={vendor.id}
                        className="location-option-button"
                        onClick={() => updateFilter('selectedVendor', vendor.vendor_id)}
                      >
                        <ShoppingCart size={14} /> <span style={{ visibility: 'hidden' }}>_ </span>
                        {vendor.shop_name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/*{activeNotification && (
           <div 
            className="system-notification"
            style={{
              backgroundColor: activeNotification.bg_color,
              color: activeNotification.text_color
            }}
          >
            <span className="notification-icon">{activeNotification.icon}</span>
           <span className="notification-message">{activeNotification.message}</span>
            <button 
              className="notification-close"
              onClick={() => setSystemNotifications(prev => 
                prev.map(n => n.id === activeNotification?.id ? {...n, is_active: false} : n)
              )}
            >
              <X size={16} />
            </button>
          </div>
        )}*/}

        <main className="products-main">
          <div className="products-grid">
            {filteredProducts.map((product) => {
              const vendor = getVendorInfo(product);
              const isLowStock = product.inventory < 10;
              const isOutOfStock = product.inventory === 0;
              
              
              return (
                <div 
                  key={product.id} 
                  className={`product-card ${isOutOfStock ? 'product-card-out-of-stock' : ''}`}
                >
                  {/* Use ProductClick component */}
                  <div 
  className="product-image-container"
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (product.inventory === 0) return;
    handleProductClick(product);
  }}
  style={{ cursor: product.inventory === 0 ? 'not-allowed' : 'pointer' }}
>
                    <div className="product-click-wrapper">
                    <span className="product-image-slideshow">
  <img 
    className="product-image"
    src={product.images && product.images.length > 0 
      ? product.images[0]  // Always start with first image
      : '/placeholder-product.jpg'
    } 
    alt={product.title}
    loading="lazy"
    data-images={product.images ? JSON.stringify(product.images) : '[]'}
  />
</span>
                    
                    {/* Floating Favorite Button - positioned absolutely over image */}
                 {/* Floating Favorite Button - positioned absolutely over image */}
<div className="product-floating-buttons">
<FavoriteButton 
    productId={product.id}
    className="product-floating-favorite"
    size="sm"
    showCount={false}
    onLikeChange={(isLiked, newCount) => {
      // Update local product likes count if needed
      setProducts(prev => prev.map(p => 
        p.id === product.id 
          ? { ...p, likes_count: newCount }
          : p
      ));
    }}
  />
  
  {/* Floating Add to Cart Button */}
<div className="product-floating-cart-wrapper">
  <CartButton 
    productId={product.id}
    vendorId={product.vendor_id}
    productName={product.title}
    className="product-floating-cart"
    onCartUpdate={(isInCart) => {
      // Update local state immediately when cart changes[citation:7]
      setCartStatus(prev => ({
        ...prev,
        [product.id]: isInCart
      }));
    }}
  >
    <div 
      className="product-cart-button-inner"
      style={{
        backgroundColor: cartStatus[product.id] ? '#3fff8628' : '#ffffff0a',
        borderColor: cartStatus[product.id] ? '#22c55e' : '#e5e7eb',
        borderRadius: '50%',
        // Keep your existing styles, add these new ones conditionally
      }}
    >
      <ShoppingCart 
        size={16} 
        style={{ 
          color: cartStatus[product.id] ? '#22c55e' : '#6b7280' 
        }}
      />
    </div>
  </CartButton>
</div>
</div>

                    <div className="product-badges">
                      {isOutOfStock && (
                        <div className="badge badge-out-of-stock">
                          <X size={12} />
                          Out of Stock
                        </div>
                      )}
                      {isLowStock && !isOutOfStock && (
                        <div className="badge badge-low-stock">
                          <AlertCircle size={12} />
                          Low Stock
                        </div>
                      )}
                      {product.is_promoted && (
                        <div className="badge badge-promoted">
                          <TrendingUp size={12} />
                          Promoted
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                  

                  <div className="product-details">
                    <div className="product-info">
                      <p className="product-title">{product.title}</p>
                      <p className="product-description">
                        {product.description?.length > 80 
                          ? `${product.description.substring(0, 80)}...` 
                          : product.description}
                      </p>
                      <div className="product-price">{formatPrice(product.price, product.currency)}</div>
                    </div>

                    <div 
                      className="vendor-info" 
                      onClick={() => handleVendorClick(product.vendor_id)}
                    >
                      <div className="vendor-avatar-container">
                        {vendor.logo ? (
                          <img className="vendor-avatar" src={vendor.logo} alt={vendor.name} />
                        ) : (
                          <div className="vendor-avatar-placeholder">
                            {vendor.name.charAt(0)}
                          </div>
                        )}
                        {vendor.online && <div className="online-indicator"></div>}
                      </div>
                      <div className="vendor-details">
                        <div className="vendor-name">
                          {vendor.name}
                          {vendor.verified && <CheckCircle className="verified-badge" size={12} />}
                        </div>
                        <div className="vendor-stats">
                          <span className="vendor-stat">
                            <Star size={12} />
                            {vendor.rating.toFixed(1)}
                          </span>
                          <span className="vendor-stat">
                            <Users size={12} />
                            {vendor.followers}
                          </span>
                          <span className="vendor-stat">
                            <TrendingUp size={12} />
                            {vendor.trades}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="product-stats">
                      <div className="product-stat">
                        <Eye size={12} className="stat-icon" />
                        <span className="stat-value">{product.views_count || 0}</span>
                      </div>
                       <div className="product-stat">
    <Heart size={12} className="stat-icon" />
    <span className="stat-value">{product.likes_count || 0}</span>
  </div>
                      <div className="product-stat">
                        <ShoppingCart size={14} className="stat-icon" />
                        <span className="stat-value">{product.sales_count || 0}</span>
                      </div>
                      <div className="product-stat">
                        <Package size={14} className="stat-icon" />
                        <span className="stat-value">{product.inventory}</span>
                      </div>
                      <div className="product-stat">
                        <Star size={14} className="stat-icon" />
                        <span className="stat-value">{(Math.random() * 2 + 3).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Search size={48} />
              </div>
              <h3 className="empty-state-title">No products found in this location</h3>
              <p className="empty-state-message">Try adjusting your search or filters</p>
              <button 
                className="clear-filters-button"
                onClick={() => {
                  setFilters({
                    searchQuery: '',
                    selectedState: '',
                    selectedUniversity: '',
                    selectedCampus: '',
                    selectedCategory: 'all',
                    selectedVendor: '',
                    priceRange: [0, 500000],
                    conditionFilter: 'all',
                    sortBy: 'newest'
                  });
                  
                  // === ADDED: Clear filter preferences when clearing all filters ===
                  clearFilterPreferences();
                }}

                  style={{
    whiteSpace: 'nowrap', // Prevents text wrapping
    display: 'inline-flex', // Keeps icon and text in line
    alignItems: 'center', // Vertically centers icon and text
    gap: '4px' // Space between icon and text
  }}
              >
                <X size={16} />
                Clear All Filters
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Marketplace Overlay - Transparent dark background */}
      {showMarketplaceOverlay && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            transition: 'opacity 0.3s ease'
          }}
          onClick={handleMarketplaceOverlayClick}
        />
      )}

      {/* Vendor Shop Overlay - 99% bottom right (adjusted for bottom nav) */}
      {showVendorShop && selectedVendorId && (
        <div 
          ref={vendorShopRef}
          style={getVendorShopDimensions()}
           onClick={(e) => {
      e.stopPropagation();
      if (showProductDisplay) {
        setShowProductDisplay(false); // Close product when shop bg clicked
      }
    }}
        >
          <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <VendorShop 
              vendorId={selectedVendorId}
              embedded={true}
              onClose={handleCancelStep}
              onProductClick={handleVendorShopProductClick}
              initialProductId={selectedProduct?.id || null}
              isBlurred={showProductDisplay}
              onToggleExpand={() => setVendorShopMaximized(!vendorShopMaximized)}
            />
          </div>
        </div>
      )}

      {/* Product Display Overlay - 98% bottom right (adjusted for bottom nav) */}
      {showProductDisplay && selectedProduct && (
        <div 
          ref={productDisplayRef}
          style={getProductDisplayDimensions()}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <ProductDisplay
              product={selectedProduct}
              vendor={vendorProfiles[selectedProduct.vendor_id] || null}
              currentImageIndex={0}
              onClose={handleBackToVendorShop}
              onNavigateToVendorShop={handleBackToVendorShop}
              embedded={true}
              onToggleExpand={() => setProductDisplayMaximized(!productDisplayMaximized)}
            />
          </div>
        </div>
      )}

      {/* Floating Navigation Controls - EXTREMELY TINY buttons at top right */}
      {(showVendorShop || showProductDisplay) && (
        <div style={{
          position: 'fixed',
          top: '6px',
          right: '6px',
          zIndex: 1004,
          display: 'flex',
          gap: '3px',
          flexDirection: 'column',
          alignItems: 'flex-end'
        }}>
          {/* Navigation controls row */}
          <div style={{
            display: 'flex',
            gap: '3px',
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            padding: '3px',
            borderRadius: '15px',
            boxShadow: '0 1px 5px rgba(0,0,0,0.2)',
            border: '0.5px solid rgba(0,0,0,0.1)'
          }}>
            {/* Back Button */}
            {navStackIndex > 0 && (
              <button
                onClick={handleBack}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '14px',
                  backgroundColor: '#f5f5f5',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  minWidth: '28px',
                  fontWeight: 'bold'
                }}
                title="Go back"
              >
                <ArrowLeft size={16} />
              </button>
            )}

            {/* Forward Button */}
            {navStackIndex < navStack.length - 1 && (
              <button
                onClick={handleForward}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '14px',
                  backgroundColor: '#f5f5f5',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  minWidth: '28px',
                  fontWeight: 'bold'
                }}
                title="Go forward"
              >
                <ArrowRight size={16} />
              </button>
            )}

            {/* FIXED: Maximize/Minimize Button - works for both */}
            <button
              onClick={handleToggleMaximize}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '14px',
                backgroundColor: '#f5f5f5',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                minWidth: '28px',
                fontWeight: 'bold'
              }}
              title={showProductDisplay 
                ? (productDisplayMaximized ? 'Minimize' : 'Maximize')
                : showVendorShop 
                  ? (vendorShopMaximized ? 'Minimize' : 'Maximize')
                  : 'Maximize'}
            >
              {showProductDisplay 
                ? (productDisplayMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />)
                : showVendorShop 
                  ? (vendorShopMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />)
                  : <Maximize2 size={14} />}
            </button>

            {/* FIXED: Cancel button - works step by step */}
            <button
              onClick={handleCancelStep}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '14px',
                backgroundColor: showProductDisplay ? '#ff9500' : '#ff3b30',
                border: 'none',
                fontSize: '14px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                minWidth: '28px',
                fontWeight: 'bold'
              }}
              title={showProductDisplay 
                ? 'Close product (back to shop)' 
                : showVendorShop 
                  ? 'Close shop (back to marketplace)'
                  : 'Close all'}
            >
              {showProductDisplay ? <ArrowLeft size={16} /> : <X size={16} />}
            </button>
          </div>

          {/* Status indicator - EXTREMELY TINY */}
          <div style={{
            fontSize: '10px',
            color: 'white',
            backgroundColor: 'rgba(0, 0, 0, 0.18)',
            padding: '2px 6px',
            borderRadius: '8px',
            marginTop: '2px',
            fontWeight: 'bold'
          }}>
            {showProductDisplay 
              ? (productDisplayMaximized ? 'Product (Max)' : 'Product') 
              : showVendorShop 
                ? (vendorShopMaximized ? 'Shop (Max)' : 'Shop') 
                : ''}
          </div>
        </div>
      )}



    {/* FIX 2: Search suggestions bar - ULTRA COMPACT WITH DEBUG LOGS */}
{(() => {
  console.log("🔍 SUGGESTIONS BAR RENDER CHECK:");
  console.log("   showSuggestions:", showSuggestions);
  console.log("   suggestionsBarVisible:", suggestionsBarVisible);
  console.log("   suggestions.length:", suggestions.length);
  console.log("   suggestions data:", suggestions);
  
  if (!showSuggestions) {
    console.log("❌ Not rendering: showSuggestions is false");
    return null;
  }
  
  if (!suggestionsBarVisible) {
    console.log("❌ Not rendering: suggestionsBarVisible is false");
    return null;
  }
  
  if (suggestions.length === 0) {
    console.log("❌ Not rendering: suggestions array is empty");
    return null;
  }
  
  console.log("✅ RENDERING suggestions bar with", suggestions.length, "items");
  
  return (
    <div 
      ref={suggestionsRef}
      style={{
        position: 'fixed',
        top: '39px',
        left: 0,
        right: 0,
        background: '#f0f0f0e5',
        borderBottom: '1px solid rgba(155, 73, 25, 0.2)',
        padding: '3px',
        height: '30px',
        zIndex: 9999999,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        whiteSpace: 'nowrap'
      }}
    >
      <div style={{
        display: 'inline-flex',
        gap: '3px',
        alignItems: 'center',
        height: '100%'
      }}>
        {/* Display ALL suggestions */}
        {suggestions.map((suggestion, index) => {
          console.log(`   Rendering suggestion ${index}:`, suggestion.term);
          return (
            <button
              key={`${suggestion.type}_${suggestion.term}_${index}`}
              onClick={() => {
                console.log(`👆 Suggestion clicked: "${suggestion.term}"`);
                handleSuggestionClick(suggestion.term);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 8px',
                background: suggestion.type.includes('user') ? 'rgba(155,72,25,0.1)' : 'rgba(155,72,25,0.05)',
                border: '1px solid rgba(155,72,25,0.2)',
                borderRadius: '15px',
                fontSize: '11px',
                color: '#333',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                height: '22px',
                flexShrink: 0
              }}
            >
              {suggestion.term}
            </button>
          );
        })}
      </div>
    </div>
  );
})()}
    </div>
  );
};

export default Marketplace;