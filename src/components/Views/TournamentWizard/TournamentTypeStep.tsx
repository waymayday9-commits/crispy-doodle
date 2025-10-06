import React from 'react';
import { Trophy, BarChart3, Play, Target, Plus, Trash2 } from 'lucide-react';
import { TournamentFormData } from './TournamentWizard';

interface TournamentTypeStepProps {
  formData: TournamentFormData;
  updateFormData: (updates: Partial<TournamentFormData>) => void;
}

export function TournamentTypeStep({ formData, updateFormData }: TournamentTypeStepProps) {
  const updatePointsSystem = (placement: number, points: number) => {
    updateFormData({
      pointsSystem: {
        ...formData.pointsSystem,
        [placement]: points
      }
    });
  };

  const addPlacement = () => {
    const nextPlacement = Math.max(...Object.keys(formData.pointsSystem).map(Number)) + 1;
    updatePointsSystem(nextPlacement, 0);
  };

  const removePlacement = (placement: number) => {
    const newPointsSystem = { ...formData.pointsSystem };
    delete newPointsSystem[placement];
    updateFormData({ pointsSystem: newPointsSystem });
  };

  return (
    <div className="space-y-6">
      {/* Tournament Type Selection */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Trophy size={20} className="mr-2 text-cyan-400" />
          Tournament Type (Stat Tracking Mode)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col p-4 border border-slate-600 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors">
            <input
              type="radio"
              name="tournamentType"
              value="practice"
              checked={formData.tournamentType === 'practice'}
              onChange={(e) => updateFormData({ tournamentType: e.target.value as any })}
              className="w-4 h-4 text-cyan-600 mb-3"
            />
            <div className="flex items-center mb-2">
              <Play size={16} className="mr-2 text-gray-400" />
              <span className="font-medium text-white">Practice</span>
            </div>
            <div className="text-sm text-slate-400">
              No stats recorded anywhere. Perfect for testing and casual play.
            </div>
          </label>
          
          <label className="flex flex-col p-4 border border-slate-600 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors">
            <input
              type="radio"
              name="tournamentType"
              value="casual"
              checked={formData.tournamentType === 'casual'}
              onChange={(e) => updateFormData({ tournamentType: e.target.value as any })}
              className="w-4 h-4 text-cyan-600 mb-3"
            />
            <div className="flex items-center mb-2">
              <BarChart3 size={16} className="mr-2 text-blue-400" />
              <span className="font-medium text-white">Casual</span>
            </div>
            <div className="text-sm text-slate-400">
              Stats recorded but no points awarded. Contributes to analytics only.
            </div>
          </label>

          <label className="flex flex-col p-4 border border-slate-600 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors">
            <input
              type="radio"
              name="tournamentType"
              value="ranked"
              checked={formData.tournamentType === 'ranked'}
              onChange={(e) => updateFormData({ tournamentType: e.target.value as any })}
              className="w-4 h-4 text-cyan-600 mb-3"
            />
            <div className="flex items-center mb-2">
              <Target size={16} className="mr-2 text-yellow-400" />
              <span className="font-medium text-white">Ranked</span>
            </div>
            <div className="text-sm text-slate-400">
              Stats recorded, points awarded. Contributes to Global + Community Leaderboards.
            </div>
          </label>
        </div>
      </div>

      {/* Points System (for ranked tournaments) */}
      {formData.tournamentType === 'ranked' && (
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] opacity-50 pointer-events-none">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white flex items-center">
              <Target size={20} className="mr-2 text-cyan-400" />
              Points System (Ranked Rewards)
            </h3>
          </div>
      
          <div className="flex items-center justify-center p-6 bg-slate-800/60 border border-slate-600 rounded-lg">
            <p className="text-slate-400 text-sm font-medium">
              🚧 Upcoming Feature — Ranked rewards system is not yet available.
            </p>
          </div>
        </div>
      )}

      {/* Tournament Impact */}
      {/* <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4">Tournament Impact</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-cyan-400">Stats Tracking</h5>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  formData.tournamentType === 'practice' ? 'bg-gray-500' : 'bg-green-500'
                }`}></div>
                <span className="text-slate-300">Global Analytics</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  formData.tournamentType === 'practice' ? 'bg-gray-500' : 'bg-green-500'
                }`}></div>
                <span className="text-slate-300">Personal Analytics</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  formData.tournamentType === 'practice' ? 'bg-gray-500' : 'bg-green-500'
                }`}></div>
                <span className="text-slate-300">Community Analytics</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-cyan-400">Points & Rankings</h5>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  formData.tournamentType === 'ranked' ? 'bg-green-500' : 'bg-gray-500'
                }`}></div>
                <span className="text-slate-300">Global Leaderboard</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  formData.tournamentType === 'ranked' ? 'bg-green-500' : 'bg-gray-500'
                }`}></div>
                <span className="text-slate-300">Community Leaderboard</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  formData.tournamentType === 'ranked' ? 'bg-green-500' : 'bg-gray-500'
                }`}></div>
                <span className="text-slate-300">Season Standings</span>
              </div>
            </div>
          </div>
        </div>
      </div> */}
    </div>
  );
}