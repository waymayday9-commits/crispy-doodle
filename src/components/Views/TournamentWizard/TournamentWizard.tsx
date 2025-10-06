import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useConfirmation } from '../../../context/ConfirmationContext';

import { BasicInformationStep } from './BasicInformationStep';
import { TournamentDescriptionStep } from './TournamentDescriptionStep';
import { RegistrationSettingsStep } from './RegistrationSettingsStep';
import { TournamentSettingsStep } from './TournamentSettingsStep';
import { ReviewStep } from './ReviewStep';

export interface TournamentFormData {
  // Basic Information
  name: string;
  description: string;
  location: string;
  password: string;
  registrationDeadline: string;
  tournamentStart: string;
  customUrl: string;
  hostType: 'individual' | 'community';
  hostCommunityId: string | null;

  // Registration Settings
  beybladesPerPlayer: number;
  decksPerPlayer: number;
  entryFee: number;
  isFree: boolean;
  paymentOptions: string[];
  paymentDetails: { [key: string]: string };
  isUnlimited: boolean;
  participantCap: number;
  allowRepeatingPartsInDeck: boolean;
  allowRepeatingPartsAcrossDecks: boolean;
  repeatPartFee: number;

  // Tournament Settings (NEW)
  tournamentType: 'practice' | 'casual' | 'ranked' | 'experimental';
  tournamentSettings: {
    rules: {
      allow_self_finish: boolean;
      allow_deck_shuffling: boolean;
      allow_repeating_parts_in_deck: boolean;
      allow_repeating_parts_across_decks: boolean;
    };
    match_format: 'solo' | 'teams';
    players_per_team: number;
  };

  // Legacy fields for compatibility
  stages: any[];
  advancementRules: any[];
  pointsSystem: { [key: number]: number };
  type: string;
}

interface TournamentWizardProps {
  onClose: () => void;
  onSuccess?: () => void;
  userCommunities?: any[];
  initialData?: any;
}

