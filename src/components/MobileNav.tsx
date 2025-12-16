import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, MessageCircle, User, Search, Heart, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileUtils } from '@/lib/mobile-utils';

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  id: string;
}

const navItems: NavItem[] = [
  {
    id: 'home',
    icon: Home,
    label: 'Home',
    path: '/'
  },
  {
    id: 'discover',
    icon: Search,
    label: 'Discover',
    path: '/discover'
  },
  {
    id: 'inbox',
    icon: MessageCircle,
    label: 'Messages',
    path: '/inbox'
  },
  {
    id: 'profile',
    icon: User,
    label: 'Profile',
    path: '/profile'
  }
];

export const MobileNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavClick = (item: NavItem) => {
    // Add haptic feedback on mobile
    MobileUtils.hapticFeedback();
    navigate(item.path);
  };

  return (
    <nav className="mobile-nav safe-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={cn(
                "flex flex-col items-center justify-center min-w-0 flex-1 h-full transition-colors touch-manipulation",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={item.label}
            >
              <Icon 
                size={20} 
                className={cn(
                  "mb-1 transition-all duration-200",
                  isActive ? "scale-110" : "scale-100"
                )} 
              />
              <span className="text-xs font-medium truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;