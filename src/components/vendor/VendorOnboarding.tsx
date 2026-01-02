import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import imageCompression from 'browser-image-compression';
import logo from '../../assets/images/logo.png';

const MAX_SHOPS_PER_USER = 2;

interface VendorFormData {
  shopName: string;
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
}

interface ShopCountInfo {
  currentCount: number;
  maxAllowed: number;
}

const VendorOnboarding: React.FC = () => {
  const [formData, setFormData] = useState<VendorFormData>({
    shopName: '',
    bio: '',
    location: '',
    contactPhone: '',
    businessEmail: '',
    website: '',
    instagramHandle: '',
    facebookPage: '',
    twitterHandle: '',
    businessHours: '',
    returnPolicy: '',
    shippingPolicy: ''
  });
  const [profileImage, setProfileImage] = useState<string>('');
  const [coverImage, setCoverImage] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userShopCount, setUserShopCount] = useState<ShopCountInfo>({ currentCount: 0, maxAllowed: MAX_SHOPS_PER_USER });
  const [checkingShopCount, setCheckingShopCount] = useState(true);
  const navigate = useNavigate();

  // Check authentication state and user's shop count
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await checkUserShopCount(user.uid);
        setFormData(prev => ({ 
          ...prev, 
          businessEmail: user.email || ''
        }));
      } else {
        setCheckingShopCount(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Check how many shops the user already has
  const checkUserShopCount = async (userId: string) => {
    try {
      const shopsQuery = query(
        collection(db, 'vendors'),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(shopsQuery);
      setUserShopCount({
        currentCount: querySnapshot.size,
        maxAllowed: MAX_SHOPS_PER_USER
      });
    } catch (error) {
      console.error('Error checking shop count:', error);
      setError('Failed to check your existing shops');
    } finally {
      setCheckingShopCount(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value,
    }));
  };

  // Convert file to Data URL (base64)
  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError("Please select a valid image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image size should be less than 2MB");
      return;
    }

    try {
      const compressedFile = await compressImage(file);
      const dataURL = await fileToDataURL(compressedFile);
      
      if (type === 'profile') {
        setImagePreview(dataURL);
        setProfileImage(dataURL);
      } else {
        setCoverPreview(dataURL);
        setCoverImage(dataURL);
      }
      setError("");
    } catch (error) {
      console.error('Error processing image:', error);
      setError("Failed to process image");
    }
  };

  const generateShopId = (shopName: string, userId: string): string => {
    const timestamp = Date.now();
    const cleanShopName = shopName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return `${userId}_${cleanShopName}_${timestamp}`;
  };

  const checkShopNameExists = async (shopName: string, userId: string): Promise<boolean> => {
    try {
      const shopsQuery = query(
        collection(db, 'vendors'),
        where('userId', '==', userId),
        where('shopName', '==', shopName.trim())
      );
      const querySnapshot = await getDocs(shopsQuery);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking shop name:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!currentUser) {
      setError('You must be logged in to create a vendor profile.');
      setLoading(false);
      return;
    }

    // Check shop limit
    if (userShopCount.currentCount >= userShopCount.maxAllowed) {
      setError(`You have reached the maximum limit of ${userShopCount.maxAllowed} shops per account.`);
      setLoading(false);
      return;
    }

    // Validation
    if (!formData.shopName.trim()) {
      setError('Shop name is required');
      setLoading(false);
      return;
    }

    if (!formData.bio.trim()) {
      setError('Shop description is required');
      setLoading(false);
      return;
    }

    if (!formData.location.trim()) {
      setError('Business location is required');
      setLoading(false);
      return;
    }

    if (!formData.contactPhone.trim()) {
      setError('Contact phone is required');
      setLoading(false);
      return;
    }

    if (!profileImage) {
      setError('Shop logo is required');
      setLoading(false);
      return;
    }

    // Check if shop name already exists for this user
    const shopNameExists = await checkShopNameExists(formData.shopName, currentUser.uid);
    if (shopNameExists) {
      setError('You already have a shop with this name. Please choose a different name.');
      setLoading(false);
      return;
    }

    try {
      const userId = currentUser.uid;
      const shopId = generateShopId(formData.shopName, userId);

      // Create vendor document with unique shop ID
      const vendorData = {
        userId: userId,
        shopId: shopId,
        shopName: formData.shopName.trim(),
        bio: formData.bio.trim(),
        location: formData.location.trim(),
        contactPhone: formData.contactPhone.trim(),
        businessEmail: formData.businessEmail.trim(),
        website: formData.website.trim() || null,
        instagramHandle: formData.instagramHandle.trim() || null,
        facebookPage: formData.facebookPage.trim() || null,
        twitterHandle: formData.twitterHandle.trim() || null,
        businessHours: formData.businessHours.trim() || null,
        returnPolicy: formData.returnPolicy.trim() || null,
        shippingPolicy: formData.shippingPolicy.trim() || null,
        profileImage: profileImage,
        coverImage: coverImage || null,
        followersCount: 0,
        likesCount: 0,
        salesCount: 0,
        totalRevenue: 0,
        isActive: true,
        onboardingCompleted: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'vendors', shopId), vendorData);

      // Navigate to vendor dashboard with success state
      navigate('/vendor/dashboard', { 
        state: { 
          message: 'Shop created successfully!',
          shopName: formData.shopName
        }
      });

    } catch (error: any) {
      console.error('Error creating vendor profile:', error);
      if (error.code === 'permission-denied') {
        setError('Database permission denied. Please check your Firestore security rules.');
      } else if (error.message.includes('quota')) {
        setError('Storage quota exceeded. Please try with smaller images.');
      } else {
        setError(error.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking shop count
  if (checkingShopCount) {
    return (
      <div className="min-h-screen bg-[#F4F1E8] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#9B4819] mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking your account...</p>
        </div>
      </div>
    );
  }

  // If no user is logged in
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F4F1E8] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <img 
              src={logo} 
              alt="Campus GOSTOREz" 
              className="h-32 w-auto"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-[#9B4819]">
            Become a Vendor
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-xl rounded-lg sm:px-10 text-center">
            <div className="mb-6">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Authentication Required
              </h3>
              <p className="text-gray-600 mb-6">
                You need to be logged in to create a vendor profile and start selling on Campus GOSTOREz.
              </p>
            </div>

            <div className="space-y-4">
              <Link
                to="/signin"
                className="w-full inline-flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#9B4819] hover:bg-[#7a3914] transition duration-150"
              >
                Sign In to Continue
              </Link>
              
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="font-medium text-[#9B4819] hover:text-[#7a3914]"
                >
                  Create one here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If user has reached shop limit
  if (userShopCount.currentCount >= userShopCount.maxAllowed) {
    return (
      <div className="min-h-screen bg-[#F4F1E8] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <img 
              src={logo} 
              alt="Campus GOSTOREz" 
              className="h-32 w-auto"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-[#9B4819]">
            Shop Limit Reached
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-xl rounded-lg sm:px-10 text-center">
            <div className="mb-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏪</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Maximum Shops Created
              </h3>
              <p className="text-gray-600 mb-4">
                You have reached the maximum limit of {userShopCount.maxAllowed} shops per account.
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  <strong>Current Shops:</strong> {userShopCount.currentCount}/{userShopCount.maxAllowed}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Link
                to="/vendor/dashboard"
                className="w-full inline-flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#9B4819] hover:bg-[#7a3914] transition duration-150"
              >
                Go to Vendor Dashboard
              </Link>
              
              <p className="text-sm text-gray-600">
                Need more shops?{' '}
                <a 
                  href="mailto:support@campusgostorez.com?subject=Request for Additional Shops" 
                  className="font-medium text-[#9B4819] hover:text-[#7a3914]"
                >
                  Contact Support
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F1E8] py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-4xl">
        <div className="flex justify-center">
          <img 
            src={logo} 
            alt="Campus GOSTOREz" 
            className="h-48 w-auto"
          />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-[#9B4819]">
          Become a Vendor
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Set up your professional shop and start selling on Campus GOSTOREz
        </p>
        
        {/* Shop Count Indicator */}
        <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4 max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Shop Progress</span>
            <span className="text-sm text-gray-600">
              {userShopCount.currentCount}/{userShopCount.maxAllowed}
            </span>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-[#9B4819] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(userShopCount.currentCount / userShopCount.maxAllowed) * 100}%` }}
            ></div>
          </div>
          <p className="mt-2 text-xs text-gray-500 text-center">
            {userShopCount.maxAllowed - userShopCount.currentCount} shop{userShopCount.maxAllowed - userShopCount.currentCount !== 1 ? 's' : ''} remaining
          </p>
        </div>

        <div className="mt-2 text-center text-xs text-green-600">
          ✅ Logged in as {currentUser.email}
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-4xl">
        <div className="bg-white py-8 px-6 shadow-xl rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Shop Information Section */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Shop Information</h3>
              
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Shop Name */}
                <div className="md:col-span-2">
                  <label htmlFor="shopName" className="block text-sm font-medium text-gray-700">
                    Shop Name *
                  </label>
                  <div className="mt-1">
                    <input
                      id="shopName"
                      name="shopName"
                      type="text"
                      required
                      value={formData.shopName}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                      placeholder="Enter your unique shop name"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Choose a unique name that represents your brand
                  </p>
                </div>

                {/* Bio */}
                <div className="md:col-span-2">
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                    Shop Description *
                  </label>
                  <div className="mt-1">
                    <textarea
                      id="bio"
                      name="bio"
                      rows={3}
                      required
                      value={formData.bio}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                      placeholder="Describe your shop, products, and what makes you unique..."
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                    Business Location *
                  </label>
                  <div className="mt-1">
                    <input
                      id="location"
                      name="location"
                      type="text"
                      required
                      value={formData.location}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                      placeholder="Where exactly is your business located?"
                    />
                  </div>
                </div>

                {/* Business Hours */}
                <div>
                  <label htmlFor="businessHours" className="block text-sm font-medium text-gray-700">
                    Business Hours
                  </label>
                  <div className="mt-1">
                    <input
                      id="businessHours"
                      name="businessHours"
                      type="text"
                      value={formData.businessHours}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                      placeholder="e.g., Mon-Fri 9AM-6PM"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Contact Phone */}
                <div>
                  <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700">
                    Contact Phone *
                  </label>
                  <div className="mt-1">
                    <input
                      id="contactPhone"
                      name="contactPhone"
                      type="tel"
                      required
                      value={formData.contactPhone}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                {/* Business Email */}
                <div>
                  <label htmlFor="businessEmail" className="block text-sm font-medium text-gray-700">
                    Business Email *
                  </label>
                  <div className="mt-1">
                    <input
                      id="businessEmail"
                      name="businessEmail"
                      type="email"
                      required
                      value={formData.businessEmail}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                      placeholder="business@example.com"
                    />
                  </div>
                </div>

                {/* Website */}
                <div className="md:col-span-2">
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                    Website
                  </label>
                  <div className="mt-1">
                    <input
                      id="website"
                      name="website"
                      type="url"
                      value={formData.website}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                      placeholder="https://yourshop.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media Section */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Media</h3>
              
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Instagram */}
                <div>
                  <label htmlFor="instagramHandle" className="block text-sm font-medium text-gray-700">
                    Instagram Handle
                  </label>
                  <div className="mt-1">
                    <input
                      id="instagramHandle"
                      name="instagramHandle"
                      type="text"
                      value={formData.instagramHandle}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                      placeholder="@yourshop"
                    />
                  </div>
                </div>

                {/* Facebook */}
                <div>
                  <label htmlFor="facebookPage" className="block text-sm font-medium text-gray-700">
                    Facebook Page
                  </label>
                  <div className="mt-1">
                    <input
                      id="facebookPage"
                      name="facebookPage"
                      type="text"
                      value={formData.facebookPage}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                      placeholder="Your Shop Name"
                    />
                  </div>
                </div>

                {/* Twitter */}
                <div>
                  <label htmlFor="twitterHandle" className="block text-sm font-medium text-gray-700">
                    Twitter Handle
                  </label>
                  <div className="mt-1">
                    <input
                      id="twitterHandle"
                      name="twitterHandle"
                      type="text"
                      value={formData.twitterHandle}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                      placeholder="@yourshop"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Policies Section */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Shop Policies</h3>
              
              <div className="grid grid-cols-1 gap-6">
                {/* Return Policy */}
                <div>
                  <label htmlFor="returnPolicy" className="block text-sm font-medium text-gray-700">
                    Return Policy
                  </label>
                  <div className="mt-1">
                    <textarea
                      id="returnPolicy"
                      name="returnPolicy"
                      rows={2}
                      value={formData.returnPolicy}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                      placeholder="Describe your return and refund policy..."
                    />
                  </div>
                </div>

                {/* Shipping Policy */}
                <div>
                  <label htmlFor="shippingPolicy" className="block text-sm font-medium text-gray-700">
                    Shipping Policy
                  </label>
                  <div className="mt-1">
                    <textarea
                      id="shippingPolicy"
                      name="shippingPolicy"
                      rows={2}
                      value={formData.shippingPolicy}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                      placeholder="Describe your shipping methods and delivery times..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Images Section */}
            <div className="pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Shop Images</h3>
              
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Profile Picture */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Shop Logo *
                  </label>
                  <div className="mt-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageSelect(e, 'profile')}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                    />
                  </div>
                  {imagePreview && (
                    <div className="mt-3">
                      <img 
                        src={imagePreview} 
                        alt="Shop logo preview" 
                        className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                      />
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Required: Square image, 400x400px, max 0.5MB
                  </p>
                </div>

                {/* Cover Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Cover Image
                  </label>
                  <div className="mt-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageSelect(e, 'cover')}
                      className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#9B4819] focus:border-[#9B4819] transition duration-150 ease-in-out text-sm"
                    />
                  </div>
                  {coverPreview && (
                    <div className="mt-3">
                      <img 
                        src={coverPreview} 
                        alt="Cover preview" 
                        className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                      />
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Optional: 1200x300px, max 1MB
                  </p>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="rounded-md bg-red-50 p-4 border border-red-200">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-red-700 font-medium">{error}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#9B4819] hover:bg-[#7a3914] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#9B4819] transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating Your Professional Shop...
                  </div>
                ) : (
                  `Create Shop ${userShopCount.currentCount + 1}/${userShopCount.maxAllowed}`
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Need help setting up your shop?{' '}
              <a href="mailto:support@campusgostorez.com" className="font-medium text-[#9B4819] hover:text-[#7a3914]">
                Contact Our Support Team
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorOnboarding;