import React, { useState, useEffect } from 'react';
import { Crown, Trophy, Target, Medal, Star, Eye, ChevronDown, Swords } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface LeaderboardsTabProps {
  tournamentId: string;
  loading?: boolean;
}

interface PlayerRanking {
  rank: number;
  player_name: string;
  total_matches: number;
  wins: number;
  losses: number;
  total_points: number;
  win_rate: number;
  avg_points_per_match: number;
  longest_win_streak: number;
  current_streak: number;
  weighted_win_rate: number;
  finish_points: {
    spin: number;
    over: number;
    burst: number;
    extreme: number;
  };
  x_side_points: number;
  b_side_points: number;
  x_side_matches: number;
  b_side_matches: number;
  x_side_wins: number;
  b_side_wins: number;
  weighted_x_side_win_rate: number;
  weighted_b_side_win_rate: number;
}

interface ComboRanking {
  combo: string;
  player: string;
  matches: number;
  wins: number;
  win_rate: number;
  total_points: number;
  avg_points: number;
  combo_score: number;
}

export function LeaderboardsTab({ tournamentId, loading = false }: LeaderboardsTabProps) {
  const [playerRankings, setPlayerRankings] = useState<PlayerRanking[]>([]);
  const [comboRankings, setComboRankings] = useState<ComboRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'weighted' | 'wins' | 'points' | 'streak'>('weighted');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (tournamentId) {
      fetchLeaderboards();
    }
  }, [tournamentId]);

  const fetchLeaderboards = async () => {
    try {
      setIsLoading(true);

      const { data: matches, error } = await supabase
        .from('match_results')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (error) throw error;
      const allMatches = matches || [];

      if (allMatches.length === 0) {
        setIsLoading(false);
        return;
      }

      const playersMap: { [name: string]: any } = {};
      const combosMap: { [key: string]: any } = {};

      allMatches.forEach(match => {
        const { player1_name, player2_name, winner_name, points_awarded, outcome, player1_beyblade, player2_beyblade, x_side_player, b_side_player } = match;

        [player1_name, player2_name].forEach(playerName => {
          if (!playersMap[playerName]) {
            playersMap[playerName] = {
              player_name: playerName,
              total_matches: 0,
              wins: 0,
              losses: 0,
              total_points: 0,
              longest_win_streak: 0,
              current_streak: 0,
              last_result: null,
              finish_points: { spin: 0, over: 0, burst: 0, extreme: 0 },
              x_side_points: 0,
              b_side_points: 0,
              x_side_matches: 0,
              b_side_matches: 0,
              x_side_wins: 0,
              b_side_wins: 0,
            };
          }
        });

        const points = points_awarded || 0;

        // Update stats
        [player1_name, player2_name].forEach(name => {
          const isWinner = name === winner_name;
          const player = playersMap[name];
          player.total_matches++;

          if (isWinner) {
            player.wins++;
            player.total_points += points;
            player.current_streak++;
            player.longest_win_streak = Math.max(player.longest_win_streak, player.current_streak);

            // Count finish types properly from outcome
            if (outcome) {
              const out = outcome.toLowerCase();
              if (out.includes('spin')) player.finish_points.spin += points;
              if (out.includes('over')) player.finish_points.over += points;
              if (out.includes('burst')) player.finish_points.burst += points;
              if (out.includes('extreme')) player.finish_points.extreme += points;
            }

            // Track X-side/B-side performance (winner)
            if (x_side_player && name === x_side_player) {
              player.x_side_points += points;
              player.x_side_matches++;
              player.x_side_wins++;
            }
            if (b_side_player && name === b_side_player) {
              player.b_side_points += points;
              player.b_side_matches++;
              player.b_side_wins++;
            }
          } else {
            player.losses++;
            player.current_streak = 0;

            // losers still count as matches per side
            if (x_side_player && name === x_side_player) {
              player.x_side_matches++;
            }
            if (b_side_player && name === b_side_player) {
              player.b_side_matches++;
            }
          }

          player.last_result = isWinner ? 'win' : 'loss';
        });

        // Track combo performance
        [
          { player: player1_name, combo: player1_beyblade, isWinner: winner_name === player1_name },
          { player: player2_name, combo: player2_beyblade, isWinner: winner_name === player2_name }
        ].forEach(({ player, combo, isWinner }) => {
          if (!combo) return;

          const comboKey = `${combo}_${player}`;
          if (!combosMap[comboKey]) {
            combosMap[comboKey] = {
              combo,
              player,
              matches: 0,
              wins: 0,
              total_points: 0
            };
          }

          const comboData = combosMap[comboKey];
          comboData.matches++;
          if (isWinner) {
            comboData.wins++;
            comboData.total_points += points;
          }
        });
      });

      const playerRankingsData = Object.values(playersMap).map((player: any) => {
        const winRate = player.total_matches > 0 ? (player.wins / player.total_matches) * 100 : 0;
        const avgPointsPerMatch = player.total_matches > 0 ? player.total_points / player.total_matches : 0;

        // Weighted Win Rate formula: win_rate * log(matches+1)
        const weightedWinRate = winRate * Math.log(player.total_matches + 1);

        const xSideWinRate = player.x_side_matches > 0 ? (player.x_side_wins / player.x_side_matches) * 100 : 0;
        const bSideWinRate = player.b_side_matches > 0 ? (player.b_side_wins / player.b_side_matches) * 100 : 0;

        const weightedXSideWinRate = xSideWinRate * Math.log(player.x_side_matches + 1);
        const weightedBSideWinRate = bSideWinRate * Math.log(player.b_side_matches + 1);

        return {
          player_name: player.player_name,
          total_matches: player.total_matches,
          wins: player.wins,
          losses: player.losses,
          total_points: player.total_points,
          win_rate: winRate,
          avg_points_per_match: avgPointsPerMatch,
          longest_win_streak: player.longest_win_streak,
          current_streak: player.current_streak,
          weighted_win_rate: weightedWinRate,
          finish_points: player.finish_points,
          x_side_points: player.x_side_points,
          b_side_points: player.b_side_points,
          x_side_matches: player.x_side_matches,
          b_side_matches: player.b_side_matches,
          x_side_wins: player.x_side_wins,
          b_side_wins: player.b_side_wins,
          weighted_x_side_win_rate: weightedXSideWinRate,
          weighted_b_side_win_rate: weightedBSideWinRate,
          rank: 0
        };
      });

      setPlayerRankings(playerRankingsData);

      const comboRankingsData = Object.values(combosMap).map((combo: any) => {
        const winRate = combo.matches > 0 ? (combo.wins / combo.matches) * 100 : 0;
        const avgPoints = combo.matches > 0 ? combo.total_points / combo.matches : 0;
        const comboScore = winRate * avgPoints * (combo.matches / (combo.matches + 10));

        return {
          combo: combo.combo,
          player: combo.player,
          matches: combo.matches,
          wins: combo.wins,
          win_rate: winRate,
          total_points: combo.total_points,
          avg_points: avgPoints,
          combo_score: comboScore
        };
      });

      comboRankingsData.sort((a, b) => b.combo_score - a.combo_score);
      setComboRankings(comboRankingsData);

    } catch (error) {
      console.error('Error fetching leaderboards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (column: keyof PlayerRanking) => {
    if (sortBy === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column as any);
      setSortDirection('desc');
    }
  };

  const sortedPlayers = [...playerRankings].sort((a, b) => {
    let valA: number;
    let valB: number;

    switch (sortBy) {
      case 'wins':
        valA = a.wins; valB = b.wins; break;
      case 'points':
        valA = a.total_points; valB = b.total_points; break;
      case 'streak':
        valA = a.longest_win_streak; valB = b.longest_win_streak; break;
      default:
        valA = a.weighted_win_rate; valB = b.weighted_win_rate; break;
    }

    return sortDirection === 'asc' ? valA - valB : valB - valA;
  });

  const finishTypes = [
    { key: 'spin', label: 'Spin Finish' },
    { key: 'over', label: 'Over Finish' },
    { key: 'burst', label: 'Burst Finish' },
    { key: 'extreme', label: 'Extreme Finish' },
  ];

  const bestXSidePoints = playerRankings.reduce((best, p) =>
    p.x_side_points > (best?.x_side_points || 0) ? p : best, null as PlayerRanking | null);
  const bestXSideWeighted = playerRankings.reduce((best, p) =>
    p.weighted_x_side_win_rate > (best?.weighted_x_side_win_rate || 0) ? p : best, null as PlayerRanking | null);

  const bestBSidePoints = playerRankings.reduce((best, p) =>
    p.b_side_points > (best?.b_side_points || 0) ? p : best, null as PlayerRanking | null);
  const bestBSideWeighted = playerRankings.reduce((best, p) =>
    p.weighted_b_side_win_rate > (best?.weighted_b_side_win_rate || 0) ? p : best, null as PlayerRanking | null);

  if (loading || isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-400">Loading leaderboards...</p>
      </div>
    );
  }

  if (playerRankings.length === 0) {
    return (
      <div className="group relative border border-slate-700 bg-slate-900/40 p-12 text-center">
        <Crown size={32} className="mx-auto text-slate-400 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No Leaderboard Data</h3>
        <p className="text-slate-400">
          This tournament has no completed matches yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Unified Player Leaderboard */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Crown size={24} className="mr-2 text-yellow-400" />
            Player Leaderboard
          </h2>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-800 text-white border border-slate-600 rounded-lg px-3 py-2 pr-8 appearance-none"
            >
              <option value="weighted">Weighted Win Rate</option>
              <option value="wins">Total Wins</option>
              <option value="points">Total Points</option>
              <option value="streak">Win Streak</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800/50">
              <tr>
                {['Rank', 'Player', 'Matches', 'Wins', 'Losses', 'Win Rate', 'Points', 'Streak'].map((header) => (
                  <th
                    key={header}
                    onClick={() => handleSort(header.toLowerCase().replace(' ', '_') as any)}
                    className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-slate-950/50 divide-y divide-slate-800">
              {sortedPlayers.map((player, index) => (
                <tr key={player.player_name} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 text-sm text-white font-bold">#{index + 1}</td>
                  <td className="px-6 py-4 text-sm text-white">{player.player_name}</td>
                  <td className="px-6 py-4 text-sm text-center text-white">{player.total_matches}</td>
                  <td className="px-6 py-4 text-sm text-center text-green-400">{player.wins}</td>
                  <td className="px-6 py-4 text-sm text-center text-red-400">{player.losses}</td>
                  <td className="px-6 py-4 text-sm text-center text-yellow-400">{player.win_rate.toFixed(1)}%</td>
                  <td className="px-6 py-4 text-sm text-center text-cyan-400 font-bold">{player.total_points}</td>
                  <td className="px-6 py-4 text-sm text-center text-purple-400">{player.longest_win_streak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Finish Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {finishTypes.map((f) => {
          const topPlayer = playerRankings.reduce((best, p) =>
            p.finish_points[f.key as keyof PlayerRanking['finish_points']] >
            (best?.finish_points[f.key as keyof PlayerRanking['finish_points']] || 0)
              ? p
              : best,
            null as PlayerRanking | null
          );

          return (
            <div key={f.key} className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-lg">
              <h3 className="text-lg font-bold text-white mb-2">{f.label}</h3>
              {topPlayer ? (
                <div>
                  <div className="text-xl text-white font-bold">{topPlayer.player_name}</div>
                  <div className="text-cyan-400 font-medium">
                    {topPlayer.finish_points[f.key as keyof PlayerRanking['finish_points']]} pts
                  </div>
                </div>
              ) : (
                <div className="text-slate-400">No data</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Best X-Side and B-Side Players */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-lg">
          <h3 className="text-lg font-bold text-white mb-2">Best X-Side Player</h3>
          {bestXSidePoints && (
            <div className="mb-2">
              <div className="text-sm text-slate-400">Most Points</div>
              <div className="text-xl text-white font-bold">{bestXSidePoints.player_name}</div>
              <div className="text-cyan-400">{bestXSidePoints.x_side_points} pts</div>
            </div>
          )}
          {bestXSideWeighted && (
            <div>
              <div className="text-sm text-slate-400">Best Weighted Win Rate</div>
              <div className="text-xl text-white font-bold">{bestXSideWeighted.player_name}</div>
              <div className="text-cyan-400">{bestXSideWeighted.weighted_x_side_win_rate.toFixed(1)}</div>
            </div>
          )}
        </div>
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-lg">
          <h3 className="text-lg font-bold text-white mb-2">Best B-Side Player</h3>
          {bestBSidePoints && (
            <div className="mb-2">
              <div className="text-sm text-slate-400">Most Points</div>
              <div className="text-xl text-white font-bold">{bestBSidePoints.player_name}</div>
              <div className="text-cyan-400">{bestBSidePoints.b_side_points} pts</div>
            </div>
          )}
          {bestBSideWeighted && (
            <div>
              <div className="text-sm text-slate-400">Best Weighted Win Rate</div>
              <div className="text-xl text-white font-bold">{bestBSideWeighted.player_name}</div>
              <div className="text-cyan-400">{bestBSideWeighted.weighted_b_side_win_rate.toFixed(1)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Top Performing Combos */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
          <Target size={24} className="mr-2 text-cyan-400" />
          Top Performing Combos
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Combo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Player</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Matches</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Win Rate</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Avg Points</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Score</th>
              </tr>
            </thead>
            <tbody className="bg-slate-950/50 divide-y divide-slate-800">
              {comboRankings.slice(0, 15).map((combo) => (
                <tr key={`${combo.combo}_${combo.player}`} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 text-sm text-white">{combo.combo}</td>
                  <td className="px-6 py-4 text-sm text-white">{combo.player}</td>
                  <td className="px-6 py-4 text-center text-sm text-white">{combo.matches}</td>
                  <td className="px-6 py-4 text-center text-sm text-green-400">{combo.win_rate.toFixed(1)}%</td>
                  <td className="px-6 py-4 text-center text-sm text-white">{combo.avg_points.toFixed(1)}</td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-purple-400">{combo.combo_score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Most Consistent & Longest Win Streaks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Most Consistent */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Star size={20} className="mr-2 text-green-400" />
            Most Consistent (5+ Matches)
          </h3>
          <div className="space-y-3">
            {playerRankings
              .filter(p => p.total_matches >= 5)
              .sort((a, b) => b.win_rate - a.win_rate)
              .slice(0, 5)
              .map((player) => (
                <div
                  key={player.player_name}
                  className="bg-slate-800/50 border border-green-500/20 rounded-lg p-3 flex justify-between items-center"
                >
                  <div>
                    <div className="text-white font-medium">{player.player_name}</div>
                    <div className="text-xs text-slate-400">{player.total_matches} matches</div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">{player.win_rate.toFixed(1)}%</div>
                    <div className="text-xs text-slate-400">{player.wins}W-{player.losses}L</div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Longest Win Streaks */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Swords size={20} className="mr-2 text-purple-400" />
            Longest Win Streaks
          </h3>
          <div className="space-y-3">
            {playerRankings
              .sort((a, b) => b.longest_win_streak - a.longest_win_streak)
              .slice(0, 5)
              .map((player) => (
                <div
                  key={player.player_name}
                  className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-3 flex justify-between items-center"
                >
                  <div>
                    <div className="text-white font-medium">{player.player_name}</div>
                    <div className="text-xs text-slate-400">Current: {player.current_streak} wins</div>
                  </div>
                  <div className="text-right">
                    <div className="text-purple-400 font-bold">{player.longest_win_streak}</div>
                    <div className="text-xs text-slate-400">wins</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

