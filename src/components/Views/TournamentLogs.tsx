import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Activity, RefreshCw, Users, Trophy, Target, 
  Clock, Zap, BarChart3, Eye, Calendar, MapPin, Settings, AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface TournamentLogsProps {
  tournamentId: string;
  onBack: () => void;
}

interface Tournament {
  id: string;
  name: string;
  tournament_date: string;
  location: string;
  status: string;
  current_participants: number;
  max_participants: number;
  tournament_type: string;
}

interface MatchResult {
  id: string;
  tournament_id: string;
  round_number: number;
  match_number: number;
  phase_number: number;
  player1_name: string;
  player2_name: string;
  player1_beyblade: string;
  player2_beyblade: string;
  player1_blade_line?: string;
  player2_blade_line?: string;
  outcome: string;
  winner_name: string;
  points_awarded: number;
  tournament_officer: string;
  stadium_number?: number;
  b_side_player?: string;
  x_side_player?: string;
  submitted_at: string;
}

interface RoundResult {
  roundKey: string;
  player1: string;
  player2: string;
  tournamentOfficer: string;
  roundNumber: number;
  matches: MatchResult[];
  player1Score: number;
  player2Score: number;
  winner: string;
  startTime: string;
  endTime: string;
  duration: string;
}

interface PlayerPairing {
  player1: string;
  player2: string;
  totalMatches: number;
  player1Wins: number;
  player2Wins: number;
  player1Score: number;
  player2Score: number;
  lastPlayed: string;
  rounds: RoundResult[];
}

