import React from 'react';
import { ArrowRight, Users, AlertCircle } from 'lucide-react';
import { TournamentFormData } from './TournamentWizard';

interface AdvancementRulesStepProps {
  formData: TournamentFormData;
  updateFormData: (updates: Partial<TournamentFormData>) => void;
}

export function AdvancementRulesStep({ formData, updateFormData }: AdvancementRulesStepProps) {
  const validAdvanceCounts = [4, 8, 16, 32, 64, 128, 256];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-white flex items-center">
            <ArrowRight size={20} className="mr-2 text-cyan-400" />
            Advancement Rules (Post-Creation Setup)
          </h3>
        </div>
        
        <p className="text-slate-400 mt-2">
          Advancement rules will be configured after tournament creation with participant counts of 4, 8, 16, 32, or 64 players.
        </p>
      </div>

      {/* Information Card */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-12 rounded-none 
                     transition-all duration-300 hover:border-orange-400/70 
                     hover:shadow-[0_0_15px_rgba(251,146,60,0.4)] text-center">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-orange-400 to-red-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} className="text-white" />
        </div>
        
        <h4 className="text-lg font-semibold text-white mb-2">Post-Creation Setup</h4>
        <p className="text-orange-300 mb-6">
          Advancement rules will be configured after tournament creation based on actual participant count.
        </p>
        
        <div className="bg-slate-800/50 border border-orange-500/20 rounded-lg p-4 max-w-md mx-auto">
          <h5 className="text-sm font-semibold text-orange-400 mb-2">Available Advancement Counts:</h5>
          <div className="flex flex-wrap justify-center gap-2">
            {validAdvanceCounts.map(count => (
              <span key={count} className="px-2 py-1 bg-orange-500/20 text-orange-300 rounded text-sm">
                {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tournament Structure Preview */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h4 className="text-lg font-semibold text-white mb-4">Tournament Structure</h4>
        
        <div className="space-y-4">
          {formData.stages.map((stage, index) => (
            <div key={stage.id} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-medium text-white">Stage {index + 1}: {stage.name}</h5>
                  <p className="text-sm text-slate-400 capitalize">{stage.type.replace('_', ' ')}</p>
                </div>
                <div className="text-xs text-cyan-400 bg-cyan-500/20 px-2 py-1 rounded">
                  {stage.type.toUpperCase()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}