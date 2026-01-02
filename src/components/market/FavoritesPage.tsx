import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { supabase } from '../../lib/supabaseClient';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { 
  ArrowLeft, 
  Heart, 
  ShoppingCart, 
  Eye, 
  Store, 
  Shield,
  User as UserIcon,
  Trash2,
  ShoppingBag,
  CheckCircle,
  Package
} from 'lucide-react';
import './FavoritesPage.css';
import CartButton from './CartButton'; // Import CartButton component
import FavoriteButton from './FavoriteButton'; // Import FavoriteButton component

// Types
interface Product {
  id: string;
  title: string;
  price: number;
  currency: string;
  images: string[];
  vendor_id: string;
  vendor_name: string;
  created_at: string;
  category?: string;
  condition?: string;
  inventory?: number;
  is_promoted?: boolean;
  views_count?: number;
  likes_count?: number;
  sales_count?: number;
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

interface UserProfile {
  id: string;
  email: string;
  name: string;
  profileImage?: string;
}

const FavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [vendorProfiles, setVendorProfiles] = useState<Record<string, VendorProfile>>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [removingProductId, setRemovingProductId] = useState<string | null>(null);
  const [cartStatus, setCartStatus] = useState<{ [key: string]: boolean }>({});

  // Fetch user and favorites data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user);
        await fetchFavorites(user.uid);
      } else {
        navigate('/signin', { state: { from: '/favorites' } });
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
        setUserProfile({
          id: user.uid,
          email: userData.email || user.email || '',
          name: userData.name || user.displayName || 'User',
          profileImage: userData.profileImage || user.photoURL || ''
        });
      } else {
        setUserProfile({
          id: user.uid,
          email: user.email || '',
          name: user.displayName || 'User',
          profileImage: user.photoURL || ''
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile({
        id: user.uid,
        email: user.email || '',
        name: user.displayName || 'User',
        profileImage: user.photoURL || ''
      });
    }
  };

  // Fetch vendor profiles in batch
  const fetchVendorProfiles = async (vendorIds: string[]) => {
    try {
      const uniqueVendorIds = Array.from(new Set(vendorIds));
      if (uniqueVendorIds.length === 0) return {};
      
      const { data: vendorsData, error } = await supabase
        .from('vendor_profiles')
        .select('*')
        .in('vendor_id', uniqueVendorIds);

      if (error) {
        console.error('Error fetching vendor profiles:', error);
        return {};
      }

      const profiles: Record<string, VendorProfile> = {};
      vendorsData?.forEach(vendor => {
        profiles[vendor.vendor_id] = {
          id: vendor.id,
          vendor_id: vendor.vendor_id,
          shop_name: vendor.shop_name || 'Shop',
          profile_image: vendor.profile_image || '',
          cover_image: vendor.cover_image,
          rating: vendor.rating || 0,
          followers_count: vendor.followers_count || 0,
          completed_trades: vendor.completed_trades || 0,
          is_verified: vendor.is_verified || false,
          online_status: vendor.online_status || false
        };
      });

      return profiles;
    } catch (error) {
      console.error('Error in fetchVendorProfiles:', error);
      return {};
    }
  };

  // Fetch favorites with vendor profiles
  const fetchFavorites = async (userId: string) => {
    try {
      setLoading(true);
      
      // Step 1: Get favorite product IDs
      const { data: favoritesData, error: favoritesError } = await supabase
        .from('user_favorites')
        .select('product_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (favoritesError) {
        console.error('Error fetching favorite IDs:', favoritesError);
        setFavorites([]);
        return;
      }

      if (!favoritesData || favoritesData.length === 0) {
        setFavorites([]);
        setVendorProfiles({});
        return;
      }

      const productIds = favoritesData.map(fav => fav.product_id);
      
      // Step 2: Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      if (productsError) {
        console.error('Error fetching products:', productsError);
        setFavorites([]);
        return;
      }

      const products: Product[] = productsData || [];
      setFavorites(products);
      
      // Step 3: Fetch vendor profiles for all products
      const vendorIds = products.map(p => p.vendor_id).filter(Boolean);
      const profiles = await fetchVendorProfiles(vendorIds);
      setVendorProfiles(profiles);
      
      // Step 4: Fetch cart status for products
      await fetchCartStatus(userId, productIds);
      
    } catch (error) {
      console.error('Error fetching favorites:', error);
      setFavorites([]);
      setVendorProfiles({});
    } finally {
      setLoading(false);
    }
  };

  // Fetch cart status for products
  const fetchCartStatus = async (userId: string, productIds: string[]) => {
    try {
      if (productIds.length === 0) return;
      
      const { data, error } = await supabase
        .from('carts')
        .select('product_id')
        .eq('user_id', userId)
        .in('product_id', productIds);

      if (error) {
        console.error('Error fetching cart status:', error);
        return;
      }

      const statusMap: { [key: string]: boolean } = {};
      data?.forEach(item => {
        statusMap[item.product_id] = true;
      });

      setCartStatus(statusMap);
    } catch (error) {
      console.error('Error in fetchCartStatus:', error);
    }
  };

  // Remove from favorites
  const removeFromFavorites = async (productId: string) => {
    if (!currentUser) return;

    try {
      setRemovingProductId(productId);
      
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', currentUser.uid)
        .eq('product_id', productId);

      if (error) throw error;

      setFavorites(prev => prev.filter(item => item.id !== productId));
      
    } catch (error) {
      console.error('Error removing from favorites:', error);
      alert('Failed to remove from favorites');
    } finally {
      setRemovingProductId(null);
    }
  };

  // FIXED: Click product to navigate to vendor shop with product (like marketplace)
  const handleProductClick = (vendorId: string, productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/vendor/${vendorId}`, { 
      state: { 
        initialProductId: productId,
        fromFavorites: true 
      } 
    });
  };

  // Click vendor to open vendor shop
  const handleVendorClick = (vendorId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/vendor/${vendorId}`);
  };

  // Handle cart update callback
  const handleCartUpdate = (productId: string, isInCart: boolean) => {
    setCartStatus(prev => ({
      ...prev,
      [productId]: isInCart
    }));
  };

  const formatPrice = (price: number) => `₦${price.toLocaleString('en-NG')}`;

  // Calculate stats
  const calculateStats = () => {
    const totalValue = favorites.reduce((sum, item) => sum + item.price, 0);
    const uniqueVendors = new Set(favorites.map(item => item.vendor_id));
    const totalProducts = favorites.length;
     const totalInCart = favorites.reduce((sum, item) => {
    return sum + (cartStatus[item.id] ? 1 : 0);
  }, 0);

    return {
      totalValue,
      totalVendors: uniqueVendors.size,
      totalProducts,
      totalInCart
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="favoritespage-loading">
        <div className="favoritespage-spinner"></div>
      </div>
    );
  }

  return (
    <div className="favoritespage-container">
      {/* Fixed Header - Profile left, Back right */}
      <header className="favoritespage-header">
        {/* Profile at LEFT */}
        <div className="favoritespage-user">
          {userProfile?.profileImage ? (
            <img 
              src={userProfile.profileImage} 
              alt="Profile" 
              className="favoritespage-userpic"
            />
          ) : (
            <div className="favoritespage-userpic">
              <UserIcon size={12} />
            </div>
          )}
          <span className="favoritespage-username">
            {userProfile?.name || currentUser?.email?.split('@')[0] || 'User'}
          </span>
        </div>
        
        <h1 className="favoritespage-title">My Favorites</h1>
        
        {/* Back button at RIGHT */}
        <button 
          className="favoritespage-back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} />
        </button>
      </header>

      {/* Stats Section with 4 boxes */}
      <section className="favoritespage-stats">
        <div className="favoritespage-statstitle">
          <Heart size={12} /> 
          My Favorites ({favorites.length})
        </div>
        <div className="favoritespage-statsgrid">
          <div className="favoritespage-statcard">
            <span className="favoritespage-statlabel">Total Items</span>
            <span className="favoritespage-statvalue">{favorites.length}</span>
          </div>
          <div className="favoritespage-statcard">
            <span className="favoritespage-statlabel">Total Value</span>
            <span className="favoritespage-statvalue">
              {formatPrice(stats.totalValue)}
            </span>
          </div>
          <div className="favoritespage-statcard">
            <span className="favoritespage-statlabel">Vendors</span>
            <span className="favoritespage-statvalue">{stats.totalVendors}</span>
          </div>
          <div className="favoritespage-statcard">
  <span className="favoritespage-statlabel">In Cart</span>
  <span className="favoritespage-statvalue">{stats.totalInCart}</span>
</div>
        </div>
      </section>

      {/* Products Section */}
      <section className="favoritespage-products">
        {favorites.length === 0 ? (
          <div className="favoritespage-empty">
            <Heart size={48} className="favoritespage-empty-heart" />
            <h3 className="favoritespage-empty-title">No favorites yet</h3>
            <p className="favoritespage-empty-subtitle">
              Items you like will appear here. Start exploring and add your favorite products!
            </p>
            <button
              className="favoritespage-browsebtn"
              onClick={() => navigate('/marketplace')}
            >
              Browse Marketplace
            </button>
          </div>
        ) : (
          <div className="favoritespage-itemslist">
            {favorites.map((product) => {
              const vendor = vendorProfiles[product.vendor_id];
              const isInCart = cartStatus[product.id] || false;
              
              return (
                <div 
                  key={product.id} 
                  className="favoritespage-item"
                  onClick={(e) => handleProductClick(product.vendor_id, product.id, e)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Product Image */}
                  <div className="favoritespage-itemimage">
                    {product.images && product.images[0] ? (
                      <img 
                        src={product.images[0]} 
                        alt={product.title}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="favoritespage-noimage">
                        <ShoppingBag size={24} />
                      </div>
                    )}
                    
                    {/* Promoted badge */}
                    {product.is_promoted && (
                      <div className="favoritespage-promotedbadge">
                        Promoted
                      </div>
                    )}
                  </div>
                  
                  {/* Product Info */}
                  <div className="favoritespage-itemdetails">
                    <div className="favoritespage-itemtop">
                      <h3 className="favoritespage-itemtitle">
                        {product.title || 'Product'}
                      </h3>
                      <div className="favoritespage-itemprice">
                        {formatPrice(product.price || 0)}
                      </div>
                    </div>
                    
                    <div className="favoritespage-itembottom">
                      <div className="favoritespage-iteminfo">
                        {product.category && (
                          <span className="favoritespage-itemcategory">
                            {product.category}
                          </span>
                        )}
                        {product.condition && (
                          <span className="favoritespage-itemcondition">
                            {product.condition}
                          </span>
                        )}
                      </div>
                      
                      {/* Stats */}
                      <div className="favoritespage-itemstats">
                        <div className="favoritespage-itemstat">
                          <Eye size={10} />
                          <span>{product.views_count || 0}</span>
                        </div>
                        <div className="favoritespage-itemstat">
                          <Heart size={10} />
                          <span>{product.likes_count || 0}</span>
                        </div>
                        <div className="favoritespage-itemstat">
                          <Package size={10} />
                          <span>{product.inventory || 0}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Vendor info - EXACTLY like CartPage */}
                    {vendor && (
                      <div 
                        className="favoritespage-shopinfo" 
                        onClick={(e) => handleVendorClick(product.vendor_id, e)}
                      >
                        {vendor.profile_image ? (
                          <img 
                            src={vendor.profile_image} 
                            alt={vendor.shop_name} 
                            className="favoritespage-shoplogo"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="favoritespage-shoplogo favoritespage-shoplogo-placeholder">
                            {vendor.shop_name?.charAt(0) || 'S'}
                          </div>
                        )}
                        <span className="favoritespage-shopname">{vendor.shop_name || 'Shop'}</span>
                        {vendor.is_verified && <span className="favoritespage-shopverified">✓</span>}
                      </div>
                    )}
                    
                    {/* Actions - Using CartButton and FavoriteButton components */}
                    <div 
                      className="favoritespage-itemactions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Remove from favorites button */}
                      <button
                        className="favoritespage-actionbtn remove"
                        onClick={() => removeFromFavorites(product.id)}
                        disabled={removingProductId === product.id}
                      >
                        <Heart size={12} fill="#ef4444" stroke="#ef4444" />
                        {removingProductId === product.id ? 'Removing...' : 'Remove'}
                      </button>
                      
                      {/* Add to Cart button using CartButton component */}
                     {/* Add to Cart button using CartButton component */}
<CartButton 
  productId={product.id}
  vendorId={product.vendor_id}
  productName={product.title}
  onCartUpdate={(isInCart) => handleCartUpdate(product.id, isInCart)}
>
  <button 
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '6px 8px',
      borderRadius: '6px',
      fontSize: '10px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      fontWeight: '600',
      height: '28px',
      flexShrink: '0',
      transition: 'all 0.2s ease',
      backgroundColor: isInCart ? '#d4edda' : '#f9f1eb',
      color: isInCart ? '#155724' : '#9B4819',
      border: `1px solid ${isInCart ? '#c3e6cb' : '#e0d6cc'}`
    }}
  >
    <ShoppingCart size={12} />
    <span>{isInCart ? 'In Cart' : 'Add to Cart'}</span>
  </button>
</CartButton>
                      
                      {/* Visit Shop button */}
                      {product.vendor_id && (
                        <button
                          className="favoritespage-actionbtn view"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/vendor/${product.vendor_id}`);
                          }}
                        >
                          <Store size={12} />
                          Visit Shop
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="favoritespage-footer">
        <div className="favoritespage-security">
          <Shield size={12} />
          <span>gostorez handles secured purchase</span>
        </div>
        <p className="favoritespage-footertext">
          Your favorites are saved securely. 
          See more terms/policy...@gostorez Enterprise
        </p>
      </footer>
    </div>
  );
};

export default FavoritesPage;