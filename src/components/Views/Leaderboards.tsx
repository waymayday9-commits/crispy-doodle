import React, { useState, useEffect } from 'react';
import { Crown, Trophy, Users, Target, RefreshCw, Medal, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Tournament {
  id: string;
  name: string;
  status: string;
  tournament_date: string;
}

interface LeaderboardEntry {
  rank: number;
  participant: string;
  matchWins: number;
  matchLosses: number;
  score: number;
  tb: number; // Tiebreaker score
  buchholz: number; // Buchholz score (opponent strength)
  ptsDiff: number; // Points differential
  totalMatches: number;
  winRate: number;
}

export function Leaderboards() {
  const [currentTab, setCurrentTab] = useState<'tournament' | 'global' | 'community'>('tournament');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament && currentTab === 'tournament') {
      fetchTournamentLeaderboard();
    } else if (currentTab === 'global') {
      fetchGlobalLeaderboard();
    }
  }, [selectedTournament, currentTab]);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, status, tournament_date')
        .order('tournament_date', { ascending: false });

      if (error) throw error;
      
      setTournaments(data || []);
      
      // Auto-select first tournament
      if (data && data.length > 0) {
        setSelectedTournament(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

const fetchTournamentLeaderboard = async () => {
  if (!selectedTournament) return;

  try {
    const { data: sessions, error } = await supabase
      .from('match_sessions')
      .select('*')
      .eq('tournament_id', selectedTournament);

    if (error) throw error;

    if (!sessions || sessions.length === 0) {
      setLeaderboard([]);
      return;
    }

    const playerStats: {
      [name: string]: {
        wins: number;
        losses: number;
        score: number;          // total wins
        pointsFor: number;      // total points scored
        pointsAgainst: number;  // total points conceded
        opponents: string[];
        winsAgainst: { [opponent: string]: number }; // track wins vs each opponent
      };
    } = {};

    sessions.forEach(session => {
      const { player1_name, player2_name, winner_name, player1_final_score, player2_final_score } = session;

      // Initialize players if missing
      if (!playerStats[player1_name]) {
        playerStats[player1_name] = { wins: 0, losses: 0, score: 0, pointsFor: 0, pointsAgainst: 0, opponents: [], winsAgainst: {} };
      }
      if (!playerStats[player2_name]) {
        playerStats[player2_name] = { wins: 0, losses: 0, score: 0, pointsFor: 0, pointsAgainst: 0, opponents: [], winsAgainst: {} };
      }

      // Assign wins/losses & session score (1 point per win)
      if (winner_name === player1_name) {
        playerStats[player1_name].wins++;
        playerStats[player1_name].score += 1;
        playerStats[player2_name].losses++;
        // track win against opponent
        playerStats[player1_name].winsAgainst[player2_name] = (playerStats[player1_name].winsAgainst[player2_name] || 0) + 1;
      } else if (winner_name === player2_name) {
        playerStats[player2_name].wins++;
        playerStats[player2_name].score += 1;
        playerStats[player1_name].losses++;
        // track win against opponent
        playerStats[player2_name].winsAgainst[player1_name] = (playerStats[player2_name].winsAgainst[player1_name] || 0) + 1;
      }

      // Track points scored and conceded
      playerStats[player1_name].pointsFor += player1_final_score || 0;
      playerStats[player1_name].pointsAgainst += player2_final_score || 0;

      playerStats[player2_name].pointsFor += player2_final_score || 0;
      playerStats[player2_name].pointsAgainst += player1_final_score || 0;

      // Track opponents
      if (!playerStats[player1_name].opponents.includes(player2_name)) {
        playerStats[player1_name].opponents.push(player2_name);
      }
      if (!playerStats[player2_name].opponents.includes(player1_name)) {
        playerStats[player2_name].opponents.push(player1_name);
      }
    });

    // Compute Median-Buchholz (drop highest and lowest opponent scores)
    Object.keys(playerStats).forEach(player => {
      const opponents = playerStats[player].opponents;
      const opponentScores: number[] = [];

      opponents.forEach(opponent => {
        if (playerStats[opponent]) {
          opponentScores.push(playerStats[opponent].score);
        }
      });

      if (opponentScores.length > 2) {
        opponentScores.sort((a, b) => a - b);
        opponentScores.shift(); // drop lowest
        opponentScores.pop();   // drop highest
      }

      const buchholzScore = opponentScores.reduce((sum, s) => sum + s, 0);
      (playerStats[player] as any).buchholz = buchholzScore;
    });

    // --- Compute TB (wins against tied opponents) ---
    const scoreGroups: { [score: number]: string[] } = {};
    Object.keys(playerStats).forEach(player => {
      const score = playerStats[player].score;
      if (!scoreGroups[score]) scoreGroups[score] = [];
      scoreGroups[score].push(player);
    });

    Object.values(scoreGroups).forEach(group => {
      if (group.length > 1) {
        group.forEach(player => {
          let tbWins = 0;
          group.forEach(opponent => {
            if (opponent !== player) {
              tbWins += playerStats[player].winsAgainst[opponent] || 0;
            }
          });
          (playerStats[player] as any).tb = tbWins;
        });
      } else {
        (playerStats[group[0]] as any).tb = 0; // no tie → TB = 0
      }
    });

    // Convert to leaderboard format
    const leaderboardData = Object.entries(playerStats).map(([name, stats]) => {
      const totalMatches = stats.wins + stats.losses;
      const winRate = totalMatches > 0 ? (stats.wins / totalMatches) * 100 : 0;
      const ptsDiff = stats.pointsFor - stats.pointsAgainst;
      const buchholz = (stats as any).buchholz || 0;
      const tb = (stats as any).tb || 0;

      return {
        participant: name,
        matchWins: stats.wins,
        matchLosses: stats.losses,
        score: stats.score,
        tb,
        buchholz,
        ptsDiff,
        totalMatches,
        winRate,
        rank: 0,
      };
    });

    // Sort & rank
    leaderboardData.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.tb !== a.tb) return b.tb - a.tb;
      if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
      if (b.ptsDiff !== a.ptsDiff) return b.ptsDiff - a.ptsDiff;
      return 0;
    });

    leaderboardData.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    setLeaderboard(leaderboardData);
  } catch (error) {
    console.error('Error fetching tournament leaderboard:', error);
    setLeaderboard([]);
  }
};

  const fetchGlobalLeaderboard = async () => {
    try {
      const { data: matches, error } = await supabase
        .from('match_results')
        .select(`
          *,
          tournaments!inner(is_practice)
        `);

      if (error) throw error;

      // Filter out practice tournament matches
      const filteredMatches = (matches || []).filter(match => 
        match.tournament_type !== 'practice'
      );

      if (filteredMatches.length === 0) {
        setLeaderboard([]);
        return;
      }

      // Similar processing as tournament leaderboard but across all tournaments
      const playerStats: { [name: string]: {
        wins: number;
        losses: number;
        totalPoints: number;
        pointsAgainst: number;
        tournaments: Set<string>;
      }} = {};

      filteredMatches.forEach(match => {
        const { player1_name, player2_name, winner_name, points_awarded, tournament_id } = match;
        
        // Initialize players
        if (!playerStats[player1_name]) {
          playerStats[player1_name] = {
            wins: 0, losses: 0, totalPoints: 0, pointsAgainst: 0,
            tournaments: new Set()
          };
        }
        if (!playerStats[player2_name]) {
          playerStats[player2_name] = {
            wins: 0, losses: 0, totalPoints: 0, pointsAgainst: 0,
            tournaments: new Set()
          };
        }

        // Track tournaments
        playerStats[player1_name].tournaments.add(tournament_id);
        playerStats[player2_name].tournaments.add(tournament_id);

        const points = points_awarded || 0;

        // Update stats
        if (winner_name === player1_name) {
          playerStats[player1_name].wins++;
          playerStats[player1_name].totalPoints += points;
          playerStats[player2_name].losses++;
          playerStats[player2_name].pointsAgainst += points;
        } else if (winner_name === player2_name) {
          playerStats[player2_name].wins++;
          playerStats[player2_name].totalPoints += points;
          playerStats[player1_name].losses++;
          playerStats[player1_name].pointsAgainst += points;
        }
      });

      // Convert to leaderboard format
      const globalLeaderboardData = Object.entries(playerStats).map(([name, stats]) => {
        const totalMatches = stats.wins + stats.losses;
        const winRate = totalMatches > 0 ? (stats.wins / totalMatches) * 100 : 0;
        const ptsDiff = stats.totalPoints - stats.pointsAgainst;
        
        return {
          participant: name,
          matchWins: stats.wins,
          matchLosses: stats.losses,
          score: stats.totalPoints,
          tb: stats.wins,
          buchholz: stats.tournaments.size, // Use tournament count as Buchholz for global
          ptsDiff,
          totalMatches,
          winRate,
          rank: 0
        };
      });

      // Sort and rank
      globalLeaderboardData.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.tb !== a.tb) return b.tb - a.tb;
        if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
        return b.ptsDiff - a.ptsDiff;
      });

      globalLeaderboardData.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      setLeaderboard(globalLeaderboardData);
    } catch (error) {
      console.error('Error fetching global leaderboard:', error);
      setLeaderboard([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (currentTab === 'tournament' && selectedTournament) {
      await fetchTournamentLeaderboard();
    } else if (currentTab === 'global') {
      await fetchGlobalLeaderboard();
    }
    setRefreshing(false);
  };

  const handleTabChange = (tab: 'tournament' | 'global' | 'community') => {
    setCurrentTab(tab);
    setLeaderboard([]);
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-600 font-bold';
      case 2: return 'text-gray-500 font-bold';
      case 3: return 'text-orange-600 font-bold';
      default: return 'text-gray-900';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown size={20} className="text-yellow-500" />;
      case 2: return <Medal size={20} className="text-gray-400" />;
      case 3: return <Medal size={20} className="text-orange-500" />;
      default: return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-600">#{rank}</span>;
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="content-wrapper">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading leaderboards...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-4xl font-bold flex items-center mb-4">
                <Crown size={40} className="mr-4 text-cyan-400" />
                <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Leaderboards
                </span>
              </h1>
              <p className="text-slate-400 text-lg">Tournament rankings and player standings</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-4 py-2 rounded-none hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 flex items-center space-x-2 disabled:opacity-50 shadow-[0_0_15px_rgba(0,200,255,0.3)]"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

{/* Tabs + Tournament Selection (compact header) */}
<div className="bg-slate-900/50 border border-cyan-500/30 rounded-none backdrop-blur-sm p-3 sm:p-4 mb-8">
  <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center">
    {/* Tabs (left) */}
    <div className="flex items-center space-x-4 sm:space-x-8 border-b border-slate-700 pb-2 overflow-x-auto">
      <button
        onClick={() => handleTabChange('tournament')}
        className={`relative pb-2 text-sm font-medium transition-colors group flex items-center whitespace-nowrap ${
          currentTab === 'tournament' ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-300'
        }`}
      >
        <Trophy size={16} className="mr-1" /> 
        <span className="hidden sm:inline">Tournament</span>
        <span className="sm:hidden">Tourn</span>
        <span
          className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500
          ${currentTab === 'tournament' ? 'w-full' : 'w-0 group-hover:w-full'}`}
        />
      </button>
      <button
        onClick={() => handleTabChange('global')}
        className={`relative pb-2 text-sm font-medium transition-colors group flex items-center whitespace-nowrap ${
          currentTab === 'global' ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-300'
        }`}
      >
        <Target size={16} className="mr-1" /> 
        <span className="hidden sm:inline">Global</span>
        <span className="sm:hidden">Global</span>
        <span
          className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500
          ${currentTab === 'global' ? 'w-full' : 'w-0 group-hover:w-full'}`}
        />
      </button>
      <button
        onClick={() => handleTabChange('community')}
        className={`relative pb-2 text-sm font-medium transition-colors group flex items-center whitespace-nowrap ${
          currentTab === 'community' ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-300'
        }`}
      >
        <Users size={16} className="mr-1" /> 
        <span className="hidden sm:inline">Community</span>
        <span className="sm:hidden">Comm</span>
        <span
          className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500
          ${currentTab === 'community' ? 'w-full' : 'w-0 group-hover:w-full'}`}
        />
      </button>
    </div>

    {/* Tournament dropdown (right) */}
    {currentTab === 'tournament' && (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full justify-end md:ml-auto mt-3 sm:mt-4 md:mt-0">
        <label className="text-sm text-slate-400 whitespace-nowrap">Tournament:</label>
        <select
          value={selectedTournament}
          onChange={(e) => setSelectedTournament(e.target.value)}
          className="bg-slate-900 border border-cyan-500/30 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 w-full sm:w-auto min-w-0"
        >
          <option value="">-- Select --</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              <span className="hidden sm:inline">{t.name} ({t.status}) - {new Date(t.tournament_date).toLocaleDateString()}</span>
              <span className="sm:hidden">{t.name}</span>
            </option>
          ))}
        </select>
      </div>
    )}
  </div>
</div>


        {/* Community Coming Soon */}
        {currentTab === 'community' && (
          <div className="max-w-4xl mx-auto">
            <div className="group relative border border-slate-700 bg-slate-900/40 p-12 rounded-none transition-all duration-300 hover:border-cyan-400/70 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] text-center">
              {/* Animated bottom underline */}
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 w-0 transition-all duration-500 group-hover:w-full" />
              
              <div className="w-24 h-24 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(0,200,255,0.5)]">
                <Users size={48} className="text-white" />
              </div>
              
              <h2 className="text-4xl font-bold text-cyan-400 mb-4">Community Leaderboards</h2>
              <div className="inline-block bg-gradient-to-r from-cyan-600 to-purple-600 text-white px-6 py-2 rounded-none font-bold text-lg mb-6 shadow-[0_0_20px_rgba(0,200,255,0.3)]">
                COMING SOON
              </div>
              
              <p className="text-cyan-300 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
                Soon, every community will have their own leaderboards to track local champions and rising stars. 
                Compare performance within your community and see who's dominating the local meta.
              </p>

              <div className="bg-slate-800/40 backdrop-blur-sm border border-cyan-400/30 rounded-none p-6 max-w-md mx-auto">
                <h4 className="font-bold text-cyan-400 mb-3">Planned Features:</h4>
                <div className="space-y-2 text-sm text-cyan-300 text-left">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full mr-3"></span>
                    Community-specific rankings
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full mr-3"></span>
                    Local tournament leaderboards
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full mr-3"></span>
                    Community comparison tools
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        {(currentTab === 'tournament' || currentTab === 'global') && (
          <div className="bg-slate-900/50 border border-cyan-500/30 rounded-none backdrop-blur-sm overflow-hidden">
            <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <TrendingUp size={24} className="mr-2 text-cyan-400" />
                  {currentTab === 'tournament' 
                    ? `${tournaments.find(t => t.id === selectedTournament)?.name || 'Tournament'} Leaderboard`
                    : 'Global Leaderboard'
                  }
                </h2>
                <span className="text-sm text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full">
                  {leaderboard.length} participants
                </span>
              </div>
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 size={32} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Data Available</h3>
                <p className="text-slate-400">
                  {currentTab === 'tournament' && !selectedTournament
                    ? 'Please select a tournament to view its leaderboard'
                    : 'No match results found for leaderboard calculation'
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">
                        Participant
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">
                        Match W-L
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">
                        TB
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">
                        Buchholz
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">
                        Pts Diff
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                    {leaderboard.map((entry) => (
                      <tr key={entry.participant} className="hover:bg-slate-800/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            {getRankIcon(entry.rank)}
                            <span className={`font-bold ${getRankColor(entry.rank)}`}>
                              {entry.rank <= 3 ? '' : `#${entry.rank}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                              {entry.participant.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-white">{entry.participant}</div>
                              <div className="text-sm text-slate-400">
                                {entry.winRate.toFixed(1)}% win rate
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm">
                            <span className="text-green-600 font-medium">{entry.matchWins}</span>
                            <span className="text-slate-400 mx-1">-</span>
                            <span className="text-red-600 font-medium">{entry.matchLosses}</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {entry.totalMatches} total
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-lg font-bold text-cyan-400">{entry.score}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-white">{entry.tb}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-white">{entry.buchholz}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className={`text-sm font-medium ${
                            entry.ptsDiff > 0 ? 'text-green-600' :
                            entry.ptsDiff < 0 ? 'text-red-600' : 'text-slate-400'
                          }`}>
                            {entry.ptsDiff > 0 ? '+' : ''}{entry.ptsDiff}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}