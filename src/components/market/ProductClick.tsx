import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { auth } from '../../lib/firebase';

interface ProductClickProps {
  productId: string;
  vendorId: string;
  productCategory?: string;
  deliveryLocation?: string | number;
  children: React.ReactElement<{
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
    style?: React.CSSProperties;
    disabled?: boolean;
    [key: string]: any;
  }>;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  trackAnonymous?: boolean;
  onViewTracked?: (success: boolean) => void;
}

const ProductClick: React.FC<ProductClickProps> = ({
  productId,
  vendorId,
  productCategory,
  deliveryLocation,
  children,
  onClick,
  className = '',
  style,
  disabled = false,
  trackAnonymous = false,
  onViewTracked
}) => {
  const [tracking, setTracking] = useState(false);

  const trackView = useCallback(async (e: React.MouseEvent) => {
    try {
      setTracking(true);
      
      const user = auth.currentUser;
      let userId = 'anonymous';
      
      if (user) {
        userId = user.uid;
      } else if (!trackAnonymous) {
        if (onClick) onClick(e);
        return;
      }

      // Track view in Supabase
      const { error: viewError } = await supabase.rpc('increment_view_count', {
        p_user_id: userId,
        p_product_id: productId,
        p_vendor_id: vendorId,
        p_product_category: productCategory || null,
        p_delivery_location: deliveryLocation ? Number(deliveryLocation) : null
      });

      if (viewError) {
        console.error('Error tracking view:', viewError);
        onViewTracked?.(false);
      } else {
        onViewTracked?.(true);
      }

    } catch (error) {
      console.error('Unexpected error in trackView:', error);
      onViewTracked?.(false);
    } finally {
      setTracking(false);
    }

    if (onClick && !e.defaultPrevented) {
      onClick(e);
    }
  }, [productId, vendorId, productCategory, deliveryLocation, onClick, trackAnonymous, onViewTracked]);

  // Clone the child with proper typing
  const child = React.Children.only(children);
  const childProps = child.props;
  
  const mergedProps = {
    ...childProps,
    onClick: (e: React.MouseEvent) => {
      trackView(e);
      childProps.onClick?.(e);
    },
    className: `${childProps.className || ''} ${className}`.trim(),
    style: { ...(childProps.style || {}), ...style },
    disabled: disabled || tracking || childProps.disabled,
    'data-tracking': tracking ? 'true' : 'false',
    'data-product-id': productId
  };

  return React.cloneElement(child, mergedProps);
};

export default ProductClick;