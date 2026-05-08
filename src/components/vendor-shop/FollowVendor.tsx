import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { supabase } from '../../lib/supabaseClient';
import { notificationService } from '../../services/notificationService'; // ADD THIS IMPORT
import { Check, Plus } from 'lucide-react';

// ========== NOTIFICATION FUNCTIONS ADDED ==========
const getCurrentUserName = async (): Promise<string> => {
  const auth = getAuth();
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

const sendFollowNotification = async (
  vendorId: string,
  followerName: string,
  shopName: string
) => {
  try {
    console.log('📢 Sending follow notification to vendor:', vendorId);
    
    // Get vendor details from vendor_profiles table
    const { data: vendorProfile, error: vendorError } = await supabase
      .from('vendor_profiles')
      .select('user_id, business_email, shop_name')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    if (vendorError) {
      console.error('❌ Error fetching vendor profile:', vendorError);
    }

    if (!vendorProfile) {
      console.warn('⚠️ No vendor profile found for vendor_id:', vendorId);
      return;
    }

    if (!vendorProfile.user_id) {
      console.warn('⚠️ Vendor has no user_id (Firebase UID)');
      return;
    }

    console.log('✅ Found vendor profile:', vendorProfile);

    // Format the message
    const notificationTitle = `👥 New Follower!! ${vendorProfile.shop_name || shopName || 'Shop'}`;
    const notificationBody = `${followerName} started following ${vendorProfile.shop_name || shopName || 'you'}`;

    console.log('📢 Notification content:', { title: notificationTitle, body: notificationBody });

    // Prepare notification data
    const notificationData: any = {
      title: notificationTitle,
      body: notificationBody,
      notification_type: 'vendor',
      redirect_url: '/vendor/dashboard',
      data: {
        vendorId: vendorId,
        followerName: followerName,
        shopName: vendorProfile.shop_name || shopName,
        type: 'new_follower',
        timestamp: new Date().toISOString()
      }
    };

    // Add target user (Firebase UID from vendor_profiles)
    notificationData.target_user_id = vendorProfile.user_id;

    // Add email with fallback
    const SPARE_EMAIL = 'miracleglory2099@gmail.com';
    if (vendorProfile.business_email) {
      notificationData.email = vendorProfile.business_email;
      console.log('📢 Using vendor business email:', vendorProfile.business_email);
    } else {
      notificationData.email = SPARE_EMAIL;
      console.log('📢 No vendor email found, using spare email:', SPARE_EMAIL);
    }

    console.log('📢 Sending notification with data:', JSON.stringify(notificationData, null, 2));

    // Send notification through the service
    const response = await notificationService.sendNotification(notificationData);
    
    console.log('✅ Notification service response:', response);
    
    // Create in-app notification
    if (response && response.success) {
      const { error: insertError } = await supabase
        .from('user_notifications')
        .insert([{
          user_id: vendorProfile.user_id,
          title: notificationTitle,
          message: notificationBody,
          type: 'follow',
          data: notificationData.data,
          is_read: false,
          created_at: new Date().toISOString()
        }]);

      if (insertError) {
        console.error('❌ Error creating user_notification:', insertError);
      } else {
        console.log('✅ In-app notification created successfully');
      }
    } else {
      console.warn('⚠️ Notification service returned non-success:', response);
    }

  } catch (error) {
    console.error('❌ Error sending follow notification:', error);
  }
};
// ========== END NOTIFICATION FUNCTIONS ==========

interface FollowVendorProps {
  vendorId: string;
  vendorName?: string;
  onFollowChange?: (isFollowing: boolean) => void;
  className?: string;
}

const FollowVendor: React.FC<FollowVendorProps> = ({ 
  vendorId, 
  vendorName,
  onFollowChange,
  className = ''
}) => {
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);
  const [followSuccess, setFollowSuccess] = useState<boolean>(false);

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    console.log('🔍 FollowVendor component mounted');
    console.log('🔍 Current user:', user?.uid);
    if (user) {
      setUserId(user.uid);
      checkIfUserIsFollowingVendor(user.uid);
    } else {
      console.log('🔍 No user logged in');
    }
  }, [vendorId]);

  const checkIfUserIsFollowingVendor = async (uid: string) => {
    console.log('🔍 Checking if user is following vendor:', vendorId);
    try {
      const { data: followData, error: followError } = await supabase
        .from('vendor_follow')
        .select('id, created_at')
        .eq('user_id', uid)
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (followError) {
        console.error('❌ Error checking follow status:', followError);
        console.error('❌ Error details:', followError.message, followError.code);
        setFollowError(followError.message);
        return;
      }

      console.log('🔍 Follow check result:', followData);
      setIsFollowing(!!followData);
    } catch (error) {
      console.error('❌ Exception in checkIfFollowing:', error);
      setFollowError('Failed to check follow status');
    }
  };

  const handleFollowButtonClick = async () => {
    console.log('🔄 Follow button clicked');
    console.log('🔄 User ID:', userId);
    console.log('🔄 Vendor ID:', vendorId);
    
    if (!userId) {
      console.log('❌ User not logged in, cannot follow vendor');
      setFollowError('Please login to follow this vendor');
      setTimeout(() => setFollowError(null), 3000);
      return;
    }

    setIsLoading(true);
    setFollowError(null);
    setFollowSuccess(false);

    try {
      if (isFollowing) {
        console.log('🔄 Unfollowing vendor...');
        await executeUnfollowVendorOperation(userId);
      } else {
        console.log('🔄 Following vendor...');
        await executeFollowVendorOperation(userId);
      }
    } catch (error) {
      console.error('❌ Error in follow operation:', error);
      setFollowError('Operation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const executeFollowVendorOperation = async (uid: string) => {
    console.log('🚀 Starting follow vendor operation');
    try {
      console.log('📝 Inserting into vendor_follow table');
      const { data: insertData, error: insertError } = await supabase
        .from('vendor_follow')
        .insert({
          user_id: uid,
          vendor_id: vendorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Insert error:', insertError);
        console.error('❌ Insert error details:', insertError.message, insertError.code);
        throw new Error(`Failed to follow: ${insertError.message}`);
      }

      console.log('✅ Insert successful:', insertData);

      console.log('📊 Fetching current vendor followers count');
      const { data: vendorProfileData, error: vendorFetchError } = await supabase
        .from('vendor_profiles')
        .select('followers_count, shop_name')
        .eq('vendor_id', vendorId)
        .single();

      if (vendorFetchError) {
        console.error('❌ Vendor fetch error:', vendorFetchError);
      }

      console.log('📊 Current vendor data:', vendorProfileData);

      const currentFollowersCount = vendorProfileData?.followers_count || 0;
      console.log('📊 Current followers count:', currentFollowersCount);

      console.log('📝 Updating vendor followers count');
      const { error: updateError } = await supabase
        .from('vendor_profiles')
        .update({
          followers_count: currentFollowersCount + 1,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendorId);

      if (updateError) {
        console.error('❌ Update error:', updateError);
        console.error('❌ Update error details:', updateError.message, updateError.code);
        throw new Error(`Failed to update followers count: ${updateError.message}`);
      }

      console.log('✅ Followers count updated successfully');

      setIsFollowing(true);
      setFollowSuccess(true);
      onFollowChange?.(true);
      
      console.log(`✅ Successfully followed ${vendorName || 'vendor'}`);
      
      // ========== NOTIFICATION ADDED HERE ==========
      // Get current user name and send notification
      const followerName = await getCurrentUserName();
      await sendFollowNotification(vendorId, followerName, vendorProfileData?.shop_name || vendorName || 'Shop');
      // ========== END NOTIFICATION ==========
      
      setTimeout(() => setFollowSuccess(false), 3000);

    } catch (error: any) {
      console.error('❌ Error in executeFollowVendorOperation:', error);
      throw error;
    }
  };

  const executeUnfollowVendorOperation = async (uid: string) => {
    console.log('🚀 Starting unfollow vendor operation');
    try {
      console.log('🗑️ Deleting from vendor_follow table');
      const { error: deleteError } = await supabase
        .from('vendor_follow')
        .delete()
        .eq('user_id', uid)
        .eq('vendor_id', vendorId);

      if (deleteError) {
        console.error('❌ Delete error:', deleteError);
        console.error('❌ Delete error details:', deleteError.message, deleteError.code);
        throw new Error(`Failed to unfollow: ${deleteError.message}`);
      }

      console.log('✅ Delete successful');

      console.log('📊 Fetching current vendor followers count');
      const { data: vendorProfileData, error: vendorFetchError } = await supabase
        .from('vendor_profiles')
        .select('followers_count, shop_name')
        .eq('vendor_id', vendorId)
        .single();

      if (vendorFetchError) {
        console.error('❌ Vendor fetch error:', vendorFetchError);
      }

      console.log('📊 Current vendor data:', vendorProfileData);

      const currentFollowersCount = vendorProfileData?.followers_count || 0;
      console.log('📊 Current followers count:', currentFollowersCount);

      const newFollowersCount = Math.max(0, currentFollowersCount - 1);
      console.log('📊 New followers count:', newFollowersCount);

      console.log('📝 Updating vendor followers count');
      const { error: updateError } = await supabase
        .from('vendor_profiles')
        .update({
          followers_count: newFollowersCount,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendorId);

      if (updateError) {
        console.error('❌ Update error:', updateError);
        console.error('❌ Update error details:', updateError.message, updateError.code);
        throw new Error(`Failed to update followers count: ${updateError.message}`);
      }

      console.log('✅ Followers count updated successfully');

      setIsFollowing(false);
      setFollowSuccess(true);
      onFollowChange?.(false);
      
      console.log(`✅ Successfully unfollowed ${vendorName || 'vendor'}`);
      
      // ========== NO NOTIFICATION FOR UNFOLLOW ==========
      // We don't send notification when someone unfollows
      
      setTimeout(() => setFollowSuccess(false), 3000);

    } catch (error: any) {
      console.error('❌ Error in executeUnfollowVendorOperation:', error);
      throw error;
    }
  };

  return (
    <div className="vendorshop-follow-vendor-container">
      <button
        className={`vendorshop-follow-vendor-button-main ${isFollowing ? 'vendorshop-follow-vendor-button-main-following' : 'vendorshop-follow-vendor-button-main-not-following'} ${className} ${isLoading ? 'vendorshop-follow-vendor-button-main-loading' : ''}`}
        onClick={handleFollowButtonClick}
        disabled={isLoading}
        title={isFollowing ? `You are following ${vendorName || 'this vendor'}` : `Follow ${vendorName || 'this vendor'}`}
      >
        {isLoading ? (
          <span className="vendorshop-follow-vendor-button-loading-text">
            <span className="vendorshop-follow-vendor-button-loading-spinner"></span>
            Processing...
          </span>
        ) : (
          <>
            {isFollowing ? (
              <>
                <Check className="vendorshop-follow-vendor-button-icon vendorshop-follow-vendor-button-icon-following" size={12} />
                <span className="vendorshop-follow-vendor-button-text vendorshop-follow-vendor-button-text-following">
                  Following
                </span>
              </>
            ) : (
              <>
                <Plus className="vendorshop-follow-vendor-button-icon vendorshop-follow-vendor-button-icon-not-following" size={12} />
                <span className="vendorshop-follow-vendor-button-text vendorshop-follow-vendor-button-text-not-following">
                  Follow
                </span>
              </>
            )}
          </>
        )}
      </button>
      
      {followError && (
        <div className="vendorshop-follow-vendor-error-message">
          <span className="vendorshop-follow-vendor-error-icon">⚠️</span>
          <span className="vendorshop-follow-vendor-error-text">{followError}</span>
        </div>
      )}
      
      {followSuccess && (
        <div className="vendorshop-follow-vendor-success-message">
          <span className="vendorshop-follow-vendor-success-icon">✅</span>
          <span className="vendorshop-follow-vendor-success-text">
            {isFollowing ? `You are now following ${vendorName || 'this vendor'}` : `You have unfollowed ${vendorName || 'this vendor'}`}
          </span>
        </div>
      )}
    </div>
  );
};

export default FollowVendor;