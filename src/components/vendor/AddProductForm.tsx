import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { supabase } from '../../lib/supabaseClient';
import imageCompression from 'browser-image-compression';
import logo from '../../assets/images/logo.png';

interface Campus {
  id: number;
  name: string;
  city: string;
  full_address: string;
  university: {
    name: string;
    abbreviation: string;
  };
  state: {
    name: string;
  };
}

interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
}

interface VendorBusiness {
  id: string;
  shopName: string;
  profileImage: string;
  coverImage?: string;
  isActive: boolean;
  userId: string;
  bio?: string;
  shopId?: string;
  contactPhone?: string;
  businessEmail?: string;
  location?: string;
  shippingPolicy?: string;
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
}

const AddProductForm: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    inventory: '1'
  });
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedCampuses, setSelectedCampuses] = useState<Campus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [campusSuggestions, setCampusSuggestions] = useState<Campus[]>([]);
  const [recentCampuses, setRecentCampuses] = useState<Campus[]>([]);
  const [recentCategories, setRecentCategories] = useState<Category[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productImages, setProductImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [vendorBusinesses, setVendorBusinesses] = useState<VendorBusiness[]>([]);
  const [selectedShop, setSelectedShop] = useState<VendorBusiness | null>(null);
  const [searching, setSearching] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [selectAllLocations, setSelectAllLocations] = useState(false);
  
  const navigate = useNavigate();
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setShowLocationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Check Firebase authentication and fetch user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserData(user.uid);
        await fetchVendorBusinesses(user.uid);
        await fetchCategories();
      } else {
        setUserProfile(null);
        setVendorBusinesses([]);
        setSelectedShop(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Set first shop as selected when businesses are loaded
  useEffect(() => {
    if (vendorBusinesses.length > 0 && !selectedShop) {
      setSelectedShop(vendorBusinesses[0]);
    }
  }, [vendorBusinesses, selectedShop]);

  // Fetch recent data when shop is selected
  useEffect(() => {
    if (selectedShop && currentUser) {
      fetchRecentData();
    }
  }, [selectedShop, currentUser]);

  useEffect(() => {
    const fetchAllCampuses = async () => {
      try {
        const { data: campuses, error } = await supabase
          .from('campuses')
          .select(`
            id,
            name,
            city,
            full_address,
            universities!inner(name, abbreviation),
            states!inner(name)
          `)
          .order('universities(name)');

        if (error) {
          console.error('Error fetching campuses:', error);
          return;
        }

        const transformedCampuses: Campus[] = (campuses || []).map((campus: any) => ({
          id: campus.id,
          name: campus.name,
          city: campus.city,
          full_address: campus.full_address,
          university: {
            name: campus.universities.name,
            abbreviation: campus.universities.abbreviation
          },
          state: {
            name: campus.states.name
          }
        }));

        setAllCampuses(transformedCampuses);
      } catch (error) {
        console.error('Error fetching campuses:', error);
      }
    };

    fetchAllCampuses();
  }, []);

  const fetchUserData = async (userId: string) => {
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
          profileImage: userData.profileImage || ''
        };
        setUserProfile(profile);
      } else {
        // Fallback to auth user data
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
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchVendorBusinesses = async (userId: string) => {
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
          coverImage: data.coverImage || '', 
          isActive: data.isActive || false,
          userId: data.userId || ''
        };
      });

      setVendorBusinesses(businesses);
      
      if (businesses.length === 0) {
        setError('No active shops found. Please create a shop first.');
      }
    } catch (error) {
      console.error('Error fetching vendor businesses:', error);
      setError('Error loading your shops. Please try again.');
    }
  };

  const fetchCategories = async () => {
    try {
      const { data: categories, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching categories:', error);
        return;
      }

      if (categories) {
        setCategories(categories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchRecentData = async () => {
    if (!selectedShop || !currentUser) return;

    try {
      // For now, we'll set empty recent data
      // In production, you would fetch actual recent data from your database
      setRecentCategories([]);
      setRecentCampuses([]);
    } catch (error) {
      console.error('Error fetching recent data:', error);
    }
  };

  const searchCampuses = (query: string) => {
    const lowercaseQuery = query.toLowerCase().trim();
    
    setSearching(true);
    
    setTimeout(() => {
      if (lowercaseQuery === '') {
        const sortedCampuses = [...allCampuses].sort((a, b) => 
          a.university.name.localeCompare(b.university.name)
        );
        setCampusSuggestions(sortedCampuses.slice(0, 15));
        setSearching(false);
        return;
      }

      const filteredCampuses = allCampuses.filter(campus => {
        const universityName = campus.university.name.toLowerCase();
        return universityName.includes(lowercaseQuery);
      });

      const sortedCampuses = filteredCampuses.sort((a, b) => {
        const aName = a.university.name.toLowerCase();
        const bName = b.university.name.toLowerCase();
        
        const aStartsWith = aName.startsWith(lowercaseQuery);
        const bStartsWith = bName.startsWith(lowercaseQuery);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        return aName.localeCompare(bName);
      });

      setCampusSuggestions(sortedCampuses.slice(0, 12));
      setSearching(false);
    }, 150);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchCampuses(query);
  };

  const handleSearchFocus = () => {
    if (searchQuery === '' && allCampuses.length > 0) {
      const sortedCampuses = [...allCampuses].sort((a, b) => 
        a.university.name.localeCompare(b.university.name)
      );
      setCampusSuggestions(sortedCampuses.slice(0, 15));
    }
  };

  const handleCampusSelect = (campus: Campus) => {
    const isAlreadySelected = selectedCampuses.find(c => c.id === campus.id);
    
    if (isAlreadySelected) {
      // Remove from selected
      setSelectedCampuses(prev => prev.filter(c => c.id !== campus.id));
    } else {
      // Add to selected
      setSelectedCampuses(prev => [...prev, campus]);
    }
  };

  const handleSelectAllLocations = () => {
    if (window.confirm('Are you able to deliver to anywhere in Nigeria?')) {
      setSelectAllLocations(true);
      setSelectedCampuses([]); // Clear individual selections when "ALL" is selected
      setShowLocationDropdown(false);
    }
  };

  const handleDeselectAllLocations = () => {
    setSelectAllLocations(false);
  };

  const removeCampus = (campusId: number) => {
    setSelectedCampuses(prev => prev.filter(campus => campus.id !== campusId));
  };

  const handleCategorySelect = (categoryId: number) => {
    setSelectedCategory(categoryId);
    setShowCategoryDropdown(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 800,
      useWebWorker: true,
    };
    return await imageCompression(file, options);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (productImages.length + files.length > 7) {
      setError('Maximum 7 images allowed');
      return;
    }

    for (const file of files) {
      try {
        const compressedFile = await compressImage(file);
        const previewUrl = URL.createObjectURL(compressedFile);
        
        setProductImages(prev => [...prev, compressedFile]);
        setImagePreviews(prev => [...prev, previewUrl]);
      } catch (error) {
        console.error('Error compressing image:', error);
        setError('Failed to compress image. Please try another image.');
      }
    }
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setProductImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadProductImages = async (userId: string): Promise<string[]> => {
    const imageUrls: string[] = [];
    
    for (let i = 0; i < productImages.length; i++) {
      const file = productImages[i];
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${userId}/products/${Date.now()}-${i}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading product image:', error);
        throw new Error(`Failed to upload image: ${error.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      imageUrls.push(publicUrl);
    }
    
    return imageUrls;
  };

////////////////////////////////
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setSuccess('');
  setLoading(true);

  try {
    // Authentication and shop validation
    if (!currentUser) throw new Error('You must be logged in to add products.');
    if (!selectedShop) throw new Error('Please select a shop to add products to.');

    // Form validation
    if (!formData.title.trim()) throw new Error('Product title is required');
    if (!formData.price || parseFloat(formData.price) <= 0) throw new Error('Valid price is required');
    if (!selectedCategory) throw new Error('Please select a category');
    if (productImages.length === 0) throw new Error('At least one product image is required');
    if (selectedCampuses.length === 0 && !selectAllLocations) throw new Error('Please add at least one delivery location');

    // Step 1: Check if vendor profile exists with BOTH user_id AND vendor_id
    const shopId = selectedShop.id;
    console.log('Checking vendor profile for user_id:', currentUser.uid, 'and vendor_id:', shopId);
    
    const { data: existingVendorProfile, error: vendorProfileCheckError } = await supabase
      .from('vendor_profiles')
      .select('id, vendor_id, shop_name, total_products')
      .eq('user_id', currentUser.uid)
      .eq('vendor_id', shopId)
      .single();

    let vendorProfileId: string | undefined;

    if (vendorProfileCheckError && vendorProfileCheckError.code === 'PGRST116') {
      // Create new vendor profile using Firebase shop data
      console.log('Creating new vendor profile for shop:', selectedShop.shopName);
      const { data: newVendorProfile, error: createVendorProfileError } = await supabase
        .from('vendor_profiles')
        .insert([{
          user_id: currentUser.uid, // Firebase user ID (owner)
          vendor_id: shopId, // Firebase shop ID as unique identifier
          shop_name: selectedShop.shopName,
          profile_image: selectedShop.profileImage || '',
          cover_image: selectedShop.coverImage || '', 
          bio: selectedShop.bio || '',
          is_active: true,
          onboarding_completed: true,
          total_products: 0
        }])
        .select()
        .single();

      if (createVendorProfileError) {
        console.error('Vendor profile creation error:', createVendorProfileError);
        // Continue with product upload even if vendor creation fails
        console.log('Continuing with product upload despite vendor profile error');
      } else if (newVendorProfile) {
        vendorProfileId = newVendorProfile.id;
        console.log('Created new vendor profile with vendor_id:', newVendorProfile.vendor_id);
      }
    }
    
    else if (vendorProfileCheckError) {
      console.error('Vendor profile lookup error:', vendorProfileCheckError);
      // Continue with product upload despite lookup error
      console.log('Continuing with product upload despite vendor lookup error');
    } else {
      vendorProfileId = existingVendorProfile.id;
      console.log('Found existing vendor profile with vendor_id:', existingVendorProfile.vendor_id);
    }

    // Step 2: Upload product images to Supabase Storage
    console.log('Uploading product images...');
    const imageUrls = await uploadProductImages(currentUser.uid);
    console.log('Product images uploaded:', imageUrls);

    // Step 3: Generate UNIQUE URL-friendly slug from title
    const baseSlug = formData.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 90);

    // Check if slug exists and generate unique one
    let finalSlug = baseSlug;
    let slugCounter = 1;
    
    while (slugCounter < 10) {
      const { data: existingSlug } = await supabase
        .from('products')
        .select('slug')
        .eq('slug', finalSlug)
        .single();

      if (!existingSlug) break;
      
      finalSlug = `${baseSlug}-${slugCounter}`;
      slugCounter++;
    }

    if (slugCounter >= 10) {
      finalSlug = `${baseSlug}-${Date.now()}`;
    }

    console.log('Using unique slug:', finalSlug);

    // Step 4: Insert product into products table
    console.log('Inserting product into database...');
    const productData = {
      vendor_id: shopId,
      user_id: currentUser.uid,
      title: formData.title.trim(),
      slug: finalSlug,
      description: formData.description.trim(),
      price: parseFloat(formData.price),
      currency: 'NGN',
      images: imageUrls,
      inventory: parseInt(formData.inventory) || 1,
      is_active: true,
      vendor_name: selectedShop.shopName,
      condition: 'new',
      category: categories.find(c => c.id === selectedCategory)?.name || ''
    };

    console.log('Product data to insert:', productData);

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (productError) {
      console.error('Product insertion error:', productError);
      throw new Error(`Failed to create product: ${productError.message}`);
    }

    if (!product) throw new Error('Failed to create product: No data returned');

    console.log('Product created successfully with ID:', product.id);

    // Step 5: Add product to category
    console.log('Adding product to category:', selectedCategory);
    const { error: categoryError } = await supabase
      .from('product_categories')
      .insert([{
        product_id: product.id,
        category_id: selectedCategory
      }]);

    if (categoryError) {
      console.error('Category assignment error:', categoryError);
      throw new Error('Failed to assign product category');
    }

    // Step 6: Add delivery locations
    console.log('Adding delivery locations...');
    const deliveryLocations = selectedCampuses.map(campus => ({
      product_id: product.id,
      campus_id: campus.id
    }));

    if (deliveryLocations.length > 0) {
      const { error: locationError } = await supabase
        .from('product_delivery_locations')
        .insert(deliveryLocations);

      if (locationError) {
        console.error('Delivery locations error:', locationError);
        throw new Error('Failed to add delivery locations');
      }
      console.log(`Added ${deliveryLocations.length} delivery locations`);
    }

    // Step 7: Update vendor profile product count if vendor exists
    if (vendorProfileId) {
      const { error: updateVendorError } = await supabase
        .from('vendor_profiles')
        .update({ 
          total_products: (existingVendorProfile?.total_products || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', vendorProfileId);

      if (updateVendorError) console.warn('Could not update vendor product count:', updateVendorError);
    }

    /////////////////////////////////////////
    // Step 8: Update vendor preferences based on product data
console.log('Updating vendor preferences...');

// Add to vendor_categories if not exists
const { error: vendorCategoryError } = await supabase
  .from('vendor_categories')
  .upsert([{
    vendor_id: vendorProfileId, // Use the vendor_profile ID (bigint)
    category_id: selectedCategory
  }], {
    onConflict: 'vendor_id,category_id',
    ignoreDuplicates: true
  });

if (vendorCategoryError) console.warn('Could not update vendor categories:', vendorCategoryError);

// Add to vendor_delivery_locations if not exists
const vendorDeliveryLocations = selectedCampuses.map(campus => ({
  vendor_id: vendorProfileId, // Use the vendor_profile ID (bigint)
  campus_id: campus.id,
  delivery_fee: 0, // Default value
  delivery_radius_m: null // Default value
}));

if (vendorDeliveryLocations.length > 0) {
  const { error: vendorLocationError } = await supabase
    .from('vendor_delivery_locations')
    .upsert(vendorDeliveryLocations, {
      onConflict: 'vendor_id,campus_id',
      ignoreDuplicates: true
    });

  if (vendorLocationError) console.warn('Could not update vendor delivery locations:', vendorLocationError);
}

console.log('Vendor preferences updated successfully');
/////////////////////////////////////

    // Success - update UI and reset form
    setSuccess('🎉 Product created successfully!');
    
    // Reset form state
    setFormData({
      title: '',
      description: '',
      price: '',
      inventory: '1'
    });
    setSelectedCategory(null);
    setSelectedCampuses([]);
    setSelectAllLocations(false);
    setProductImages([]);
    
    // Clean up image preview URLs
    imagePreviews.forEach(preview => URL.revokeObjectURL(preview));
    setImagePreviews([]);
    
    setSearchQuery('');
    setShowCategoryDropdown(false);
    setShowLocationDropdown(false);

    console.log('Product creation completed successfully');

  } catch (error: any) {
    console.error('Product creation error:', error);
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
/////////////////////////////////////

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      const dataTransfer = new DataTransfer();
      imageFiles.forEach(file => dataTransfer.items.add(file));
      
      const inputEvent = {
        target: {
          files: dataTransfer.files
        }
      } as React.ChangeEvent<HTMLInputElement>;
      
      handleImageSelect(inputEvent);
    }
  };

  // Show login prompt if no user
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F4F1E8] flex flex-col justify-center py-12">
        <div className="max-w-md mx-auto text-center">
          <div className="flex justify-center mb-6">
            <img src={logo} alt="Campus GOSTOREz" className="h-24 w-auto" />
          </div>
          <h2 className="text-2xl font-bold text-[#9B4819] mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please log in to add products to your shop.</p>
          <button
            onClick={() => navigate('/signin')}
            className="w-full py-3 bg-[#9B4819] text-white rounded-xl font-semibold hover:bg-[#7a3914] transition duration-200"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Show shop creation required
  if (vendorBusinesses.length === 0 && currentUser) {
    return (
      <div className="min-h-screen bg-[#F4F1E8] flex flex-col justify-center py-12">
        <div className="max-w-md mx-auto text-center">
          <div className="flex justify-center mb-6">
            <img src={logo} alt="Campus GOSTOREz" className="h-24 w-auto" />
          </div>
          <h2 className="text-2xl font-bold text-[#9B4819] mb-4">Shop Required</h2>
          <p className="text-gray-600 mb-6">You need to create a shop before adding products.</p>
          <div className="space-y-4">
            <button
              onClick={() => navigate('/vendor-onboarding')}
              className="w-full py-3 bg-[#9B4819] text-white rounded-xl font-semibold hover:bg-[#7a3914] transition duration-200"
            >
              Create Your Shop
            </button>
            <button
              onClick={() => navigate('/vendor/dashboard')}
              className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition duration-200"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F1E8] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Shop Logo and Close Button */}
        <div className="text-center mb-8 relative">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-3 shadow-lg hover:bg-gray-50 transition duration-200"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          
          <div className="flex items-center justify-center space-x-4 mb-4">
            {selectedShop?.profileImage && (
              <div className="w-16 h-16 rounded-full border-4 border-white shadow-lg overflow-hidden">
                <img 
                  src={selectedShop.profileImage} 
                  alt={selectedShop.shopName}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <img 
              src={logo} 
              alt="Campus GOSTOREz" 
              className="h-20 w-auto"
            />
          </div>
          
          <h1 className="text-3xl font-bold text-[#9B4819]">Add New Product</h1>
          <p className="text-gray-600 mt-2">List your product and start selling</p>
          
          {/* User Info and Shop Selection */}
          <div className="mt-6 bg-white rounded-xl p-4 shadow-sm border border-gray-200 max-w-md mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#9B4819] rounded-full flex items-center justify-center">
                  {userProfile?.profileImage ? (
                    <img 
                      src={userProfile.profileImage} 
                      alt="Profile" 
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <span className="text-white font-semibold text-sm">
                      {userProfile?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-sm">
                    {userProfile?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate max-w-[150px]">
                    {userProfile?.email}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600">Logged in</p>
                <p className="text-xs text-[#9B4819] font-medium">✓ Active</p>
              </div>
            </div>

            {/* Shop Selection */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">Shop:</span>
                {selectedShop && (
                  <span className="text-sm font-semibold text-[#9B4819]">
                    {selectedShop.shopName}
                  </span>
                )}
              </div>
              {vendorBusinesses.length > 1 && (
                <select
                  value={selectedShop?.id || ''}
                  onChange={(e) => {
                    const shop = vendorBusinesses.find(s => s.id === e.target.value);
                    if (shop) setSelectedShop(shop);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#9B4819] text-xs"
                >
                  {vendorBusinesses.map(shop => (
                    <option key={shop.id} value={shop.id}>
                      {shop.shopName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Uploading product as <span className="font-semibold text-[#9B4819]">{selectedShop?.shopName}</span>
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-8">
            {/* Product Title */}
            <div className="mb-8">
              <label htmlFor="title" className="block text-lg font-semibold text-gray-800 mb-3">
                Product Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-200"
                placeholder="e.g., Vintage Denim Jacket, Handmade Leather Bag..."
                maxLength={200}
              />
              <p className="text-sm text-gray-500 mt-2">
                {formData.title.length}/200 characters
              </p>
            </div>

            {/* Category Selection */}
            <div className="mb-8" ref={categoryDropdownRef}>
              <label className="block text-lg font-semibold text-gray-800 mb-3">
                Category
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className={`w-full px-4 py-4 text-lg border-2 rounded-xl text-left transition duration-200 ${
                    selectedCategory 
                      ? 'border-[#9B4819] bg-[#FDF8F3] text-[#9B4819]' 
                      : 'border-gray-200 bg-white text-gray-700'
                  } focus:outline-none focus:ring-2 focus:ring-[#9B4819] focus:border-[#9B4819]`}
                >
                  {selectedCategory 
                    ? categories.find(c => c.id === selectedCategory)?.name 
                    : 'Select a category'}
                  <svg 
                    className={`absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-transform duration-200 ${
                      showCategoryDropdown ? 'rotate-180' : ''
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Category Dropdown */}
                {showCategoryDropdown && (
                  <div className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
                    <div className="p-2">
                      {/* Recent Categories */}
                      {recentCategories.length > 0 && (
                        <div className="mb-2">
                          <div className="px-3 py-2 text-sm font-semibold text-gray-500 bg-gray-50 rounded-lg flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                            Recently Used
                          </div>
                          {recentCategories.map(category => (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => handleCategorySelect(category.id)}
                              className={`w-full p-3 text-left rounded-lg transition duration-200 text-sm flex items-center ${
                                selectedCategory === category.id
                                  ? 'bg-[#9B4819] text-white'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <div className="font-medium">{category.name}</div>
                            </button>
                          ))}
                          <div className="border-t border-gray-200 my-2"></div>
                        </div>
                      )}
                      
                      {/* All Categories */}
                      <div className="px-3 py-2 text-sm font-semibold text-gray-500 bg-gray-50 rounded-lg mb-2">
                        All Categories
                      </div>
                      {categories.map(category => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => handleCategorySelect(category.id)}
                          className={`w-full p-3 text-left rounded-lg transition duration-200 text-sm ${
                            selectedCategory === category.id
                              ? 'bg-[#9B4819] text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          } ${recentCategories.find(rc => rc.id === category.id) ? 'hidden' : ''}`}
                        >
                          <div className="font-medium">{category.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {selectedCategory && (
                <p className="mt-3 text-sm text-green-600">
                  Selected: <strong>{categories.find(c => c.id === selectedCategory)?.name}</strong>
                </p>
              )}
            </div>

            {/* Description */}
            <div className="mb-8">
              <label htmlFor="description" className="block text-lg font-semibold text-gray-800 mb-3">
                Product Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-200 resize-none"
                placeholder="Describe your product features, condition, size, materials..."
              />
            </div>

            {/* Price & Stock */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <label htmlFor="price" className="block text-lg font-semibold text-gray-800 mb-3">
                  Price (NGN)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">₦</span>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    required
                    value={formData.price}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-200"
                    placeholder="0"
                    min="1"
                    step="0.01"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="inventory" className="block text-lg font-semibold text-gray-800 mb-3">
                  Stock Quantity
                </label>
                <input
                  id="inventory"
                  name="inventory"
                  type="number"
                  required
                  value={formData.inventory}
                  onChange={handleChange}
                  className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-200"
                    placeholder="0"
                    min="1"
                />
              </div>
            </div>

            {/* Delivery Locations */}
            <div className="mb-8" ref={locationDropdownRef}>
              <label className="block text-lg font-semibold text-gray-800 mb-3">
                Delivery Locations
              </label>
              
              {/* Selected Locations Display */}
              <div className="mb-4">
                {selectAllLocations ? (
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                      <span className="font-semibold text-green-800">ALL LOCATIONS (Nigeria-wide delivery)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeselectAllLocations}
                      className="text-red-500 hover:text-red-700 transition duration-200 p-1"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : selectedCampuses.length > 0 ? (
                  <div className="space-y-3">
                    {selectedCampuses.map((campus) => (
                      <div key={campus.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex-1">
                          <div className="font-bold text-gray-900">
                            {campus.state.name} • {campus.university.name} • {campus.city} • {campus.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {campus.university.abbreviation} - {campus.full_address}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCampus(campus.id)}
                          className="ml-4 text-red-500 hover:text-red-700 transition duration-200 p-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No locations selected</p>
                )}
              </div>

              {/* Location Selection Interface */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                  className="w-full px-4 py-3 bg-[#9B4819] text-white rounded-xl font-semibold hover:bg-[#7a3914] transition duration-200"
                >
                  {selectAllLocations ? 'Change Delivery Locations' : 'Select Delivery Locations'}
                </button>

                {showLocationDropdown && (
                  <div className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-96 overflow-y-auto">
                    <div className="p-4">
                      {/* Header with Select All and Close */}
                      <div className="flex justify-between items-center mb-4">
                        <button
                          type="button"
                          onClick={handleSelectAllLocations}
                          className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition duration-200 flex items-center"
                        >
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Deliver to All Nigeria
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLocationDropdown(false)}
                          className="text-gray-500 hover:text-gray-700 transition duration-200 p-1"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Recent Locations */}
                      {recentCampuses.length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center text-sm font-semibold text-gray-500 mb-2">
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                            Recently Used Locations
                          </div>
                          <div className="space-y-2">
                            {recentCampuses.map((campus) => (
                              <label key={campus.id} className={`flex items-center p-3 rounded-lg cursor-pointer transition duration-200 ${
                                selectedCampuses.find(c => c.id === campus.id) 
                                  ? 'bg-blue-50 border border-blue-200' 
                                  : 'hover:bg-gray-50'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={!!selectedCampuses.find(c => c.id === campus.id)}
                                  onChange={() => handleCampusSelect(campus)}
                                  className="w-4 h-4 text-[#9B4819] rounded-full border-gray-300 focus:ring-[#9B4819]"
                                />
                                <div className="ml-3 flex-1">
                                  <div className="font-medium text-gray-900 text-sm">
                                    {campus.university.name} - {campus.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {campus.university.abbreviation}, {campus.city}, {campus.state.name}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                          <div className="border-t border-gray-200 my-3"></div>
                        </div>
                      )}

                      {/* Search and All Locations */}
                      <div className="mb-4">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={handleSearchChange}
                          onFocus={handleSearchFocus}
                          className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-200"
                          placeholder="Search universities by name..."
                        />
                      </div>

                      {/* Location List */}
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {campusSuggestions.map((campus) => (
                          <label key={campus.id} className={`flex items-center p-3 rounded-lg cursor-pointer transition duration-200 ${
                            selectedCampuses.find(c => c.id === campus.id) 
                              ? 'bg-blue-50 border border-blue-200' 
                              : 'hover:bg-gray-50'
                          }`}>
                            <input
                              type="checkbox"
                              checked={!!selectedCampuses.find(c => c.id === campus.id)}
                              onChange={() => handleCampusSelect(campus)}
                              className="w-4 h-4 text-[#9B4819] rounded-full border-gray-300 focus:ring-[#9B4819]"
                            />
                            <div className="ml-3 flex-1">
                              <div className="font-medium text-gray-900 text-sm">
                                {campus.university.name} - {campus.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                 {campus.university.abbreviation}, {campus.city}, {campus.state.name}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-500 mt-3">
                Select campuses where you can deliver this product. Students in these locations will be able to find your product.
              </p>
            </div>

            {/* Image Upload */}
            <div className="mb-8">
              <label className="block text-lg font-semibold text-gray-800 mb-3">
                Product Images ({productImages.length}/7)
              </label>
              
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageSelect}
                disabled={productImages.length >= 7 || loading}
                className="hidden"
                id="product-images"
              />
              
              <label 
                htmlFor="product-images"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`block border-3 border-dashed rounded-2xl p-12 text-center cursor-pointer transition duration-200 ${
                  productImages.length >= 7 
                    ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                    : 'border-gray-300 bg-gray-50 hover:border-[#9B4819] hover:bg-[#FDF8F3]'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex flex-col items-center">
                  <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" />
                  </svg>
                  <p className="text-xl font-semibold text-gray-700 mb-2">
                    {productImages.length >= 7 ? 'Maximum images reached' : 'Click or drag to upload'}
                  </p>
                  <p className="text-gray-500 mb-1">Upload up to 7 high-quality images</p>
                  <p className="text-sm text-gray-400">PNG, JPG, JPEG • Max 1MB each</p>
                </div>
              </label>

              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="mt-8">
                  <p className="text-lg font-semibold text-gray-800 mb-4">Image Previews</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square rounded-xl overflow-hidden border-2 border-gray-200">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          disabled={loading}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-op duration-200 shadow-lg hover:bg-red-600"
                        >
                          ×
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs py-1 text-center">
                          Image {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Success Display */}
            {success && (
              <div className="mb-8 rounded-xl bg-green-50 border border-green-200 p-6">
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-lg font-medium text-green-800">{success}</span>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-8 rounded-xl bg-red-50 border border-red-200 p-6">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center">
                    <svg className="w-6 h-6 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-lg font-medium text-red-800">{error}</span>
                  </div>
                  {error.includes('No active shops found') && (
                    <div className="flex space-x-4">
                      <button
                        onClick={() => navigate('/vendor-onboarding')}
                        className="px-4 py-2 bg-[#9B4819] text-white rounded-lg font-medium hover:bg-[#7a3914] transition duration-200"
                      >
                        Create Shop Now
                      </button>
                      <button
                        onClick={() => navigate('/vendor/dashboard')}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition duration-200"
                      >
                        Back to Dashboard
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose || (() => navigate('/vendor/dashboard'))}
                disabled={loading}
                className="flex-1 py-4 px-6 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold text-lg hover:bg-gray-50 disabled:opacity-50 transition duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedCategory || (selectedCampuses.length === 0 && !selectAllLocations)}
                className="flex-1 py-4 px-6 bg-[#9B4819] text-white rounded-xl font-semibold text-lg hover:bg-[#7a3914] disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    Creating Product...
                  </>
                ) : (
                  'Launch Product'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Help Text */}
        <div className="text-center mt-8">
          <p className="text-gray-600">
            Need help? <a href="mailto:support@campusgostorez.com" className="text-[#9B4819] hover:text-[#7a3914] font-semibold">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AddProductForm;