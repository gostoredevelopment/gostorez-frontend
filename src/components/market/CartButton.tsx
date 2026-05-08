import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { auth } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../../services/notificationService';

interface CartButtonProps {
  productId: string;
  vendorId: string;
  productName?: string;
  quantity?: number;
  onCartUpdate?: (inCart: boolean, cartQuantity: number) => void;
  className?: string;
  children?: React.ReactElement;
  style?: React.CSSProperties;
}

interface ChildProps {
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  [key: string]: any;
}

// Helper function to extract the actual vendor ID (everything before the first underscore)
const extractVendorId = (fullVendorId: string): string => {
  const underscoreIndex = fullVendorId.indexOf('_');
  if (underscoreIndex !== -1) {
    return fullVendorId.substring(0, underscoreIndex);
  }
  return fullVendorId;
};

// FIXED: Helper function to get vendor details using productId (matches FavoriteButton approach)
const getVendorDetails = async (productId: string): Promise<{ firebaseUid: string | null; businessEmail: string | null; shopName: string | null }> => {
  try {
    console.log('🔍 CartButton - Getting vendor details for product:', productId);
    
    // Step 1: Get product to find vendor_id
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('vendor_id')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      console.error('❌ CartButton - Error fetching product:', productError);
      return { firebaseUid: null, businessEmail: null, shopName: null };
    }

    const vendorId = product.vendor_id;
    console.log('🔍 CartButton - Found vendor_id from product:', vendorId);

    if (!vendorId) {
      console.warn('⚠️ CartButton - No vendor_id found for product');
      return { firebaseUid: null, businessEmail: null, shopName: null };
    }

    // Step 2: Get vendor profile using vendor_id
    const { data: vendorProfile, error: vendorError } = await supabase
      .from('vendor_profiles')
      .select('user_id, business_email, shop_name')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    if (vendorError) {
      console.error('❌ CartButton - Error fetching vendor profile:', vendorError);
    }

    if (vendorProfile) {
      console.log('✅ CartButton - Found vendor profile:', vendorProfile);
      return {
        firebaseUid: vendorProfile.user_id,
        businessEmail: vendorProfile.business_email,
        shopName: vendorProfile.shop_name || 'Shop'
      };
    }

    console.warn('⚠️ CartButton - No vendor profile found for vendor_id:', vendorId);
    return { firebaseUid: null, businessEmail: null, shopName: null };

  } catch (error) {
    console.error('❌ CartButton - Error in getVendorDetails:', error);
    return { firebaseUid: null, businessEmail: null, shopName: null };
  }
};

