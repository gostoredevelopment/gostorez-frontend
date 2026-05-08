import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { auth } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../../services/notificationService';

interface FavoriteButtonProps {
  productId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  // Callback when like status changes - returns (isLiked, newLikesCount)
  onLikeChange?: (isLiked: boolean, newLikesCount: number) => void;
  // Optional initial state for immediate UI rendering (will be validated against DB)
  initialLiked?: boolean;
  initialLikesCount?: number;
}

// Helper function to get vendor details from product
const getVendorDetailsFromProduct = async (productId: string): Promise<{ vendorId: string | null; firebaseUid: string | null; businessEmail: string | null; shopName: string | null }> => {
  try {
    console.log('🔍 FavoriteButton - Getting vendor details for product:', productId);
    
    // First get the product to find vendor_id
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('vendor_id, vendor_name')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      console.error('❌ FavoriteButton - Error fetching product:', productError);
      return { vendorId: null, firebaseUid: null, businessEmail: null, shopName: null };
    }

    const vendorId = product.vendor_id;
    console.log('🔍 FavoriteButton - Found vendor_id from product:', vendorId);

    if (!vendorId) {
      console.warn('⚠️ FavoriteButton - No vendor_id found for product');
      return { vendorId: null, firebaseUid: null, businessEmail: null, shopName: null };
    }

    // Now get vendor profile details
    const { data: vendorProfile, error: vendorError } = await supabase
      .from('vendor_profiles')
      .select('user_id, business_email, shop_name')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    if (vendorError) {
      console.error('❌ FavoriteButton - Error fetching vendor profile:', vendorError);
    }

    if (vendorProfile) {
      console.log('✅ FavoriteButton - Found vendor profile:', vendorProfile);
      return {
        vendorId: vendorId,
        firebaseUid: vendorProfile.user_id,
        businessEmail: vendorProfile.business_email,
        shopName: vendorProfile.shop_name || product.vendor_name
      };
    }

    // If no vendor profile, try to get from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('firebase_uid, email, name')
      .eq('firebase_uid', vendorId)
      .maybeSingle();

    if (!userError && userData) {
      console.log('✅ FavoriteButton - Found user by firebase_uid:', userData);
      return {
        vendorId: vendorId,
        firebaseUid: userData.firebase_uid,
        businessEmail: userData.email,
        shopName: userData.name
      };
    }

    console.warn('⚠️ FavoriteButton - Could not find vendor details for ID:', vendorId);
    return { vendorId, firebaseUid: null, businessEmail: null, shopName: null };

  } catch (error) {
    console.error('❌ FavoriteButton - Error in getVendorDetailsFromProduct:', error);
    return { vendorId: null, firebaseUid: null, businessEmail: null, shopName: null };
  }
};

// Helper function to get current user's name
const getCurrentUserName = async (): Promise<string> => {
  const user = auth.currentUser;
  if (!user) return 'A user';

  try {
    const { data } = await supabase
      .from('users')
      .select('name')
      .eq('firebase_uid', user.uid)
      .maybeSingle();
    
    return data?.name || user.displayName || 'A user';
  } catch {
    return user.displayName || 'A user';
  }
};

