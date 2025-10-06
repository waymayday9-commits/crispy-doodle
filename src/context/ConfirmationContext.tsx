import React, { createContext, useContext, useState, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ConfirmationContextType {
  confirm: (title: string, message: string) => Promise<boolean>;
  alert: (title: string, message: string) => Promise<void>;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

interface ConfirmationState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'confirm' | 'alert';
  resolve?: (value: boolean | void) => void;
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  const confirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title,
        message,
        type: 'confirm',
        resolve
      });
    });
  };

  const alert = (title: string, message: string): Promise<void> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title,
        message,
        type: 'alert',
        resolve
      });
    });
  };

  const handleConfirm = () => {
    if (state.resolve) {
      state.resolve(true);
    }
    setState(prev => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    if (state.resolve) {
      if (state.type === 'confirm') {
        state.resolve(false);
      } else {
        state.resolve();
      }
    }
    setState(prev => ({ ...prev, isOpen: false }));
  };

  const handleBackdropClick = () => {
    handleCancel();
  };

  return (
    <ConfirmationContext.Provider value={{ confirm, alert }}>
      {children}
      
      {/* Global Confirmation Modal */}
      {state.isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={handleBackdropClick}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 border border-gray-200">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-blue-600 text-xl">
                      {state.type === 'confirm' ? '⚠️' : 'ℹ️'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{state.title}</h3>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-6">{state.message}</p>
                
                <div className="flex justify-end space-x-3">
                  {state.type === 'confirm' && (
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleConfirm}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      state.type === 'confirm' 
                        ? 'bg-red-600 text-white hover:bg-red-700' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {state.type === 'confirm' ? 'Confirm' : 'OK'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (context === undefined) {
    throw new Error('useConfirmation must be used within a ConfirmationProvider');
  }
  return context;
}