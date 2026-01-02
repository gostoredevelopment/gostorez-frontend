import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { auth } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';

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