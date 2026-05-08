import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useSidebar } from '../contexts/SidebarContext';
import { 
  Home, 
  Heart, 
  ShoppingCart, 
  ShoppingBag, 
  User as UserIcon,
  MessagesSquare,
  X,
  RefreshCw
} from 'lucide-react';

interface SidebarProps {
  userNotifications?: number; // Optional notification count from parent
}

const Sidebar: React.FC<SidebarProps> = ({ userNotifications = 0 }) => {
  const { isOpen, closeSidebar } = useSidebar();
  const navigate = useNavigate();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        closeSidebar();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent body scroll when sidebar is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeSidebar]);

  const handleNavigate = (path: string) => {
    navigate(path);
    closeSidebar();
  };

  const handleSignOut = async () => {
    await signOut(auth);
    handleNavigate('/signin');
  };

  if (!isOpen) return null;

  return (
    <div className="sidebar-overlay">
      <div ref={sidebarRef} className="sidebar-menu">
        <div className="sidebar-header">
          <button className="sidebar-close" onClick={closeSidebar}>
            <X size={20} />
          </button>
          <h3 className="sidebar-title">Menu</h3>
        </div>
        
        <div className="sidebar-content">
          <button 
            className="sidebar-item"
            onClick={() => handleNavigate('/user/dashboard')}
          >
            <Home size={20} />
            <span>Home</span>
          </button>
          
          <button 
            className="sidebar-item"
            onClick={() => handleNavigate('/favorites')}
          >
            <Heart size={20} />
            <span>Favourites</span>
          </button>
          
          <button 
            className="sidebar-item"
            onClick={() => handleNavigate('/cart')}
          >
            <ShoppingCart size={20} />
            <span>Cart</span>
          </button>

          {auth.currentUser && (
            <button 
              className="sidebar-item"
              onClick={() => handleNavigate('/vendor/dashboard')}
            >
              <ShoppingBag size={20} />
              <span>My Shop</span>
            </button>
          )}
          
          <button 
            className="sidebar-item"
            onClick={() => handleNavigate('/chats')}
          >
            <MessagesSquare size={20} />
            <span>Messages</span>
            {userNotifications > 0 && (
              <span className="sidebar-badge">{userNotifications}</span>
            )}
          </button>
          
          {auth.currentUser ? (
            <>
              <button 
                className="sidebar-item"
                onClick={() => handleNavigate('/user/profile')}
              >
                <UserIcon size={20} />
                <span>My Account</span>
              </button>
              
              <button 
                className="sidebar-item"
                onClick={handleSignOut}
              >
                <X size={20} />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <button 
              className="sidebar-item"
              onClick={() => handleNavigate('/signin')}
            >
              <UserIcon size={20} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;