import React from 'react';
import { DollarSign, Users, Package, AlertCircle } from 'lucide-react';
import { TournamentFormData } from './TournamentWizard';

interface RegistrationSettingsStepProps {
  formData: TournamentFormData;
  updateFormData: (updates: Partial<TournamentFormData>) => void;
}

export function RegistrationSettingsStep({ formData, updateFormData }: RegistrationSettingsStepProps) {
  const togglePaymentOption = (option: string) => {
    const currentOptions = formData.paymentOptions || [];
    const newOptions = currentOptions.includes(option)
      ? currentOptions.filter(opt => opt !== option)
      : [...currentOptions, option];
    
    updateFormData({ paymentOptions: newOptions });
  };

  return (
    <div className="space-y-6">
      {/* Registration Fee */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <DollarSign size={20} className="mr-2 text-cyan-400" />
          Registration Fee
        </h3>

        <div className="space-y-4">
          <div className="flex items-center space-x-6">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="feeType"
                checked={formData.isFree}
                onChange={() => updateFormData({ isFree: true, entryFee: 0 })}
                className="w-4 h-4 text-cyan-600"
              />
              <span className="text-white font-medium">Free Tournament</span>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="feeType"
                checked={!formData.isFree}
                onChange={() => updateFormData({ isFree: false })}
                className="w-4 h-4 text-cyan-600"
              />
              <span className="text-white font-medium">Paid Tournament</span>
            </label>
          </div>

          {!formData.isFree && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
<div>
  <label className="block text-sm font-medium text-cyan-400 mb-2">
    Entry Fee (₱)
  </label>
  <input
    type="text"
    inputMode="decimal"
    placeholder="₱0"
    value={formData.entryFee === 0 ? '' : formData.entryFee}
    onChange={(e) => {
      const val = e.target.value;
      if (val === '') {
        updateFormData({ entryFee: 0 }); // keep state clean but show blank
      } else if (/^\d*\.?\d*$/.test(val)) {
        updateFormData({ entryFee: parseFloat(val) });
      }
    }}
    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white 
               focus:outline-none focus:ring-2 focus:ring-cyan-500 
               [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  />
</div>

              </div>

              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">
                  Payment Options
                </label>
                <div className="space-y-2">
                  {['cash', 'gcash', 'bank_transfer'].map(option => (
                    <label key={option} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.paymentOptions.includes(option)}
                        onChange={() => togglePaymentOption(option)}
                        className="w-4 h-4 text-cyan-600"
                      />
                      <span className="text-white capitalize">{option.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Participant Cap */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Users size={20} className="mr-2 text-cyan-400" />
          Participant Limits
        </h3>

        <div className="space-y-4">
          <div className="flex items-center space-x-6">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="participantType"
                checked={!formData.isUnlimited}
                onChange={() => updateFormData({ isUnlimited: false })}
                className="w-4 h-4 text-cyan-600"
              />
              <span className="text-white font-medium">Limited Slots</span>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="participantType"
                checked={formData.isUnlimited}
                onChange={() => updateFormData({ isUnlimited: true })}
                className="w-4 h-4 text-cyan-600"
              />
              <span className="text-white font-medium">Unlimited Participants</span>
            </label>
          </div>

          {!formData.isUnlimited && (
            <div>
              <label className="block text-sm font-medium text-cyan-400 mb-2">
                Maximum Participants
              </label>
              <input
                type="number"
                min="4"
                max="256"
                value={formData.participantCap}
                onChange={(e) => updateFormData({ participantCap: parseInt(e.target.value) || 16 })}
                className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Beyblade Rules */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Package size={20} className="mr-2 text-cyan-400" />
          Beyblade Rules
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-cyan-400 mb-2">
              Beyblades per Player *
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={formData.beybladesPerPlayer}
              onChange={(e) => updateFormData({ beybladesPerPlayer: parseInt(e.target.value) || 3 })}
              className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-cyan-400 mb-2">
              Decks per Player *
            </label>
            <input
              type="number"
              min="1"
              max="3"
              value={formData.decksPerPlayer}
              onChange={(e) => updateFormData({ decksPerPlayer: parseInt(e.target.value) || 1 })}
              className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              Total Beyblades: {formData.beybladesPerPlayer * formData.decksPerPlayer}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.allowRepeatingPartsInDeck}
                onChange={(e) => updateFormData({ allowRepeatingPartsInDeck: e.target.checked })}
                className="w-4 h-4 text-cyan-600"
              />
              <div className="flex-1">
                <span className="text-white font-medium">Allow Repeating Parts in One Deck</span>
                <p className="text-xs text-slate-400 mt-0.5">Players can use the same part multiple times within a single deck</p>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.allowRepeatingPartsAcrossDecks}
                onChange={(e) => updateFormData({ allowRepeatingPartsAcrossDecks: e.target.checked })}
                className="w-4 h-4 text-cyan-600"
              />
              <div className="flex-1">
                <span className="text-white font-medium">Allow Repeating Parts Across All Decks</span>
                <p className="text-xs text-slate-400 mt-0.5">Players can reuse parts from one deck in another deck</p>
              </div>
            </label>

            {(formData.allowRepeatingPartsInDeck || formData.allowRepeatingPartsAcrossDecks) && (
              <div className="flex items-center space-x-2 pl-7 mt-2">
                <label className="text-sm text-cyan-400">Extra fee per repeated part (₱):</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.repeatPartFee}
                  onChange={(e) => updateFormData({ repeatPartFee: parseFloat(e.target.value) || 0 })}
                  className="w-24 bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            )}
          </div>

          {(formData.allowRepeatingPartsInDeck || formData.allowRepeatingPartsAcrossDecks) && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-yellow-400">
                <AlertCircle size={16} />
                <span className="text-sm font-medium">Repeating Parts Rules</span>
              </div>
              <ul className="text-yellow-300 text-sm mt-2 space-y-1 list-disc list-inside">
                {formData.allowRepeatingPartsInDeck && (
                  <li>Players can use the same part multiple times within a single deck</li>
                )}
                {formData.allowRepeatingPartsAcrossDecks && (
                  <li>Players can reuse parts from one deck in other decks</li>
                )}
                {formData.repeatPartFee > 0 && (
                  <li className="font-medium">Additional fee: ₱{formData.repeatPartFee} per repeated part</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Payment Details (if paid) */}
      {!formData.isFree && formData.paymentOptions.length > 0 && (
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <h3 className="text-lg font-bold text-white mb-4">Payment Details</h3>
          
          <div className="space-y-4">
            {formData.paymentOptions.includes('gcash') && (
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">
                  GCash Details
                </label>
                <textarea
                  value={formData.paymentDetails.gcash || ''}
                  onChange={(e) => updateFormData({
                    paymentDetails: { ...formData.paymentDetails, gcash: e.target.value }
                  })}
                  placeholder="GCash number and instructions..."
                  rows={3}
                  className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            )}

            {formData.paymentOptions.includes('bank_transfer') && (
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">
                  Bank Transfer Details
                </label>
                <textarea
                  value={formData.paymentDetails.bank_transfer || ''}
                  onChange={(e) => updateFormData({
                    paymentDetails: { ...formData.paymentDetails, bank_transfer: e.target.value }
                  })}
                  placeholder="Bank account details and instructions..."
                  rows={3}
                  className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            )}

            {formData.paymentOptions.includes('cash') && (
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">
                  Cash Payment Instructions
                </label>
                <textarea
                  value={formData.paymentDetails.cash || ''}
                  onChange={(e) => updateFormData({
                    paymentDetails: { ...formData.paymentDetails, cash: e.target.value }
                  })}
                  placeholder="Where and when to pay cash..."
                  rows={3}
                  className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}