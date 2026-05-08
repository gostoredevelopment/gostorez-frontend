import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { supabase } from '../../lib/supabaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import imageCompression from 'browser-image-compression';
import {
  User,
  Edit2,
  Save,
  X,
  Camera,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Package,
  ShoppingBag,
  Heart,
  Clock,
  CheckCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  ChevronRight,
  Trash2,
  Copy,
  CheckCheck,
  Award,
  Wallet,
  MapPinned,
  Plus,
  TrendingUp,
  Building,
  Home,
  Map as MapIcon,
  BookOpen
} from 'lucide-react';
import './UserProfile.css';

interface UserProfileData {
  id: string;
  firebase_uid: string;
  name: string;
  email: string;
  phone: string;
  avatar_url: string;
  user_type: string;
  created_at: string;
  updated_at: string;
  last_seen: string;
  is_active: boolean;
  balance: number;
  total_spent: number;
  total_orders: number;
  total_deposits: number;
  last_deposit_date: string | null;
  user_filter_preferences: any;
  locations?: UserLocation[];
  favorite_vendors_count?: number;
  pending_orders_count?: number;
  completed_orders_count?: number;
  level?: number;
}

interface UserLocation {
  id: string;
  firebase_uid: string;
  state_id: number | null;
  university_id: number | null;
  campus_id: number | null;
  precise_location: string;
  is_active: boolean;
  last_used: string;
  created_at: string;
  updated_at: string;
  state_name?: string;
  university_name?: string;
  campus_name?: string;
}

interface StatsCard {
  id: string;
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

interface LocationOption {
  id: number;
  name: string;
}

// Convert file to Data URL
const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
};

// Compress image
const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 400,
    useWebWorker: true,
  };
  return await imageCompression(file, options);
};

const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [originalData, setOriginalData] = useState<UserProfileData | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'location'>('profile');
  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<UserLocation | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Partial<UserLocation>>({});
  const [imagePreview, setImagePreview] = useState<string>("");
  
  // Location selection options
  const [states, setStates] = useState<LocationOption[]>([]);
  const [universities, setUniversities] = useState<LocationOption[]>([]);
  const [campuses, setCampuses] = useState<LocationOption[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Form state for edit mode
  const [formData, setFormData] = useState<Partial<UserProfileData>>({});

  // Sync avatar_url from Firebase to Supabase on page load
  const syncAvatarFromFirebaseToSupabase = async (firebaseUid: string, supabaseAvatarUrl: string) => {
    try {
      // Check if Firebase has profile image
      const firestoreDoc = await getDoc(doc(db, 'users', firebaseUid));
      const firebaseData = firestoreDoc.data();
      const firebaseAvatarUrl = firebaseData?.profileImage || '';
      
      // If Firebase has image but Supabase doesn't, update Supabase
      if (firebaseAvatarUrl && !supabaseAvatarUrl) {
        console.log('Syncing avatar from Firebase to Supabase');
        await supabase
          .from('users')
          .update({ avatar_url: firebaseAvatarUrl, updated_at: new Date().toISOString() })
          .eq('firebase_uid', firebaseUid);
        return firebaseAvatarUrl;
      }
      
      // If Supabase has image but Firebase doesn't, update Firebase
      if (supabaseAvatarUrl && !firebaseAvatarUrl) {
        console.log('Syncing avatar from Supabase to Firebase');
        await updateDoc(doc(db, 'users', firebaseUid), {
          profileImage: supabaseAvatarUrl,
          updatedAt: new Date()
        });
        return supabaseAvatarUrl;
      }
      
      // If both have images, prefer Firebase (primary source)
      if (firebaseAvatarUrl && supabaseAvatarUrl && firebaseAvatarUrl !== supabaseAvatarUrl) {
        console.log('Firebase has different avatar, updating Supabase');
        await supabase
          .from('users')
          .update({ avatar_url: firebaseAvatarUrl, updated_at: new Date().toISOString() })
          .eq('firebase_uid', firebaseUid);
        return firebaseAvatarUrl;
      }
      
      return supabaseAvatarUrl || firebaseAvatarUrl || '';
    } catch (error) {
      console.error('Error syncing avatar:', error);
      return supabaseAvatarUrl || '';
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await fetchUserProfile(user.uid);
        await fetchLocationOptions();
      } else {
        navigate('/signin');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const fetchLocationOptions = async () => {
    try {
      const { data: statesData } = await supabase
        .from('states')
        .select('id, name')
        .order('name');
      
      if (statesData) {
        setStates(statesData);
      }
    } catch (error) {
      console.error('Error fetching location options:', error);
    }
  };

  const fetchUniversities = async (stateId: number) => {
    setLoadingLocations(true);
    try {
      const { data: universitiesData } = await supabase
        .from('universities')
        .select('id, name')
        .eq('state_id', stateId)
        .order('name');
      
      setUniversities(universitiesData || []);
    } catch (error) {
      console.error('Error fetching universities:', error);
    } finally {
      setLoadingLocations(false);
    }
  };

  const fetchCampuses = async (universityId: number) => {
    setLoadingLocations(true);
    try {
      const { data: campusesData } = await supabase
        .from('campuses')
        .select('id, name')
        .eq('university_id', universityId)
        .order('name');
      
      setCampuses(campusesData || []);
    } catch (error) {
      console.error('Error fetching campuses:', error);
    } finally {
      setLoadingLocations(false);
    }
  };

  const fetchLocationNames = async (location: UserLocation): Promise<UserLocation> => {
    const enrichedLocation = { ...location };
    
    try {
      if (location.state_id) {
        const { data } = await supabase
          .from('states')
          .select('name')
          .eq('id', location.state_id)
          .single();
        if (data) enrichedLocation.state_name = data.name;
      }
      
      if (location.university_id) {
        const { data } = await supabase
          .from('universities')
          .select('name')
          .eq('id', location.university_id)
          .single();
        if (data) enrichedLocation.university_name = data.name;
      }
      
      if (location.campus_id) {
        const { data } = await supabase
          .from('campuses')
          .select('name')
          .eq('id', location.campus_id)
          .single();
        if (data) enrichedLocation.campus_name = data.name;
      }
    } catch (error) {
      console.error('Error fetching location names:', error);
    }
    
    return enrichedLocation;
  };

  const fetchUserProfile = async (firebaseUid: string) => {
    try {
      console.log('Fetching user profile for:', firebaseUid);
      
      // Fetch from Supabase
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('firebase_uid', firebaseUid)
        .single();

      if (userError) throw userError;
      if (!userData) throw new Error('User not found');

      console.log('Supabase user data:', userData);

      // Sync avatar from Firebase to Supabase
      const syncedAvatarUrl = await syncAvatarFromFirebaseToSupabase(firebaseUid, userData.avatar_url || '');
      
      // Use synced avatar URL
      const finalAvatarUrl = syncedAvatarUrl;
      
      // Set image preview
      if (finalAvatarUrl) {
        setImagePreview(finalAvatarUrl);
      }

      // Fetch user locations
      const { data: locationData, error: locationError } = await supabase
        .from('user_locations')
        .select('*')
        .eq('firebase_uid', firebaseUid)
        .order('is_active', { ascending: false })
        .order('last_used', { ascending: false });

      if (locationError) {
        console.error('Error fetching locations:', locationError);
      }

      const enrichedLocations: UserLocation[] = [];
      if (locationData) {
        for (const loc of locationData) {
          const enriched = await fetchLocationNames(loc);
          enrichedLocations.push(enriched);
        }
      }

      // Get order statistics
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('user_id', firebaseUid);

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
      }

      let pendingOrders = 0;
      let completedOrders = 0;

      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('user_status')
          .in('order_id', orderIds);

        if (!itemsError && orderItems) {
          pendingOrders = orderItems.filter(item => item.user_status === 'pending').length;
          completedOrders = orderItems.filter(item => item.user_status === 'received').length;
        }
      }

      // Get favorite vendors count
      const { count: favCount, error: favError } = await supabase
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', firebaseUid);

      if (favError) {
        console.error('Error fetching favorites:', favError);
      }

      const totalSpent = orders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0;
      const level = totalSpent > 0 ? parseFloat((totalSpent * 0.00005).toFixed(1)) : 0;

      const profile: UserProfileData = {
        id: userData.id,
        firebase_uid: userData.firebase_uid,
        name: userData.name || 'User',
        email: userData.email || '',
        phone: userData.phone || '',
        avatar_url: finalAvatarUrl,
        user_type: userData.user_type || 'user',
        created_at: userData.created_at || new Date().toISOString(),
        updated_at: userData.updated_at || new Date().toISOString(),
        last_seen: userData.last_seen || new Date().toISOString(),
        is_active: userData.is_active ?? true,
        balance: Number(userData.balance) || 0,
        total_spent: totalSpent,
        total_orders: orders?.length || 0,
        total_deposits: Number(userData.total_deposits) || 0,
        last_deposit_date: userData.last_deposit_date || null,
        user_filter_preferences: userData.user_filter_preferences || {},
        locations: enrichedLocations,
        favorite_vendors_count: favCount || 0,
        pending_orders_count: pendingOrders,
        completed_orders_count: completedOrders,
        level: level
      };

      setProfileData(profile);
      setOriginalData(profile);
      setFormData(profile);
      setLocations(enrichedLocations);
      
      const activeLocation = enrichedLocations.find(loc => loc.is_active);
      setSelectedLocation(activeLocation || null);
      
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleEdit = () => {
    setEditMode(true);
    setFormData(profileData || {});
    setSaveSuccess(false);
  };

  const handleCancel = () => {
    setEditMode(false);
    setFormData(originalData || {});
    if (profileData) {
      setProfileData({ ...originalData! });
    }
    // Reset image preview to original
    if (originalData?.avatar_url) {
      setImagePreview(originalData.avatar_url);
    } else {
      setImagePreview("");
    }
  };

  const saveToSupabase = async (firebaseUid: string, updates: any) => {
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('firebase_uid', firebaseUid);
    
    if (error) throw error;
  };

  const saveToFirebase = async (firebaseUid: string, updates: any) => {
    const firebaseUpdates: any = {
      name: updates.name,
      phone: updates.phone,
      updatedAt: new Date()
    };
    
    if (updates.avatar_url !== undefined) {
      firebaseUpdates.profileImage = updates.avatar_url;
    }
    
    await updateDoc(doc(db, 'users', firebaseUid), firebaseUpdates);
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    
    setSaving(true);
    try {
      const updates: any = {
        name: formData.name,
        phone: formData.phone,
        updated_at: new Date().toISOString()
      };
      
      // Only include avatar_url if it has changed
      if (formData.avatar_url !== undefined && formData.avatar_url !== originalData?.avatar_url) {
        updates.avatar_url = formData.avatar_url;
      }

      console.log('Saving to Supabase and Firebase:', { ...updates, avatar_url: updates.avatar_url ? '[DATA_URL]' : undefined });

      // Save to both databases
      await Promise.all([
        saveToSupabase(auth.currentUser.uid, updates),
        saveToFirebase(auth.currentUser.uid, updates)
      ]);

      // Update local state
      setProfileData({ ...profileData, ...formData } as UserProfileData);
      setOriginalData({ ...profileData, ...formData } as UserProfileData);
      setEditMode(false);
      setSaveSuccess(true);
      
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Image handling
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Please select a valid image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Image size should be less than 2MB");
      return;
    }

    setUploadingImage(true);

    try {
      const compressedFile = await compressImage(file);
      const dataURL = await fileToDataURL(compressedFile);
      
      setImagePreview(dataURL);
      setFormData({ ...formData, avatar_url: dataURL });
    } catch (error) {
      console.error('Error processing image:', error);
      alert("Failed to process image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview("");
    setFormData({ ...formData, avatar_url: "" });
    setShowDeleteConfirm(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleCopyUserId = () => {
    if (profileData?.firebase_uid) {
      navigator.clipboard.writeText(profileData.firebase_uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Location Management Functions
  const handleAddLocation = () => {
    setEditingLocation({
      firebase_uid: profileData?.firebase_uid,
      precise_location: '',
      is_active: locations.length === 0,
      state_id: null,
      university_id: null,
      campus_id: null
    });
    setUniversities([]);
    setCampuses([]);
    setShowLocationModal(true);
  };

  const handleEditLocation = (location: UserLocation) => {
    setEditingLocation(location);
    if (location.state_id) fetchUniversities(location.state_id);
    if (location.university_id) fetchCampuses(location.university_id);
    setShowLocationModal(true);
  };

  const handleStateChange = (stateId: string) => {
    const id = parseInt(stateId);
    setEditingLocation({
      ...editingLocation,
      state_id: id,
      university_id: null,
      campus_id: null
    });
    setUniversities([]);
    setCampuses([]);
    if (id) fetchUniversities(id);
  };

  const handleUniversityChange = (universityId: string) => {
    const id = parseInt(universityId);
    setEditingLocation({
      ...editingLocation,
      university_id: id,
      campus_id: null
    });
    setCampuses([]);
    if (id) fetchCampuses(id);
  };

  const handleSetActiveLocation = async (location: UserLocation) => {
    if (!profileData) return;

    try {
      await supabase
        .from('user_locations')
        .update({ is_active: false })
        .eq('firebase_uid', profileData.firebase_uid);

      await supabase
        .from('user_locations')
        .update({ 
          is_active: true,
          last_used: new Date().toISOString()
        })
        .eq('id', location.id);

      const { data } = await supabase
        .from('user_locations')
        .select('*')
        .eq('firebase_uid', profileData.firebase_uid);

      if (data) {
        const enrichedLocations: UserLocation[] = [];
        for (const loc of data) {
          const enriched = await fetchLocationNames(loc);
          enrichedLocations.push(enriched);
        }
        setLocations(enrichedLocations);
        const active = enrichedLocations.find(loc => loc.is_active);
        setSelectedLocation(active || null);
      }
    } catch (error) {
      console.error('Error setting active location:', error);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!profileData) return;

    try {
      const { error } = await supabase
        .from('user_locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;

      const { data } = await supabase
        .from('user_locations')
        .select('*')
        .eq('firebase_uid', profileData.firebase_uid);

      if (data) {
        const enrichedLocations: UserLocation[] = [];
        for (const loc of data) {
          const enriched = await fetchLocationNames(loc);
          enrichedLocations.push(enriched);
        }
        setLocations(enrichedLocations);
        const active = enrichedLocations.find(loc => loc.is_active);
        setSelectedLocation(active || null);
      }
    } catch (error) {
      console.error('Error deleting location:', error);
    }
  };

  const handleSaveLocation = async () => {
    if (!profileData || !editingLocation.precise_location?.trim()) return;

    try {
      const locationData = {
        firebase_uid: profileData.firebase_uid,
        state_id: editingLocation.state_id || null,
        university_id: editingLocation.university_id || null,
        campus_id: editingLocation.campus_id || null,
        precise_location: editingLocation.precise_location.trim(),
        is_active: editingLocation.is_active ?? false,
        last_used: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (editingLocation.id) {
        await supabase
          .from('user_locations')
          .update(locationData)
          .eq('id', editingLocation.id);
      } else {
        await supabase
          .from('user_locations')
          .insert([locationData]);
      }

      const { data } = await supabase
        .from('user_locations')
        .select('*')
        .eq('firebase_uid', profileData.firebase_uid);

      if (data) {
        const enrichedLocations: UserLocation[] = [];
        for (const loc of data) {
          const enriched = await fetchLocationNames(loc);
          enrichedLocations.push(enriched);
        }
        setLocations(enrichedLocations);
        const active = enrichedLocations.find(loc => loc.is_active);
        setSelectedLocation(active || null);
      }

      setShowLocationModal(false);
      setEditingLocation({});
    } catch (error) {
      console.error('Error saving location:', error);
      alert('Failed to save location. Please try again.');
    }
  };

  const formatFullLocation = (location: UserLocation): string => {
    const parts = [];
    if (location.state_name) parts.push(location.state_name);
    if (location.university_name) parts.push(location.university_name);
    if (location.campus_name) parts.push(location.campus_name);
    if (location.precise_location) parts.push(location.precise_location);
    return parts.join(' > ');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const statsCards: StatsCard[] = [
    {
      id: 'orders',
      label: 'Total Orders',
      value: profileData?.total_orders || 0,
      icon: <Package size={16} />,
      color: '#9B4819'
    },
    {
      id: 'spent',
      label: 'Level',
      value: profileData?.level?.toFixed(1) || '0.0',
      icon: <TrendingUp size={16} />,
      color: '#10b981'
    },
    {
      id: 'balance',
      label: 'Balance',
      value: formatCurrency(profileData?.balance || 0),
      icon: <Wallet size={16} />,
      color: '#3b82f6'
    },
    {
      id: 'favorites',
      label: 'Favorites',
      value: profileData?.favorite_vendors_count || 0,
      icon: <Heart size={16} />,
      color: '#ef4444'
    }
  ];

  if (loading) {
    return (
      <div className="userprofile-loading">
        <div className="userprofile-loading-spinner">
          <RefreshCw className="userprofile-animate-spin" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="userprofile-container">
      {/* Header */}
      <header className="userprofile-header">
        <div className="userprofile-header-left">
          <button 
            className="userprofile-back-btn"
            onClick={() => navigate(-1)}
          >
            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <h1 className="userprofile-header-title">My Profile</h1>
        </div>
        
        <div className="userprofile-header-right">
          {!editMode ? (
            <button 
              className="userprofile-edit-btn"
              onClick={handleEdit}
            >
              <Edit2 size={16} />
              <span>Edit</span>
            </button>
          ) : (
            <div className="userprofile-edit-actions">
              <button 
                className="userprofile-save-btn"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <RefreshCw size={14} className="userprofile-spinning" />
                ) : (
                  <Save size={14} />
                )}
                <span>Save</span>
              </button>
              <button 
                className="userprofile-cancel-btn"
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

      {/* Save Success Notification */}
      {saveSuccess && (
        <div className="userprofile-success-notification">
          <CheckCircle size={16} />
          <span>Profile updated successfully!</span>
        </div>
      )}

      {/* Profile Header Section */}
      <section className="userprofile-header-section">
        <div className="userprofile-cover-photo">
          <div className="userprofile-cover-overlay"></div>
        </div>
        
        <div className="userprofile-profile-info">
          <div className="userprofile-avatar-wrapper">
            <div className="userprofile-avatar-container">
              {imagePreview ? (
                <img 
                  src={imagePreview} 
                  alt={formData.name || 'User'} 
                  className="userprofile-avatar"
                />
              ) : (
                <div className="userprofile-avatar-placeholder">
                  {formData.name?.charAt(0) || 'U'}
                </div>
              )}
              
              {editMode && (
                <div className="userprofile-avatar-actions">
                  <label className="userprofile-upload-btn">
                    <Camera size={14} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageSelect}
                      disabled={uploadingImage}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {imagePreview && (
                    <button 
                      className="userprofile-remove-btn"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
              
              {uploadingImage && (
                <div className="userprofile-uploading">
                  <RefreshCw size={16} className="userprofile-spinning" />
                </div>
              )}
            </div>
          </div>

          <div className="userprofile-name-section">
            {editMode ? (
              <input
                type="text"
                name="name"
                value={formData.name || ''}
                onChange={handleInputChange}
                className="userprofile-name-input"
                placeholder="Your name"
              />
            ) : (
              <h2 className="userprofile-name">{profileData?.name}</h2>
            )}
            
            <div className="userprofile-badge-container">
              {profileData?.is_active && (
                <span className="userprofile-active-badge">
                  <CheckCircle size={12} />
                  Active
                </span>
              )}
              <span className="userprofile-role-badge">
                {profileData?.user_type === 'vendor' ? 'Vendor' : 'User'}
              </span>
            </div>

            <div className="userprofile-userid">
              <span className="userprofile-userid-label">User ID:</span>
              <code className="userprofile-userid-code">
                {profileData?.firebase_uid?.slice(0, 12)}...
              </code>
              <button 
                className="userprofile-copy-btn"
                onClick={handleCopyUserId}
              >
                {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          <div className="userprofile-actions">
            <button 
              className={`userprofile-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={14} />
              Profile
            </button>
            <button 
              className={`userprofile-tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              <Package size={14} />
              Stats
            </button>
            <button 
              className={`userprofile-tab-btn ${activeTab === 'location' ? 'active' : ''}`}
              onClick={() => setActiveTab('location')}
            >
              <MapPin size={14} />
              Location
            </button>
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <section className="userprofile-stats-section">
        <div className="userprofile-stats-grid">
          {statsCards.map(stat => (
            <div key={stat.id} className="userprofile-stat-card">
              <div className="userprofile-stat-icon" style={{ background: `${stat.color}10`, color: stat.color }}>
                {stat.icon}
              </div>
              <div className="userprofile-stat-content">
                <div className="userprofile-stat-value">{stat.value}</div>
                <div className="userprofile-stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tab Content */}
      <section className="userprofile-content-section">
        {activeTab === 'profile' && (
          <div className="userprofile-tab-content">
            {/* Personal Information */}
            <div className="userprofile-info-card">
              <h3 className="userprofile-card-title">Personal Information</h3>
              
              <div className="userprofile-info-grid">
                <div className="userprofile-info-item full-width">
                  <div className="userprofile-info-label">
                    <Mail size={12} />
                    <span>Email</span>
                  </div>
                  <div className="userprofile-info-value">{profileData?.email}</div>
                </div>

                <div className="userprofile-info-item full-width">
                  <div className="userprofile-info-label">
                    <Phone size={12} />
                    <span>Phone</span>
                  </div>
                  {editMode ? (
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone || ''}
                      onChange={handleInputChange}
                      className="userprofile-info-input"
                      placeholder="+234 XXX XXX XXXX"
                    />
                  ) : (
                    <div className="userprofile-info-value">{profileData?.phone || 'Not set'}</div>
                  )}
                </div>

                <div className="userprofile-info-item full-width">
                  <div className="userprofile-info-label">
                    <Calendar size={12} />
                    <span>Member Since</span>
                  </div>
                  <div className="userprofile-info-value">{formatDate(profileData?.created_at)}</div>
                </div>

                <div className="userprofile-info-item full-width">
                  <div className="userprofile-info-label">
                    <Clock size={12} />
                    <span>Last Seen</span>
                  </div>
                  <div className="userprofile-info-value">{formatDate(profileData?.last_seen)}</div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="userprofile-info-card">
              <h3 className="userprofile-card-title">Account Information</h3>
              
              <div className="userprofile-info-grid">
                <div className="userprofile-info-item">
                  <div className="userprofile-info-label">
                    <Shield size={12} />
                    <span>Account Type</span>
                  </div>
                  <div className="userprofile-info-value">
                    {profileData?.user_type === 'vendor' ? 'Vendor Account' : 'Buyer Account'}
                  </div>
                </div>

                <div className="userprofile-info-item">
                  <div className="userprofile-info-label">
                    <CheckCircle size={12} />
                    <span>Status</span>
                  </div>
                  <div className="userprofile-info-value">
                    {profileData?.is_active ? (
                      <span className="userprofile-status-active">Active</span>
                    ) : (
                      <span className="userprofile-status-inactive">Inactive</span>
                    )}
                  </div>
                </div>

                <div className="userprofile-info-item">
                  <div className="userprofile-info-label">
                    <Award size={12} />
                    <span>User ID</span>
                  </div>
                  <div className="userprofile-info-value userprofile-id-value">
                    <code>{profileData?.firebase_uid}</code>
                  </div>
                </div>

                <div className="userprofile-info-item">
                  <div className="userprofile-info-label">
                    <TrendingUp size={12} />
                    <span>Level</span>
                  </div>
                  <div className="userprofile-info-value">
                    {profileData?.level?.toFixed(1) || '0.0'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="userprofile-tab-content">
            {/* Order Statistics */}
            <div className="userprofile-stats-detailed">
              <div className="userprofile-stat-detailed-card">
                <div className="userprofile-stat-detailed-header">
                  <Package size={16} color="#9B4819" />
                  <h4>Order Statistics</h4>
                </div>
                <div className="userprofile-stat-detailed-grid">
                  <div className="userprofile-stat-detailed-item">
                    <span className="userprofile-stat-detailed-label">Total Orders</span>
                    <span className="userprofile-stat-detailed-value">{profileData?.total_orders || 0}</span>
                  </div>
                  <div className="userprofile-stat-detailed-item">
                    <span className="userprofile-stat-detailed-label">Pending Orders</span>
                    <span className="userprofile-stat-detailed-value">{profileData?.pending_orders_count || 0}</span>
                  </div>
                  <div className="userprofile-stat-detailed-item">
                    <span className="userprofile-stat-detailed-label">Completed Orders</span>
                    <span className="userprofile-stat-detailed-value">{profileData?.completed_orders_count || 0}</span>
                  </div>
                </div>
              </div>

              {/* Financial Statistics */}
              <div className="userprofile-stat-detailed-card">
                <div className="userprofile-stat-detailed-header">
                  <ShoppingBag size={16} color="#10b981" />
                  <h4>Financial Statistics</h4>
                </div>
                <div className="userprofile-stat-detailed-grid">
                  <div className="userprofile-stat-detailed-item">
                    <span className="userprofile-stat-detailed-label">Available Balance</span>
                    <span className="userprofile-stat-detailed-value">{formatCurrency(profileData?.balance || 0)}</span>
                  </div>
                  <div className="userprofile-stat-detailed-item">
                    <span className="userprofile-stat-detailed-label">Total Spent</span>
                    <span className="userprofile-stat-detailed-value">{formatCurrency(profileData?.total_spent || 0)}</span>
                  </div>
                  <div className="userprofile-stat-detailed-item">
                    <span className="userprofile-stat-detailed-label">Total Deposits</span>
                    <span className="userprofile-stat-detailed-value">{formatCurrency(profileData?.total_deposits || 0)}</span>
                  </div>
                  {profileData?.last_deposit_date && (
                    <div className="userprofile-stat-detailed-item">
                      <span className="userprofile-stat-detailed-label">Last Deposit</span>
                      <span className="userprofile-stat-detailed-value">{formatDate(profileData.last_deposit_date)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Engagement Statistics */}
              <div className="userprofile-stat-detailed-card">
                <div className="userprofile-stat-detailed-header">
                  <Heart size={16} color="#ef4444" />
                  <h4>Engagement</h4>
                </div>
                <div className="userprofile-stat-detailed-grid">
                  <div className="userprofile-stat-detailed-item">
                    <span className="userprofile-stat-detailed-label">Favorite Vendors</span>
                    <span className="userprofile-stat-detailed-value">{profileData?.favorite_vendors_count || 0}</span>
                  </div>
                  <div className="userprofile-stat-detailed-item">
                    <span className="userprofile-stat-detailed-label">Level</span>
                    <span className="userprofile-stat-detailed-value">{profileData?.level?.toFixed(1) || '0.0'}</span>
                  </div>
                  <div className="userprofile-stat-detailed-item">
                    <span className="userprofile-stat-detailed-label">Member Since</span>
                    <span className="userprofile-stat-detailed-value">
                      {profileData?.created_at ? 
                        Math.floor((new Date().getTime() - new Date(profileData.created_at).getTime()) / (1000 * 3600 * 24)) : 0
                      } days
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'location' && (
          <div className="userprofile-tab-content">
            {/* Current Location */}
            <div className="userprofile-info-card">
              <div className="userprofile-location-header">
                <h3 className="userprofile-card-title">Delivery Locations</h3>
                <button 
                  className="userprofile-add-location-btn"
                  onClick={handleAddLocation}
                >
                  <Plus size={14} />
                  Add Location
                </button>
              </div>
              
              {selectedLocation && (
                <div className="userprofile-current-location">
                  <div className="userprofile-location-badge">Active</div>
                  <div className="userprofile-location-details">
                    <MapPinned size={16} color="#9B4819" />
                    <span>{formatFullLocation(selectedLocation)}</span>
                  </div>
                </div>
              )}

              {/* All Locations */}
              <div className="userprofile-locations-list">
                {locations.length === 0 ? (
                  <div className="userprofile-empty-locations">
                    <MapPin size={24} />
                    <p>No delivery locations added yet</p>
                  </div>
                ) : (
                  locations.map(location => (
                    <div key={location.id} className="userprofile-location-item">
                      <div className="userprofile-location-item-main">
                        <div className="userprofile-location-item-icon">
                          <MapPin size={14} color={location.is_active ? '#9B4819' : '#999'} />
                        </div>
                        <div className="userprofile-location-item-info">
                          <div className="userprofile-location-item-address">
                            {formatFullLocation(location)}
                          </div>
                          <div className="userprofile-location-item-meta">
                            Last used: {formatDate(location.last_used)}
                          </div>
                        </div>
                        {location.is_active ? (
                          <span className="userprofile-location-active-badge">Active</span>
                        ) : (
                          <button 
                            className="userprofile-location-set-active"
                            onClick={() => handleSetActiveLocation(location)}
                          >
                            Set Active
                          </button>
                        )}
                      </div>
                      <div className="userprofile-location-item-actions">
                        <button 
                          className="userprofile-location-action-btn edit"
                          onClick={() => handleEditLocation(location)}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          className="userprofile-location-action-btn delete"
                          onClick={() => handleDeleteLocation(location.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Delete Image Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="userprofile-modal-overlay">
          <div className="userprofile-confirm-modal">
            <div className="userprofile-confirm-header">
              <AlertTriangle size={16} color="#f59e0b" />
              <h3>Remove Profile Image</h3>
              <button onClick={() => setShowDeleteConfirm(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="userprofile-confirm-body">
              <p>Are you sure you want to remove your profile image?</p>
            </div>
            <div className="userprofile-confirm-actions">
              <button 
                className="userprofile-confirm-btn no"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="userprofile-confirm-btn yes"
                onClick={handleRemoveImage}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <div className="userprofile-modal-overlay">
          <div className="userprofile-location-modal">
            <div className="userprofile-location-modal-header">
              <MapPin size={16} color="#9B4819" />
              <h3>{editingLocation.id ? 'Edit Location' : 'Add New Location'}</h3>
              <button onClick={() => setShowLocationModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="userprofile-location-modal-body">
              <div className="userprofile-location-form">
                {/* State Selection */}
                <div className="userprofile-form-group">
                  <label>State</label>
                  <select
                    value={editingLocation.state_id || ''}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="userprofile-location-select"
                  >
                    <option value="">Select State</option>
                    {states.map(state => (
                      <option key={state.id} value={state.id}>{state.name}</option>
                    ))}
                  </select>
                </div>

                {/* University Selection */}
                {editingLocation.state_id && (
                  <div className="userprofile-form-group">
                    <label>University</label>
                    <select
                      value={editingLocation.university_id || ''}
                      onChange={(e) => handleUniversityChange(e.target.value)}
                      className="userprofile-location-select"
                      disabled={loadingLocations}
                    >
                      <option value="">Select University</option>
                      {universities.map(uni => (
                        <option key={uni.id} value={uni.id}>{uni.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Campus Selection */}
                {editingLocation.university_id && (
                  <div className="userprofile-form-group">
                    <label>Campus</label>
                    <select
                      value={editingLocation.campus_id || ''}
                      onChange={(e) => setEditingLocation({
                        ...editingLocation,
                        campus_id: parseInt(e.target.value)
                      })}
                      className="userprofile-location-select"
                      disabled={loadingLocations}
                    >
                      <option value="">Select Campus</option>
                      {campuses.map(campus => (
                        <option key={campus.id} value={campus.id}>{campus.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Precise Location */}
                <div className="userprofile-form-group">
                  <label>Precise Location <span className="required">*</span></label>
                  <textarea
                    value={editingLocation.precise_location || ''}
                    onChange={(e) => setEditingLocation({
                      ...editingLocation,
                      precise_location: e.target.value
                    })}
                    placeholder="Enter your specific address, building name, room number, or landmark"
                    rows={3}
                    className="userprofile-location-textarea"
                  />
                </div>

                <p className="userprofile-location-hint">
                  <Info size={12} />
                  Be as specific as possible for accurate delivery
                </p>

                {/* Location Preview */}
                {(editingLocation.state_id || editingLocation.university_id || editingLocation.campus_id || editingLocation.precise_location) && (
                  <div className="userprofile-location-preview">
                    <h4>Location Preview:</h4>
                    <div className="userprofile-preview-text">
                      {[
                        states.find(s => s.id === editingLocation.state_id)?.name,
                        universities.find(u => u.id === editingLocation.university_id)?.name,
                        campuses.find(c => c.id === editingLocation.campus_id)?.name,
                        editingLocation.precise_location
                      ].filter(Boolean).join(' > ')}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="userprofile-location-modal-footer">
              <button 
                className="userprofile-location-modal-btn cancel"
                onClick={() => setShowLocationModal(false)}
              >
                Cancel
              </button>
              <button 
                className="userprofile-location-modal-btn save"
                onClick={handleSaveLocation}
                disabled={!editingLocation.precise_location?.trim()}
              >
                Save Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;