import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { supabase } from '../../lib/supabaseClient';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import OrderComponent from './OrderComponent';
import { 
  ArrowLeft, 
  MapPin, 
  Search, 
  Check, 
  Edit2, 
  Trash2, 
  X, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Store, 
  Shield,
  User as UserIcon
} from 'lucide-react';
import './CartPage.css';

// Types
interface Product {
  id: string;
  title: string;
  price: number;
  currency: string;
  images: string[];
  vendor_name: string;
  vendor_logo: string;
  inventory: number;
  vendor_id: string;
}

interface CartItem {
  id: string;
  product_id: string;
  vendor_id: string;
  quantity: number;
  created_at: string;
  product: Product;
  delivery_locations?: DeliveryLocation[];
  vendor_profile?: VendorProfile;
}

interface DeliveryLocation {
  state_id: number;
  university_id?: number;
  campus_id?: number;
  state_name: string;
  university_name?: string;
  campus_name?: string;
}

interface SavedLocation {
  id: string;
  firebase_uid: string;
  state_id: number;
  university_id?: number;
  campus_id?: number;
  precise_location?: string;
  last_used: string;
  state_name: string;
  university_name?: string;
  campus_name?: string;
}

interface LocationStep {
  state_id?: number;
  university_id?: number;
  campus_id?: number;
  precise_location?: string;
}

interface State {
  id: number;
  name: string;
}

interface University {
  id: number;
  name: string;
  abbreviation: string;
}

interface Campus {
  id: number;
  name: string;
  university_id: number;
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

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Location states
  const [showLocationSetup, setShowLocationSetup] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [locationStep, setLocationStep] = useState<LocationStep>({});
  
  // Search results
  const [states, setStates] = useState<State[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  
  // Filtered results
  const [filteredStates, setFilteredStates] = useState<State[]>([]);
  const [filteredUniversities, setFilteredUniversities] = useState<University[]>([]);
  const [filteredCampuses, setFilteredCampuses] = useState<Campus[]>([]);
  
  // UI states
  const [activeStep, setActiveStep] = useState<'state' | 'university' | 'campus' | 'precise'>('state');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showConfirmLocation, setShowConfirmLocation] = useState(false);

  const locationSetupRef = useRef<HTMLDivElement>(null);