export function TournamentWizard({
  onClose,
  onSuccess,
  userCommunities = [],
  initialData,
}: TournamentWizardProps) {
  const { user } = useAuth();
  const { alert } = useConfirmation();

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<TournamentFormData>({
    // Basic Information
    name: '',
    description: '',
    location: '',
    password: '',
    registrationDeadline: '',
    tournamentStart: '',
    customUrl: '',
    hostType: 'individual',
    hostCommunityId: null,

    // Registration Settings
    beybladesPerPlayer: 3,
    decksPerPlayer: 1,
    entryFee: 0,
    isFree: false,
    paymentOptions: [],
    paymentDetails: {
      gcash: '',
      bank_transfer: '',
      cash: '',
    },
    isUnlimited: true,
    participantCap: 16,
    allowRepeatingPartsInDeck: false,
    allowRepeatingPartsAcrossDecks: false,
    repeatPartFee: 50,

    // Tournament Settings (NEW)
    tournamentType: 'ranked',
    tournamentSettings: {
      rules: {
        allow_self_finish: false,
        allow_deck_shuffling: false,
        allow_repeating_parts_in_deck: false,
        allow_repeating_parts_across_decks: false,
      },
      match_format: 'solo',
      players_per_team: 1,
    },

    // Legacy compatibility
    stages: [],
    advancementRules: [],
    pointsSystem: { 1: 10, 2: 6, 3: 3 },
    type: 'ranked',
  });

  // Prefill form data if editing
  useEffect(() => {
    if (!initialData) return;
    
    try {
      setFormData((prev) => ({
        ...prev,
        name: initialData.name || '',
        description: initialData.description || '',
        location: initialData.location || '',
        password: initialData.password || '',
        registrationDeadline: initialData.registration_deadline || '',
        tournamentStart: initialData.tournament_date || '',
        beybladesPerPlayer: initialData.beyblades_per_player || 3,
        decksPerPlayer: initialData.decks_per_player || 1,
        entryFee: initialData.entry_fee || 0,
        isFree: initialData.is_free || false,
        paymentOptions: initialData.payment_options || [],
        paymentDetails: initialData.payment_details || { gcash: '', bank_transfer: '', cash: '' },
        isUnlimited: initialData.max_participants === 999999,
        participantCap: initialData.max_participants === 999999 ? 16 : initialData.max_participants || 16,
        allowRepeatingPartsInDeck: initialData.allow_repeating_parts_in_deck || initialData.allow_repeating_parts || false,
        allowRepeatingPartsAcrossDecks: initialData.allow_repeating_parts_across_decks || initialData.allow_repeating_parts || false,
        repeatPartFee: initialData.repeat_part_fee || 50,
        tournamentType: initialData.tournament_type || 'ranked',
        tournamentSettings: initialData.tournament_settings || {
          rules: {
            allow_self_finish: false,
            allow_deck_shuffling: false,
            allow_repeating_parts_in_deck: false,
            allow_repeating_parts_across_decks: false,
          },
          match_format: 'solo',
          players_per_team: 1,
        },
        hostType: initialData.hosted_by_type || 'individual',
        hostCommunityId: initialData.hosted_by_community_id || null,
      }));
    } catch (err) {
      console.error('Error prefilling form data:', err);
    }
  }, [initialData]);

  const steps = [
    { id: 'basic', title: 'Basic Information', icon: '📋' },
    { id: 'description', title: 'Description', icon: '📝' },
    { id: 'registration', title: 'Registration Settings', icon: '👥' },
    { id: 'settings', title: 'Tournament Settings', icon: '⚙️' },
    { id: 'review', title: 'Review & Create', icon: '✅' },
  ];

  const updateFormData = (updates: Partial<TournamentFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return (
          formData.name.trim() &&
          formData.password.trim() &&
          formData.location.trim() &&
          formData.registrationDeadline &&
          formData.tournamentStart &&
          (formData.hostType === 'individual' || formData.hostCommunityId)
        );
      case 1: // Description
        return true; // Description is optional
      case 2: // Registration
        return (
          formData.beybladesPerPlayer > 0 &&
          formData.decksPerPlayer > 0 &&
          (formData.isFree || formData.entryFee > 0)
        );
      case 3: // Tournament Settings
        return true; // All settings have defaults
      case 4: // Review
        return true;
      default:
        return false;
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <BasicInformationStep
            formData={formData}
            updateFormData={updateFormData}
            userCommunities={userCommunities}
          />
        );
      case 1:
        return (
          <TournamentDescriptionStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );
      case 2:
        return (
          <RegistrationSettingsStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );
      case 3:
        return (
          <TournamentSettingsStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );
      case 4:
        return (
          <ReviewStep
            formData={formData}
            userCommunities={userCommunities}
          />
        );
      default:
        return null;
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);

      const tournamentData = {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        password: formData.password,
        registration_deadline: formData.registrationDeadline,
        tournament_date: formData.tournamentStart,
        max_participants: formData.isUnlimited ? 999999 : formData.participantCap,
        beyblades_per_player: formData.beybladesPerPlayer,
        decks_per_player: formData.decksPerPlayer,
        entry_fee: formData.isFree ? 0 : formData.entryFee,
        is_free: formData.isFree,
        tournament_type: formData.tournamentType,
        tournament_settings: formData.tournamentSettings,
        hosted_by_type: formData.hostType,
        hosted_by_user_id: formData.hostType === 'individual' ? user?.id : null,
        hosted_by_community_id: formData.hostType === 'community' ? formData.hostCommunityId : null,
        payment_options: formData.paymentOptions || [],
        payment_details: formData.paymentDetails || {},
        allow_repeating_parts_in_deck: formData.allowRepeatingPartsInDeck || false,
        allow_repeating_parts_across_decks: formData.allowRepeatingPartsAcrossDecks || false,
        repeat_part_fee: formData.repeatPartFee || 0,
      };

      if (initialData && initialData.id) {
        // Update existing tournament
        const { error } = await supabase
          .from('tournaments')
          .update(tournamentData)
          .eq('id', initialData.id);

        if (error) throw error;
        await alert('Success', 'Tournament updated successfully!');
      } else {
        // Create new tournament
        const { data: tournament, error } = await supabase
          .from('tournaments')
          .insert([tournamentData])
          .select()
          .single();

        if (error) throw error;

        // Create default stage
        const { error: stageError } = await supabase
          .from('tournament_stages')
          .insert([
            {
              tournament_id: tournament.id,
              stage_name: 'Main Stage',
              stage_type: 'swiss',
              number_of_rounds: 5,
              stage_number: 1,
            },
          ]);

        if (stageError) console.warn('Stage creation warning:', stageError);
        await alert('Success', 'Tournament created successfully!');
      }

      onClose();
      onSuccess?.();
    } catch (err: any) {
      console.error('Error saving tournament:', err);
      await alert('Error', err.message || 'Failed to save tournament');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-950 border border-cyan-500/30 rounded-xl shadow-[0_0_40px_rgba(0,200,255,0.3)] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-4 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">
                {initialData ? 'Edit Tournament' : 'Create Tournament'}
              </h2>
              <p className="text-cyan-100">Step {currentStep + 1} of {steps.length}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-900 px-6 py-3 border-b border-slate-700">
          <div className="flex items-center space-x-2">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className={`flex items-center space-x-2 ${
                  index === currentStep ? 'text-cyan-400' : 
                  index < currentStep ? 'text-green-400' : 'text-slate-400'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === currentStep ? 'bg-cyan-500 text-white' :
                    index < currentStep ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {index < currentStep ? '✓' : index + 1}
                  </div>
                  <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 ${
                    index < currentStep ? 'bg-green-500' : 'bg-slate-700'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderCurrentStep()}
        </div>

        {/* Navigation */}
        <div className="bg-slate-900 px-6 py-4 border-t border-slate-700 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Cancel
          </button>
          
          <div className="flex space-x-3">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              >
                Back
              </button>
            )}
            
            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceed()}
                className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 transition-all duration-200"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-400 hover:to-emerald-500 disabled:opacity-50 transition-all duration-200"
              >
                {saving ? 'Saving...' : initialData ? 'Update Tournament' : 'Create Tournament'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}