import React from 'react';
import { Check, Trophy, Calendar, MapPin, Users, Target, DollarSign, Shield } from 'lucide-react';
import { TournamentFormData } from './TournamentWizard';

interface ReviewStepProps {
  formData: TournamentFormData;
  userCommunities: any[];
}

export function ReviewStep({ formData, userCommunities }: ReviewStepProps) {
  const hostCommunity = userCommunities.find(c => c.id === formData.hostCommunityId);

  return (
    <div className="space-y-6">
      {/* Tournament Summary */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-6 flex items-center">
          <Check size={20} className="mr-2 text-cyan-400" />
          Tournament Summary
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-cyan-400 mb-2">Basic Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <Trophy size={14} className="mr-2 text-cyan-400" />
                  <span className="text-slate-400">Name:</span>
                  <span className="text-white ml-2 font-medium">{formData.name}</span>
                </div>
                <div className="flex items-center">
                  <Users size={14} className="mr-2 text-cyan-400" />
                  <span className="text-slate-400">Host:</span>
                  <span className="text-white ml-2">
                    {formData.hostType === 'community' 
                      ? `${hostCommunity?.name || 'Unknown Community'} (Community)`
                      : 'Individual'
                    }
                  </span>
                </div>
                <div className="flex items-center">
                  <Users size={14} className="mr-2 text-cyan-400" />
                  <span className="text-slate-400">Format:</span>
                  <span className="text-white ml-2">
                    {formData.tournamentSettings?.match_format === 'teams' 
                      ? `Teams (${formData.tournamentSettings.players_per_team} players per team)`
                      : 'Solo'
                    }
                  </span>
                </div>
                <div className="flex items-center">
                  <MapPin size={14} className="mr-2 text-cyan-400" />
                  <span className="text-slate-400">Location:</span>
                  <span className="text-white ml-2">{formData.location}</span>
                </div>
                <div className="flex items-center">
                  <Calendar size={14} className="mr-2 text-cyan-400" />
                  <span className="text-slate-400">Start:</span>
                  <span className="text-white ml-2">
                    {new Date(formData.tournamentStart).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center">
                  <Calendar size={14} className="mr-2 text-cyan-400" />
                  <span className="text-slate-400">Registration Deadline:</span>
                  <span className="text-white ml-2">
                    {new Date(formData.registrationDeadline).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Registration Settings */}
            <div>
              <h4 className="text-sm font-semibold text-cyan-400 mb-2">Registration Settings</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <DollarSign size={14} className="mr-2 text-cyan-400" />
                  <span className="text-slate-400">Entry Fee:</span>
                  <span className="text-white ml-2">
                    {formData.isFree ? 'Free' : `₱${formData.entryFee}`}
                  </span>
                </div>
                <div className="flex items-center">
                  <Users size={14} className="mr-2 text-cyan-400" />
                  <span className="text-slate-400">Participants:</span>
                  <span className="text-white ml-2">
                    {formData.isUnlimited ? 'Unlimited' : `Max ${formData.participantCap}`}
                  </span>
                </div>
                <div className="flex items-center">
                  <Target size={14} className="mr-2 text-cyan-400" />
                  <span className="text-slate-400">Beyblades:</span>
                  <span className="text-white ml-2">
                    {formData.beybladesPerPlayer} per player ({formData.decksPerPlayer} deck{formData.decksPerPlayer > 1 ? 's' : ''})
                  </span>
                </div>
                <div className="flex items-center">
                  <Shield size={14} className="mr-2 text-cyan-400" />
                  <span className="text-slate-400">Repeating Parts:</span>
                  <span className="text-white ml-2">
                    {formData.tournamentSettings?.rules?.allow_repeating_parts ? 'Allowed' : 'Not Allowed'}
                  </span>
                </div>
                <div className="flex items-center">
                  <Trophy size={14} className="mr-2 text-cyan-400" />
                  <span className="text-slate-400">Tournament Type:</span>
                  <span className="text-white ml-2 capitalize">
                    {formData.tournamentType}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tournament Structure */}
          <div className="space-y-4">
            {/* Tournament Settings */}
            <div>
              <h4 className="text-sm font-semibold text-cyan-400 mb-2">Tournament Settings</h4>
              <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-3">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      formData.tournamentSettings?.rules?.allow_self_finish ? 'bg-green-500' : 'bg-gray-500'
                    }`}></div>
                    <span className="text-slate-300">Self Finish Scoring</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      formData.tournamentSettings?.rules?.allow_deck_shuffling ? 'bg-green-500' : 'bg-gray-500'
                    }`}></div>
                    <span className="text-slate-300">Deck Shuffling</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      formData.allowRepeatingPartsInDeck || formData.allowRepeatingPartsAcrossDecks ? 'bg-green-500' : 'bg-gray-500'
                    }`}></div>
                    <span className="text-slate-300">Repeating Parts</span>
                  </div>
                </div>
              </div>
            </div>

            {/* <div>
              <h4 className="text-sm font-semibold text-cyan-400 mb-2">Tournament Structure</h4>
              <div className="space-y-3">
                {formData.stages.map((stage, index) => (
                  <div key={stage.id} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">Stage {index + 1}: {stage.name}</span>
                      <span className="text-xs text-cyan-400 capitalize bg-cyan-500/20 px-2 py-1 rounded">
                        {stage.type.replace('_', ' ')}
                      </span>
                    </div>
                    
                    {stage.type === 'swiss' && (
                      <div className="text-xs text-slate-400">
                        Win: {stage.rules.pointsPerWin}pts, Tie: {stage.rules.pointsPerTie}pts, Bye: {stage.rules.pointsPerBye}pts
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div> */}

            {/* Advancement Rules */}
            {formData.advancementRules.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-cyan-400 mb-2">Advancement Rules</h4>
                <div className="space-y-2">
                  {formData.advancementRules.map((rule, index) => (
                    <div key={index} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-3">
                      <div className="text-xs text-slate-300">
                        Top <span className="text-white font-medium">{rule.advanceCount}</span> from 
                        <span className="text-cyan-400 ml-1">Stage {rule.fromStage}</span> → 
                        <span className="text-purple-400 ml-1">Stage {rule.toStage}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tournament Type Impact */}
            <div>
              <h4 className="text-sm font-semibold text-cyan-400 mb-2">Tournament Impact</h4>
              <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-3">
                  <span className="text-white font-medium capitalize">{formData.tournamentType} Tournament</span>
                </div>
                <div className="text-xs text-slate-400">
                  {formData.tournamentType === 'experimental' && 'No stats recorded anywhere - purely for testing'}
                  {formData.tournamentType === 'practice' && 'No stats recorded, perfect for testing'}
                  {formData.tournamentType === 'casual' && 'Stats recorded for analytics, no ranking points'}
                  {formData.tournamentType === 'ranked' && 'Full stats + ranking points awarded based on placement'}
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Description Preview */}
      {formData.description && formData.description.trim() && (
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <h4 className="text-sm font-semibold text-cyan-400 mb-3">Preview</h4>
          <div 
            className="prose prose-invert prose-sm max-w-none
                       prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300
                       prose-strong:text-white prose-em:text-slate-300 prose-a:text-cyan-400"
            dangerouslySetInnerHTML={{ __html: formData.description }}
          />
        </div>
      )}
    </div>
  );
}