import React, { useState, useEffect } from 'react';
import { Target, Users, BarChart3, TrendingUp, Eye, Search, X, Zap } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface MatchInsightsTabProps {
  tournamentId: string;
  loading?: boolean;
}

interface MatchupData {
  players: string;
  totalMatches: number;
  player1Wins: number;
  player2Wins: number;
  avgPointGap: number;
  lastPlayed: string;
}

interface BeybladeMatchup {
  matchup: string;
  totalMatches: number;
  winnerCombo: string;
  winRate: number;
  avgPoints: number;
}

interface MatchAnalysis {
  mostOneSided: { players: string; pointGap: number; winner: string };
  closestMatch: { players: string; pointGap: number; winner: string };
  avgPointGap: number;
  totalRounds: number;
}

interface SideAnalysis {
  xSideWins: number;
  bSideWins: number;
  xSideWinRate: number;
  bSideWinRate: number;
  totalMatches: number;
}

interface ShowAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  columns: { key: string; label: string }[];
}

function ShowAllModal({ isOpen, onClose, title, data, columns }: ShowAllModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = data.filter(row => 
    columns.some(col => 
      String(row[col.key] || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-4 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {columns.map(col => (
                    <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {columns.map(col => (
                      <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {typeof row[col.key] === 'number' ? 
                          (col.key.includes('Rate') || col.key.includes('avg') || col.key.includes('Gap') ? 
                            row[col.key].toFixed(1) : row[col.key]) : 
                          String(row[col.key] || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MatchInsightsTab({ tournamentId, loading = false }: MatchInsightsTabProps) {
  const [playerMatchups, setPlayerMatchups] = useState<MatchupData[]>([]);
  const [beybladeMatchups, setBeybladeMatchups] = useState<BeybladeMatchup[]>([]);
  const [matchAnalysis, setMatchAnalysis] = useState<MatchAnalysis | null>(null);
  const [sideAnalysis, setSideAnalysis] = useState<SideAnalysis | null>(null);
  const [phaseAnalysis, setPhaseAnalysis] = useState<any[]>([]);
  const [pointsDistribution, setPointsDistribution] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllModal, setShowAllModal] = useState<{
    isOpen: boolean;
    title: string;
    data: any[];
    columns: { key: string; label: string }[];
  }>({
    isOpen: false,
    title: '',
    data: [],
    columns: []
  });

  useEffect(() => {
    if (tournamentId) {
      fetchMatchInsights();
    }
  }, [tournamentId]);

  const fetchMatchInsights = async () => {
    try {
      setIsLoading(true);

      // Fetch match sessions for round-level analysis
      const { data: sessions, error: sessionsError } = await supabase
        .from('match_sessions')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (sessionsError) throw sessionsError;
      const allSessions = sessions || [];

      // Fetch individual matches for detailed analysis
      const { data: matches, error: matchesError } = await supabase
        .from('match_results')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (matchesError) throw matchesError;
      const allMatches = matches || [];

      if (allSessions.length === 0 && allMatches.length === 0) {
        setIsLoading(false);
        return;
      }

      // Analyze player matchups from sessions
      const playerMatchupsMap: { [key: string]: any } = {};
      let mostOneSided = { players: '', pointGap: 0, winner: '' };
      let closestMatch = { players: '', pointGap: Infinity, winner: '' };
      let totalPointGap = 0;

      allSessions.forEach(session => {
        const { player1_name, player2_name, player1_final_score, player2_final_score, winner_name } = session;
        const players = [player1_name, player2_name].sort().join(' vs ');
        const pointGap = Math.abs((player1_final_score || 0) - (player2_final_score || 0));
        
        totalPointGap += pointGap;

        // Track most one-sided and closest matches
        if (pointGap > mostOneSided.pointGap) {
          mostOneSided = { players, pointGap, winner: winner_name || 'Unknown' };
        }
        if (pointGap < closestMatch.pointGap) {
          closestMatch = { players, pointGap, winner: winner_name || 'Unknown' };
        }

        // Track player matchups
        if (!playerMatchupsMap[players]) {
          playerMatchupsMap[players] = {
            players,
            totalMatches: 0,
            player1Wins: 0,
            player2Wins: 0,
            totalPointGap: 0,
            lastPlayed: session.created_at || ''
          };
        }

        const matchup = playerMatchupsMap[players];
        matchup.totalMatches++;
        matchup.totalPointGap += pointGap;
        
        if (winner_name === player1_name) {
          matchup.player1Wins++;
        } else if (winner_name === player2_name) {
          matchup.player2Wins++;
        }

        if (new Date(session.created_at || '') > new Date(matchup.lastPlayed)) {
          matchup.lastPlayed = session.created_at || '';
        }
      });

      // Finalize player matchups
      const playerMatchupsData = Object.values(playerMatchupsMap).map((matchup: any) => ({
        ...matchup,
        avgPointGap: matchup.totalMatches > 0 ? matchup.totalPointGap / matchup.totalMatches : 0
      }));

      setPlayerMatchups(playerMatchupsData.sort((a, b) => b.totalMatches - a.totalMatches));

      // Analyze beyblade matchups
      const beybladeMatchupsMap: { [key: string]: any } = {};
      
      allMatches.forEach(match => {
        const { player1_beyblade, player2_beyblade, winner_name, points_awarded } = match;
        if (!player1_beyblade || !player2_beyblade) return;
        
        const matchup = [player1_beyblade, player2_beyblade].sort().join(' vs ');
        
        if (!beybladeMatchupsMap[matchup]) {
          beybladeMatchupsMap[matchup] = {
            matchup,
            totalMatches: 0,
            wins: { [player1_beyblade]: 0, [player2_beyblade]: 0 },
            totalPoints: 0
          };
        }

        const beyMatchup = beybladeMatchupsMap[matchup];
        beyMatchup.totalMatches++;
        beyMatchup.totalPoints += points_awarded || 0;
        
        const winnerBeyblade = winner_name === match.player1_name ? player1_beyblade : player2_beyblade;
        if (beyMatchup.wins[winnerBeyblade] !== undefined) {
          beyMatchup.wins[winnerBeyblade]++;
        }
      });

      const beybladeMatchupsData = Object.values(beybladeMatchupsMap).map((matchup: any) => {
        const winCounts = Object.values(matchup.wins) as number[];
        const maxWins = Math.max(...winCounts);
        const winnerCombo = Object.entries(matchup.wins).find(([_, wins]) => wins === maxWins)?.[0] || 'Unknown';
        
        return {
          matchup: matchup.matchup,
          totalMatches: matchup.totalMatches,
          winnerCombo,
          winRate: matchup.totalMatches > 0 ? (maxWins / matchup.totalMatches) * 100 : 0,
          avgPoints: matchup.totalMatches > 0 ? matchup.totalPoints / matchup.totalMatches : 0
        };
      });

      setBeybladeMatchups(beybladeMatchupsData.sort((a, b) => b.totalMatches - a.totalMatches));

      // Set match analysis
      setMatchAnalysis({
        mostOneSided,
        closestMatch,
        avgPointGap: allSessions.length > 0 ? totalPointGap / allSessions.length : 0,
        totalRounds: allSessions.length
      });

      // Analyze side performance (X vs B)
      let xSideWins = 0;
      let bSideWins = 0;
      let totalSideMatches = 0;

      allMatches.forEach(match => {
        if (match.x_side_player && match.b_side_player) {
          totalSideMatches++;
          if (match.winner_name === match.x_side_player) {
            xSideWins++;
          } else if (match.winner_name === match.b_side_player) {
            bSideWins++;
          }
        }
      });

      if (totalSideMatches > 0) {
        setSideAnalysis({
          xSideWins,
          bSideWins,
          xSideWinRate: (xSideWins / totalSideMatches) * 100,
          bSideWinRate: (bSideWins / totalSideMatches) * 100,
          totalMatches: totalSideMatches
        });
      }

      // Analyze phase performance
      const phaseCounts: { [key: string]: { matches: number; points: number } } = {};
      
      allMatches.forEach(match => {
        const phase = match.phase_number ? `Phase ${match.phase_number}` : 'Unknown Phase';
        if (!phaseCounts[phase]) {
          phaseCounts[phase] = { matches: 0, points: 0 };
        }
        phaseCounts[phase].matches++;
        phaseCounts[phase].points += match.points_awarded || 0;
      });

      const phaseData = Object.entries(phaseCounts).map(([phase, data]) => ({
        phase,
        matches: data.matches,
        avgPoints: data.matches > 0 ? data.points / data.matches : 0
      }));

      setPhaseAnalysis(phaseData);

      // Points per match distribution
      const pointsPerMatch: { [key: number]: number } = {};
      
      allSessions.forEach(session => {
        const totalPoints = (session.player1_final_score || 0) + (session.player2_final_score || 0);
        pointsPerMatch[totalPoints] = (pointsPerMatch[totalPoints] || 0) + 1;
      });

      const pointsDistData = Object.entries(pointsPerMatch)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([points, count]) => ({
          points: `${points} pts`,
          matches: count
        }));

      setPointsDistribution(pointsDistData);

    } catch (error) {
      console.error('Error fetching match insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const showAllPlayerMatchups = () => {
    setShowAllModal({
      isOpen: true,
      title: 'All Player Matchups',
      data: playerMatchups,
      columns: [
        { key: 'players', label: 'Matchup' },
        { key: 'totalMatches', label: 'Total Matches' },
        { key: 'player1Wins', label: 'Player 1 Wins' },
        { key: 'player2Wins', label: 'Player 2 Wins' },
        { key: 'avgPointGap', label: 'Avg Point Gap' },
        { key: 'lastPlayed', label: 'Last Played' }
      ]
    });
  };

  const showAllBeybladeMatchups = () => {
    setShowAllModal({
      isOpen: true,
      title: 'All Beyblade Matchups',
      data: beybladeMatchups,
      columns: [
        { key: 'matchup', label: 'Beyblade Matchup' },
        { key: 'totalMatches', label: 'Total Matches' },
        { key: 'winnerCombo', label: 'Dominant Combo' },
        { key: 'winRate', label: 'Win Rate (%)' },
        { key: 'avgPoints', label: 'Avg Points' }
      ]
    });
  };

  if (loading || isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-400">Loading match insights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Match Analysis Summary */}
      {matchAnalysis && (
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <h2 className="text-xl font-bold text-white mb-6 flex items-center">
            <BarChart3 size={24} className="mr-2 text-cyan-400" />
            Match Analysis Summary
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-red-500/10 border border-red-500/20 rounded-none">
              <div className="text-2xl font-bold text-red-400">{matchAnalysis.mostOneSided.pointGap}</div>
              <div className="text-sm text-slate-400">Most One-Sided</div>
              <div className="text-xs text-slate-500 mt-1">{matchAnalysis.mostOneSided.players}</div>
            </div>
            
            <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-none">
              <div className="text-2xl font-bold text-green-400">{matchAnalysis.closestMatch.pointGap}</div>
              <div className="text-sm text-slate-400">Closest Match</div>
              <div className="text-xs text-slate-500 mt-1">{matchAnalysis.closestMatch.players}</div>
            </div>
            
            <div className="text-center p-4 bg-purple-500/10 border border-purple-500/20 rounded-none">
              <div className="text-2xl font-bold text-purple-400">{matchAnalysis.avgPointGap.toFixed(1)}</div>
              <div className="text-sm text-slate-400">Avg Point Gap</div>
            </div>
            
            <div className="text-center p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-none">
              <div className="text-2xl font-bold text-cyan-400">{matchAnalysis.totalRounds}</div>
              <div className="text-sm text-slate-400">Total Rounds</div>
            </div>
          </div>
        </div>
      )}

      {/* Side Analysis */}
      {sideAnalysis && (
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <h2 className="text-xl font-bold text-white mb-6 flex items-center">
            <Target size={24} className="mr-2 text-cyan-400" />
            Side Analysis (X vs B)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-red-500/10 border border-red-500/20 rounded-none">
              <div className="text-4xl font-bold text-red-400">{sideAnalysis.xSideWins}</div>
              <div className="text-sm text-slate-400">X-Side Wins</div>
              <div className="text-lg font-bold text-red-300 mt-2">{sideAnalysis.xSideWinRate.toFixed(1)}%</div>
            </div>
            
            <div className="text-center p-6 bg-blue-500/10 border border-blue-500/20 rounded-none">
              <div className="text-4xl font-bold text-blue-400">{sideAnalysis.bSideWins}</div>
              <div className="text-sm text-slate-400">B-Side Wins</div>
              <div className="text-lg font-bold text-blue-300 mt-2">{sideAnalysis.bSideWinRate.toFixed(1)}%</div>
            </div>
            
            <div className="text-center p-6 bg-slate-500/10 border border-slate-500/20 rounded-none">
              <div className="text-4xl font-bold text-slate-400">{sideAnalysis.totalMatches}</div>
              <div className="text-sm text-slate-400">Total Matches</div>
              <div className="text-sm text-slate-500 mt-2">with side data</div>
            </div>
          </div>
        </div>
      )}

      {/* Player Matchups */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Users size={24} className="mr-2 text-cyan-400" />
            Most Common Player Matchups
          </h2>
          <button
            onClick={showAllPlayerMatchups}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-4 py-2 rounded-none hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 flex items-center space-x-2 shadow-[0_0_15px_rgba(0,200,255,0.3)]"
          >
            <Eye size={16} />
            <span>Show All</span>
          </button>
        </div>

        {playerMatchups.length === 0 ? (
          <div className="text-center py-8">
            <Users size={48} className="mx-auto text-slate-400 mb-4" />
            <p className="text-slate-400">No player matchup data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">Matchup</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Matches</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Head-to-Head</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Avg Point Gap</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">Last Played</th>
                </tr>
              </thead>
              <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                {playerMatchups.slice(0, 10).map((matchup) => (
                  <tr key={matchup.players} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {matchup.players}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-white">
                      {matchup.totalMatches}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm">
                        <span className="text-cyan-400 font-medium">{matchup.player1Wins}</span>
                        <span className="text-slate-400 mx-1">-</span>
                        <span className="text-purple-400 font-medium">{matchup.player2Wins}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-white">
                      {matchup.avgPointGap.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {new Date(matchup.lastPlayed).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Beyblade Matchups */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Zap size={24} className="mr-2 text-cyan-400" />
            Most Common Beyblade Matchups
          </h2>
          <button
            onClick={showAllBeybladeMatchups}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-4 py-2 rounded-none hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 flex items-center space-x-2 shadow-[0_0_15px_rgba(0,200,255,0.3)]"
          >
            <Eye size={16} />
            <span>Show All</span>
          </button>
        </div>

        {beybladeMatchups.length === 0 ? (
          <div className="text-center py-8">
            <Zap size={48} className="mx-auto text-slate-400 mb-4" />
            <p className="text-slate-400">No beyblade matchup data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">Beyblade Matchup</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Matches</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">Dominant Combo</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Win Rate</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Avg Points</th>
                </tr>
              </thead>
              <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                {beybladeMatchups.slice(0, 10).map((matchup) => (
                  <tr key={matchup.matchup} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {matchup.matchup}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-white">
                      {matchup.totalMatches}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {matchup.winnerCombo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`font-medium ${
                        matchup.winRate >= 60 ? 'text-green-400' :
                        matchup.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {matchup.winRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-white">
                      {matchup.avgPoints.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Phase Performance */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <h3 className="text-lg font-bold text-white mb-4">Performance by Phase</h3>
          {phaseAnalysis.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-slate-400 text-sm">No phase data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={phaseAnalysis}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="phase" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid rgba(6, 182, 212, 0.3)', 
                    borderRadius: '8px' 
                  }}
                  labelStyle={{ color: '#06b6d4' }}
                />
                <Bar dataKey="matches" fill="#3B82F6" name="Matches" />
                <Bar dataKey="avgPoints" fill="#8B5CF6" name="Avg Points" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Points Distribution */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <h3 className="text-lg font-bold text-white mb-4">Points per Match Distribution</h3>
          {pointsDistribution.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-slate-400 text-sm">No points distribution data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pointsDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="points" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid rgba(6, 182, 212, 0.3)', 
                    borderRadius: '8px' 
                  }}
                  labelStyle={{ color: '#06b6d4' }}
                />
                <Bar dataKey="matches" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Show All Modal */}
      <ShowAllModal
        isOpen={showAllModal.isOpen}
        onClose={() => setShowAllModal(prev => ({ ...prev, isOpen: false }))}
        title={showAllModal.title}
        data={showAllModal.data}
        columns={showAllModal.columns}
      />
    </div>
  );
}