const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  productId,
  className = '',
  size = 'md',
  showCount = false,
  onLikeChange,
  initialLiked = false,
  initialLikesCount = 0
}) => {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [loading, setLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();

  // Fetch initial state from database on mount and when productId changes
  useEffect(() => {
    fetchInitialData();
  }, [productId]);

  const fetchInitialData = async () => {
    try {
      setIsInitializing(true);
      await Promise.all([
        fetchLikeStatus(),
        fetchLikesCount()
      ]);
    } catch (error) {
      console.error('Error fetching initial favorite data:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const fetchLikeStatus = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setIsLiked(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', user.uid)
        .eq('product_id', productId)
        .single();

      // PGRST116 = no rows returned (not liked)
      if (error && error.code !== 'PGRST116') {
        console.error('Error checking like status:', error);
      } else {
        // Update state only if different from current
        const isCurrentlyLiked = !!data;
        if (isCurrentlyLiked !== isLiked) {
          setIsLiked(isCurrentlyLiked);
        }
      }
    } catch (error) {
      console.error('Error fetching like status:', error);
    }
  };

  const fetchLikesCount = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('likes_count')
        .eq('id', productId)
        .single();

      if (!error && data) {
        const newCount = data.likes_count || 0;
        if (newCount !== likesCount) {
          setLikesCount(newCount);
        }
      }
    } catch (error) {
      console.error('Error fetching likes count:', error);
    }
  };

  // Updated function with spare email fallback
  const sendVendorNotification = async (productName?: string) => {
    try {
      console.log('📢 FavoriteButton - Starting to send notification for product like');
      
      // Get current user's name
      const userName = await getCurrentUserName();
      
      // Get product details for the notification
      const { data: product } = await supabase
        .from('products')
        .select('title')
        .eq('id', productId)
        .single();
      
      const productTitle = product?.title || 'a product';
      
      // Get vendor details from the product
      const vendorDetails = await getVendorDetailsFromProduct(productId);
      
      if (!vendorDetails.firebaseUid) {
        console.warn('⚠️ FavoriteButton - Could not find vendor Firebase UID for product:', productId);
        return;
      }

      // Don't send notification if user is liking their own product
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === vendorDetails.firebaseUid) {
        console.log('📢 FavoriteButton - User is liking their own product, skipping notification');
        return;
      }

      console.log('📢 FavoriteButton - Vendor details for notification:', vendorDetails);

      // Format the message
      const notificationBody = `${userName} liked ${productTitle}`;
      const notificationTitle = `❤️ New Product Like - ${vendorDetails.shopName || 'Your Shop'}`;

      console.log('📢 FavoriteButton - Notification content:', { title: notificationTitle, body: notificationBody });

      // Prepare notification data
      const notificationData: any = {
        title: notificationTitle,
        body: notificationBody,
        notification_type: 'vendor',
        redirect_url: '/vendor/products',
        data: {
          productId: productId,
          vendorId: vendorDetails.vendorId,
          userId: auth.currentUser?.uid,
          productName: productTitle,
          action: 'liked',
          type: 'favorite_activity',
          timestamp: new Date().toISOString()
        }
      };

      // Add target user (Firebase UID)
      notificationData.target_user_id = vendorDetails.firebaseUid;

      // Add email with fallback - use fetched email if available, otherwise use spare email
      const SPARE_EMAIL = 'miracleglory2099@gmail.com';
      if (vendorDetails.businessEmail) {
        notificationData.email = vendorDetails.businessEmail;
        console.log('📢 FavoriteButton - Using vendor business email:', vendorDetails.businessEmail);
      } else {
        notificationData.email = SPARE_EMAIL;
        console.log('📢 FavoriteButton - No vendor email found, using spare email:', SPARE_EMAIL);
      }

      console.log('📢 FavoriteButton - Sending notification with data:', JSON.stringify(notificationData, null, 2));

      // Send notification through the service
      const response = await notificationService.sendNotification(notificationData);
      
      console.log('✅ FavoriteButton - Notification service response:', response);
      
      // Create in-app notification
      if (response && response.success) {
        const { error: insertError } = await supabase
          .from('user_notifications')
          .insert([{
            user_id: vendorDetails.firebaseUid,
            title: notificationTitle,
            message: notificationBody,
            type: 'favorite',
            data: notificationData.data,
            is_read: false,
            created_at: new Date().toISOString()
          }]);

        if (insertError) {
          console.error('❌ FavoriteButton - Error creating user_notification:', insertError);
        } else {
          console.log('✅ FavoriteButton - In-app notification created successfully');
        }
      } else {
        console.warn('⚠️ FavoriteButton - Notification service returned non-success:', response);
      }

    } catch (error) {
      console.error('❌ FavoriteButton - Error sending vendor notification:', error);
    }
  };

  const handleFavoriteToggle = async () => {
    const user = auth.currentUser;
    
    if (!user) {
      setShowLoginPrompt(true);
      setTimeout(() => {
        setShowLoginPrompt(false);
      }, 5000);
      return;
    }

    try {
      setLoading(true);
      
      // Optimistic update for immediate UI response
      const wasLiked = isLiked;
      const newIsLiked = !wasLiked;
      const newCount = wasLiked ? Math.max(0, likesCount - 1) : likesCount + 1;
      
      setIsLiked(newIsLiked);
      setLikesCount(newCount);
      onLikeChange?.(newIsLiked, newCount);

      // Perform actual database operations
      if (wasLiked) {
        // Remove from favorites
        const { error: deleteError } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.uid)
          .eq('product_id', productId);

        if (deleteError) {
          // Revert optimistic update on error
          setIsLiked(wasLiked);
          setLikesCount(likesCount);
          onLikeChange?.(wasLiked, likesCount);
          throw deleteError;
        }

        // Decrement product likes count
        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            likes_count: newCount 
          })
          .eq('id', productId);

        if (updateError) {
          console.error('Error updating likes count:', updateError);
          // Don't revert UI as the favorite was successfully removed
        }
      } else {
        // Add to favorites
        const { error: insertError } = await supabase
          .from('user_favorites')
          .insert([
            {
              user_id: user.uid,
              product_id: productId,
              created_at: new Date().toISOString()
            }
          ]);

        if (insertError) {
          // Revert optimistic update on error
          setIsLiked(wasLiked);
          setLikesCount(likesCount);
          onLikeChange?.(wasLiked, likesCount);
          throw insertError;
        }

        // Increment product likes count
        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            likes_count: newCount 
          })
          .eq('id', productId);

        if (updateError) {
          console.error('Error updating likes count:', updateError);
          // Don't revert UI as the favorite was successfully added
        } else {
          // Send notification to vendor when product is liked (don't await to not block UI)
          sendVendorNotification();
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      
      // Fetch actual state from DB to ensure consistency
      setTimeout(() => {
        fetchInitialData();
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'favoritebtn-sm';
      case 'lg':
        return 'favoritebtn-lg';
      default:
        return 'favoritebtn-md';
    }
  };

  return (
    <div className={`favoritebuttoncontainer ${className}`}>
      <button
        className={`favoritebtn ${getSizeClasses()} ${isLiked ? 'favoritebtn-liked' : 'favoritebtn-unliked'}`}
        onClick={handleFavoriteToggle}
        disabled={loading || isInitializing}
        aria-label={isLiked ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Heart 
          size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20}
          fill={isLiked ? '#ef4444' : 'none'}
          stroke={isLiked ? '#ef4444' : '#6b7280'}
          className={`favoriteicon ${loading ? 'favoriteicon-loading' : ''}`}
        />
      </button>
      
      {showCount && (
        <span className="favoritecount">
          {isInitializing ? '...' : likesCount}
        </span>
      )}

      {showLoginPrompt && (
        <div className="favoriteloginprompt">
          <div className="favoriteloginpromptcontent">
            <span className="favoriteloginprompttext">Please login to add favorites</span>
            <button 
              className="favoriteloginpromptloginbtn"
              onClick={() => navigate('/signin')}
            >
              Login
            </button>
            <button 
              className="favoriteloginpromptclosebtn"
              onClick={() => setShowLoginPrompt(false)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FavoriteButton;