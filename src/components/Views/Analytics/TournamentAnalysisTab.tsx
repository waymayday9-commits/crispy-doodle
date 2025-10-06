// src/components/Analysis/TournamentAnalysisTab.tsx
import React, { useState, useEffect } from 'react';
import { Database, Users, BarChart3, LayoutDashboard, Crown, Target, Zap } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { MetaAnalysisSubTab } from './MetaAnalysisSubTab';
import { PlayerAnalyticsSubTab } from './PlayerAnalyticsSubTab';
import { TournamentSummaryTab } from './TournamentSummaryTab';
import { LeaderboardsTab } from './LeaderboardsTab';
import { MatchInsightsTab } from './MatchInsightsTab';

interface Tournament {
  id: string;
  name: string;
  status: string;
  tournament_date: string;
}

export function TournamentAnalysisTab() {
  const [currentSubTab, setCurrentSubTab] = useState<'summary' | 'leaderboards' | 'insights' | 'meta' | 'player'>('summary');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, status, tournament_date')
        .order('tournament_date', { ascending: false });

      if (error) throw error;

      setTournaments(data || []);

      // Auto-select first completed tournament
      const completedTournament = data?.find(t => t.status === 'completed');
      if (completedTournament) {
        setSelectedTournament(completedTournament.id);
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubTabChange = (subTab: 'summary' | 'leaderboards' | 'insights' | 'meta' | 'player') => {
    if (subTab === currentSubTab) return;

    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentSubTab(subTab);
      setIsTransitioning(false);
    }, 150);
  };

  return (
    <div className="space-y-8 p-6">
      {/* Tournament Selection */}
      <div className="relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center">
          <Database size={24} className="mr-2 text-cyan-400" />
          Tournament Selection
        </h2>
        <div className="max-w-md">
          <label className="block text-sm font-medium text-cyan-400 mb-2">
            Select Tournament for Analysis
          </label>
          <select
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
            className="w-full bg-slate-800 border border-cyan-500/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-none"
          >
            <option value="">-- Select Tournament --</option>
            {tournaments.map(tournament => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name} ({tournament.status}) - {new Date(tournament.tournament_date).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedTournament && (
        <>
          {/* Sub-tabs */}
          <div className="relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] backdrop-blur-sm">
            {/* NOTE: removed parent-level `group` and its group-hover underline */}
            <div className="flex items-center space-x-4 sm:space-x-6 border-b border-slate-700 pb-2 overflow-x-auto">
              {/* Tournament Summary */}
              <button
                onClick={() => handleSubTabChange('summary')}
                className={`relative pb-2 text-sm font-medium transition-colors group flex items-center ${
                  currentSubTab === 'summary'
                    ? 'text-cyan-400'
                    : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                <LayoutDashboard size={16} className="mr-2" />
                <span className="hidden sm:inline">Tournament Summary</span>
                <span className="sm:hidden">Summary</span>
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-300
                  ${currentSubTab === 'summary' ? 'w-full' : 'w-0 group-hover:w-full'}`}
                />
              </button>

              {/* Leaderboards */}
              <button
                onClick={() => handleSubTabChange('leaderboards')}
                className={`relative pb-2 text-sm font-medium transition-colors group flex items-center ${
                  currentSubTab === 'leaderboards'
                    ? 'text-cyan-400'
                    : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                <Crown size={16} className="mr-2" />
                <span className="hidden sm:inline">Leaderboards</span>
                <span className="sm:hidden">Ranks</span>
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-300
                  ${currentSubTab === 'leaderboards' ? 'w-full' : 'w-0 group-hover:w-full'}`}
                />
              </button>

              {/* Match Insights */}
              <button
                onClick={() => handleSubTabChange('insights')}
                className={`relative pb-2 text-sm font-medium transition-colors group flex items-center ${
                  currentSubTab === 'insights'
                    ? 'text-cyan-400'
                    : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                <Target size={16} className="mr-2" />
                <span className="hidden sm:inline">Match Insights</span>
                <span className="sm:hidden">Insights</span>
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-300
                  ${currentSubTab === 'insights' ? 'w-full' : 'w-0 group-hover:w-full'}`}
                />
              </button>

              {/* Meta Analysis */}
              <button
                onClick={() => handleSubTabChange('meta')}
                className={`relative pb-2 text-sm font-medium transition-colors group flex items-center ${
                  currentSubTab === 'meta'
                    ? 'text-cyan-400'
                    : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                <BarChart3 size={16} className="mr-2" />
                <span className="hidden sm:inline">Meta Analysis</span>
                <span className="sm:hidden">Meta</span>
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-300
                  ${currentSubTab === 'meta' ? 'w-full' : 'w-0 group-hover:w-full'}`}
                />
              </button>

              {/* Player Analytics */}
              <button
                onClick={() => handleSubTabChange('player')}
                className={`relative pb-2 text-sm font-medium transition-colors group flex items-center ${
                  currentSubTab === 'player'
                    ? 'text-cyan-400'
                    : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                <Users size={16} className="mr-2" />
                <span className="hidden sm:inline">Player Analytics</span>
                <span className="sm:hidden">Players</span>
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-300
                  ${currentSubTab === 'player' ? 'w-full' : 'w-0 group-hover:w-full'}`}
                />
              </button>
            </div>
          </div>

          {/* Sub-tab Content */}
          <div>
            {currentSubTab === 'summary' && (
              <TournamentSummaryTab tournamentId={selectedTournament} />
            )}
            {currentSubTab === 'leaderboards' && (
              <LeaderboardsTab tournamentId={selectedTournament} />
            )}
            {currentSubTab === 'insights' && (
              <MatchInsightsTab tournamentId={selectedTournament} />
            )}
            {currentSubTab === 'meta' && (
              <MetaAnalysisSubTab tournamentId={selectedTournament} />
            )}
            {currentSubTab === 'player' && (
              <PlayerAnalyticsSubTab tournamentId={selectedTournament} />
            )}
          </div>
        </>
      )}

      {!selectedTournament && (
        <div className="relative border border-slate-700 bg-slate-900/40 p-8 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] text-center m-6">
          <div className="w-16 h-16 bg-slate-800/50 flex items-center justify-center mx-auto mb-4 rounded-none">
            <Database size={32} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Select a Tournament</h3>
          <p className="text-slate-400">
            Choose a tournament from the dropdown above to view overview, meta analysis, and player analytics.
          </p>
        </div>
      )}
    </div>
  );
}