interface Stadium {
  id: string;
  stadium_number: number;
  stadium_name: string;
  assigned_officer: string;
  current_score: {
    b_side_player?: string;
    x_side_player?: string;
    b_side_score: number;
    x_side_score: number;
    last_updated: string;
  };
}
export function TournamentLogs({ tournamentId, onBack }: TournamentLogsProps) {
  const { user } = useAuth();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [liveMatches, setLiveMatches] = useState<MatchResult[]>([]);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [playerPairings, setPlayerPairings] = useState<PlayerPairing[]>([]);
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [newStadiumName, setNewStadiumName] = useState('');
  const [newOfficerName, setNewOfficerName] = useState('');
  const [availableOfficers, setAvailableOfficers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentTab, setCurrentTab] = useState<'live-feed' | 'round-results' | 'pairings' | 'stadiums'>('live-feed');
  const [isAdmin, setIsAdmin] = useState(false);
  const [unmatchedTOMatches, setUnmatchedTOMatches] = useState<MatchResult[]>([]);
  const [roundsToShow, setRoundsToShow] = useState(1);
  const [roundsInput, setRoundsInput] = useState("1");
  const [showTotals, setShowTotals] = useState(false);
  const [stadiumTotals, setStadiumTotals] = useState<{ [id: string]: { p1: number; p2: number } }>({});

  
  useEffect(() => {
    fetchTournamentData();
    setIsAdmin(user?.role === 'admin' || user?.role === 'developer');
  }, [tournamentId]);

  useEffect(() => {
    // Auto-refresh every 10 seconds if enabled
    if (autoRefresh) {
      const interval = setInterval(() => {
        handleRefresh();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  useEffect(() => {
    if (!showTotals) return;
    const totals: { [id: string]: { p1: number; p2: number } } = {};
    stadiums.forEach((stadium) => {
      const rounds = getStadiumRoundResults(stadium.assigned_officer).slice(0, roundsToShow);
      const p1 = rounds.reduce((sum, r) => sum + r.player1Score, 0);
      const p2 = rounds.reduce((sum, r) => sum + r.player2Score, 0);
      totals[stadium.id] = { p1, p2 };
    });
    setStadiumTotals(totals);
  }, [showTotals, stadiums, roundResults, roundsToShow]);
  
  const fetchTournamentData = async () => {
    try {
      // Fetch tournament details
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      // Fetch all data
      await Promise.all([
        fetchLiveMatches(),
        fetchRoundResults(),
        fetchPlayerPairings(),
        fetchStadiums()
      ]);
    } catch (error) {
      console.error('Error fetching tournament data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('match_results')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('submitted_at', { ascending: true });

      if (error) throw error;
      
      // Sort matches properly by round, then by phase, then by match number
      const sortedMatches = (data || []).sort((a, b) => {
        // First by round number
        if (a.round_number !== b.round_number) {
          return b.round_number - a.round_number; // Newest rounds first
        }
        
        // Then by phase number (within same round)
        if (a.phase_number !== b.phase_number) {
          return b.phase_number - a.phase_number; // Latest phases first
        }
        
        // Then by match number (within same phase)
        if (a.match_number !== b.match_number) {
          return b.match_number - a.match_number; // Latest matches first
        }
        
        // Finally by submission time
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });
      
      setLiveMatches(sortedMatches.slice(0, 50)); // Limit to 50 most recent
    } catch (error) {
      console.error('Error fetching live matches:', error);
    }
  };

  const fetchRoundResults = async () => {
    try {
      const { data: matches, error } = await supabase
        .from('match_results')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('submitted_at', { ascending: true });

      if (error) throw error;

      // Group matches into rounds using the same logic as personal stats
      const roundsMap: { [key: string]: RoundResult } = {};

      (matches || []).forEach((match: MatchResult) => {
        const roundKey = `${match.player1_name}_vs_${match.player2_name}_${match.tournament_officer}_${match.round_number}`;
        
        if (!roundsMap[roundKey]) {
          roundsMap[roundKey] = {
            roundKey,
            player1: match.player1_name,
            player2: match.player2_name,
            tournamentOfficer: match.tournament_officer,
            roundNumber: match.round_number,
            matches: [],
            player1Score: 0,
            player2Score: 0,
            winner: '',
            startTime: match.submitted_at,
            endTime: match.submitted_at,
            duration: ''
          };
        }

        const round = roundsMap[roundKey];
        round.matches.push(match);
        
        // Update scores
        if (match.winner_name === match.player1_name) {
          round.player1Score += match.points_awarded || 0;
        } else if (match.winner_name === match.player2_name) {
          round.player2Score += match.points_awarded || 0;
        }

        // Update timing
        if (new Date(match.submitted_at) < new Date(round.startTime)) {
          round.startTime = match.submitted_at;
        }
        if (new Date(match.submitted_at) > new Date(round.endTime)) {
          round.endTime = match.submitted_at;
        }
      });

      // Finalize round results
      Object.values(roundsMap).forEach(round => {
        round.winner = round.player1Score > round.player2Score ? round.player1 : 
                      round.player2Score > round.player1Score ? round.player2 : 'Draw';
        
        const startTime = new Date(round.startTime);
        const endTime = new Date(round.endTime);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.floor(durationMs / 60000);
        round.duration = `${durationMinutes}m`;
      });

      const sortedRounds = Object.values(roundsMap).sort((a, b) => 
        new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
      );

      setRoundResults(sortedRounds);
    } catch (error) {
      console.error('Error fetching round results:', error);
    }
  };

  const fetchPlayerPairings = async () => {
    try {
      const { data: matches, error } = await supabase
        .from('match_results')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (error) throw error;

      // Group by player pairings
      const pairingsMap: { [key: string]: PlayerPairing } = {};

      (matches || []).forEach((match: MatchResult) => {
        const players = [match.player1_name, match.player2_name].sort();
        const pairingKey = `${players[0]}_vs_${players[1]}`;
        
        if (!pairingsMap[pairingKey]) {
          pairingsMap[pairingKey] = {
            player1: players[0],
            player2: players[1],
            totalMatches: 0,
            player1Wins: 0,
            player2Wins: 0,
            player1Score: 0,
            player2Score: 0,
            lastPlayed: match.submitted_at,
            rounds: []
          };
        }

        const pairing = pairingsMap[pairingKey];
        pairing.totalMatches++;
        
        if (match.winner_name === players[0]) {
          pairing.player1Wins++;
          pairing.player1Score += match.points_awarded || 0;
        } else if (match.winner_name === players[1]) {
          pairing.player2Wins++;
          pairing.player2Score += match.points_awarded || 0;
        }

        if (new Date(match.submitted_at) > new Date(pairing.lastPlayed)) {
          pairing.lastPlayed = match.submitted_at;
        }
      });

      // Add round results to pairings
      Object.values(pairingsMap).forEach(pairing => {
        pairing.rounds = roundResults.filter(round => 
          (round.player1 === pairing.player1 && round.player2 === pairing.player2) ||
          (round.player1 === pairing.player2 && round.player2 === pairing.player1)
        );
      });

      const sortedPairings = Object.values(pairingsMap).sort((a, b) => 
        new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime()
      );

      setPlayerPairings(sortedPairings);
    } catch (error) {
      console.error('Error fetching player pairings:', error);
    }
  };

  const fetchStadiums = async () => {
    try {
      const { data, error } = await supabase
        .from('tournament_stadiums')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('stadium_number');

      if (error) throw error;
      setStadiums(data || []);
      
      // Extract available officers from stadiums
      const officers = (data || [])
        .map(stadium => stadium.assigned_officer)
        .filter(Boolean)
        .filter((officer, index, arr) => arr.indexOf(officer) === index); // Remove duplicates
      
      setAvailableOfficers(officers);
    } catch (error) {
      console.error('Error fetching stadiums:', error);
    }
  };

  const updateStadiumCount = async (count: number) => {
    if (count < 1 || count > 20) return;
  
    try {
      // Get existing stadiums before reset
      const existing = [...stadiums];
  
      // Delete old stadiums
      await supabase
        .from('tournament_stadiums')
        .delete()
        .eq('tournament_id', tournamentId);
  
      // Build new stadiums array
      const stadiumsToCreate = Array.from({ length: count }, (_, index) => {
        const prev = existing.find(s => s.stadium_number === index + 1);
        return {
          tournament_id: tournamentId,
          stadium_number: index + 1,
          stadium_name: `Stadium ${index + 1}`,
          assigned_officer: prev?.assigned_officer || null,  // keep TO if existed
          match_status: 'waiting'
        };
      });
  
      const { error } = await supabase
        .from('tournament_stadiums')
        .insert(stadiumsToCreate);
  
      if (error) throw error;
      await fetchStadiums();
    } catch (error) {
      console.error('Error updating stadium count:', error);
    }
  };

  const addOfficer = async () => {
    if (!newOfficerName.trim() || availableOfficers.includes(newOfficerName.trim())) {
      return;
    }

    setAvailableOfficers([...availableOfficers, newOfficerName.trim()]);
    setNewOfficerName('');
  };

  const removeOfficer = (officerToRemove: string) => {
    setAvailableOfficers(availableOfficers.filter(officer => officer !== officerToRemove));
    
    // Remove officer from any stadium assignments
    setStadiums(stadiums.map(stadium => 
      stadium.assigned_officer === officerToRemove 
        ? { ...stadium, assigned_officer: null }
        : stadium
    ));
  };

  const randomizeOfficers = async () => {
    if (availableOfficers.length === 0 || stadiums.length === 0) return;

    try {
      const shuffledOfficers = [...availableOfficers].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < stadiums.length; i++) {
        const stadium = stadiums[i];
        const assignedOfficer = shuffledOfficers[i % shuffledOfficers.length];
        
        const { error } = await supabase
          .from('tournament_stadiums')
          .update({ assigned_officer: assignedOfficer })
          .eq('id', stadium.id);

        if (error) throw error;
      }

      await fetchStadiums();
    } catch (error) {
      console.error('Error randomizing officers:', error);
    }
  };

  const getStadiumRoundResults = (assignedOfficer: string | null) => {
    if (!assignedOfficer) return [];
    
    return roundResults.filter(round => 
      round.tournamentOfficer === assignedOfficer
    );
  };

  const checkUnmatchedTOs = async () => {
    try {
      const { data: matches, error } = await supabase
        .from('match_results')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (error) throw error;

      const validOfficers = [
        ...new Set([
          ...stadiums.map(stadium => stadium.assigned_officer).filter(Boolean),
          ...availableOfficers
        ])
      ];
      
      const unmatched = (matches || []).filter(match => 
        match.tournament_officer &&
        !validOfficers.includes(match.tournament_officer)
      );

      setUnmatchedTOMatches(unmatched);
    } catch (error) {
      console.error('Error checking unmatched TOs:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchLiveMatches(),
      fetchRoundResults(),
      fetchPlayerPairings(),
      fetchStadiums(),
      checkUnmatchedTOs()
    ]);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading tournament logs...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity size={32} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Tournament Not Found</h2>
          <p className="text-slate-400 mb-6">The requested tournament could not be found.</p>
          <button
            onClick={onBack}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200"
          >
            Back to Tournament Manager
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Tournament Manager</span>
          </button>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-4">
              {/* <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                <Activity size={32} />
              </div> */}
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">{tournament.name} - Live Logs</h1>
                <div className="flex items-center space-x-4 text-slate-400">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    tournament.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    tournament.status === 'completed' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-cyan-500/20 text-cyan-400'
                  }`}>
                    {tournament.status.toUpperCase()}
                  </span>
                 <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                   tournament.tournament_type === 'practice' ? 'bg-gray-500/20 text-gray-400' :
                   tournament.tournament_type === 'casual' ? 'bg-blue-500/20 text-blue-400' :
                   'bg-yellow-500/20 text-yellow-400'
                 }`}>
                   {tournament.tournament_type.toUpperCase()}
                 </span>
                  <div className="flex items-center space-x-1">
                    <Calendar size={14} />
                    <span>{new Date(tournament.tournament_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MapPin size={14} />
                    <span>{tournament.location}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-cyan-600"
                />
                <span className="text-sm text-slate-300">Auto-refresh (10s)</span>
              </label>
              
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-slate-800 border border-slate-600 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-700 hover:text-white transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-4 sm:space-x-8 border-b border-slate-700 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'stadiums', label: 'Stadiums', icon: <Trophy size={16} /> },
            { id: 'live-feed', label: 'Live Match Feed', icon: <Activity size={16} /> },
            { id: 'round-results', label: 'Round Results', icon: <Target size={16} /> },
            { id: 'pairings', label: 'Player Pairings', icon: <Users size={16} /> }

          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id as any)}
              className={`relative pb-2 text-sm font-medium transition-colors group flex items-center whitespace-nowrap ${
                currentTab === tab.id ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-300'
              }`}
            >
              {tab.icon}
              <span className="ml-2 hidden sm:inline">{tab.label}</span>
              <span className="ml-2 sm:hidden">{tab.label.split(' ')[0]}</span>
              <span
                className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500
                ${currentTab === tab.id ? 'w-full' : 'w-0 group-hover:w-full'}`}
              />
            </button>
          ))}
        </div>

        {/* Tournament Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="group relative border border-slate-700 bg-slate-900/40 p-4 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-400">{liveMatches.length}</div>
              <div className="text-sm text-slate-400">Total Matches</div>
            </div>
          </div>
          
          <div className="group relative border border-slate-700 bg-slate-900/40 p-4 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">{roundResults.length}</div>
              <div className="text-sm text-slate-400">Completed Rounds</div>
            </div>
          </div>
          
          <div className="group relative border border-slate-700 bg-slate-900/40 p-4 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">{playerPairings.length}</div>
              <div className="text-sm text-slate-400">Player Pairings</div>
            </div>
          </div>
          
          <div className="group relative border border-slate-700 bg-slate-900/40 p-4 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400">{tournament.current_participants}</div>
              <div className="text-sm text-slate-400">Participants</div>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Live Match Feed */}
          {currentTab === 'live-feed' && (
            <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                           transition-all duration-300 hover:border-cyan-400/70 
                           hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <Activity size={24} className="mr-2 text-cyan-400" />
                  Live Match Feed
                </h2>
                <div className="flex items-center space-x-2 bg-green-500/20 border border-green-500/30 rounded-lg px-3 py-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-sm font-medium">LIVE</span>
                </div>
              </div>

              {liveMatches.length === 0 ? (
                <div className="text-center py-12">
                  <Activity size={48} className="mx-auto text-slate-400 mb-4" />
                  <p className="text-slate-400">No matches recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Round</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Player 1</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Beyblade 1</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Player 2</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Beyblade 2</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Winner</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Finish</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">TO</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                      {liveMatches.map((match) => (
                        <tr key={match.id} className="hover:bg-slate-800/50">
                          <td className="px-4 py-3 text-sm text-slate-300">
                            {new Date(match.submitted_at).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-white">R{match.round_number}</td>
                          <td className={`px-4 py-3 text-sm font-medium ${
                            match.winner_name === match.player1_name ? 'text-cyan-400' : 'text-white'
                          }`}>
                            {match.player1_name}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-slate-300 text-xs">
                            {match.player1_beyblade}
                          </td>
                          <td className={`px-4 py-3 text-sm font-medium ${
                            match.winner_name === match.player2_name ? 'text-cyan-400' : 'text-white'
                          }`}>
                            {match.player2_name}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-slate-300 text-xs">
                            {match.player2_beyblade}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-green-400">
                            {match.winner_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-300">
                            {match.outcome?.split(' (')[0] || 'Unknown'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400">
                            {match.tournament_officer}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Round Results */}
          {currentTab === 'round-results' && (
            <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                           transition-all duration-300 hover:border-cyan-400/70 
                           hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <Target size={24} className="mr-2 text-cyan-400" />
                Round Results ({roundResults.length})
              </h2>

              {roundResults.length === 0 ? (
                <div className="text-center py-12">
                  <Target size={48} className="mx-auto text-slate-400 mb-4" />
                  <p className="text-slate-400">No completed rounds yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {roundResults.map((round) => (
                    <div key={round.roundKey} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-white">
                            {round.player1} vs {round.player2}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm text-slate-400">
                            <span>Round {round.roundNumber}</span>
                            <span>TO: {round.tournamentOfficer}</span>
                            <span>Duration: {round.duration}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-white">
                            <span className={round.winner === round.player1 ? 'text-cyan-400' : 'text-slate-400'}>
                              {round.player1Score}
                            </span>
                            <span className="text-slate-400 mx-2">-</span>
                            <span className={round.winner === round.player2 ? 'text-cyan-400' : 'text-slate-400'}>
                              {round.player2Score}
                            </span>
                          </div>
                          <div className="text-sm text-green-400 font-medium">
                            Winner: {round.winner}
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-cyan-400 mb-2">
                          Match Breakdown ({round.matches.length} matches)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {round.matches.map((match, index) => (
                            <div key={match.id} className="text-xs bg-slate-800/50 rounded p-2">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400">M{index + 1}:</span>
                                <span className={`font-medium ${
                                  match.winner_name === match.player1_name ? 'text-cyan-400' :
                                  match.winner_name === match.player2_name ? 'text-purple-400' :
                                  'text-slate-400'
                                }`}>
                                  {match.outcome?.split(' (')[0] || 'Unknown'}
                                </span>
                              </div>
                              <div className="text-slate-300 mt-1">
                                {match.player1_beyblade} vs {match.player2_beyblade}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-slate-500 text-right">
                        {new Date(round.startTime).toLocaleTimeString()} - {new Date(round.endTime).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Player Pairings */}
          {currentTab === 'pairings' && (
            <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                           transition-all duration-300 hover:border-cyan-400/70 
                           hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <Users size={24} className="mr-2 text-cyan-400" />
                Player Pairings & Head-to-Head ({playerPairings.length})
              </h2>

              {playerPairings.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={48} className="mx-auto text-slate-400 mb-4" />
                  <p className="text-slate-400">No player pairings yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Matchup</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Rounds</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Matches</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Head-to-Head</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Score</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Last Played</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                      {playerPairings.map((pairing) => (
                        <tr key={`${pairing.player1}_vs_${pairing.player2}`} className="hover:bg-slate-800/50">
                          <td className="px-4 py-3 text-sm font-medium text-white">
                            {pairing.player1} vs {pairing.player2}
                          </td>
                          <td className="px-4 py-3 text-sm text-white text-center">
                            {pairing.rounds.length}
                          </td>
                          <td className="px-4 py-3 text-sm text-white text-center">
                            {pairing.totalMatches}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <span className="text-cyan-400 font-medium">{pairing.player1Wins}</span>
                              <span className="text-slate-400">-</span>
                              <span className="text-purple-400 font-medium">{pairing.player2Wins}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <span className="text-cyan-400">{pairing.player1Score}</span>
                              <span className="text-slate-400">-</span>
                              <span className="text-purple-400">{pairing.player2Score}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400">
                            {new Date(pairing.lastPlayed).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Stadiums Tab */}
          {currentTab === 'stadiums' && (
            <div className="space-y-6">
              {/* Stadium Management (Admin Only) */}
              {isAdmin && (
                <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                               transition-all duration-300 hover:border-cyan-400/70 
                               hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                  <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                   w-0 transition-all duration-500 group-hover:w-full" />
                  
                  <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                    {/* <Settings size={24} className="mr-2 text-cyan-400" /> */}
                    Stadium Management
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Stadium Count */}
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-3">Number of Stadiums</h3>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={stadiums.length}
                          onChange={(e) => updateStadiumCount(parseInt(e.target.value) || 1)}
                          className="flex-1 bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    </div>

                    {/* Add Officer */}
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-3">Add Tournament Officer</h3>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={newOfficerName}
                          onChange={(e) => setNewOfficerName(e.target.value)}
                          placeholder="Officer name"
                          className="flex-1 bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <button
                          onClick={addOfficer}
                          disabled={!newOfficerName.trim()}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-400 hover:to-purple-500 disabled:opacity-50 transition-all duration-200"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Randomize Officers */}
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-3">Assign Officers</h3>
                      <button
                        onClick={randomizeOfficers}
                        disabled={availableOfficers.length === 0 || stadiums.length === 0}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-400 hover:to-pink-500 disabled:opacity-50 transition-all duration-200 flex items-center justify-center space-x-2"
                      >
                        <Target size={16} />
                        <span>Randomize TOs</span>
                      </button>
                    </div>
                  </div>

                  {/* Current Officers List */}
                  {availableOfficers.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-cyan-400 mb-3">
                        Tournament Officers ({availableOfficers.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {availableOfficers.map((officer, index) => (
                          <div key={index} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg px-3 py-2 flex items-center space-x-2">
                            <span className="text-white text-sm">{officer}</span>
                            <button
                              onClick={() => removeOfficer(officer)}
                              className="text-red-400 hover:text-red-300 text-xs"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      {availableOfficers.length === 0 && (
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
                          <p className="text-orange-400 text-sm">
                            ⚠️ Please add Tournament Officers above. TOs need to submit their names for proper stadium assignment.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Stadium Grid with Round Results */}
              <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                
              <h2 className="text-xl font-bold text-white mb-6 flex items-center justify-between">
                <span className="flex items-center">
                  {/* <Trophy size={24} className="mr-2 text-cyan-400" /> */}
                  Stadium Round Results ({stadiums.length} Stadiums)
                </span>
              
                {/* Controls (top-right) */}
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    value={roundsInput}
                    onChange={(e) => setRoundsInput(e.target.value)}
                    className="w-16 bg-slate-900 border border-cyan-500/30 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <button
                    onClick={() => setRoundsToShow(Math.max(1, parseInt(roundsInput) || 1))}
                    className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-3 py-1 rounded-lg text-sm hover:from-cyan-400 hover:to-purple-500 transition-all duration-200"
                  >
                    Set Records Shown
                  </button>
              
                  {/* New total button */}
                  <button
                    onClick={() => setShowTotals(!showTotals)}
                    className={`${
                      showTotals
                        ? "bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500"
                        : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500"
                    } text-white px-3 py-1 rounded-lg text-sm transition-all duration-200`}
                  >
                    {showTotals ? "Hide Totals" : "Show Totals"}
                  </button>
                </div>
              </h2>


                {stadiums.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy size={48} className="mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-400">No stadiums configured yet</p>
                    {isAdmin && (
                      <p className="text-sm text-cyan-400 mt-2">Set the number of stadiums and add officers above to get started</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stadiums.map((stadium) => (
                      <div key={stadium.id} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-white">
                              Stadium {stadium.stadium_number}
                            </h3>
                            <p className="text-sm text-cyan-400">{stadium.stadium_name}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-slate-400">TO:</div>
                            <div className="text-sm text-white">{stadium.assigned_officer || 'Not assigned'}</div>
                          </div>
                        </div>

                        {/* Round Results for this Stadium */}
                        <div className="space-y-3">
                          {getStadiumRoundResults(stadium.assigned_officer).length === 0 ? (
                            <div className="text-center py-8">
                              <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Clock size={24} className="text-slate-400" />
                              </div>
                              <p className="text-slate-400 text-sm">No rounds completed</p>
                            </div>
                          ) : (
                          getStadiumRoundResults(stadium.assigned_officer)
                            .slice(0, roundsToShow)
                            .map((round) => (
                              <div key={round.roundKey} className="bg-slate-900/50 rounded-lg p-3">
                                <div className="flex justify-between items-center mb-2">
                                  <div className="text-sm text-white font-medium">
                                    R{round.roundNumber}: {round.player1} vs {round.player2}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    {round.duration}
                                  </div>
                                </div>

                                <div className="flex items-center justify-center space-x-4">
                                  <div className="text-center">
                                    <div className={`text-lg font-bold ${
                                      round.winner === round.player1 ? 'text-cyan-400' : 'text-slate-400'
                                    }`}>
                                      {round.player1Score}
                                    </div>
                                    <div className="text-xs text-slate-400">{round.player1}</div>
                                  </div>

                                  <div className="text-slate-400">-</div>

                                  <div className="text-center">
                                    <div className={`text-lg font-bold ${
                                      round.winner === round.player2 ? 'text-cyan-400' : 'text-slate-400'
                                    }`}>
                                      {round.player2Score}
                                    </div>
                                    <div className="text-xs text-slate-400">{round.player2}</div>
                                  </div>
                                </div>

                                <div className="text-center mt-2 pt-2 border-t border-slate-700">
                                  <div className="text-xs text-green-400 font-medium">
                                    Winner: {round.winner}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {new Date(round.endTime).toLocaleTimeString()}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}

                        {showTotals && stadiumTotals[stadium.id] && (
                          <div className="mt-4 border-t border-slate-700 pt-2 text-center">
                            <div className="text-sm font-semibold text-cyan-400">
                              Total Scores (Shown Rounds)
                            </div>
                            <div className="text-lg font-bold text-white">
                              <span className="text-cyan-400">{stadiumTotals[stadium.id].p1}</span>
                              <span className="text-slate-400 mx-2">-</span>
                              <span className="text-purple-400">{stadiumTotals[stadium.id].p2}</span>
                            </div>
                          </div>
                        )}
                          
                          {getStadiumRoundResults(stadium.assigned_officer).length > 3 && (
                            <div className="text-center">
                              <button
                                onClick={() => setCurrentTab('round-results')}
                                className="text-cyan-400 hover:text-cyan-300 text-sm underline"
                              >
                                View all {getStadiumRoundResults(stadium.assigned_officer).length} rounds
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unmatched TO Notifications */}
              {unmatchedTOMatches.length > 0 && (
                <div className="group relative border border-red-700 bg-red-900/40 p-6 rounded-none 
                               transition-all duration-300 hover:border-red-400/70 
                               hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                  <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-red-400 to-orange-400 
                                   w-0 transition-all duration-500 group-hover:w-full" />
                  
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                    {/* <AlertCircle size={24} className="mr-2 text-red-400" /> */}
                    Unmatched Tournament Officers ({unmatchedTOMatches.length})
                  </h2>
                  
                  <p className="text-red-300 mb-4">
                    The following matches were submitted by TOs who are not assigned to any stadium:
                  </p>

                  <div className="space-y-2">
                    {unmatchedTOMatches.map((match) => (
                      <div key={match.id} className="bg-red-800/50 border border-red-500/20 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-sm text-white font-medium">
                              {match.player1_name} vs {match.player2_name}
                            </div>
                            <div className="text-xs text-red-300">
                              Round {match.round_number} • {new Date(match.submitted_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-red-400 font-medium">
                              TO: {match.tournament_officer}
                            </div>
                            <div className="text-xs text-red-300">
                              Not assigned to any stadium
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Status Indicator */}
        <div className="fixed bottom-6 right-6 z-40">
          <div className="bg-slate-900/90 backdrop-blur-sm border border-cyan-500/30 rounded-lg px-4 py-2 shadow-[0_0_20px_rgba(0,200,255,0.3)]">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}`}></div>
              <span className="text-sm text-white">
                {autoRefresh ? 'Live Updates' : 'Manual Refresh'}
              </span>
              {refreshing && (
                <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
