import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  signup: (username: string, email: string, password: string, role: User['role']) => Promise<boolean>;
  logout: () => Promise<void>;
  loading: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false); // Start with false, no loading

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Get user profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .limit(1);

          if (profile && profile.length > 0) {
            setUser({
              id: profile[0].id,
              username: profile[0].username,
              email: profile[0].email || '',
              role: profile[0].role || 'user',
              joinedDate: profile[0].created_at
            });
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      console.log('🔐 LOGIN ATTEMPT - Username:', username);
      
      // Find user by username to get their email
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .limit(1);

      if (profileError) {
        console.error('❌ LOGIN FAILED - Database error:', profileError);
        return false;
      }

      if (!profiles || profiles.length === 0) {
        console.error('❌ LOGIN FAILED - No profile found for username:', username);
        return false;
      }

      const profile = profiles[0];
      
      if (!profile.email) {
        console.error('❌ LOGIN FAILED - Profile has no email:', profile);
        return false;
      }

      console.log('✅ Profile found - Email:', profile.email, 'Role:', profile.role);
      
      // Use the email from profile to authenticate
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password
      });
      
      if (authError) {
        console.error('❌ SUPABASE AUTH ERROR:', authError.message);
        return false;
      }

      // Set user data from profile
      setUser({
        id: profile.id,
        username: profile.username,
        email: profile.email || '',
        role: profile.role || 'user',
        joinedDate: profile.created_at
      });

      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const signup = async (username: string, email: string, password: string, role: User['role']): Promise<boolean> => {
    try {
      console.log('📝 SIGNUP ATTEMPT - Username:', username, 'Email:', email);
      
      // Check if username already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (existingProfile) {
        console.error('❌ SIGNUP FAILED - Username already exists:', username);
        return false;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username
          }
        }
      });

      if (error) {
        console.error('❌ SUPABASE SIGNUP ERROR:', error.message, 'Code:', error.status);
        return false;
      }
      
      console.log('✅ SUPABASE SIGNUP SUCCESS:', {
        user_id: data.user?.id,
        email: data.user?.email,
        email_confirmed: data.user?.email_confirmed_at,
        user_metadata: data.user?.user_metadata
      });
      
      // Create profile entry if user was created successfully
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username,
            email,
            role
          });

        if (profileError) {
          console.error('❌ PROFILE CREATION ERROR:', profileError.message);
          // Don't return false here as the user was created successfully
        } else {
          console.log('✅ PROFILE CREATED SUCCESSFULLY');
        }
      }
      
      return true;
    } catch (error) {
      console.error('Signup error:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      console.log('🚪 LOGOUT: Starting logout process...');
      
      // Clear React state first to prevent auto re-login
      setUser(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ LOGOUT: Supabase signout error:', error);
      } else {
        console.log('✅ LOGOUT: Supabase signout successful');
      }
      
      // Force clear any cached session data
      localStorage.clear();
      sessionStorage.clear();
      
      // Small delay to ensure cleanup, then reload
      setTimeout(() => {
        window.location.href = window.location.origin;
      }, 100);
    } catch (error) {
      console.error('❌ LOGOUT: Unexpected error:', error);
      setUser(null);
      localStorage.clear();
      sessionStorage.clear();
      setTimeout(() => {
        window.location.href = window.location.origin;
      }, 100);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}