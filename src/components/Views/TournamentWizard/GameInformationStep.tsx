import React from 'react';
import { Target, Plus, Trash2, Settings } from 'lucide-react';
import { TournamentFormData } from './TournamentWizard';

interface GameInformationStepProps {
  formData: TournamentFormData;
  updateFormData: (updates: Partial<TournamentFormData>) => void;
}

export function GameInformationStep({ formData, updateFormData }: GameInformationStepProps) {
  const addStage = () => {
    if (formData.stages.length < 3) {
      const newStage = {
        id: Date.now().toString(),
        name: `Stage ${formData.stages.length + 1}`,
        type: 'swiss' as const,
        rules: {
          pointsPerWin: 3,
          pointsPerTie: 1,
          pointsPerBye: 3
        }
      };
      
      updateFormData({
        stages: [...formData.stages, newStage]
      });
    }
  };

  const removeStage = (stageId: string) => {
    if (formData.stages.length > 1) {
      updateFormData({
        stages: formData.stages.filter(stage => stage.id !== stageId)
      });
    }
  };

  const updateStage = (stageId: string, updates: any) => {
    updateFormData({
      stages: formData.stages.map(stage => 
        stage.id === stageId ? { ...stage, ...updates } : stage
      )
    });
  };

  const updateStageRules = (stageId: string, rules: any) => {
    updateStage(stageId, { rules });
  };

  return (
    <div className="space-y-6">
      {/* Stages Header */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-white flex items-center">
            <Target size={20} className="mr-2 text-cyan-400" />
            Tournament Stages ({formData.stages.length}/3)
          </h3>
          
          {formData.stages.length < 3 && (
            <button
              onClick={addStage}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all duration-200 flex items-center space-x-2"
            >
              <Plus size={16} />
              <span>Add Stage</span>
            </button>
          )}
        </div>
      </div>

      {/* Stages Configuration */}
      {formData.stages.map((stage, index) => (
        <div key={stage.id} className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                                      transition-all duration-300 hover:border-cyan-400/70 
                                      hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-white">Stage {index + 1}</h4>
            {formData.stages.length > 1 && (
              <button
                onClick={() => removeStage(stage.id)}
                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-cyan-400 mb-2">
                Stage Name *
              </label>
              <input
                type="text"
                value={stage.name}
                onChange={(e) => updateStage(stage.id, { name: e.target.value })}
                placeholder="e.g., Qualifiers, Finals"
                className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-cyan-400 mb-2">
                Tournament Type *
              </label>
              <select
                value={stage.type}
                onChange={(e) => updateStage(stage.id, { type: e.target.value })}
                className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="swiss">Swiss</option>
                <option value="round_robin">Round Robin</option>
                <option value="single_elimination">Single Elimination</option>
                <option value="double_elimination">Double Elimination</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Stage Rules Configuration */}
          <div className="mt-6 bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
            <h5 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center">
              <Settings size={16} className="mr-2" />
              Stage Rules
            </h5>

            {stage.type === 'swiss' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-cyan-400 mb-1">
                    Points per Win
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stage.rules.pointsPerWin || 3}
                    onChange={(e) => updateStageRules(stage.id, {
                      ...stage.rules,
                      pointsPerWin: parseInt(e.target.value) || 0
                    })}
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-cyan-400 mb-1">
                    Points per Tie
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stage.rules.pointsPerTie || 1}
                    onChange={(e) => updateStageRules(stage.id, {
                      ...stage.rules,
                      pointsPerTie: parseInt(e.target.value) || 0
                    })}
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-cyan-400 mb-1">
                    Points per Bye
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stage.rules.pointsPerBye || 3}
                    onChange={(e) => updateStageRules(stage.id, {
                      ...stage.rules,
                      pointsPerBye: parseInt(e.target.value) || 0
                    })}
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            )}

            {stage.type === 'round_robin' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-cyan-400 mb-1">
                    Matches per Opponent
                  </label>
                  <select
                    value={stage.rules.matchesPerOpponent || 1}
                    onChange={(e) => updateStageRules(stage.id, {
                      ...stage.rules,
                      matchesPerOpponent: parseInt(e.target.value)
                    })}
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value={1}>Once</option>
                    <option value={2}>Twice</option>
                    <option value={3}>Thrice</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-cyan-400 mb-2">
                    Ranking Criteria (in order of priority)
                  </label>
                  <div className="space-y-2 text-sm">
                    {['Match Wins', 'Game/Set Wins', 'Win %', 'Game/Set W/L Difference', 'Points Scored', 'Points Difference'].map((criteria, idx) => (
                      <div key={criteria} className="flex items-center space-x-2 text-slate-300">
                        <span className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center text-xs font-bold text-cyan-400">
                          {idx + 1}
                        </span>
                        <span>{criteria}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {stage.type === 'single_elimination' && (
              <div>
                <label className="flex items-center space-x-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={stage.rules.placementMatches || false}
                    onChange={(e) => updateStageRules(stage.id, {
                      ...stage.rules,
                      placementMatches: e.target.checked
                    })}
                    className="w-4 h-4 text-cyan-600"
                  />
                  <span>Break ties with placement matches</span>
                </label>
              </div>
            )}

            {stage.type === 'double_elimination' && (
              <div className="space-y-4">
                <label className="flex items-center space-x-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={stage.rules.splitParticipants || false}
                    onChange={(e) => updateStageRules(stage.id, {
                      ...stage.rules,
                      splitParticipants: e.target.checked
                    })}
                    className="w-4 h-4 text-cyan-600"
                  />
                  <span>Split participants evenly at start</span>
                </label>
                
                <div>
                  <label className="block text-xs font-medium text-cyan-400 mb-2">
                    Grand Finals Format
                  </label>
                  <select
                    value={stage.rules.grandFinalsFormat || 'double_defeat'}
                    onChange={(e) => updateStageRules(stage.id, {
                      ...stage.rules,
                      grandFinalsFormat: e.target.value
                    })}
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="double_defeat">Winner's finalist must be defeated twice</option>
                    <option value="single_match">One match only</option>
                  </select>
                </div>
              </div>
            )}

            {stage.type === 'custom' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-400 text-sm">
                  Custom tournament types will be configured manually after creation.
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}