import React, { useState } from 'react';
import { Menu, X, User, LogOut, Settings, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LoginForm } from '../Auth/LoginForm';

interface HeaderProps {
  onMenuToggle: () => void;
  isMenuOpen: boolean;
}

export function Header({ onMenuToggle, isMenuOpen }: HeaderProps) {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'technical_officer': return 'bg-blue-500';
      case 'developer': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <>
      <header className="header">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              {/* Hamburger Icon */}
              <button
                id="sidebar-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent click from bubbling to outside-click handler
                  onMenuToggle();
                }}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>

              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center font-space-grotesk font-bold text-lg text-white">
                  B
                </div>
                <div>
                  <h1 className="text-xl font-space-grotesk font-bold text-gray-900">
                    OBC Portal
                  </h1>
                  <p className="text-xs text-gray-500 font-inter">Beyblade Community</p>
                </div>
              </div>
            </div>

            {user && (
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-100 transition-all duration-200"
                  >
                    <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center font-space-grotesk font-bold text-sm text-white">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="font-inter font-semibold text-gray-900">{user.username}</p>
                      <p className="text-xs font-inter capitalize text-gray-600">
                        {user.role.replace('_', ' ')}
                      </p>
                    </div>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                      <div className="py-1">
                        <div className="px-4 py-3 border-b border-gray-200">
                          <p className="font-inter font-semibold text-gray-900">{user.username}</p>
                          <p className="text-sm text-gray-600 capitalize font-inter">{user.role.replace('_', ' ')}</p>
                        </div>
                        <button className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors">
                          <Settings size={16} />
                          <span className="font-inter">Settings</span>
                        </button>
                        <button
                          onClick={logout}
                          className="w-full text-left px-4 py-3 hover:bg-red-50 flex items-center space-x-2 text-red-600 hover:text-red-700 transition-colors"
                        >
                          <LogOut size={16} />
                          <span className="font-inter">Logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!user && (
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="primary-button flex items-center space-x-2"
                >
                  <LogIn size={20} />
                  <span className="hidden sm:block font-inter font-semibold">Login</span>
                </button>
              </div>
            )}
          </div>
        </div>
        
        {showUserMenu && (
          <div 
            className="fixed inset-0 z-30" 
            onClick={() => {
              setShowUserMenu(false);
            }}
          />
        )}

        {/* Login Modal */}
        {showLoginModal && (
          <>
            {/* Modal Backdrop */}
            <div 
              className="modal-overlay"
              style={{ zIndex: 50 }}
              onClick={() => setShowLoginModal(false)}
            />
            
            {/* Modal Content */}
            <div 
              className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none z-50"
            >
              <div className="relative pointer-events-auto bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh]">
                <LoginForm onLoginSuccess={() => setShowLoginModal(false)} />
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </header>
    </>
  );
}
