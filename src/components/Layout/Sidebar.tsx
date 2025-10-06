import React, { useEffect } from 'react';
import {
  Home, Trophy, Users, BarChart3, Settings, User,
  Database, Package, X, LogIn, LogOut, Crown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LoginForm } from '../Auth/LoginForm';
import { motion, AnimatePresence } from 'framer-motion';


interface SidebarProps {
  isOpen: boolean;
  currentView: string;
  onViewChange: (view: string) => void;
  onToggle: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  requiresAuth?: boolean;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Home size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'] },
  { id: 'tournaments', label: 'Tournaments', icon: <Trophy size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'] },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'] },
  { id: 'personal-stats', label: 'Personal Stats', icon: <User size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'], requiresAuth: true },
  { id: 'parts-database', label: 'Parts Database', icon: <Database size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'] },
  { id: 'inventory', label: 'Inventory & Decks', icon: <Package size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'] },
  { id: 'team-manager', label: 'Team Manager', icon: <Users size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'] },
  { id: 'tournament-manager', label: 'Tournament Manager', icon: <Settings size={20} />, roles: ['admin', 'developer'] },
  { id: 'user-management', label: 'User Management', icon: <Users size={20} />, roles: ['admin', 'developer'] },
  { id: 'database', label: 'Database', icon: <Database size={20} />, roles: ['developer'] },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} />, roles: ['user', 'technical_officer', 'admin', 'developer'], requiresAuth: true },
];

export function Sidebar({ isOpen, currentView, onViewChange, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = React.useState(false);

  // Apply role filtering
  const filteredMenuItems = menuItems.filter(item =>
    !user
      ? (!item.requiresAuth && item.roles.includes('user'))
      : item.roles.includes(user.role || 'user')
  );

  const handleLogout = async () => {
    await logout();
    onToggle();
  };

  // Desktop hover auto-toggle (less aggressive)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth > 768) {
        if (e.clientX <= 20 && !isOpen) {
          onToggle();
        } else if (e.clientX > 300 && isOpen) { // push threshold to 300px
          onToggle();
        }
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isOpen, onToggle]);

  // Mobile outside-click close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (window.innerWidth <= 768 && isOpen) {
        const sidebarEl = document.getElementById('app-sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle-btn');
        if (
          sidebarEl &&
          !sidebarEl.contains(e.target as Node) &&
          toggleBtn &&
          !toggleBtn.contains(e.target as Node)
        ) {
          onToggle();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <>
      {/* Backdrop for mobile when sidebar is open */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" />
      )}

      <aside
        id="app-sidebar"
        className={`fixed left-0 top-0 z-50 h-screen flex flex-col 
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        bg-slate-950 border-r border-cyan-500/30 w-64 shadow-[0_0_30px_rgba(0,200,255,0.2)]`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <img src="/favicon.png" alt="OBC Logo" className="w-8 h-8 object-contain" />
            {isOpen && <h1 className="text-lg font-bold text-white">OBC Portal</h1>}
          </div>
          {isOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="p-2 hover:bg-cyan-500/20 rounded transition-colors text-cyan-400 hover:text-white"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
          {/* Overview */}
          <div>
            {isOpen && <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Overview</p>}
            <ul className="space-y-1">
              {filteredMenuItems
                .filter(item => ['dashboard', 'tournaments', 'analytics'].includes(item.id))
                .map(item => (
                  <li key={item.id}>
                    <button
                      onClick={() => onViewChange(item.id)}
                      className={`w-full flex items-center px-2 py-2 relative transition group
                        ${currentView === item.id
                          ? 'text-cyan-400'
                          : 'text-slate-300 hover:text-cyan-400'}
                      `}
                    >
                      <div className="mr-3">{item.icon}</div>
                      {isOpen && <span className="ml-3 font-medium">{item.label}</span>}
                      <div
                        className={`absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-cyan-500 to-purple-500
                          group-hover:w-full transition-all duration-500
                          ${currentView === item.id ? 'w-full' : ''}
                        `}
                      />
                    </button>
                  </li>
                ))}
            </ul>
          </div>

          {/* Database */}
          <div>
            {isOpen && <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Database</p>}
            <ul className="space-y-1">
              {filteredMenuItems
                .filter(item => ['parts-database', 'inventory'].includes(item.id))
                .map(item => (
                  <li key={item.id}>
                    <button
                      onClick={() => onViewChange(item.id)}
                      className={`w-full flex items-center px-2 py-2 relative transition group
                        ${currentView === item.id
                          ? 'text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
                          : 'text-slate-300 hover:text-cyan-400'}
                      `}
                    >
                      <div className="mr-3">{item.icon}</div>
                      {isOpen && <span className="ml-3 font-medium">{item.label}</span>}
                      <div
                        className={`absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-cyan-500 to-purple-500
                          group-hover:w-full transition-all duration-500
                          ${currentView === item.id ? 'w-full' : ''}
                        `}
                      />
                    </button>
                  </li>
                ))}
            </ul>
          </div>

          {/* Management */}
          <div>
            {isOpen && <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Management</p>}
            <ul className="space-y-1">
              {filteredMenuItems
                .filter(item => ['team-manager', 'community-manager', 'tournament-manager', 'user-management', 'bbx-database-update'].includes(item.id))
                .map(item => (
                  <li key={item.id}>
                    <button
                      onClick={() => onViewChange(item.id)}
                      className={`w-full flex items-center px-2 py-2 relative transition group
                        ${currentView === item.id
                          ? 'text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
                          : 'text-slate-300 hover:text-cyan-400'}
                      `}
                    >
                      <div className="mr-3">{item.icon}</div>
                      {isOpen && <span className="ml-3 font-medium">{item.label}</span>}
                      <div
                        className={`absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-cyan-500 to-purple-500
                          group-hover:w-full transition-all duration-500
                          ${currentView === item.id ? 'w-full' : ''}
                        `}
                      />
                    </button>
                  </li>
                ))}
            </ul>
          </div>

{/* Developer (only shows if there are items) */}
{filteredMenuItems.some(item => ['database'].includes(item.id)) && (
  <div>
    <ul className="space-y-1">
      {filteredMenuItems
        .filter(item => ['database'].includes(item.id))
        .map(item => (
          <li key={item.id}>
            <button
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center px-2 py-2 relative transition group
                ${currentView === item.id
                  ? 'text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
                  : 'text-slate-300 hover:text-cyan-400'}
              `}
            >
              <div className="mr-3">{item.icon}</div>
              {isOpen && <span className="ml-3 font-medium">{item.label}</span>}
              <div
                className={`absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-cyan-500 to-purple-500
                  group-hover:w-full transition-all duration-500
                  ${currentView === item.id ? 'w-full' : ''}
                `}
              />
            </button>
          </li>
        ))}
    </ul>
  </div>
)}
        </div>

        {/* Auth Section */}
        <div className="px-4 py-4 bg-slate-950 border-t border-slate-800">
          {/* User Info (if logged in) */}
          {user && !user.id.startsWith('guest-') && isOpen && (
            <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-cyan-500/20">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.username}</p>
                  <p className="text-xs text-cyan-400 capitalize">{user.role.replace('_', ' ')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Settings (only for authenticated users) */}
          {user && !user.id.startsWith('guest-') && (
            <button
              onClick={() => onViewChange('settings')}
              className={`w-full flex items-center px-3 py-3 mb-2 transition-all duration-200 ${
                currentView === 'settings'
                  ? 'text-cyan-400 bg-cyan-500/20'
                  : 'text-slate-300 hover:text-cyan-400 hover:bg-cyan-500/10'
              }`}
            >
              <Settings size={20} />
              {isOpen && <span className="ml-3 font-medium">Settings</span>}
            </button>
          )}

          {user && !user.id.startsWith('guest-') ? (
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
            >
              <LogOut size={20} />
              {isOpen && <span className="ml-3 font-medium">Logout</span>}
            </button>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="w-full flex items-center px-3 py-3 text-cyan-400 hover:text-white hover:bg-cyan-500/20 transition-all duration-200"
            >
              <LogIn size={20} />
              {isOpen && <span className="ml-3 font-medium">Login</span>}
            </button>
          )}
        </div>
      </aside>

{/* Login Modal */}
<AnimatePresence>
  {showLoginModal && (
    <>
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={() => setShowLoginModal(false)}
      />
      
      {/* Modal */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none z-50"
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