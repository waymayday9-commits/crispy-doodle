import React, { useState, useEffect } from 'react';
import { Trophy, Users, Settings, Check, ChevronDown, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';

import { BasicInformationStep } from './TournamentWizard/BasicInformationStep';
import { TournamentDescriptionStep } from './TournamentWizard/TournamentDescriptionStep';
import { RegistrationSettingsStep } from './TournamentWizard/RegistrationSettingsStep';
import { TournamentSettingsStep } from './TournamentWizard/TournamentSettingsStep';
import { ReviewStep } from './TournamentWizard/ReviewStep';

interface TournamentWizardLiteProps {
  onClose: () => void;
  onSuccess?: () => void;
  userCommunities?: any[];
  initialData?: any; // <-- added for edit support
}

export function TournamentWizardLite({
  onClose,
  onSuccess,
  userCommunities = [],
  initialData,
}: TournamentWizardLiteProps) {
  const { user } = useAuth();
  const { alert } = useConfirmation();

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const baseBtn =
    'px-4 py-2 rounded-none text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';

  const [formData, setFormData] = useState<any>({
    name: '',
    description: '',
    location: '',
    password: '',
    registrationDeadline: '',
    tournamentStart: '',
    maxParticipants: 16,

    // Registration defaults
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

    // Tournament type defaults
    tournamentType: 'ranked',
    pointsSystem: { 1: 10, 2: 6, 3: 3 },

    // Tournament Settings (NEW)
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

    // 🚑 Prevent ReviewStep crash
    stages: [],
    advancementRules: [],

    // Misc
    type: 'ranked',
    hostType: 'individual',
    hostCommunityId: null,
  });

  // If initialData supplied, prefill form (edit mode)
  useEffect(() => {
    if (!initialData) return;
    try {
      setFormData((prev: any) => ({
        ...prev,
        name: initialData.name || '',
        description: initialData.description || '',
        location: initialData.location || '',
        password: initialData.password || '',
        registrationDeadline: initialData.registration_deadline || '',
        tournamentStart: initialData.tournament_date || '',
        maxParticipants:
          initialData.max_participants === 999999
            ? 999999
            : initialData.max_participants || 16,
        beybladesPerPlayer:
          initialData.beyblades_per_player || prev.beybladesPerPlayer,
        decksPerPlayer:
          initialData.decks_per_player || prev.decksPerPlayer,
        entryFee: initialData.entry_fee || prev.entryFee,
        isFree:
          typeof initialData.is_free === 'boolean'
            ? initialData.is_free
            : prev.isFree,
        paymentOptions:
          initialData.payment_options || prev.paymentOptions || [],
        paymentDetails:
          initialData.payment_details ||
          prev.paymentDetails || {
            gcash: '',
            bank_transfer: '',
            cash: '',
          },
        isUnlimited: initialData.max_participants === 999999,
        participantCap:
          initialData.max_participants === 999999
            ? 16
            : initialData.max_participants || 16,
        allowRepeatingPartsInDeck:
          initialData.allow_repeating_parts_in_deck || initialData.allow_repeating_parts || prev.allowRepeatingPartsInDeck,
        allowRepeatingPartsAcrossDecks:
          initialData.allow_repeating_parts_across_decks || initialData.allow_repeating_parts || prev.allowRepeatingPartsAcrossDecks,
        repeatPartFee:
          initialData.repeat_part_fee || prev.repeatPartFee,
        tournamentType:
          initialData.tournament_type || prev.tournamentType,
        tournamentSettings:
          initialData.tournament_settings || prev.tournamentSettings || {
            rules: {
              allow_self_finish: false,
              allow_deck_shuffling: false,
              allow_repeating_parts_in_deck: false,
              allow_repeating_parts_across_decks: false,
            },
            match_format: 'solo',
            players_per_team: 1,
          },
        pointsSystem:
          initialData.points_system ||
          prev.pointsSystem || { 1: 10, 2: 6, 3: 3 },
        stages: initialData.stages_config || prev.stages || [],
        advancementRules:
          initialData.advancement_rules ||
          prev.advancementRules || [],
        type:
          initialData.tournament_type ||
          prev.type ||
          'ranked',
        hostType:
          initialData.hosted_by_type ||
          prev.hostType ||
          'individual',
        hostCommunityId:
          initialData.hosted_by_community_id ||
          prev.hostCommunityId ||
          null,
      }));
    } catch (err) {
      console.error('Error prefilling initialData:', err);
    }
  }, [initialData]);

  const steps = [
    { id: 'basic', title: 'Basic Information', icon: <Trophy size={20} /> },
    { id: 'description', title: 'Tournament Description', icon: <FileText size={20} /> },
    {
      id: 'registration',
      title: 'Registration Settings',
      icon: <Users size={20} />,
    },
    { id: 'settings', title: 'Tournament Settings', icon: <Settings size={20} /> },
    {
      id: 'review',
      title: initialData?.id
        ? 'Review & Update'
        : 'Review & Create',
      icon: <Check size={20} />,
    },
  ];

  const updateFormData = (updates: any) => {
    setFormData((prev: any) => ({ ...prev, ...updates }));
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
          (formData.hostType === 'individual' ||
            formData.hostCommunityId)
        );
      case 1: // Tournament Description
        return true; // Description is optional
      case 2: // Registration
        return (
          formData.beybladesPerPlayer > 0 &&
          formData.decksPerPlayer > 0 &&
          (formData.isFree ? true : formData.entryFee > 0)
        );
      case 3: // Tournament Type
        return true;
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
        max_participants: formData.isUnlimited
          ? 999999
          : formData.maxParticipants,
        beyblades_per_player: formData.beybladesPerPlayer,
        decks_per_player: formData.decksPerPlayer,
        entry_fee: formData.isFree ? 0 : formData.entryFee,
        is_free: formData.isFree,
        tournament_type: formData.tournamentType || formData.type,
        hosted_by_type: formData.hostType,
        hosted_by_user_id:
          formData.hostType === 'individual' ? user?.id : null,
        hosted_by_community_id:
          formData.hostType === 'community'
            ? formData.hostCommunityId
            : null,
        tournament_settings: formData.tournamentSettings,
        payment_options: formData.paymentOptions || [],
        payment_details: formData.paymentDetails || {},
        allow_repeating_parts_in_deck:
          formData.allowRepeatingPartsInDeck || false,
        allow_repeating_parts_across_decks:
          formData.allowRepeatingPartsAcrossDecks || false,
        repeat_part_fee: formData.repeatPartFee || 0,
      };

      // Edit existing tournament
      if (initialData && initialData.id) {
        const { data: updatedTournament, error: updateError } =
          await supabase
            .from('tournaments')
            .update(tournamentData)
            .eq('id', initialData.id)
            .select()
            .single();

        if (updateError) throw updateError;

        try {
          const { error: stageError } = await supabase
            .from('tournament_stages')
            .upsert(
              [
                {
                  tournament_id: updatedTournament.id,
                  stage_number: 1,
                  stage_name: 'Main Stage',
                  stage_type: 'swiss',
                  number_of_rounds: 5,
                },
              ],
              { onConflict: 'tournament_id,stage_number' }
            );

          if (stageError) {
            console.warn('Stage upsert warning:', stageError);
          }
        } catch (err) {
          console.warn('Stage upsert failed:', err);
        }

        alert('Updated', 'Tournament updated successfully!');
        onClose();
        onSuccess?.();
        return;
      }

      // Create new tournament
      const { data: tournament, error } = await supabase
        .from('tournaments')
        .insert([tournamentData])
        .select()
        .single();

      if (error) throw error;

      const { error: stageError } =
        await supabase.from('tournament_stages').insert([
          {
            tournament_id: tournament.id,
            stage_name: 'Main Stage',
            stage_type: 'swiss',
            number_of_rounds: 5,
            stage_number: 1,
          },
        ]);
      if (stageError) console.warn('Stage insert warning:', stageError);

      alert('Success', 'Tournament created successfully!');
      onClose();
      onSuccess?.();
    } catch (err: any) {
      console.error('Error creating/updating tournament:', err);
      alert(
        'Error',
        err.message || 'Failed to create/update tournament'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-950 border border-cyan-500/30 shadow-lg w-full max-w-7xl h-[85vh] flex flex-col md:flex-row overflow-hidden">
      {/* Steps Sidebar (desktop) OR Dropdown (mobile) */}
      <div className="md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-3 md:p-6">
{/* Mobile Dropdown */}
<div className="md:hidden relative">
  <button
    onClick={() => setDropdownOpen(!dropdownOpen)}
    className="w-full flex justify-between items-center px-3 py-2 bg-slate-800 text-slate-200 rounded-none"
  >
    <span className="flex items-center gap-2">
      <div
        className={`h-6 w-6 flex items-center justify-center text-xs font-bold ${
          currentStep === 0
            ? 'bg-cyan-500 text-white'
            : 'bg-slate-700 text-slate-300'
        }`}
      >
        {currentStep + 1}
      </div>
      {steps[currentStep].title}
    </span>
    <ChevronDown
      className={`w-4 h-4 transition-transform ${
        dropdownOpen ? 'rotate-180' : ''
      }`}
    />
  </button>

  {dropdownOpen && (
    <div className="absolute left-0 right-0 mt-1 z-50 bg-slate-800 border border-slate-700 shadow-lg">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={`px-3 py-2 cursor-pointer ${
            currentStep === index
              ? 'bg-cyan-600 text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => {
            setCurrentStep(index);
            setDropdownOpen(false);
          }}
        >
          {index + 1}. {step.title}
        </div>
      ))}
    </div>
  )}
</div>


        {/* Desktop Steps */}
        <div className="hidden md:flex flex-col space-y-6">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 cursor-pointer ${
                currentStep === index
                  ? 'text-cyan-400 font-semibold'
                  : 'text-slate-400'
              }`}
              onClick={() => setCurrentStep(index)}
            >
              <div
                className={`h-6 w-6 flex items-center justify-center text-xs font-bold ${
                  currentStep === index
                    ? 'bg-cyan-500 text-white'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {index + 1}
              </div>
              <span>{step.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden md:max-w-[calc(100%-16rem)]">
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          {renderCurrentStep()}
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center border-t border-slate-800 p-4 bg-slate-950 sticky bottom-0">
          <button
            onClick={onClose}
            className={`${baseBtn} bg-red-600 text-white hover:bg-red-500`}
          >
            Cancel
          </button>
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className={`${baseBtn} bg-slate-700 text-slate-300 hover:bg-slate-600`}
              >
                Back
              </button>
            )}
            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceed()}
                className={`${baseBtn} ${
                  canProceed()
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-400 hover:to-purple-500'
                    : 'bg-slate-700 text-slate-500'
                }`}
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className={`${baseBtn} bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-400 hover:to-purple-500`}
              >
                {saving
                  ? 'Saving...'
                  : initialData && initialData.id
                  ? 'Update'
                  : 'Create'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}