const CartButton: React.FC<CartButtonProps> = ({
  productId,
  vendorId,
  productName = 'Item',
  quantity = 1,
  onCartUpdate,
  className = '',
  children,
  style
}) => {
  const [loading, setLoading] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [cartQuantity, setCartQuantity] = useState(0);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [vendorShopName, setVendorShopName] = useState<string>('the shop');
  const navigate = useNavigate();

  // Get current user's name when component mounts
  useEffect(() => {
    const getUserName = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const { data } = await supabase
            .from('users')
            .select('name')
            .eq('firebase_uid', user.uid)
            .maybeSingle();
          
          if (data?.name) {
            setCurrentUserName(data.name);
          } else {
            setCurrentUserName(user.displayName || 'A user');
          }
        } catch {
          setCurrentUserName(user.displayName || 'A user');
        }
      }
    };
    
    getUserName();
  }, []);

  // Get vendor shop name - FIXED: Now uses productId to get correct shop name
  useEffect(() => {
    const getVendorName = async () => {
      const details = await getVendorDetails(productId);
      if (details.shopName) {
        setVendorShopName(details.shopName);
      }
    };
    getVendorName();
  }, [productId]);

  useEffect(() => {
    checkCartStatus();
  }, [productId]);

  const checkCartStatus = async () => {
    const user = auth.currentUser;
    if (!user) {
      setInCart(false);
      setCartQuantity(0);
      onCartUpdate?.(false, 0);
      return;
    }

    try {
      const { data } = await supabase
        .from('carts')
        .select('quantity')
        .eq('user_id', user.uid)
        .eq('product_id', productId)
        .single();

      if (data) {
        setInCart(true);
        setCartQuantity(data.quantity);
        onCartUpdate?.(true, data.quantity);
      } else {
        setInCart(false);
        setCartQuantity(0);
        onCartUpdate?.(false, 0);
      }
    } catch {
      setInCart(false);
      setCartQuantity(0);
      onCartUpdate?.(false, 0);
    }
  };

  const showNotification = (message: string) => {
    const existing = document.querySelector('.cart-notification-popup');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'cart-notification-popup';
    notification.innerHTML = `
      <div class="cart-notification-content">
        <span class="cart-notification-text">${message}</span>
        <div class="cart-notification-actions">
          <button class="cart-notification-btn cart-notification-view">View Cart</button>
          <button class="cart-notification-btn cart-notification-dismiss">✕</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    const viewBtn = notification.querySelector('.cart-notification-view');
    const dismissBtn = notification.querySelector('.cart-notification-dismiss');
    
    viewBtn?.addEventListener('click', () => {
      navigate('/cart');
      notification.remove();
    });
    
    dismissBtn?.addEventListener('click', () => {
      notification.remove();
    });
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  };

  // FIXED: sendVendorNotification now uses productId to get vendor details
  const sendVendorNotification = async (action: 'added' | 'updated', itemQuantity: number) => {
    try {
      // Get vendor details using productId (matches FavoriteButton approach)
      const vendorDetails = await getVendorDetails(productId);
      
      if (!vendorDetails.firebaseUid) {
        console.warn('Could not find vendor Firebase UID for product:', productId);
        return;
      }

      console.log('Sending notification to vendor:', vendorDetails);

      // Format the message - FIXED: Always use 'added' in body, shop name shows in title
      const notificationBody = `${currentUserName || 'A user'} added ${productName} to cart`;
      const notificationTitle = `🛒 New Cart Activity - ${vendorDetails.shopName || vendorShopName || 'Shop'}`;

      // Prepare notification data matching the test page format
      const notificationData: any = {
        title: notificationTitle,
        body: notificationBody,
        notification_type: 'vendor',
        redirect_url: '/vendor/orders',
        data: {
          productId: productId,
          vendorId: vendorId,
          userId: auth.currentUser?.uid,
          quantity: itemQuantity,
          action: action,
          productName: productName,
          type: 'cart_activity',
          timestamp: new Date().toISOString()
        }
      };

      // Add target user (Firebase UID)
      notificationData.target_user_id = vendorDetails.firebaseUid;

      // Add email with fallback - use fetched email if available, otherwise use spare email
      const SPARE_EMAIL = 'miracleglory2099@gmail.com';
      if (vendorDetails.businessEmail) {
        notificationData.email = vendorDetails.businessEmail;
        console.log('Using vendor business email:', vendorDetails.businessEmail);
      } else {
        notificationData.email = SPARE_EMAIL;
        console.log('No vendor email found, using spare email:', SPARE_EMAIL);
      }

      console.log('Sending notification with data:', notificationData);

      // Send notification through the service
      const response = await notificationService.sendNotification(notificationData);
      
      console.log('Vendor notification response:', response);
      
      // Create in-app notification
      if (response && response.success) {
        const { error } = await supabase
          .from('user_notifications')
          .insert([{
            user_id: vendorDetails.firebaseUid,
            title: notificationTitle,
            message: notificationBody,
            type: 'cart',
            data: notificationData.data,
            is_read: false,
            created_at: new Date().toISOString()
          }]);

        if (error) {
          console.error('Error creating user_notification:', error);
        } else {
          console.log('In-app notification created successfully');
        }
      }

    } catch (error) {
      console.error('Error sending vendor notification:', error);
    }
  };

  const handleAddToCart = async () => {
    const user = auth.currentUser;
    
    if (!user) {
      showNotification('Please login to add to cart');
      setTimeout(() => navigate('/signin'), 1500);
      return;
    }

    try {
      setLoading(true);
      
      const { data: existingItem } = await supabase
        .from('carts')
        .select('id, quantity')
        .eq('user_id', user.uid)
        .eq('product_id', productId)
        .single();

      let newQuantity = quantity;
      let message = '';
      let notificationAction: 'added' | 'updated' = 'added';

      if (existingItem) {
        newQuantity = existingItem.quantity + quantity;
        const { error } = await supabase
          .from('carts')
          .update({ 
            quantity: newQuantity,
            created_at: new Date().toISOString()
          })
          .eq('id', existingItem.id);

        if (!error) {
          await supabase.rpc('increment_cart_count', { product_uuid: productId });
          message = `Updated: ${productName} (Qty: ${newQuantity})`;
          notificationAction = 'updated';
        }
      } else {
        const { error } = await supabase
          .from('carts')
          .insert([{
            user_id: user.uid,
            product_id: productId,
            vendor_id: vendorId,
            quantity: quantity,
            created_at: new Date().toISOString()
          }]);

        if (!error) {
          await supabase.rpc('increment_cart_count', { product_uuid: productId });
          message = `Added: ${productName} (Qty: ${quantity})`;
          newQuantity = quantity;
          notificationAction = 'added';
        }
      }

      if (message) {
        setInCart(true);
        setCartQuantity(newQuantity);
        onCartUpdate?.(true, newQuantity);
        showNotification(message);
        
        // Send notification to vendor
        sendVendorNotification(notificationAction, newQuantity);
      }
    } catch (error) {
      console.error('Cart error:', error);
      showNotification('Failed to update cart');
    } finally {
      setLoading(false);
    }
  };

  // If children provided, enhance it with cart functionality
  if (children) {
    return (
      <div 
        className={`cart-button-wrapper ${className}`}
        style={{ display: 'contents', ...style }}
        onClick={handleAddToCart}
      >
        {children}
      </div>
    );
  }

  // Default button if no children
  return (
    <button
      onClick={handleAddToCart}
      disabled={loading}
      className={`cart-button-default ${className}`}
      aria-label={inCart ? `In cart (${cartQuantity})` : 'Add to cart'}
      style={style}
    >
      {inCart ? `In Cart (${cartQuantity})` : 'Add to Cart'}
    </button>
  );
};

export default CartButton;