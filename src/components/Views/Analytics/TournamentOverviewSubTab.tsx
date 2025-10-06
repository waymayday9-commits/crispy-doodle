import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Target, BarChart3, Award, Users, Star } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { supabase } from '../../../lib/supabase';
import { parseBeybladeName, type AllPartsData, type ParsedBeyblade } from '../../../utils/beybladeParser';

interface TournamentOverviewSubTabProps {
  tournamentId: string;
  loading?: boolean;
}

interface ComboStats {
  combo: string;
  player: string;
  wins: number;
  losses: number;
  totalMatches: number;
  winRate: number;
  weightedWinRate: number;
  totalPoints: number;
  avgPointsPerMatch: number;
  comboScore: number;
  finishDistribution: { [finish: string]: number };
  bladeLine: string;
  allMatches: any[];
}

interface PlayerAward {
  id: string;
  player_name: string;
  award_name: string;
  icon_type: string;
  icon_url?: string;
  icon_data?: any;
  awarded_at: string;
  isChampion: boolean;
}

const FINISH_COLORS = {
  'Spin Finish': '#10B981',
  'Burst Finish': '#F59E0B',
  'Over Finish': '#EF4444',
  'Extreme Finish': '#8B5CF6'
};

export function TournamentOverviewSubTab({ tournamentId, loading = false }: TournamentOverviewSubTabProps) {
  const [partsData, setPartsData] = useState<AllPartsData>({
    blades: [],
    ratchets: [],
    bits: [],
    lockchips: [],
    assistBlades: []
  });
  
  const [comboStats, setComboStats] = useState<ComboStats[]>([]);
  const [playerRankings, setPlayerRankings] = useState<any[]>([]);
  const [playerAwards, setPlayerAwards] = useState<PlayerAward[]>([]);
  const [finishDistribution, setFinishDistribution] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tournamentId) {
      fetchPartsData();
    }
  }, [tournamentId]);

  useEffect(() => {
    if (tournamentId && partsData.blades.length > 0) {
      fetchOverviewData();
    }
  }, [tournamentId, partsData]);

  const fetchPartsData = async () => {
    try {
      const [bladesRes, ratchetsRes, bitsRes, lockchipsRes, assistBladesRes] = await Promise.all([
        supabase.from('beypart_blade').select('*'),
        supabase.from('beypart_ratchet').select('*'),
        supabase.from('beypart_bit').select('*'),
        supabase.from('beypart_lockchip').select('*'),
        supabase.from('beypart_assistblade').select('*')
      ]);

      setPartsData({
        blades: bladesRes.data || [],
        ratchets: ratchetsRes.data || [],
        bits: bitsRes.data || [],
        lockchips: lockchipsRes.data || [],
        assistBlades: assistBladesRes.data || []
      });
    } catch (error) {
      console.error('Error fetching parts data:', error);
    }
  };

  const fetchOverviewData = async () => {
    try {
      // Fetch awards
      const { data: awards, error: awardsError } = await supabase
        .from('tournament_awards')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('awarded_at', { ascending: false });

      if (awardsError) throw awardsError;

      // Process awards and identify champion
      const processedAwards = (awards || []).map(award => ({
        ...award,
        isChampion: award.award_name.toLowerCase().includes('champion') || 
                   award.award_name.toLowerCase().includes('winner') ||
                   award.award_name.toLowerCase().includes('1st')
      }));

      setPlayerAwards(processedAwards);

      // Fetch matches for combo analysis and player rankings
      const { data: matches, error: matchesError } = await supabase
        .from('match_results')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (matchesError) throw matchesError;

      if (!matches || matches.length === 0) {
        setIsLoading(false);
        return;
      }

      // Process combo stats
      const comboStatsMap: { [key: string]: ComboStats } = {};
      const playerStatsMap: { [key: string]: any } = {};

      matches.forEach((match: any) => {
        if (!match.winner_name || !match.player1_name || !match.player2_name) return;
        
        const outcome = match.outcome?.split(' (')[0] || 'Unknown';
        const points = match.points_awarded || 0;

        // Process both players
        [
          { name: match.player1_name, beyblade: match.player1_beyblade, bladeLine: match.player1_blade_line, isWinner: match.winner_name === match.player1_name },
          { name: match.player2_name, beyblade: match.player2_beyblade, bladeLine: match.player2_blade_line, isWinner: match.winner_name === match.player2_name }
        ].forEach(({ name, beyblade, bladeLine, isWinner }) => {
          // Combo stats
          const comboKey = `${beyblade}_${name}`;
          
          if (!comboStatsMap[comboKey]) {
            comboStatsMap[comboKey] = {
              combo: beyblade,
              player: name,
              wins: 0,
              losses: 0,
              totalMatches: 0,
              winRate: 0,
              weightedWinRate: 0,
              totalPoints: 0,
              avgPointsPerMatch: 0,
              comboScore: 0,
              finishDistribution: {},
              bladeLine: bladeLine || 'Unknown',
              allMatches: []
            };
          }

          const combo = comboStatsMap[comboKey];
          combo.totalMatches++;
          combo.finishDistribution[outcome] = (combo.finishDistribution[outcome] || 0) + 1;
          combo.allMatches.push(match);

          if (isWinner) {
            combo.wins++;
            combo.totalPoints += points;
          } else {
            combo.losses++;
          }

          // Player stats
          if (!playerStatsMap[name]) {
            playerStatsMap[name] = {
              name,
              matches: 0,
              wins: 0,
              losses: 0,
              totalPoints: 0,
              winRate: 0
            };
          }

          const player = playerStatsMap[name];
          player.matches++;
          if (isWinner) {
            player.wins++;
            player.totalPoints += points;
          } else {
            player.losses++;
          }
        });
      });

      // Calculate final combo stats
      const comboStatsArray = Object.values(comboStatsMap).map(combo => {
        combo.winRate = combo.totalMatches > 0 ? (combo.wins / combo.totalMatches) * 100 : 0;
        combo.weightedWinRate = combo.totalMatches > 0 ? (combo.wins / combo.totalMatches) * (combo.totalMatches / (combo.totalMatches + 10)) : 0;
        combo.avgPointsPerMatch = combo.totalMatches > 0 ? combo.totalPoints / combo.totalMatches : 0;
        combo.comboScore = combo.weightedWinRate * (combo.avgPointsPerMatch / 3) * 100;
        return combo;
      });

      setComboStats(comboStatsArray.sort((a, b) => b.comboScore - a.comboScore));

      // Calculate player rankings
      const playerRankingsArray = Object.values(playerStatsMap).map((player: any) => {
        player.winRate = player.matches > 0 ? (player.wins / player.matches) * 100 : 0;
        return player;
      }).sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.winRate - a.winRate;
      }).map((player, index) => ({ ...player, rank: index + 1 }));

      setPlayerRankings(playerRankingsArray);

      // Calculate finish distribution
      const finishCounts = matches.reduce((acc: any, match: any) => {
        const outcome = match.outcome?.split(' (')[0] || 'Unknown';
        acc[outcome] = (acc[outcome] || 0) + 1;
        return acc;
      }, {});

      const finishData = Object.entries(finishCounts).map(([finish, count]) => ({
        name: finish,
        value: count,
        color: FINISH_COLORS[finish as keyof typeof FINISH_COLORS] || '#6B7280'
      }));

      setFinishDistribution(finishData);

    } catch (error) {
      console.error('Error fetching overview data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderAwardIcon = (award: PlayerAward, size: number = 20) => {
    if (award.icon_type === 'predefined' && award.icon_data) {
      const iconName = award.icon_data.name;
      const iconColor = award.icon_data.color || 'text-yellow-500';
      
      const IconComponent = {
        Trophy,
        Crown,
        Award,
        Star,
        Target
      }[iconName] || Trophy;
      
      return <IconComponent size={size} className={iconColor} />;
    } else if (award.icon_type === 'upload' && award.icon_url) {
      return (
        <img
          src={award.icon_url}
          alt={award.award_name}
          className="object-cover rounded"
          style={{ width: size, height: size }}
        />
      );
    }
    
    return <Trophy size={size} className="text-yellow-500" />;
  };

  if (loading || isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
        <p className="text-slate-400">Loading tournament overview...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tournament Awards */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Award size={24} className="mr-2 text-yellow-400" />
          Tournament Awards & Champions
        </h3>

        {playerAwards.length === 0 ? (
          <div className="text-center py-8">
            <Award size={48} className="mx-auto text-slate-400 mb-4" />
            <p className="text-slate-400">No awards have been given yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playerAwards.map((award) => (
              <div 
                key={award.id} 
                className={`p-4 rounded-lg border transition-all duration-300 ${
                  award.isChampion 
                    ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/50 shadow-[0_0_20px_rgba(251,191,36,0.3)]' 
                    : 'bg-slate-800/50 border-cyan-500/20'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    award.isChampion 
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-600 shadow-[0_0_15px_rgba(251,191,36,0.4)]' 
                      : 'bg-gradient-to-r from-cyan-500 to-purple-600'
                  }`}>
                    {renderAwardIcon(award, 24)}
                  </div>
                  <div>
                    <h4 className={`font-bold ${award.isChampion ? 'text-yellow-400' : 'text-white'}`}>
                      {award.player_name}
                    </h4>
                    <p className={`text-sm ${award.isChampion ? 'text-yellow-300' : 'text-slate-400'}`}>
                      {award.award_name}
                    </p>
                    {award.isChampion && (
                      <div className="flex items-center space-x-1 mt-1">
                        <Crown size={12} className="text-yellow-400" />
                        <span className="text-xs text-yellow-400 font-medium">GRAND CHAMPION</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tournament Player Rankings */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Users size={24} className="mr-2 text-cyan-400" />
          Tournament Player Rankings
        </h3>

        {playerRankings.length === 0 ? (
          <div className="text-center py-8">
            <Users size={48} className="mx-auto text-slate-400 mb-4" />
            <p className="text-slate-400">No player data available yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Player</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Matches</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-cyan-400 uppercase">W-L</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Points</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Win Rate</th>
                </tr>
              </thead>
              <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                {playerRankings.slice(0, 10).map((player) => (
                  <tr key={player.name} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-sm font-bold text-cyan-400">#{player.rank}</td>
                    <td className="px-4 py-3 text-sm font-medium text-white">
                      <div className="flex items-center space-x-2">
                        <span>{player.name}</span>
                        {playerAwards.some(award => award.player_name === player.name && award.isChampion) && (
                          <Crown size={16} className="text-yellow-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-white text-center">{player.matches}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className="text-green-400">{player.wins}</span>
                      <span className="text-slate-400 mx-1">-</span>
                      <span className="text-red-400">{player.losses}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-purple-400 text-center">{player.totalPoints}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className={`font-medium ${
                        player.winRate >= 60 ? 'text-green-400' :
                        player.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {player.winRate.toFixed(1)}%
                      </span>
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
        {/* Top Combos Chart */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Target size={24} className="mr-2 text-blue-600" />
            Top Combos by Score
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comboStats.slice(0, 10).map(combo => ({
              name: combo.combo,
              score: combo.comboScore,
              winRate: combo.winRate,
              matches: combo.totalMatches
            }))} margin={{ bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                fontSize={9}
                stroke="#94a3b8"
              />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid rgba(6, 182, 212, 0.3)', 
                  borderRadius: '8px' 
                }}
                labelStyle={{ color: '#06b6d4' }}
                formatter={(value, name) => [
                  typeof value === 'number' ? value.toFixed(2) : value,
                  name === 'score' ? 'Combo Score' : name === 'winRate' ? 'Win Rate (%)' : 'Matches'
                ]}
              />
              <Bar dataKey="score" fill="#3B82F6" name="Combo Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Finish Distribution */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          <h3 className="text-lg font-bold text-white mb-4">Finish Type Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={finishDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {finishDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid rgba(6, 182, 212, 0.3)', 
                  borderRadius: '8px' 
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}