  // Fetch user and cart data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user);
        await fetchCartItems(user.uid);
        await fetchSavedLocations(user.uid);
        await fetchStates();
      } else {
        navigate('/signin', { state: { from: '/cart' } });
      }
    });
    
    return () => unsubscribe();
  }, [navigate]);

  // Fetch user profile
  const fetchUserProfile = async (user: User) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const profile: UserProfile = {
          id: user.uid,
          email: userData.email || user.email || '',
          phone: userData.phone || '',
          name: userData.name || user.displayName || 'User',
          role: userData.role || 'user',
          isVerified: userData.isVerified || false,
          createdAt: userData.createdAt?.toDate().toISOString() || new Date().toISOString(),
          profileImage: userData.profileImage || user.photoURL || '',
          bio: userData.bio || '',
          location: userData.location || ''
        };
        setUserProfile(profile);
      } else {
        const profile: UserProfile = {
          id: user.uid,
          email: user.email || '',
          phone: '',
          name: user.displayName || 'User',
          role: 'user',
          isVerified: false,
          createdAt: new Date().toISOString(),
          profileImage: user.photoURL || '',
          bio: '',
          location: ''
        };
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      const profile: UserProfile = {
        id: user.uid,
        email: user.email || '',
        phone: '',
        name: user.displayName || 'User',
        role: 'user',
        isVerified: false,
        createdAt: new Date().toISOString(),
        profileImage: user.photoURL || '',
        bio: '',
        location: ''
      };
      setUserProfile(profile);
    }
  };

  const [showOrderComponent, setShowOrderComponent] = useState(false);

  // Fetch cart items with vendor profiles
  const fetchCartItems = async (userId: string) => {
    try {
      setLoading(true);
      // First fetch cart items
      const { data: cartData, error: cartError } = await supabase
        .from('carts')
        .select(`
          id,
          product_id,
          vendor_id,
          quantity,
          created_at,
          products!inner (
            id,
            title,
            price,
            currency,
            images,
            vendor_name,
            vendor_logo,
            inventory,
            vendor_id
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (cartError) throw cartError;

      const items: CartItem[] = await Promise.all(
        (cartData || []).map(async (item: any) => {
          // Fetch delivery locations for this product
          const deliveryLocations = await fetchProductDeliveryLocations(item.product_id);
          // Fetch vendor profile
          const vendorProfile = await fetchVendorProfile(item.vendor_id);
          
          return {
            id: item.id,
            product_id: item.product_id,
            vendor_id: item.vendor_id,
            quantity: item.quantity,
            created_at: item.created_at,
            product: item.products || {
              id: item.product_id,
              title: 'Product',
              price: 0,
              currency: 'NGN',
              images: [],
              vendor_name: 'Vendor',
              vendor_logo: '',
              inventory: 0,
              vendor_id: item.vendor_id
            },
            delivery_locations: deliveryLocations,
            vendor_profile: vendorProfile
          };
        })
      );

      setCartItems(items);
    } catch (error) {
      console.error('Error fetching cart:', error);
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch vendor profile
  const fetchVendorProfile = async (vendorId: string): Promise<VendorProfile | undefined> => {
    try {
      // Try to get vendor profile from vendor_profiles table
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching vendor profile:', error);
        return undefined;
      }

      if (data) {
        return {
          id: data.id,
          vendor_id: data.vendor_id,
          shop_name: data.shop_name || 'Shop',
          profile_image: data.profile_image || '',
          cover_image: data.cover_image,
          rating: data.rating || 0,
          followers_count: data.followers_count || 0,
          completed_trades: data.completed_trades || 0,
          is_verified: data.is_verified || false,
          online_status: data.online_status || false
        };
      }

      return undefined;
    } catch (error) {
      console.error('Error in fetchVendorProfile:', error);
      return undefined;
    }
  };

  // Fetch product delivery locations using product_id
  const fetchProductDeliveryLocations = async (productId: string): Promise<DeliveryLocation[]> => {
    try {
      // First try product_delivery_locations table
      const { data: productLocations, error: productError } = await supabase
        .from('product_delivery_locations')
        .select(`
          campus_id,
          campuses!inner (
            id,
            name,
            university_id,
            universities!inner (
              id,
              name,
              abbreviation,
              state_id,
              states!inner (
                id,
                name
              )
            )
          )
        `)
        .eq('product_id', productId);

      if (productError && productError.code !== 'PGRST116') {
        console.error('Error fetching product delivery locations:', productError);
      }

      // If product has specific delivery locations
      if (productLocations && productLocations.length > 0) {
        return productLocations.map((loc: any) => ({
          state_id: loc.campuses.universities.states.id,
          university_id: loc.campuses.universities.id,
          campus_id: loc.campus_id,
          state_name: loc.campuses.universities.states.name,
          university_name: loc.campuses.universities.name,
          campus_name: loc.campuses.name
        }));
      }

      // If no specific product locations, fetch vendor's delivery locations
      const { data: vendorData, error: vendorError } = await supabase
        .from('products')
        .select('vendor_id')
        .eq('id', productId)
        .single();

      if (vendorError || !vendorData) {
        console.error('Error fetching product vendor:', vendorError);
        return [];
      }

      // Fetch vendor delivery locations
      const { data: vendorLocations, error: vendorLocError } = await supabase
        .from('vendor_delivery_locations')
        .select(`
          campus_id,
          campuses!inner (
            id,
            name,
            university_id,
            universities!inner (
              id,
              name,
              abbreviation,
              state_id,
              states!inner (
                id,
                name
              )
            )
          )
        `)
        .eq('vendor_id', vendorData.vendor_id);

      if (vendorLocError && vendorLocError.code !== 'PGRST116') {
        console.error('Error fetching vendor delivery locations:', vendorLocError);
      }

      if (vendorLocations && vendorLocations.length > 0) {
        return vendorLocations.map((loc: any) => ({
          state_id: loc.campuses.universities.states.id,
          university_id: loc.campuses.universities.id,
          campus_id: loc.campus_id,
          state_name: loc.campuses.universities.states.name,
          university_name: loc.campuses.universities.name,
          campus_name: loc.campuses.name
        }));
      }

      return [];
    } catch (error) {
      console.error('Error in fetchProductDeliveryLocations:', error);
      return [];
    }
  };

  // FIXED: Fetch saved locations and populate university/campus data
  const fetchSavedLocations = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_locations')
        .select(`
          id,
          firebase_uid,
          state_id,
          university_id,
          campus_id,
          precise_location,
          last_used,
          states!inner(name),
          universities!left(name),
          campuses!left(name)
        `)
        .eq('firebase_uid', userId)
        .eq('is_active', true)
        .order('last_used', { ascending: false });

      if (error) throw error;

      const locations: SavedLocation[] = (data || []).map((loc: any) => ({
        id: loc.id,
        firebase_uid: loc.firebase_uid,
        state_id: loc.state_id,
        university_id: loc.university_id,
        campus_id: loc.campus_id,
        precise_location: loc.precise_location,
        last_used: loc.last_used,
        state_name: loc.states?.name || '',
        university_name: loc.universities?.name,
        campus_name: loc.campuses?.name
      }));

      setSavedLocations(locations);
    } catch (error) {
      console.error('Error fetching saved locations:', error);
      setSavedLocations([]);
    }
  };

  const fetchStates = async () => {
    try {
      const { data, error } = await supabase
        .from('states')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setStates(data || []);
      setFilteredStates(data || []);
    } catch (error) {
      console.error('Error fetching states:', error);
    }
  };

  const fetchUniversities = async (stateId?: number) => {
    try {
      let query = supabase
        .from('universities')
        .select('id, name, abbreviation')
        .order('name');

      if (stateId) {
        const { data: stateUnis, error } = await supabase
          .from('university_locations')
          .select('university_id')
          .eq('state_id', stateId);

        if (stateUnis && stateUnis.length > 0) {
          const universityIds = Array.from(new Set(stateUnis.map(uni => uni.university_id)));
          query = query.in('id', universityIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setUniversities(data || []);
      setFilteredUniversities(data || []);
    } catch (error) {
      console.error('Error fetching universities:', error);
    }
  };

  const fetchCampuses = async (universityId: number) => {
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('id, name, university_id')
        .eq('university_id', universityId)
        .order('name');

      if (error) throw error;
      setCampuses(data || []);
      setFilteredCampuses(data || []);
    } catch (error) {
      console.error('Error fetching campuses:', error);
    }
  };

  // FIXED: Handle saved location selection - fetch university and campus data
  const handleUseSavedLocation = async (location: SavedLocation) => {
    try {
      // Update last used
      await supabase
        .from('user_locations')
        .update({ last_used: new Date().toISOString() })
        .eq('id', location.id);

      // Set the location step
      setLocationStep({
        state_id: location.state_id,
        university_id: location.university_id,
        campus_id: location.campus_id,
        precise_location: location.precise_location
      });

      // FIXED: Fetch universities for the state
      if (location.state_id) {
        await fetchUniversities(location.state_id);
      }

      // FIXED: Fetch campuses for the university
      if (location.university_id) {
        await fetchCampuses(location.university_id);
      }

      setShowLocationSetup(false);
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  // Handle location selection
  const handleStateSelect = (state: State) => {
    setLocationStep(prev => ({ 
      ...prev, 
      state_id: state.id,
      university_id: undefined,
      campus_id: undefined,
      precise_location: undefined
    }));
    setLocationSearch('');
    fetchUniversities(state.id);
    setActiveStep('university');
  };

  const handleUniversitySelect = (university: University) => {
    setLocationStep(prev => ({ 
      ...prev, 
      university_id: university.id,
      campus_id: undefined,
      precise_location: undefined
    }));
    setLocationSearch('');
    fetchCampuses(university.id);
    setActiveStep('campus');
  };

  const handleCampusSelect = (campus: Campus) => {
    setLocationStep(prev => ({ 
      ...prev, 
      campus_id: campus.id,
      precise_location: undefined
    }));
    setLocationSearch('');
    setActiveStep('precise');
  };

  // Handle location save
  const handleSaveLocation = async () => {
    if (!currentUser || !locationStep.state_id || !locationStep.precise_location) {
      alert('State and precise location are required');
      return;
    }

    try {
      const locationData = {
        firebase_uid: currentUser.uid,
        state_id: locationStep.state_id,
        university_id: locationStep.university_id || null,
        campus_id: locationStep.campus_id || null,
        precise_location: locationStep.precise_location,
        last_used: new Date().toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('user_locations')
        .insert([locationData])
        .select();

      if (error) throw error;

      await fetchSavedLocations(currentUser.uid);
      setShowLocationSetup(false);
      setLocationSearch('');
      setActiveStep('state');
      setShowConfirmLocation(false);
    } catch (error) {
      console.error('Error saving location:', error);
      alert('Failed to save location. Please ensure RLS is disabled for testing.');
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    try {
      const { error } = await supabase
        .from('user_locations')
        .update({ is_active: false })
        .eq('id', locationId);

      if (error) throw error;

      await fetchSavedLocations(currentUser?.uid || '');
    } catch (error) {
      console.error('Error deleting location:', error);
    }
  };

  // Cart functions
  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (!currentUser || newQuantity < 1) return;

    try {
      setUpdatingItemId(itemId);

      if (newQuantity === 0) {
        await removeFromCart(itemId);
        return;
      }

      const { error } = await supabase
        .from('carts')
        .update({ quantity: newQuantity })
        .eq('id', itemId)
        .eq('user_id', currentUser.uid);

      if (error) throw error;

      setCartItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ));
    } catch (error) {
      console.error('Error updating quantity:', error);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (!currentUser) return;

    try {
      setUpdatingItemId(itemId);
      const { error } = await supabase
        .from('carts')
        .delete()
        .eq('id', itemId)
        .eq('user_id', currentUser.uid);

      if (error) throw error;

      setCartItems(prev => prev.filter(item => item.id !== itemId));
    } catch (error) {
      console.error('Error removing item:', error);
    } finally {
      setUpdatingItemId(null);
    }
  };

  // FIXED: Click product to navigate to vendor shop with product (like marketplace)
  const handleProductClick = (vendorId: string, productId: string) => {
    navigate(`/vendor/${vendorId}`, { 
      state: { 
        initialProductId: productId,
        fromCart: true 
      } 
    });
  };

  // Filter search results
  useEffect(() => {
    const searchTerm = locationSearch.toLowerCase();
    
    if (activeStep === 'state') {
      const filtered = states.filter(state => 
        state.name.toLowerCase().includes(searchTerm)
      );
      setFilteredStates(filtered);
    } else if (activeStep === 'university') {
      const filtered = universities.filter(uni => 
        uni.name.toLowerCase().includes(searchTerm)
      );
      setFilteredUniversities(filtered);
    } else if (activeStep === 'campus') {
      const filtered = campuses.filter(campus => 
        campus.name.toLowerCase().includes(searchTerm)
      );
      setFilteredCampuses(filtered);
    }
  }, [locationSearch, activeStep, states, universities, campuses]);

  // Calculate summary
  const calculateSummary = () => {
    const uniqueVendors = new Set(cartItems.map(item => item.vendor_id));
    const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = cartItems.reduce((sum, item) => 
      sum + (item.product.price * item.quantity), 0);

    return {
      vendors: uniqueVendors.size,
      products: cartItems.length,
      quantity: totalQuantity,
      amount: totalAmount
    };
  };

  // Check location match for a product
  const getProductLocationMatch = (item: CartItem) => {
    if (!item.delivery_locations || item.delivery_locations.length === 0) {
      return null;
    }

    if (!locationStep.state_id) {
      return null;
    }

    const matchedLocation = item.delivery_locations.find(loc => {
      if (loc.state_id !== locationStep.state_id) return false;
      
      if (locationStep.university_id && loc.university_id !== locationStep.university_id) return false;
      
      if (locationStep.campus_id && loc.campus_id !== locationStep.campus_id) return false;
      
      return true;
    });

    if (!matchedLocation) {
      return null;
    }

    const matchedParts = [];
    matchedParts.push(matchedLocation.state_name);
    
    if (matchedLocation.university_name) {
      matchedParts.push(matchedLocation.university_name);
    }
    
    if (matchedLocation.campus_name) {
      matchedParts.push(matchedLocation.campus_name);
    }
    
    return matchedParts;
  };

  const summary = calculateSummary();
  const formatPrice = (price: number) => `₦${price.toLocaleString('en-NG')}`;

  // FIXED: Get location placeholders - always show full text, no truncation
  const getLocationPlaceholders = () => {
    const state = locationStep.state_id ? states.find(s => s.id === locationStep.state_id)?.name : '[State]';
    const university = locationStep.university_id ? universities.find(u => u.id === locationStep.university_id)?.name : '[University]';
    const campus = locationStep.campus_id ? campuses.find(c => c.id === locationStep.campus_id)?.name : '[Campus]';
    const precise = locationStep.precise_location || '[Precise location]';
    
    return { state, university, campus, precise };
  };

  if (loading) {
    return (
      <div className="cartpage-loading">
        <div className="cartpage-spinner"></div>
      </div>
    );
  }

  return (
    <div className="cartpage-container">
      {/* Fixed Header */}
      <header className="cartpage-header">

          <div className="cartpage-user">
          {userProfile?.profileImage ? (
            <img 
              src={userProfile.profileImage} 
              alt="Profile" 
              className="cartpage-userpic"
            />
          ) : currentUser?.photoURL ? (
            <img 
              src={currentUser.photoURL} 
              alt="Profile" 
              className="cartpage-userpic"
            />
          ) : (
            <div className="cartpage-userpic">
              <UserIcon size={12} />
            </div>
          )}
          <span className="cartpage-username">
            {userProfile?.name || currentUser?.email?.split('@')[0] || 'User'}
          </span>
        </div>
     
        
        <h1 className="cartpage-title">My shopping bag</h1>

           <button 
          className="cartpage-back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} />
        </button>
        
      
      </header>

      {/* Location Setup Section */}
      <section className="cartpage-locationsetup">
        <div className="cartpage-locationprompt">
          Set location for next purchase...
        </div>
        
        <div 
          className="cartpage-searchtrigger"
          onClick={() => setShowLocationSetup(true)}
        >
          <Search size={14} />
          <span>set delivery location</span>
        </div>

        {/* Location Placeholders - Always visible, full text */}
        <div className="cartpage-locationpreview">
          <div className="cartpage-locationchips">
            {['state', 'university', 'campus', 'precise'].map((type) => {
              const placeholder = getLocationPlaceholders();
              const value = type === 'state' ? placeholder.state :
                           type === 'university' ? placeholder.university :
                           type === 'campus' ? placeholder.campus : placeholder.precise;
              
              return (
                <span 
                  key={type}
                  className={`cartpage-locationchip ${type}`}
                  onClick={() => {
                    if (type === 'state' || (type === 'university' && locationStep.state_id) || 
                        (type === 'campus' && locationStep.university_id) || type === 'precise') {
                      setActiveStep(type as any);
                      setShowLocationSetup(true);
                    }
                  }}
                >
                  {value}
                </span>
              );
            })}
          </div>
          <button 
            className={`cartpage-locationcheck ${locationStep.state_id && locationStep.precise_location ? 'enabled' : 'disabled'}`}
            onClick={() => {
              if (locationStep.state_id && locationStep.precise_location) {
                setShowConfirmLocation(true);
              }
            }}
          >
            <Check size={14} />
          </button>
        </div>
      </section>

      {/* Cart Items Section */}
      <section className="cartpage-items">
        <div className="cartpage-sectiontitle">
          Your Items ({cartItems.length})
        </div>
        
        {cartItems.length === 0 ? (
          <div className="cartpage-empty">
            <ShoppingBag size={32} />
            <p>Your bag is empty</p>
          </div>
        ) : (
          <div className="cartpage-itemslist">
            {cartItems.map((item) => {
              const locationMatch = getProductLocationMatch(item);
              const vendor = item.vendor_profile;
              
              return (
                <div 
                  key={item.id} 
                  className="cartpage-item"
                  onClick={() => handleProductClick(item.vendor_id, item.product_id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="cartpage-itemimage">
                    <img 
                      src={item.product.images?.[0] || '/placeholder.jpg'} 
                      alt={item.product.title}
                    />
                    {item.product.vendor_logo && (
                      <img 
                        src={item.product.vendor_logo} 
                        alt="Vendor"
                        className="cartpage-vendorlogo"
                      />
                    )}
                  </div>
                  
                  <div className="cartpage-itemdetails">
                    <div className="cartpage-itemtop">
                      <h3 className="cartpage-itemtitle">
                        {item.product.title}
                      </h3>
                      <div className="cartpage-itemprice">
                        {formatPrice(item.product.price)}
                      </div>
                    </div>
                    
                    <div className="cartpage-itembottom">
                      <div className="cartpage-itemtotal">
                        Total: {formatPrice(item.product.price * item.quantity)}
                      </div>
                      
                      <div className="cartpage-quantity">
                        <button
                          className="cartpage-qtybtn"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuantity(item.id, item.quantity - 1);
                          }}
                          disabled={item.quantity <= 1 || updatingItemId === item.id}
                        >
                          <Minus size={10} />
                        </button>
                        <span className="cartpage-qtyvalue">
                          {updatingItemId === item.id ? '...' : item.quantity}
                        </span>
                        <button
                          className="cartpage-qtybtn"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuantity(item.id, item.quantity + 1);
                          }}
                          disabled={item.quantity >= item.product.inventory || updatingItemId === item.id}
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Location Match Display */}
                    <div className="cartpage-itemlocationmatch">
                      <MapPin size={10} />
                      <div className="cartpage-locationmatchscroll">
                        {locationMatch ? (
                          locationMatch.map((part, index) => (
                            <span key={index} className="cartpage-matchpart">
                              {part}{index < locationMatch.length - 1 ? ' → ' : ''}
                            </span>
                          ))
                        ) : (
                          <span className="cartpage-nomatch">No location match</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Vendor info and actions */}
                    <div 
                      className="cartpage-itemactions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="cartpage-actionbtn remove"
                        onClick={() => removeFromCart(item.id)}
                        disabled={updatingItemId === item.id}
                      >
                        <Trash2 size={12} />
                        Remove
                      </button>
                      
                      {/* Vendor info with logo */}
                      {vendor && (
                        <div 
                          className="cartpage-shopinfo" 
                          onClick={() => navigate(`/vendor/${item.vendor_id}`)}
                        >
                          {vendor.profile_image ? (
                            <img src={vendor.profile_image} alt={vendor.shop_name} className="cartpage-shoplogo" />
                          ) : (
                            <div className="cartpage-shoplogo cartpage-shoplogo-placeholder">
                              {vendor.shop_name?.charAt(0) || 'S'}
                            </div>
                          )}
                          <span className="cartpage-shopname">{vendor.shop_name || 'Shop'}</span>
                          {vendor.is_verified && <span className="cartpage-shopverified">✓</span>}
                        </div>
                      )}
                      
                      <button
                        className="cartpage-actionbtn shop"
                        onClick={() => navigate(`/vendor/${item.vendor_id}`)}
                      >
                        <Store size={12} />
                        Visit Shop
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Summary Section */}
      {cartItems.length > 0 && (
        <section className="cartpage-summary">
          <div className="cartpage-stats">
            <div className="cartpage-stat">
              <span>Total</span>
              <span>{formatPrice(summary.amount)}</span>
            </div>
            <div className="cartpage-stat">
              <span>Vendors</span>
              <span>{summary.vendors}</span>
            </div>
            <div className="cartpage-stat">
              <span>Products</span>
              <span>{summary.products}</span>
            </div>
            <div className="cartpage-stat">
              <span>Quantity</span>
              <span>{summary.quantity}</span>
            </div>
          </div>
          
          <button
            className="cartpage-checkoutbtn"
            onClick={() => setShowCheckout(true)}
            disabled={!locationStep.state_id || !locationStep.precise_location}
          >
            Checkout
          </button>
        </section>
      )}

      {/* Security Footer */}
      <footer className="cartpage-footer">
        <div className="cartpage-security">
          <Shield size={12} />
          <span>gostorez handles secured purchase</span>
        </div>
        <p className="cartpage-footertext">
          Vendors won't receive payment until you confirm delivery. 
          Orders can be reversed as long as vendor hasn't indicated processed...
          See more terms/policy...@gostorez Enterprise
        </p>
      </footer>

      {/* Location Setup Modal */}
      {showLocationSetup && (
        <div className="cartpage-modalbg">
          <div className="cartpage-locationmodal" ref={locationSetupRef}>
            <button
              className="cartpage-modalclose"
              onClick={() => {
                setShowLocationSetup(false);
                setLocationSearch('');
                setActiveStep('state');
              }}
            >
              <X size={16} />
            </button>

            {/* Saved Locations */}
            <div className="cartpage-savedlocations">
              <div className="cartpage-savedtitle">Recent Locations</div>
              {savedLocations.length > 0 ? (
                <div className="cartpage-savedlist">
                  {savedLocations.map((location) => (
                    <div key={location.id} className="cartpage-saveditem">
                      <div className="cartpage-savedinfo">
                        <MapPin size={12} />
                        <span className="cartpage-savedtext">
                          {[
                            location.state_name,
                            location.university_name,
                            location.campus_name,
                            location.precise_location
                          ].filter(Boolean).join(', ')}
                        </span>
                      </div>
                      <div className="cartpage-savedactions">
                        <button
                          className="cartpage-savedaction use"
                          onClick={() => handleUseSavedLocation(location)}
                          title="Use location"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          className="cartpage-savedaction edit"
                          onClick={() => {
                            setLocationStep({
                              state_id: location.state_id,
                              university_id: location.university_id,
                              campus_id: location.campus_id,
                              precise_location: location.precise_location
                            });
                            // FIXED: Fetch universities and campuses for saved location
                            if (location.state_id) fetchUniversities(location.state_id);
                            if (location.university_id) fetchCampuses(location.university_id);
                            setActiveStep('precise');
                            setShowLocationSetup(true);
                          }}
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="cartpage-savedaction delete"
                          onClick={() => handleDeleteLocation(location.id)}
                          title="Remove"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cartpage-norecent">
                  No recent location setup...
                </div>
              )}
            </div>

            {/* FIXED: Location Placeholders in Modal - Show full text */}
            <div className="cartpage-locationplaceholders">
              <div className="cartpage-placeholderscroll">
                <span 
                  className={`cartpage-placeholder ${activeStep === 'state' ? 'active' : ''}`}
                  onClick={() => setActiveStep('state')}
                >
                  {locationStep.state_id ? states.find(s => s.id === locationStep.state_id)?.name : '[State]'}
                </span>
                <span className="cartpage-placeholdersep">-</span>
                <span 
                  className={`cartpage-placeholder ${activeStep === 'university' ? 'active' : ''}`}
                  onClick={() => locationStep.state_id && setActiveStep('university')}
                >
                  {locationStep.university_id ? universities.find(u => u.id === locationStep.university_id)?.name : '[University]'}
                </span>
                <span className="cartpage-placeholdersep">-</span>
                <span 
                  className={`cartpage-placeholder ${activeStep === 'campus' ? 'active' : ''}`}
                  onClick={() => locationStep.university_id && setActiveStep('campus')}
                >
                  {locationStep.campus_id ? campuses.find(c => c.id === locationStep.campus_id)?.name : '[Campus]'}
                </span>
                <span className="cartpage-placeholdersep">-</span>
                <span 
                  className={`cartpage-placeholder ${activeStep === 'precise' ? 'active' : ''}`}
                  onClick={() => setActiveStep('precise')}
                >
                  {locationStep.precise_location || '[Precise location]'}
                </span>
              </div>
              <button 
                className={`cartpage-placeholdercheck ${locationStep.state_id && locationStep.precise_location ? 'enabled' : 'disabled'}`}
                onClick={() => {
                  if (locationStep.state_id && locationStep.precise_location) {
                    setShowConfirmLocation(true);
                    setShowLocationSetup(false);
                  }
                }}
              >
                <Check size={14} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="cartpage-modalsearch">
              <Search size={14} />
              <input
                type="text"
                className="cartpage-searchinput"
                placeholder={
                  activeStep === 'state' ? 'Search state...' :
                  activeStep === 'university' ? 'Search university...' :
                  activeStep === 'campus' ? 'Search campus...' :
                  'Enter precise location...'
                }
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Search Results */}
            {activeStep !== 'precise' && (
              <div className="cartpage-searchresults">
                {activeStep === 'state' && filteredStates.map((state) => (
                  <button
                    key={state.id}
                    className="cartpage-resultitem"
                    onClick={() => handleStateSelect(state)}
                  >
                    {state.name}
                  </button>
                ))}
                
                {activeStep === 'university' && filteredUniversities.map((uni) => (
                  <button
                    key={uni.id}
                    className="cartpage-resultitem"
                    onClick={() => handleUniversitySelect(uni)}
                  >
                    {uni.name} ({uni.abbreviation})
                  </button>
                ))}
                
                {activeStep === 'campus' && filteredCampuses.map((campus) => (
                  <button
                    key={campus.id}
                    className="cartpage-resultitem"
                    onClick={() => handleCampusSelect(campus)}
                  >
                    {campus.name}
                  </button>
                ))}
              </div>
            )}

            {/* Precise Location Input */}
            {activeStep === 'precise' && (
              <div className="cartpage-preciselocation">
                <textarea
                  className="cartpage-preciseinput"
                  placeholder="Enter precise location (e.g., Room 12, Hostel Block A)"
                  value={locationStep.precise_location || ''}
                  onChange={(e) => setLocationStep(prev => ({ 
                    ...prev, 
                    precise_location: e.target.value 
                  }))}
                  rows={3}
                />
                <div className="cartpage-preciseinfo">
                  State and precise location are required. University and campus are optional.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Location Modal */}
      {showConfirmLocation && (
        <div className="cartpage-modalbg">
          <div className="cartpage-confirmmodal">
            <div className="cartpage-confirmtitle">
              Use this location?
            </div>
            <div className="cartpage-confirmlocation">
              {[
                states.find(s => s.id === locationStep.state_id)?.name,
                universities.find(u => u.id === locationStep.university_id)?.name,
                campuses.find(c => c.id === locationStep.campus_id)?.name,
                locationStep.precise_location
              ].filter(Boolean).join(' - ')}
            </div>
            <div className="cartpage-confirmactions">
              <button
                className="cartpage-confirmbtn yes"
                onClick={handleSaveLocation}
              >
                Yes
              </button>
              <button
                className="cartpage-confirmbtn no"
                onClick={() => setShowConfirmLocation(false)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="cartpage-modalbg">
          <div className="cartpage-checkoutmodal">
            <button
              className="cartpage-checkoutclose"
              onClick={() => setShowCheckout(false)}
            >
              <X size={16} />
            </button>
            
            <div className="cartpage-checkouttitle">
              Order Summary
            </div>
            
            <div className="cartpage-checkoutuser">
              <div>User: {userProfile?.name}</div>
              <div>Email: {userProfile?.email}</div>
              {userProfile?.phone && <div>Phone: {userProfile.phone}</div>}
            </div>
            
            <div className="cartpage-checkoutlocation">
              <div>Delivery Location:</div>
              <div>
                {[
                  states.find(s => s.id === locationStep.state_id)?.name,
                  universities.find(u => u.id === locationStep.university_id)?.name,
                  campuses.find(c => c.id === locationStep.campus_id)?.name,
                  locationStep.precise_location
                ].filter(Boolean).join(' - ')}
              </div>
            </div>
            
            <div className="cartpage-checkoutitems">
              {cartItems.map((item) => (
                <div key={item.id} className="cartpage-checkoutitem">
                  <span>{item.product.title} × {item.quantity}</span>
                  <span>{formatPrice(item.product.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            
            <div className="cartpage-checkouttotal">
              Total: {formatPrice(summary.amount)}
            </div>
            
            <button className="cartpage-placeorderbtn"
              onClick={() => setShowOrderComponent(true)}
  disabled={!locationStep.state_id || !locationStep.precise_location}
  >
              Place Order
            </button>
          </div>
        </div>
      )}

      {showOrderComponent && (
  <OrderComponent
    cartItems={cartItems}
    locationStep={locationStep}
    userProfile={userProfile}
    totalAmount={summary.amount}
    onOrderSuccess={(orderId: string) => {
      setShowOrderComponent(false);
      navigate(`/orders/${orderId}`);
    }}
    onClose={() => setShowOrderComponent(false)}
  />
)}
    </div>
  );
};

export default CartPage;