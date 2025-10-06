import React from 'react';
import { Settings, Users, Trophy, AlertCircle, CheckCircle } from 'lucide-react';
import { TournamentFormData } from './TournamentWizard';

interface TournamentSettingsStepProps {
  formData: TournamentFormData;
  updateFormData: (updates: Partial<TournamentFormData>) => void;
}

export function TournamentSettingsStep({ formData, updateFormData }: TournamentSettingsStepProps) {
  const updateTournamentSettings = (updates: any) => {
    updateFormData({
      tournamentSettings: {
        ...formData.tournamentSettings,
        ...updates
      }
    });
  };

  const updateRules = (ruleUpdates: any) => {
    updateTournamentSettings({
      rules: {
        ...formData.tournamentSettings.rules,
        ...ruleUpdates
      }
    });
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
          Tournament Type
        </h3>

        <div className="space-y-3">
          <label className="flex items-center space-x-3 p-4 border border-slate-600 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors">
            <input
              type="radio"
              name="tournamentType"
              value="practice"
              checked={formData.tournamentType === 'practice'}
              onChange={(e) => updateFormData({ tournamentType: e.target.value as any })}
              className="w-4 h-4 text-cyan-600"
            />
            <div className="flex-1">
              <div className="font-medium text-white">Practice</div>
              <div className="text-sm text-slate-400">Stats recorded only in personal stats</div>
            </div>
          </label>
          
          <label className="flex items-center space-x-3 p-4 border border-slate-600 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors">
            <input
              type="radio"
              name="tournamentType"
              value="casual"
              checked={formData.tournamentType === 'casual'}
              onChange={(e) => updateFormData({ tournamentType: e.target.value as any })}
              className="w-4 h-4 text-cyan-600"
            />
            <div className="flex-1">
              <div className="font-medium text-white">Casual</div>
              <div className="text-sm text-slate-400">Stats recorded in personal stats + analytics</div>
            </div>
          </label>

          <label className="flex items-center space-x-3 p-4 border border-slate-600 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors">
            <input
              type="radio"
              name="tournamentType"
              value="ranked"
              checked={formData.tournamentType === 'ranked'}
              onChange={(e) => updateFormData({ tournamentType: e.target.value as any })}
              className="w-4 h-4 text-cyan-600"
            />
            <div className="flex-1">
              <div className="font-medium text-white">Ranked</div>
              <div className="text-sm text-slate-400">Stats recorded in personal stats, analytics, and global leaderboards</div>
            </div>
          </label>

          <label className="flex items-center space-x-3 p-4 border border-slate-600 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors">
            <input
              type="radio"
              name="tournamentType"
              value="experimental"
              checked={formData.tournamentType === 'experimental'}
              onChange={(e) => updateFormData({ tournamentType: e.target.value as any })}
              className="w-4 h-4 text-cyan-600"
            />
            <div className="flex-1">
              <div className="font-medium text-white">Experimental</div>
              <div className="text-sm text-slate-400">No stats recorded anywhere (not even personal)</div>
            </div>
          </label>
        </div>
      </div>

      {/* Tournament Rules */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Settings size={20} className="mr-2 text-cyan-400" />
          Tournament Rules
        </h3>

        <div className="space-y-4">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.tournamentSettings.rules.allow_self_finish}
              onChange={(e) => updateRules({ allow_self_finish: e.target.checked })}
              className="w-4 h-4 text-cyan-600 border-cyan-500/30 focus:ring-cyan-500 bg-slate-800"
            />
            <div>
              <div className="font-medium text-white">Allow Self Finish? (1 pt)</div>
              <div className="text-sm text-slate-400">Players can score points from self-finishes</div>
            </div>
          </label>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.tournamentSettings.rules.allow_deck_shuffling}
              onChange={(e) => updateRules({ allow_deck_shuffling: e.target.checked })}
              className="w-4 h-4 text-cyan-600 border-cyan-500/30 focus:ring-cyan-500 bg-slate-800"
            />
            <div>
              <div className="font-medium text-white">Allow Deck Shuffling before match?</div>
              <div className="text-sm text-slate-400">Players can reorder their Beyblades between phases</div>
            </div>
          </label>
        </div>
      </div>

      {/* Match Format */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Users size={20} className="mr-2 text-cyan-400" />
          Match Format
        </h3>

        <div className="space-y-4">
          <label className="flex items-center space-x-3 p-4 border border-slate-600 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors">
            <input
              type="radio"
              name="matchFormat"
              value="solo"
              checked={formData.tournamentSettings.match_format === 'solo'}
              onChange={(e) => updateTournamentSettings({ 
                match_format: e.target.value,
                players_per_team: 1
              })}
              className="w-4 h-4 text-cyan-600"
            />
            <div className="flex-1">
              <div className="font-medium text-white">Solo</div>
              <div className="text-sm text-slate-400">Individual players compete</div>
            </div>
          </label>
          
          <label className="flex items-center space-x-3 p-4 border border-slate-600 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors">
            <input
              type="radio"
              name="matchFormat"
              value="teams"
              checked={formData.tournamentSettings.match_format === 'teams'}
              onChange={(e) => updateTournamentSettings({ 
                match_format: e.target.value,
                players_per_team: formData.tournamentSettings.players_per_team || 2
              })}
              className="w-4 h-4 text-cyan-600"
            />
            <div className="flex-1">
              <div className="font-medium text-white">Teams</div>
              <div className="text-sm text-slate-400">Players compete as team members</div>
            </div>
          </label>

          {formData.tournamentSettings.match_format === 'teams' && (
            <div className="ml-7 mt-4">
              <label className="block text-sm font-medium text-cyan-400 mb-2">
                Number of players per team
              </label>
              <input
                type="number"
                min="2"
                max="10"
                value={formData.tournamentSettings.players_per_team}
                onChange={(e) => updateTournamentSettings({ 
                  players_per_team: parseInt(e.target.value) || 2 
                })}
                className="w-32 bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Settings Impact */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4">Settings Impact</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-cyan-400">Stats Tracking</h5>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  formData.tournamentType === 'experimental' ? 'bg-gray-500' : 'bg-green-500'
                }`}></div>
                <span className="text-slate-300">Personal Stats</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  ['casual', 'ranked'].includes(formData.tournamentType) ? 'bg-green-500' : 'bg-gray-500'
                }`}></div>
                <span className="text-slate-300">Analytics</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  formData.tournamentType === 'ranked' ? 'bg-green-500' : 'bg-gray-500'
                }`}></div>
                <span className="text-slate-300">Global Leaderboards</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-cyan-400">Active Rules</h5>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  formData.tournamentSettings.rules.allow_self_finish ? 'bg-green-500' : 'bg-gray-500'
                }`}></div>
                <span className="text-slate-300">Self Finish Scoring</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  formData.tournamentSettings.rules.allow_deck_shuffling ? 'bg-green-500' : 'bg-gray-500'
                }`}></div>
                <span className="text-slate-300">Deck Shuffling</span>
              </div>
            </div>
          </div>
        </div>

        {/* Match Format Summary */}
        <div className="mt-6 pt-6 border-t border-slate-700">
          <div className="flex items-center space-x-3">
            <Users size={16} className="text-cyan-400" />
            <span className="text-white font-medium">
              Match Format: {formData.tournamentSettings.match_format === 'solo' ? 'Solo' : 'Teams'}
            </span>
            {formData.tournamentSettings.match_format === 'teams' && (
              <span className="text-slate-400">
                ({formData.tournamentSettings.players_per_team} players per team)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tournament Type Information */}
      <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-cyan-400 mb-3">Tournament Type Information</h4>
        <div className="space-y-2 text-sm">
          {formData.tournamentType === 'practice' && (
            <div className="flex items-center space-x-2 text-gray-300">
              <AlertCircle size={14} className="text-gray-400" />
              <span>Practice tournaments only record stats in personal profiles for individual tracking</span>
            </div>
          )}
          {formData.tournamentType === 'casual' && (
            <div className="flex items-center space-x-2 text-blue-300">
              <CheckCircle size={14} className="text-blue-400" />
              <span>Casual tournaments contribute to analytics and meta analysis but not global rankings</span>
            </div>
          )}
          {formData.tournamentType === 'ranked' && (
            <div className="flex items-center space-x-2 text-yellow-300">
              <Trophy size={14} className="text-yellow-400" />
              <span>Ranked tournaments contribute to all stats tracking and global leaderboard rankings</span>
            </div>
          )}
          {formData.tournamentType === 'experimental' && (
            <div className="flex items-center space-x-2 text-red-300">
              <AlertCircle size={14} className="text-red-400" />
              <span>Experimental tournaments record no stats anywhere - purely for testing new formats</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}