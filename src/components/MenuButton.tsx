import React from 'react';
import { Menu } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';

interface MenuButtonProps {
  className?: string;
  size?: number;
}

const MenuButton: React.FC<MenuButtonProps> = ({ className = '', size = 20 }) => {
  const { toggleSidebar } = useSidebar();

  return (
    <button 
      className={`menu-button ${className}`}
      onClick={toggleSidebar}
      style={{
        background: 'rgba(155, 72, 25, 0.1)',
        border: '1px solid rgba(155, 72, 25, 0.2)',
        borderRadius: '16px',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '2px',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9B4819',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(155, 72, 25, 0.2)';
        e.currentTarget.style.borderColor = 'rgba(155, 72, 25, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(155, 72, 25, 0.1)';
        e.currentTarget.style.borderColor = 'rgba(155, 72, 25, 0.2)';
      }}
      aria-label="Menu"
    >
      <Menu size={size} />
    </button>
  );
};

export default MenuButton;