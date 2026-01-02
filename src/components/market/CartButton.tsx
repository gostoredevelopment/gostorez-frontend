import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { auth } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

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
        }
      }

      if (message) {
        setInCart(true);
        setCartQuantity(newQuantity);
        onCartUpdate?.(true, newQuantity);
        showNotification(message);
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
