import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Trophy, Crown, BarChart3, Database, Package, Users, Settings,
  ChevronDown, ChevronRight, X, LogIn, LogOut, Menu, Shield, User
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LoginForm } from '../Auth/LoginForm';

interface NavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onToggle?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  requiresAuth?: boolean;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <Home size={20} />,
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <Home size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'] }
    ]
  },
  {
    id: 'overview',
    label: 'Overview',
    icon: <Trophy size={20} />,
    items: [
      { id: 'tournaments', label: 'Tournaments', icon: <Trophy size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'] },
      { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'] },
      { id: 'personal-stats', label: 'Personal Stats', icon: <User size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'], requiresAuth: true }
    ]
  },
  {
    id: 'database',
    label: 'Database',
    icon: <Database size={20} />,
    items: [
      { id: 'parts-database', label: 'Parts Database', icon: <Database size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'] },
      { id: 'inventory', label: 'Inventory & Decks', icon: <Package size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'] }
    ]
  },
  {
    id: 'management',
    label: 'Management',
    icon: <Users size={20} />,
    items: [
      { id: 'team-manager', label: 'Team Manager (Beta)', icon: <Users size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'] },
      { id: 'community-manager', label: 'Community Manager', icon: <Users size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'] },
      { id: 'claim-requests', label: 'Claim Requests', icon: <Shield size={20} />, roles: ['admin', 'developer'] },
      // { id: 'tournament-manager', label: 'Tournament Manager', icon: <Settings size={20} />, roles: ['admin', 'developer'] },
      { id: 'user-management', label: 'User Management', icon: <Users size={20} />, roles: ['admin', 'developer'] },
      { id: 'database', label: 'Database', icon: <Database size={20} />, roles: ['developer'] }
    ]
  },
  {
    id: 'bbx-database',
    label: 'BBX Database',
    icon: <Database size={20} />,
    items: [
      { id: 'bbx-database-update', label: 'Update BBX Database', icon: <Database size={20} />, roles: ['admin', 'developer'] }
    ]
  }
];

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const { user, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showDevPopup, setShowDevPopup] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Filter menu groups based on user role
  const getFilteredGroups = () => {
    return menuGroups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!user) {
          return !item.requiresAuth && item.roles.includes('user');
        }
        return item.roles.includes(user.role || 'user');
      })
    })).filter(group => group.items.length > 0);
  };

  // Handle scroll for header hide/show
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < 10) {
        setIsHeaderVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsHeaderVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isMobileMenuOpen) {
        const mobileMenu = document.getElementById('mobile-navigation');
        const toggleButton = document.getElementById('mobile-menu-toggle');
        
        if (
          mobileMenu &&
          !mobileMenu.contains(e.target as Node) &&
          toggleButton &&
          !toggleButton.contains(e.target as Node)
        ) {
          setIsMobileMenuOpen(false);
          setOpenMobileGroup(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  const handleMobileGroupToggle = (groupId: string) => {
    setOpenMobileGroup(openMobileGroup === groupId ? null : groupId);
  };

  const handleNavigation = (viewId: string) => {
    onViewChange(viewId);
    setIsMobileMenuOpen(false);
    setOpenMobileGroup(null);
    setHoveredGroup(null);
  };

  const handleLogout = async () => {
    await logout();
    setIsMobileMenuOpen(false);
    setShowUserDropdown(false);
  };

  const showDevMessage = () => {
    setShowDevPopup(true);
    setTimeout(() => setShowDevPopup(false), 2000);
  };

  const filteredGroups = getFilteredGroups();

  return (
    <>
      {/* Desktop Navigation */}
      <motion.header
        initial={{ y: 0 }}
        animate={{ y: isHeaderVisible ? 0 : -100 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden md:block fixed top-0 left-0 right-0 z-50 h-20  bg-gradient-to-b from-black/90 via-black/60 to-transparent"
      >
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
          <img
            src="/favicon.png"
            className="w-10 h-10 object-cover fixed inset-5"
          />
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-8">
            {filteredGroups.map((group) => (
              <div
                key={group.id}
                className="relative"
                onMouseEnter={() => setHoveredGroup(group.id)}
                onMouseLeave={() => setHoveredGroup(null)}
              >
                <button
                  onClick={() => {
                    if (group.items.length === 1) {
                      handleNavigation(group.items[0].id);
                    }
                  }}
                  className="text-white/90 hover:text-white transition-all duration-300 font-medium px-4 py-2 flex items-center space-x-1"
                >
                  <span>{group.label}</span>
                  {group.items.length > 1 && <ChevronDown size={16} />}
                </button>

                {/* Mega Menu Dropdown */}
                {group.items.length > 1 && (
                  <AnimatePresence>
                    {hoveredGroup === group.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl shadow-[0_0_40px_rgba(0,200,255,0.3)] overflow-hidden"
                      >
                        <div className="p-4">
                          <h3 className="text-cyan-400 font-semibold text-sm uppercase tracking-wide mb-3">
                            {group.label}
                          </h3>
                          <div className="space-y-2">
                            {group.items.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => handleNavigation(item.id)}
                                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                                  currentView === item.id
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                                }`}
                              >
                                {item.icon}
                                <span className="font-medium">{item.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            ))}

            <button
              onClick={showDevMessage}
              className="text-white/90 hover:text-white transition-all duration-300 font-medium px-4 py-2"
            >
              About
            </button>
            <button
              onClick={showDevMessage}
              className="text-white/90 hover:text-white transition-all duration-300 font-medium px-4 py-2"
            >
              Contact
            </button>
          </nav>

          {/* Right Side - Auth */}
          <div className="flex items-center space-x-4">
            {user && !user.id.startsWith('guest-') ? (
              <div className="relative">
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center space-x-2 bg-black/40 backdrop-blur-md border border-white/20 rounded-lg px-4 py-2 text-white hover:bg-black/60 hover:border-white/30 transition-all duration-300 shadow-[0_0_20px_rgba(0,200,255,0.4)] hover:shadow-[0_0_30px_rgba(0,200,255,0.6)]"
                  >
                    <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-none flex items-center justify-center text-white font-bold">
                      {user.username.charAt(0).toUpperCase()}
                    </div> 
                    <span className="font-medium text-sm">{user.username}</span>
                    <motion.div
                      animate={{ rotate: showUserDropdown ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown size={16} className="text-white/80" />
                    </motion.div>
                  </button>

                  {/* User Dropdown */}
                  <AnimatePresence>
                    {showUserDropdown && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full right-0 mt-2 w-48 bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl shadow-[0_0_40px_rgba(0,200,255,0.3)] overflow-hidden z-50"
                      >
                        <div className="p-2">
                          <button
                            onClick={() => {
                              onViewChange('settings');
                              setShowUserDropdown(false);
                            }}
                            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all duration-200"
                          >
                            <Settings size={16} />
                            <span className="font-medium">Settings</span>
                          </button>
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
                          >
                            <LogOut size={16} />
                            <span className="font-medium">Logout</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="bg-black/60 backdrop-blur-md border border-white/20 text-white px-6 py-3 rounded-lg font-medium hover:bg-black/80 hover:border-white/30 transition-all duration-300 flex items-center space-x-2 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(0,200,255,0.3)]"
              >
                <LogIn size={16} />
                <span>Login / Signup</span>
              </button>
            )}
          </div>
        </div>
      </motion.header>

      {/* Click outside to close user dropdown */}
      {showUserDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowUserDropdown(false)}
        />
      )}

      {/* Mobile Navigation */}
      <div className="md:hidden">
        {/* Mobile Header */}
        <motion.header
          initial={{ y: 0 }}
          animate={{ y: isHeaderVisible ? 0 : -100 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="fixed top-0 left-0 right-0 z-50 h-16  bg-gradient-to-b from-black/90 via-black/60 to-transparent"
        >
          <div className="px-4 h-full flex items-center justify-between">
            {/* Mobile Menu Toggle */}
            <button
              id="mobile-menu-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-white hover:text-cyan-400 transition-colors"
            >
              <Menu size={24} />
            </button>

            {/* Logo */}

            {/* Auth Button */}
            {user && !user.id.startsWith('guest-') ? (
              <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                {user.username.charAt(0).toUpperCase()}
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="text-white text-sm font-medium"
              >
                Login
              </button>
            )}
          </div>
        </motion.header>

        {/* Mobile Full-Screen Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
              />

              {/* Full-Screen Menu */}
              <motion.div
                id="mobile-navigation"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-0 z-[70] bg-slate-950 overflow-y-auto"
              >
                
                {/* Mobile Menu Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                  <div className="flex items-center space-x-3">
                    <img
                      src="/favicon.png"
                      alt="OBC Logo"
                      className="w-10 h-10 object-cover rounded"
                    />
                    <span className="text-white font-bold text-xl">OBC Portal</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setOpenMobileGroup(null);
                    }}
                    className="p-2 text-cyan-400 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Mobile Menu Content */}
                <div className="p-6 space-y-4">
                  {filteredGroups.map((group) => (
                    <div key={group.id} className="space-y-2">
                      {group.items.length === 1 ? (
                        // Single item - direct navigation
                        <button
                          onClick={() => handleNavigation(group.items[0].id)}
                          className={`w-full flex items-center justify-between p-4 rounded-lg transition-all duration-200 ${
                            currentView === group.items[0].id
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            {group.icon}
                            <span className="font-medium text-lg">{group.label}</span>
                          </div>
                        </button>
                      ) : (
                        // Multiple items - accordion
                        <>
                          <button
                            onClick={() => handleMobileGroupToggle(group.id)}
                            className="w-full flex items-center justify-between p-4 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all duration-200"
                          >
                            <div className="flex items-center space-x-3">
                              {group.icon}
                              <span className="font-medium text-lg">{group.label}</span>
                            </div>
                            <motion.div
                              animate={{ rotate: openMobileGroup === group.id ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronRight size={20} />
                            </motion.div>
                          </button>

                          <AnimatePresence>
                            {openMobileGroup === group.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="overflow-hidden"
                              >
                                <div className="ml-6 space-y-2 border-l border-slate-700 pl-4">
                                  {group.items.map((item) => (
                                    <button
                                      key={item.id}
                                      onClick={() => handleNavigation(item.id)}
                                      className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                                        currentView === item.id
                                          ? 'bg-cyan-500/20 text-cyan-400'
                                          : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                                      }`}
                                    >
                                      {item.icon}
                                      <span className="font-medium">{item.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Mobile About/Contact */}
                  <div className="pt-6 border-t border-slate-800 space-y-2">
                    <button
                      onClick={showDevMessage}
                      className="w-full flex items-center space-x-3 p-4 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all duration-200"
                    >
                      <span className="font-medium text-lg">About</span>
                    </button>
                    <button
                      onClick={showDevMessage}
                      className="w-full flex items-center space-x-3 p-4 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all duration-200"
                    >
                      <span className="font-medium text-lg">Contact</span>
                    </button>
                  </div>

                  {/* Mobile Auth Section */}
                  <div className="pt-6 border-t border-slate-800">
                    {user && !user.id.startsWith('guest-') ? (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3 p-4 bg-slate-800/50 rounded-lg">
                          <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-medium">{user.username}</p>
                            <p className="text-slate-400 text-sm capitalize">{user.role.replace('_', ' ')}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleNavigation('settings')}
                          className={`w-full flex items-center space-x-3 p-4 rounded-lg transition-all duration-200 ${
                            currentView === 'settings'
                              ? 'bg-cyan-500/20 text-cyan-400'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                          }`}
                        >
                          <Settings size={20} />
                          <span className="font-medium">Settings</span>
                        </button>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center space-x-3 p-4 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
                        >
                          <LogOut size={20} />
                          <span className="font-medium">Logout</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setShowLoginModal(true);
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-center space-x-3 p-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg font-medium transition-all duration-200 shadow-[0_0_20px_rgba(0,200,255,0.3)]"
                      >
                        <LogIn size={20} />
                        <span>Login / Signup</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Development Popup */}
      <AnimatePresence>
        {showDevPopup && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[80] bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl px-6 py-4 shadow-[0_0_30px_rgba(0,200,255,0.4)]"
          >
            <p className="text-cyan-400 font-medium">🚧 In Development</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80]"
              onClick={() => setShowLoginModal(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none z-[90]"
            >
              <div className="relative pointer-events-auto bg-slate-950 border border-cyan-500/30 rounded-xl shadow-[0_0_40px_rgba(0,200,255,0.3)] max-w-md w-full mx-4 max-h-[90vh] overflow-hidden">
                <LoginForm onLoginSuccess={() => setShowLoginModal(false)} />
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="absolute top-3 right-3 w-7 h-7 bg-slate-800 hover:bg-slate-700 border border-cyan-500/30 rounded-full flex items-center justify-center text-cyan-400 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}