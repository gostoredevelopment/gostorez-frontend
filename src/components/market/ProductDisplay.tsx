import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { auth } from '../../lib/firebase';
import { 
  Heart, 
  Eye, 
  ShoppingCart, 
  Package, 
  MapPin, 
  Star, 
  CheckCircle, 
  Users, 
  TrendingUp,
  X,
  LogIn,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  User,
  Home,
  Truck,
  Shield,
  Tag,
  ShoppingBag
} from 'lucide-react';
import './ProductDisplay.css';
import FavoriteButton from './FavoriteButton';
import CartButton from './CartButton';

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
  average_rating?: number;
  review_count?: number;
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
  response_time?: string;
  response_rate?: number;
  user_id?: string;
  delivery_campus_ids?: string[];
}

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

interface ProductDisplayProps {
  product: Product;
  vendor: VendorProfile | null;
  currentImageIndex: number;
  onClose: () => void;
  onNavigateToVendorShop: () => void;
  embedded?: boolean;
  onToggleExpand?: () => void;
}

const ProductDisplay: React.FC<ProductDisplayProps> = ({
  product,
  vendor,
  currentImageIndex: initialImageIndex,
  onClose,
  onNavigateToVendorShop,
  embedded = false,
  onToggleExpand
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(initialImageIndex);
  const [imageLoading, setImageLoading] = useState(false);
  const [fullscreenImageLoading, setFullscreenImageLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deliveryCampuses, setDeliveryCampuses] = useState<Campus[]>([]);
  const [showDeliveryDropdown, setShowDeliveryDropdown] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [currentLikesCount, setCurrentLikesCount] = useState(product.likes_count || 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const deliveryDropdownRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fullscreenImageRef = useRef<HTMLImageElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    trackProductView();
    fetchDeliveryCampuses();
  }, [product.id]);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isFullscreen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deliveryDropdownRef.current && !deliveryDropdownRef.current.contains(event.target as Node)) {
        setShowDeliveryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

const trackProductView = async () => {
  try {
    const user = auth.currentUser;
    let userId = 'anonymous';
    
    if (user) {
      userId = user.uid;
    }

    // 1. Increment product's views_count by 1
    const { error: productError } = await supabase
      .from('products')
      .update({ 
        views_count: (product.views_count || 0) + 1 
      })
      .eq('id', product.id);

    if (productError) {
      console.error('Error incrementing product view:', productError);
    }

    // 2. Insert or update views table
    // Check if user already viewed this product
    const { data: existingView } = await supabase
      .from('views')
      .select('*')
      .eq('user_id', userId)
      .eq('product_id', product.id)
      .single();

    if (existingView) {
      // Update quantity by +1
      const { error: updateError } = await supabase
        .from('views')
        .update({ 
          quantity: (existingView.quantity || 1) + 1,
          last_clicked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingView.id);

      if (updateError) {
        console.error('Error updating view:', updateError);
      }
    } else {
      // Insert new row
      const { error: insertError } = await supabase
        .from('views')
        .insert({
          user_id: userId,
          product_id: product.id,
          vendor_id: product.vendor_id,
          product_category: product.category,
          product_delivery_location: product.delivery_campus_ids?.[0] || null,
          quantity: 1,
          last_clicked_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error inserting view:', insertError);
      }
    }

    return true;
  } catch (error) {
    console.error('Unexpected error tracking view:', error);
    return false;
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

  const fetchDeliveryCampuses = async () => {
    try {
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('product_delivery_locations')
        .select('campus_id')
        .eq('product_id', product.id);

      if (deliveryError) {
        console.error('Error fetching product delivery locations:', deliveryError);
        fetchVendorDeliveryCampuses();
        return;
      }

      if (!deliveryData || deliveryData.length === 0) {
        fetchVendorDeliveryCampuses();
        return;
      }

      const campusIds = deliveryData.map(item => item.campus_id);
      await fetchCampusDetails(campusIds);
    } catch (error) {
      console.error('Error in fetchDeliveryCampuses:', error);
      fetchVendorDeliveryCampuses();
    }
  };

  const fetchVendorDeliveryCampuses = async () => {
    try {
      if (!vendor?.vendor_id) {
        console.log('No vendor ID available');
        setDeliveryCampuses([]);
        return;
      }

      const { data: vendorDeliveryData, error: vendorDeliveryError } = await supabase
        .from('vendor_delivery_locations')
        .select('campus_id')
        .eq('vendor_id', vendor.vendor_id);

      if (vendorDeliveryError) {
        console.error('Error fetching vendor delivery locations:', vendorDeliveryError);
        setDeliveryCampuses([]);
        return;
      }

      if (!vendorDeliveryData || vendorDeliveryData.length === 0) {
        console.log('No vendor delivery locations found');
        setDeliveryCampuses([]);
        return;
      }

      const campusIds = vendorDeliveryData.map(item => item.campus_id);
      await fetchCampusDetails(campusIds);
    } catch (error) {
      console.error('Error in fetchVendorDeliveryCampuses:', error);
      setDeliveryCampuses([]);
    }
  };

  const fetchCampusDetails = async (campusIds: string[]) => {
    try {
      const { data: campuses, error: campusesError } = await supabase
        .from('campuses')
        .select(`
          id,
          name,
          city,
          full_address,
          universities!inner (
            name,
            abbreviation
          ),
          states!inner (
            name
          )
        `)
        .in('id', campusIds);

      if (campusesError) {
        console.error('Error fetching campus details:', campusesError);
        setDeliveryCampuses([]);
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

      transformedCampuses.sort((a, b) => a.name.localeCompare(b.name));
      setDeliveryCampuses(transformedCampuses);
    } catch (error) {
      console.error('Error in fetchCampusDetails:', error);
      setDeliveryCampuses([]);
    }
  };

  const handleNextImage = () => {
    if (product.images?.length > 0 && !imageLoading) {
      const nextIndex = (currentImageIndex + 1) % product.images.length;
      setImageLoading(true);
      setCurrentImageIndex(nextIndex);
    }
  };

  const handlePrevImage = () => {
    if (product.images?.length > 0 && !imageLoading) {
      const prevIndex = currentImageIndex === 0 ? product.images.length - 1 : currentImageIndex - 1;
      setImageLoading(true);
      setCurrentImageIndex(prevIndex);
    }
  };

  const handleFullscreenNextImage = () => {
    if (product.images?.length > 0 && !fullscreenImageLoading) {
      const nextIndex = (currentImageIndex + 1) % product.images.length;
      setFullscreenImageLoading(true);
      setCurrentImageIndex(nextIndex);
    }
  };

  const handleFullscreenPrevImage = () => {
    if (product.images?.length > 0 && !fullscreenImageLoading) {
      const prevIndex = currentImageIndex === 0 ? product.images.length - 1 : currentImageIndex - 1;
      setFullscreenImageLoading(true);
      setCurrentImageIndex(prevIndex);
    }
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleFullscreenImageLoad = () => {
    setFullscreenImageLoading(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !product.images?.length) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };

    const dx = touchEnd.x - touchStart.x;
    const dy = touchEnd.y - touchStart.y;
    const minSwipeDistance = 50;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipeDistance) {
      if (dx > 0) {
        if (isFullscreen) {
          handleFullscreenPrevImage();
        } else {
          handlePrevImage();
        }
      } else {
        if (isFullscreen) {
          handleFullscreenNextImage();
        } else {
          handleNextImage();
        }
      }
    }

    if (isFullscreen && dy > minSwipeDistance && Math.abs(dx) < Math.abs(dy)) {
      handleCloseFullscreen();
    }

    setTouchStart(null);
  };

  const handleAddToCart = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('shopping_cart') || '[]');
      const existingIndex = cart.findIndex((item: any) => item.productId === product.id);
      
      if (existingIndex > -1) {
        cart[existingIndex].quantity += quantity;
      } else {
        cart.push({
          productId: product.id,
          title: product.title,
          price: product.price,
          currency: product.currency,
          image: product.images?.[0] || '',
          vendorId: product.vendor_id,
          vendorName: product.vendor_name || vendor?.shop_name || 'Unknown Vendor',
          quantity: quantity,
          addedAt: new Date().toISOString()
        });
      }
      
      localStorage.setItem('shopping_cart', JSON.stringify(cart));
      
      const notification = document.createElement('div');
      notification.className = 'productdisplaycartnotification';
      notification.innerHTML = `
        <div class="productdisplaynotificationcontent">
          <span>✅ Added to cart</span>
        </div>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate('/cart');
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleCloseFullscreen = () => {
    setIsFullscreen(false);
  };

  const calculateDiscount = () => {
    if (product.original_price && product.original_price > product.price) {
      return Math.round((1 - product.price / product.original_price) * 100);
    }
    return 0;
  };

  const discount = calculateDiscount();

  const getConditionLabel = (condition: string) => {
    const labels: Record<string, string> = {
      'new': 'New',
      'like_new': 'Like New',
      'used_good': 'Good',
      'used_fair': 'Fair',
      'for_parts': 'For Parts'
    };
    return labels[condition] || condition;
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(
          <Star key={i} className="productdisplaystarfull" size={14} fill="#f59e0b" stroke="#f59e0b" />
        );
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(
          <div key={i} className="productdisplaystarhalf">
            <Star size={14} fill="#f59e0b" stroke="#f59e0b" />
          </div>
        );
      } else {
        stars.push(
          <Star key={i} className="productdisplaystarempty" size={14} stroke="#d1d5db" />
        );
      }
    }
    
    return stars;
  };

  const getContainerClass = () => {
    let containerClass = 'productdisplaycontainer';
    if (isFullscreen) {
      containerClass += ' productdisplayfullscreen';
    } else if (embedded) {
      containerClass += ' productdisplayembedded';
    }
    return containerClass;
  };

  const handleLikeChange = (isLiked: boolean, newLikesCount: number) => {
    // Update local likes count to keep UI in sync
    setCurrentLikesCount(newLikesCount);
  };

  return (
    <div 
      className={getContainerClass()} 
      ref={containerRef}
    >
      {showLoginPrompt && (
        <div className="productdisplayloginprompt">
          <div className="productdisplayloginpromptcontent">
            <LogIn size={20} />
            <span>Please login to add favorites</span>
            <button 
              className="productdisplayloginpromptbtn"
              onClick={() => navigate('/signin')}
            >
              Login
            </button>
            <button 
              className="productdisplayloginpromptclose"
              onClick={() => setShowLoginPrompt(false)}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {isFullscreen && (
        <div 
          className="productdisplayfullscreenoverlay"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button 
            className="productdisplayfullscreenbackbtn"
            onClick={handleCloseFullscreen}
          >
            <ArrowLeft size={24} />
          </button>
          
          <div className="productdisplayfullscreenimages">
            {product.images && product.images.length > 0 ? (
              <div className="productdisplayfullscreenimagecontainer">
                <img
                  ref={fullscreenImageRef}
                  src={product.images[currentImageIndex]}
                  alt={`${product.title} - Image ${currentImageIndex + 1}`}
                  className="productdisplayfullscreenimage"
                  onLoad={handleFullscreenImageLoad}
                  style={{ display: fullscreenImageLoading ? 'none' : 'block' }}
                />
                
                {fullscreenImageLoading && (
                  <div className="productdisplayimageloading">
                    <div className="productdisplayloadingdots">
                      <div className="productdisplayloadingdot"></div>
                      <div className="productdisplayloadingdot"></div>
                      <div className="productdisplayloadingdot"></div>
                    </div>
                  </div>
                )}
                
                <button 
                  className="productdisplayfullscreennavbtn productdisplayfullscreenprevbtn"
                  onClick={handleFullscreenPrevImage}
                  disabled={fullscreenImageLoading}
                >
                  <ArrowLeft size={24} />
                </button>
                
                <button 
                  className="productdisplayfullscreennavbtn productdisplayfullscreennextbtn"
                  onClick={handleFullscreenNextImage}
                  disabled={fullscreenImageLoading}
                >
                  <ArrowRight size={24} />
                </button>
                
                <div className="productdisplayfullscreendots">
                  {product.images.map((_, index) => (
                    <div 
                      key={index}
                      className={`productdisplayfullscreendot ${index === currentImageIndex ? 'productdisplayfullscreendotactive' : ''}`}
                      onClick={() => {
                        if (!fullscreenImageLoading) {
                          setFullscreenImageLoading(true);
                          setCurrentImageIndex(index);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="productdisplaynofullscreenimages">
                <ShoppingBag size={40} className="productdisplaynofullscreenimageicon" />
                <p>No images available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!isFullscreen && (
        <>
          <div className="productdisplayimagesection">
            <div 
              className="productdisplayimagecontainer"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {product.images && product.images.length > 0 ? (
                <>
                  <img
                    ref={imageRef}
                    src={product.images[currentImageIndex]}
                    alt={`${product.title} - Image ${currentImageIndex + 1}`}
                    className="productdisplaymainproductimage"
                    onClick={handleToggleFullscreen}
                    onLoad={handleImageLoad}
                    style={{ display: imageLoading ? 'none' : 'block' }}
                  />
                  
                  {imageLoading && (
                    <div className="productdisplayimageloading">
                      <div className="productdisplayloadingdots">
                        <div className="productdisplayloadingdot"></div>
                        <div className="productdisplayloadingdot"></div>
                        <div className="productdisplayloadingdot"></div>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    className="productdisplayimagenavbtn productdisplayimageprevbtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevImage();
                    }}
                    disabled={imageLoading}
                  >
                    <ArrowLeft size={18} />
                  </button>
                  
                  <button 
                    className="productdisplayimagenavbtn productdisplayimagenextbtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextImage();
                    }}
                    disabled={imageLoading}
                  >
                    <ArrowRight size={18} />
                  </button>
                  
                  <div className="productdisplayimagedots">
                    {product.images.map((_, index) => (
                      <div 
                        key={index}
                        className={`productdisplayimagedot ${index === currentImageIndex ? 'productdisplayimagedotactive' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!imageLoading) {
                            setImageLoading(true);
                            setCurrentImageIndex(index);
                          }
                        }}
                      />
                    ))}
                  </div>
                  
                  <button 
                    className="productdisplayfullscreenbtn"
                    onClick={handleToggleFullscreen}
                  >
                    <Maximize2 size={16} />
                  </button>
                </>
              ) : (
                <div className="productdisplaynoimagesplaceholder" onClick={handleToggleFullscreen}>
                  <ShoppingBag size={32} className="productdisplayplaceholdericon" />
                  <p>No image</p>
                </div>
              )}
            </div>
          </div>

          <div className="productdisplayinfosection">
            <div className="productdisplaytitlepricerow">
              <h1 className="productdisplayproducttitle">{product.title}</h1>
              <div className="productdisplayproductprice">{formatPrice(product.price, product.currency)}</div>
            </div>

            <div className="productdisplayproductstats">
              <div className="productdisplaystatitem">
                <Eye size={14} className="productdisplaystaticon" />
                <span className="productdisplaystatvalue">{product.views_count || 0}</span>
              </div>
              <div className="productdisplaystatitem">
                <Heart size={14} className="productdisplaystaticon" />
                <span className="productdisplaystatvalue">{currentLikesCount}</span>
              </div>
              <div className="productdisplaystatitem">
                <ShoppingCart size={14} className="productdisplaystaticon" />
                <span className="productdisplaystatvalue">{product.sales_count || 0}</span>
              </div>
              <div className="productdisplaystatitem">
                <Package size={14} className="productdisplaystaticon" />
                <span className="productdisplaystatvalue">{product.inventory}</span>
              </div>
            </div>

            <div className="productdisplaydeliverylocations" ref={deliveryDropdownRef}>
              <div 
                className="productdisplaydeliverylocationsheader"
                onClick={() => setShowDeliveryDropdown(!showDeliveryDropdown)}
              >
                <MapPin size={16} className="productdisplaydeliverylocationicon" />
                <span className="productdisplaydeliverylocationstitle">Delivery Locations</span>
                <span className="productdisplaydeliverylocationsarrow">
                  {showDeliveryDropdown ? '▲' : '▼'}
                </span>
              </div>
              
              {showDeliveryDropdown && (
                <div className="productdisplaydeliverylocationsdropdown">
                  {deliveryCampuses.length > 0 ? (
                    <>
                      <div className="productdisplaydeliverylocationslist">
                        {deliveryCampuses.map((campus) => (
                          <div key={campus.id} className="productdisplaydeliverylocationitem">
                            <div className="productdisplaycampusrow">
                              <span className="productdisplaycampusname">{campus.name}</span>
                            </div>
                            <div className="productdisplayuniversityrow">
                              <span className="productdisplayuniversityinfo">
                                {campus.university.name} ({campus.university.abbreviation})
                              </span>
                            </div>
                            <div className="productdisplaylocationrow">
                              <span className="productdisplaylocationdetails">
                                {campus.city}, {campus.state.name}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="productdisplaydeliverylocationscount">
                        {deliveryCampuses.length} {deliveryCampuses.length === 1 ? 'campus' : 'campuses'}
                      </div>
                    </>
                  ) : (
                    <div className="productdisplaynodeliverylocations">
                      <MapPin size={20} className="productdisplaynodeliveryicon" />
                      <span className="productdisplaynodeliverytext">No delivery locations specified</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {vendor && (
              <div 
                className="productdisplayvendorinfo"
                onClick={onNavigateToVendorShop}
              >
                <div className="productdisplayvendoravatar">
                  <img 
                    src={vendor.profile_image || '/default-avatar.jpg'} 
                    alt={vendor.shop_name}
                  />
                  {vendor.online_status && <div className="productdisplayvendoronlinedot"></div>}
                </div>
                <div className="productdisplayvendordetails">
                  <div className="productdisplayvendorname">
                    {vendor.shop_name}
                    {vendor.is_verified && (
                      <CheckCircle size={14} className="productdisplayvendorverifiedbadge" />
                    )}
                  </div>
                  <div className="productdisplayvendorstats">
                    <span className="productdisplayvendorstatitem">
                      <Star size={12} className="productdisplayvendorstaticon" />
                      <span className="productdisplayvendorstatvalue">{vendor.rating?.toFixed(1) || '0.0'}</span>
                    </span>
                    <span className="productdisplayvendorstatitem">
                      <Users size={12} className="productdisplayvendorstaticon" />
                      <span className="productdisplayvendorstatvalue">{vendor.followers_count || 0}</span>
                    </span>
                    <span className="productdisplayvendorstatitem">
                      <TrendingUp size={12} className="productdisplayvendorstaticon" />
                      <span className="productdisplayvendorstatvalue">{vendor.completed_trades || 0}</span>
                    </span>
                  </div>
                </div>
                <div className="productdisplayvendorarrow">›</div>
              </div>
            )}

            <div className="productdisplayactionbuttonsrow">

               <CartButton 
                productId={product.id}
                vendorId={product.vendor_id}
                productName={product.title}
              >

              <button 
                className="productdisplayactionbtn productdisplaybuynowbtn"
                onClick={handleBuyNow}
                disabled={product.inventory === 0}
              >
                <ShoppingCart size={14} className="productdisplayactionicon" />
                <span>Buy Now</span>
              </button>
              </CartButton>
              
              <CartButton 
                productId={product.id}
                vendorId={product.vendor_id}
                productName={product.title}
              >
                <button 
                  className="productdisplayactionbtn productdisplayaddtocartbtn"
                  disabled={product.inventory === 0}
                >
                  <Package size={14} className="productdisplayactionicon" />
                  <span>Add to Cart</span>
                </button>
              </CartButton>
              
              <FavoriteButton 
                productId={product.id}
                className="productdisplayfavoritebtn"
                size="md"
                showCount={false}
                initialLikesCount={product.likes_count || 0}
                onLikeChange={handleLikeChange}
              />
            </div>

            <div className="productdisplayinfosections">
              <div className="productdisplayinfosection">
                <h3 className="productdisplaysectiontitle">Description</h3>
                <p className="productdisplaysectioncontent">{product.description}</p>
              </div>

              <div className="productdisplayinfosection">
                <h3 className="productdisplaysectiontitle">Condition</h3>
                <div className="productdisplayconditionbadge">
                  {getConditionLabel(product.condition)}
                </div>
              </div>

              {product.specifications && Object.keys(product.specifications).length > 0 && (
                <div className="productdisplayinfosection">
                  <h3 className="productdisplaysectiontitle">Specifications</h3>
                  <div className="productdisplayspecsgrid">
                    {Object.entries(product.specifications).map(([key, value]) => (
                      <div key={key} className="productdisplayspecitem">
                        <span className="productdisplayspeckey">{key}:</span>
                        <span className="productdisplayspecvalue">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {product.shipping_info && (
                <div className="productdisplayinfosection">
                  <h3 className="productdisplaysectiontitle">
                    <Truck size={16} className="productdisplaysectiontitleicon" />
                    Shipping
                  </h3>
                  <div className="productdisplayshippinginfo">
                    {product.shipping_info.shipping_cost !== undefined && (
                      <div className="productdisplayshippingitem">
                        <span>Cost:</span>
                        <span>
                          {product.shipping_info.shipping_cost === 0 
                            ? 'Free Shipping' 
                            : formatPrice(product.shipping_info.shipping_cost, product.currency)}
                        </span>
                      </div>
                    )}
                    {product.shipping_info.estimated_delivery && (
                      <div className="productdisplayshippingitem">
                        <span>Delivery:</span>
                        <span>{product.shipping_info.estimated_delivery}</span>
                      </div>
                    )}
                    {product.shipping_info.free_shipping_threshold && (
                      <div className="productdisplayshippingitem">
                        <span>Free Shipping Over:</span>
                        <span>{formatPrice(product.shipping_info.free_shipping_threshold, product.currency)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {product.warranty_info?.has_warranty && (
                <div className="productdisplayinfosection">
                  <h3 className="productdisplaysectiontitle">
                    <Shield size={16} className="productdisplaysectiontitleicon" />
                    Warranty
                  </h3>
                  <div className="productdisplaywarrantyinfo">
                    <div className="productdisplaywarrantyperiod">
                      Period: {product.warranty_info.warranty_period}
                    </div>
                    {product.warranty_info.warranty_details && (
                      <div className="productdisplaywarrantydetails">
                        {product.warranty_info.warranty_details}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="productdisplayinfosection">
                <h3 className="productdisplaysectiontitle">Average Rating</h3>
                <div className="productdisplayratingcontainer">
                  <div className="productdisplayratingstars">
                    {renderStars(product.average_rating || 4.5)}
                  </div>
                  <div className="productdisplayratingvalue">{product.average_rating?.toFixed(1) || '4.5'}</div>
                  <div className="productdisplayratingcount">
                    ({product.review_count || 0} reviews)
                  </div>
                </div>
              </div>

              {product.tags && product.tags.length > 0 && (
                <div className="productdisplayinfosection">
                  <h3 className="productdisplaysectiontitle">
                    <Tag size={16} className="productdisplaysectiontitleicon" />
                    Tags
                  </h3>
                  <div className="productdisplaytagscontainer">
                    {product.tags.map((tag, index) => (
                      <span key={index} className="productdisplaytag">#{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {embedded && (
              <button className="productdisplayembeddedbackbtn" onClick={onClose}>
                <Home size={14} className="productdisplayembeddedbackicon" />
                <span>Back to Shop</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProductDisplay;