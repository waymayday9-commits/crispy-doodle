import React, { useState } from 'react';
import { Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SignupForm } from './SignupForm';
import { supabase } from '../../lib/supabase';

interface LoginFormProps {
  onLoginSuccess?: () => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'login' | 'signup'>('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const success = await login(username, password);
    if (success) {
      setUsername('');
      setPassword('');
      setError('');
      onLoginSuccess?.();
    } else {
      setError('Invalid username or password. Please check your credentials and try again.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `https://obcportal.netlify.app/reset-password`,
      });

      if (error) throw error;

      setResetMessage('Password reset email sent! Check your inbox for further instructions.');
    } catch (error: any) {
      setResetMessage(`Error: ${error.message}`);
    } finally {
      setResetLoading(false);
    }
  };

  if (currentView === 'signup') {
    return <SignupForm onBackToLogin={() => setCurrentView('login')} onSignupSuccess={onLoginSuccess} />;
  }

  if (showForgotPassword) {
    return (
      <div className="w-full max-w-md p-8 mx-auto">
        <div className="flex items-center mb-6">
          <button
            onClick={() => setShowForgotPassword(false)}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors mr-3 text-cyan-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">Reset Password</h2>
            <p className="text-slate-400">Enter your email to receive reset instructions</p>
          </div>
        </div>

        <form onSubmit={handleForgotPassword} className="space-y-6">
          <div>
            <label htmlFor="resetEmail" className="block text-sm font-medium text-cyan-400 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="resetEmail"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-200"
              required
              placeholder="Enter your email address"
            />
          </div>

          {resetMessage && (
            <div className={`text-sm text-center p-3 rounded-md border ${
              resetMessage.includes('Error') 
                ? 'text-red-400 bg-red-500/10 border-red-500/30' 
                : 'text-green-400 bg-green-500/10 border-green-500/30'
            }`}>
              {resetMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={resetLoading}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-medium px-6 py-3 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 disabled:opacity-50 shadow-[0_0_20px_rgba(0,200,255,0.3)]"
          >
            {resetLoading ? 'Sending...' : 'Send Reset Email'}
          </button>
        </form>

        <div className="mt-6">
          <button
            onClick={() => setShowForgotPassword(false)}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white font-medium px-6 py-3 rounded-lg transition-all duration-200"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-6 mx-auto max-h-[90vh] overflow-y-auto">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(0,200,255,0.5)]">
          <span className="text-white text-lg font-bold">B</span>
        </div>
        <h2 className="text-xl font-bold text-white">OBC Portal</h2>
        <p className="text-slate-400 text-sm">Ormoc Beyblade Club</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-cyan-400 mb-2">
            Username
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-200"
            required
            placeholder="Enter your username"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-cyan-400 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 pr-10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-200"
              required
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-cyan-400 transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
            {error}
          </div>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Forgot your password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-medium px-6 py-3 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 disabled:opacity-50 shadow-[0_0_20px_rgba(0,200,255,0.3)]"
        >
          {loading ? 'Accessing...' : 'Access Portal'}
        </button>
      </form>

      <div className="mt-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-slate-950 text-slate-500">Or</span>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={() => setCurrentView('signup')}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white font-medium px-6 py-3 rounded-lg transition-all duration-200"
          >
            Create New Account
          </button>
        </div>
      </div>
    </div>
  );
}