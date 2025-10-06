import React, { useState, useEffect } from 'react';
import { Users, Trophy, Target, Eye, Search, X, TrendingUp } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { supabase } from '../../../lib/supabase';

interface PlayerAnalyticsSubTabProps {
  tournamentId: string;
  loading?: boolean;
}

interface PlayerData {
  name: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  weightedWinRate: number;
  totalPoints: number;
  avgPointsPerMatch: number;
  mvpCombo: string;
  mvpComboScore: number;
  mostCommonWinFinish: string;
  mostCommonLoseFinish: string;
  finishDistribution: { [key: string]: number };
  phasePerformance: { [phase: number]: { wins: number; matches: number; points: number } };
  winsByFinish: { [beyblade: string]: { [finish: string]: number } };
  lossesByFinish: { [beyblade: string]: { [finish: string]: number } };
  pointsGainedByBey: { [beyblade: string]: number };
  pointsGivenByBey: { [beyblade: string]: number };
  allMatches: any[];
}

interface HeadToHeadData {
  player1: string;
  player2: string;
  p1Wins: number;
  p2Wins: number;
  totalMatches: number;
  p1WinRate: number;
}

interface ShowAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  columns: { key: string; label: string }[];
  onRowClick?: (row: any) => void;
}

interface MatchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  matches: any[];
}

const FINISH_POINTS = {
  'Spin Finish': 1,
  'Burst Finish': 2,
  'Over Finish': 2,
  'Extreme Finish': 3
};

const FINISH_TYPES = ['Spin Finish', 'Burst Finish', 'Over Finish', 'Extreme Finish'];

/* -------------------- ShowAllModal -------------------- */
function ShowAllModal({ isOpen, onClose, title, data, columns, onRowClick }: ShowAllModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredData = data.filter(row => 
    columns.some(col => String(row[col.key] || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-4 text-white flex justify-between items-center">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full">
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-4 relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {columns.map(col => (
                    <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((row, index) => (
                  <tr key={index} className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`} onClick={() => onRowClick?.(row)}>
                    {columns.map(col => (
                      <td key={col.key} className="px-6 py-4 text-sm text-gray-900">
                        {typeof row[col.key] === 'number'
                          ? (col.key.includes('Rate') || col.key.includes('Score'))
                            ? row[col.key].toFixed(1)
                            : row[col.key]
                          : String(row[col.key] || '')}
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

/* -------------------- MatchDetailsModal -------------------- */
function MatchDetailsModal({ isOpen, onClose, title, matches }: MatchDetailsModalProps) {
  if (!isOpen) return null;

  const FINISH_POINTS: Record<string, number> = {
    "Spin Finish": 1,
    "Burst Finish": 2,
    "Over Finish": 2,
    "Extreme Finish": 3,
  };

  // Group by player1, player2, TO, and time proximity (≤ 5 min apart = same round)
  function groupRounds(matches: any[]) {
    const rounds: any[] = [];

    // Sort by submitted_at
    const sorted = [...matches].sort(
      (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    );

    let currentRound: any[] = [];
    let lastTime: number | null = null;

    sorted.forEach((m) => {
      const matchTime = new Date(m.submitted_at).getTime();

      if (
        currentRound.length === 0 ||
        m.player1_name !== currentRound[0].player1_name ||
        m.player2_name !== currentRound[0].player2_name ||
        m.tournament_official !== currentRound[0].tournament_official ||
        (lastTime && matchTime - lastTime > 5 * 60 * 1000) // > 5 min apart → new round
      ) {
        if (currentRound.length > 0) rounds.push(currentRound);
        currentRound = [m];
      } else {
        currentRound.push(m);
      }

      lastTime = matchTime;
    });

    if (currentRound.length > 0) rounds.push(currentRound);
    return rounds;
  }

  const rounds = groupRounds(matches);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto rounded-none">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2 text-white flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Rounds */}
        <div className="p-4 space-y-6">
          {rounds.map((roundMatches, rIndex) => {
            let p1Score = 0;
            let p2Score = 0;
            const p1 = roundMatches[0].player1_name;
            const p2 = roundMatches[0].player2_name;
            const TO = roundMatches[0].tournament_official;

            roundMatches.forEach((m: any) => {
              const pts = FINISH_POINTS[m.outcome?.split(" (")[0]] || 0;
              if (m.winner_name === p1) p1Score += pts;
              else if (m.winner_name === p2) p2Score += pts;
            });

            return (
              <div key={rIndex} className="border border-slate-700">
                {/* Round header */}
                <div className="bg-slate-800/80 px-3 py-1.5 text-sm font-bold flex justify-between items-center">
                  <span className="text-cyan-300">
                    Round {rIndex + 1}: {p1} vs {p2}{" "}
                    <span className="text-slate-400 ml-2">{TO}</span>
                  </span>
                  <span
                    className={`font-semibold ${
                      p1Score > p2Score
                        ? "text-blue-400"
                        : p1Score < p2Score
                        ? "text-red-400"
                        : "text-slate-300"
                    }`}
                  >
                    {p1Score > p2Score
                      ? "WIN"
                      : p1Score < p2Score
                      ? "LOSS"
                      : "DRAW"}{" "}
                    {p1Score}-{p2Score}
                  </span>
                </div>

                {/* Matches table */}
{/* Matches table */}
<table className="min-w-full divide-y divide-slate-700 text-xs">
  <thead className="bg-slate-800/70">
    <tr>
      <th className="px-2 py-1 text-left font-medium text-cyan-300 uppercase">#</th>
      <th className="px-2 py-1 text-left font-medium text-cyan-300 uppercase">P1</th>
      <th className="px-2 py-1 text-left font-medium text-cyan-300 uppercase">P1 Bey</th>
      <th className="px-2 py-1 text-left font-medium text-cyan-300 uppercase">P2</th>
      <th className="px-2 py-1 text-left font-medium text-cyan-300 uppercase">P2 Bey</th>
      <th className="px-2 py-1 text-left font-medium text-cyan-300 uppercase">Winner</th>
      <th className="px-2 py-1 text-left font-medium text-cyan-300 uppercase">Finish</th>
    </tr>
  </thead>
  <tbody className="bg-slate-950/50 divide-y divide-slate-800">
    {roundMatches
      .slice()
      .sort((a, b) => {
        const tA = new Date(a.submitted_at).getTime();
        const tB = new Date(b.submitted_at).getTime();
        if (tA !== tB) return tA - tB;
        return (a.match_number ?? 0) - (b.match_number ?? 0); // <- ensures beyblade order
      })
      .map((m: any, idx: number) => {
        const isP1Winner = m.winner_name === m.player1_name;
        const isP2Winner = m.winner_name === m.player2_name;
        return (
          <tr
            key={idx}
            className={`hover:bg-slate-800/40 ${
              isP1Winner
                ? "bg-blue-500/10"
                : isP2Winner
                ? "bg-red-500/10"
                : ""
            }`}
          >
            <td className="px-2 py-1 text-slate-300">M{idx + 1}</td>
            <td
              className={`px-2 py-1 ${
                isP1Winner ? "text-blue-400 font-medium" : "text-slate-400"
              }`}
            >
              {m.player1_name}
            </td>
            <td className="px-2 py-1 text-slate-300 truncate max-w-[100px]">
              {m.player1_beyblade}
            </td>
            <td
              className={`px-2 py-1 ${
                isP2Winner ? "text-red-400 font-medium" : "text-slate-400"
              }`}
            >
              {m.player2_name}
            </td>
            <td className="px-2 py-1 text-slate-300 truncate max-w-[100px]">
              {m.player2_beyblade}
            </td>
            <td className="px-2 py-1 text-green-400 font-bold">{m.winner_name}</td>
            <td className="px-2 py-1 text-slate-300">{m.outcome}</td>
          </tr>
        );
      })}
  </tbody>
</table>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}



/* -------------------- Main Component -------------------- */
export function PlayerAnalyticsSubTab({ tournamentId, loading = false }: PlayerAnalyticsSubTabProps) {
  const [players, setPlayers] = useState<{ [name: string]: PlayerData }>({});
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [headToHead, setHeadToHead] = useState<HeadToHeadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showAllModal, setShowAllModal] = useState({
    isOpen: false,
    title: '',
    data: [] as any[],
    columns: [] as { key: string; label: string }[],
    onRowClick: undefined as ((row: any) => void) | undefined,
  });
  const [matchDetailsModal, setMatchDetailsModal] = useState({
    isOpen: false,
    title: '',
    matches: [] as any[],
  });

  useEffect(() => {
    if (tournamentId) fetchPlayerAnalytics();
  }, [tournamentId]);

  const calculateWeightedWinRate = (wins: number, totalMatches: number): number => {
    if (totalMatches === 0) return 0;
    return (wins / totalMatches) * (totalMatches / (totalMatches + 10));
  };

  const fetchPlayerAnalytics = async () => {
    try {
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

      const playersMap: { [name: string]: PlayerData } = {};
      const h2hMap: { [key: string]: HeadToHeadData } = {};

      /* ----- Process Matches ----- */
      allMatches.forEach(match => {
        if (!match.winner_name || !match.player1_name || !match.player2_name) return;
        const outcome = match.outcome?.split(' (')[0] || 'Unknown';
        const points = match.points_awarded || FINISH_POINTS[outcome as keyof typeof FINISH_POINTS] || 0;
        const phase = match.phase_number || 1;

        // Use normalized names for consistent player tracking
        const normalizedPlayer1 = match.normalized_player1_name || match.player1_name.toLowerCase();
        const normalizedPlayer2 = match.normalized_player2_name || match.player2_name.toLowerCase();
        const normalizedWinner = match.normalized_winner_name || match.winner_name.toLowerCase();
        
        [normalizedPlayer1, normalizedPlayer2].forEach((normalizedName, index) => {
          const displayName = index === 0 ? match.player1_name : match.player2_name;
          
          if (!playersMap[displayName]) {
            playersMap[displayName] = {
              name: displayName,
              matches: 0,
              wins: 0,
              losses: 0,
              winRate: 0,
              weightedWinRate: 0,
              totalPoints: 0,
              avgPointsPerMatch: 0,
              mvpCombo: '',
              mvpComboScore: 0,
              mostCommonWinFinish: '',
              mostCommonLoseFinish: '',
              finishDistribution: {},
              phasePerformance: {},
              winsByFinish: {},
              lossesByFinish: {},
              pointsGainedByBey: {},
              pointsGivenByBey: {},
              allMatches: []
            };
          }
        });

        // Store all matches
        if (playersMap[match.player1_name]) playersMap[match.player1_name].allMatches.push(match);
        if (playersMap[match.player2_name]) playersMap[match.player2_name].allMatches.push(match);

        const winner = playersMap[match.winner_name];
        const loserName = normalizedWinner === normalizedPlayer1 ? match.player2_name : match.player1_name;
        const loser = playersMap[loserName];
        const winnerBeyblade = match.winner_name === match.player1_name ? match.player1_beyblade : match.player2_beyblade;
        const loserBeyblade = match.winner_name === match.player1_name ? match.player2_beyblade : match.player1_beyblade;

        if (!winner || !loser) return; // Skip if players not found
        
        // Winner stats
        winner.matches++;
        winner.wins++;
        winner.totalPoints += points;
        winner.finishDistribution[outcome] = (winner.finishDistribution[outcome] || 0) + 1;
        if (!winner.winsByFinish[winnerBeyblade]) winner.winsByFinish[winnerBeyblade] = {};
        winner.winsByFinish[winnerBeyblade][outcome] = (winner.winsByFinish[winnerBeyblade][outcome] || 0) + 1;
        winner.pointsGainedByBey[winnerBeyblade] = (winner.pointsGainedByBey[winnerBeyblade] || 0) + points;
        if (!winner.phasePerformance[phase]) winner.phasePerformance[phase] = { wins: 0, matches: 0, points: 0 };
        winner.phasePerformance[phase].wins++;
        winner.phasePerformance[phase].matches++;
        winner.phasePerformance[phase].points += points;

        // Loser stats
        loser.matches++;
        loser.losses++;
        loser.finishDistribution[outcome] = (loser.finishDistribution[outcome] || 0) + 1;
        if (!loser.lossesByFinish[loserBeyblade]) loser.lossesByFinish[loserBeyblade] = {};
        loser.lossesByFinish[loserBeyblade][outcome] = (loser.lossesByFinish[loserBeyblade][outcome] || 0) + 1;
        loser.pointsGivenByBey[loserBeyblade] = (loser.pointsGivenByBey[loserBeyblade] || 0) + points;
        if (!loser.phasePerformance[phase]) loser.phasePerformance[phase] = { wins: 0, matches: 0, points: 0 };
        loser.phasePerformance[phase].matches++;

        // Head-to-head
        const h2hKey = [match.player1_name, match.player2_name].sort().join('_vs_');
        if (!h2hMap[h2hKey]) {
          h2hMap[h2hKey] = { player1: match.player1_name, player2: match.player2_name, p1Wins: 0, p2Wins: 0, totalMatches: 0, p1WinRate: 0 };
        }
        h2hMap[h2hKey].totalMatches++;
        if (match.winner_name === match.player1_name) h2hMap[h2hKey].p1Wins++;
        else h2hMap[h2hKey].p2Wins++;
      });

      /* ----- Finalize Player Stats ----- */
      Object.values(playersMap).forEach(player => {
        player.winRate = player.matches > 0 ? (player.wins / player.matches) * 100 : 0;
        player.weightedWinRate = calculateWeightedWinRate(player.wins, player.matches);
        player.avgPointsPerMatch = player.matches > 0 ? player.totalPoints / player.matches : 0;

        // MVP Beyblade
        if (Object.keys(player.pointsGainedByBey).length > 0) {
          const [bestBey, bestScore] = Object.entries(player.pointsGainedByBey).reduce((a, b) => (a[1] > b[1] ? a : b));
          player.mvpCombo = bestBey;
          player.mvpComboScore = bestScore;
        }

        // Most common finishes
        const winFinishes = Object.entries(player.finishDistribution);
        player.mostCommonWinFinish = winFinishes.length > 0 ? winFinishes.reduce((a, b) => (a[1] > b[1] ? a : b))[0] : 'N/A';
        player.mostCommonLoseFinish = player.mostCommonWinFinish; // simplified
      });

      // Head-to-head win rates
      Object.values(h2hMap).forEach(h2h => {
        h2h.p1WinRate = h2h.totalMatches > 0 ? (h2h.p1Wins / h2h.totalMatches) * 100 : 0;
      });

      setPlayers(playersMap);
      setHeadToHead(Object.values(h2hMap).filter(h2h => h2h.totalMatches > 0));

      const playerNames = Object.keys(playersMap);
      if (playerNames.length > 0 && !selectedPlayer) setSelectedPlayer(playerNames[0]);
    } catch (error) {
      console.error('Error fetching player analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };
  /* -------------------- UI Helpers -------------------- */
  const playerNames = Object.keys(players);
  const selectedPlayerData = selectedPlayer ? players[selectedPlayer] : undefined;

  const showAllPlayers = () => {
    const data = Object.values(players).map(p => ({
      Player: p.name,
      Matches: p.matches,
      Wins: p.wins,
      Losses: p.losses,
      'Win Rate (%)': Number(p.winRate.toFixed(1)),
      'Weighted Win Rate (%)': Number((p.weightedWinRate * 100).toFixed(1)),
      'Total Points': p.totalPoints,
      'Avg Pts/Match': Number(p.avgPointsPerMatch.toFixed(2)),
      'MVP Beyblade': p.mvpCombo || '—',
      'MVP Points': p.mvpComboScore || 0,
    }));

    setShowAllModal({
      isOpen: true,
      title: 'All Players (Sortable/Filterable)',
      data,
      columns: [
        { key: 'Player', label: 'Player' },
        { key: 'Matches', label: 'Matches' },
        { key: 'Wins', label: 'Wins' },
        { key: 'Losses', label: 'Losses' },
        { key: 'Win Rate (%)', label: 'Win Rate (%)' },
        { key: 'Weighted Win Rate (%)', label: 'Weighted Win Rate (%)' },
        { key: 'Total Points', label: 'Total Points' },
        { key: 'Avg Pts/Match', label: 'Avg Pts/Match' },
        { key: 'MVP Beyblade', label: 'MVP Beyblade' },
        { key: 'MVP Points', label: 'MVP Points' },
      ],
      onRowClick: (row) => {
        setSelectedPlayer(row.Player);
        setShowAllModal(m => ({ ...m, isOpen: false }));
      }
    });
  };

  const showAllHeadToHead = () => {
    const data = headToHead.map(h => ({
      Matchup: `${h.player1} vs ${h.player2}`,
      'Total Matches': h.totalMatches,
      'Player 1 Wins': h.p1Wins,
      'Player 2 Wins': h.p2Wins,
      'P1 Win Rate (%)': Number(h.p1WinRate.toFixed(1)),
    }));

    setShowAllModal({
      isOpen: true,
      title: 'All Head-to-Head Matchups',
      data,
      columns: [
        { key: 'Matchup', label: 'Matchup' },
        { key: 'Total Matches', label: 'Total Matches' },
        { key: 'Player 1 Wins', label: 'Player 1 Wins' },
        { key: 'Player 2 Wins', label: 'Player 2 Wins' },
        { key: 'P1 Win Rate (%)', label: 'P1 Win Rate (%)' },
      ],
    });
  };

  const openMatchDetailsForPlayer = (playerName: string) => {
    const p = players[playerName];
    if (!p) return;
    setMatchDetailsModal({
      isOpen: true,
      title: `${playerName} — Match Details`,
      matches: p.allMatches || [],
    });
  };

  /* -------------------- Render -------------------- */
  if (isLoading || loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="h-40 bg-gray-200 rounded-lg" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (playerNames.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-gray-600">No match data found for this tournament yet.</p>
        </div>
      </div>
    );
  }

   return (
    <div className="space-y-3 p-2 sm:space-y-6 sm:p-6">
      {/* Player Selection */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-3 sm:p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <h2 className="text-base sm:text-xl font-bold text-white mb-2 sm:mb-4 flex items-center">
          <Users size={20} className="mr-2 text-blue-600" />
          Player Selection
        </h2>
        <div className="w-full">
          <label className="block text-xs font-medium text-cyan-400 mb-1">
            Select Player for Detailed Analysis
          </label>
          <select
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            className="w-full bg-slate-800 border border-cyan-500/30 rounded-none px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">-- Select Player --</option>
            {playerNames.sort().map(playerName => (
              <option key={playerName} value={playerName}>
                {playerName}
              </option>
            ))}
          </select>
        </div>
      </div>


      {/* Tournament Player Rankings moved above Player Selection */}

      {/* Player Detailed Performance (with MVP) */}
      {selectedPlayerData && (
        <>
          {/* Move Tournament Player Rankings above Player Selection */}
          <div className="group relative border border-slate-700 bg-slate-900/40 p-3 sm:p-6 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] mb-3 sm:mb-6">
            {/* Animated bottom underline */}
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center">
                <Trophy size={20} className="mr-2 text-yellow-600" />
                Tournament Player Rankings
              </h2>
              <button
                onClick={showAllPlayers}
                className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-none hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 flex items-center space-x-1 sm:space-x-2 shadow-[0_0_15px_rgba(0,200,255,0.3)] text-sm"
              >
                <Eye size={16} />
                <span>Show All</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">Player</th>
                    <th className="px-1 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">M</th>
                    <th className="px-1 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">WR%</th>
                    <th className="hidden sm:table-cell px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">Weighted WR</th>
                    <th className="px-1 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">Pts</th>
                    <th className="hidden sm:table-cell px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">Avg Pts</th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">Most Common Win</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                  {Object.values(players)
                    .sort((a, b) => b.weightedWinRate - a.weightedWinRate)
                    .slice(0, 10)
                    .map((player, index) => (
                      <tr
                        key={player.name}
                        className={`hover:bg-slate-800/50 cursor-pointer ${selectedPlayer === player.name ? 'bg-cyan-500/10' : ''}`}
                        onClick={() => setSelectedPlayer(player.name)}
                      >
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-sm font-medium text-white">
                          <div className="flex items-center space-x-1 sm:space-x-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {index + 1}
                            </div>
                            <span className="truncate">{player.name}</span>
                          </div>
                        </td>
                        <td className="px-1 sm:px-6 py-2 sm:py-4 text-sm text-white text-center">{player.matches}</td>
                        <td className="px-1 sm:px-6 py-2 sm:py-4 text-sm text-center">
                          <span className={`font-medium ${
                            player.winRate >= 60 ? 'text-green-400' :
                            player.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {player.winRate.toFixed(2)}%
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-4 text-sm font-bold text-cyan-400 text-center">
                          {(player.weightedWinRate * 100).toFixed(2)}%
                        </td>
                        <td className="px-1 sm:px-6 py-2 sm:py-4 text-sm font-medium text-white text-center">{player.totalPoints}</td>
                        <td className="hidden sm:table-cell px-6 py-4 text-sm text-white text-center">{player.avgPointsPerMatch.toFixed(2)}</td>
                        <td className="hidden md:table-cell px-6 py-4 text-sm text-white">{player.mostCommonWinFinish}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

        <div className="group relative border border-slate-700 bg-slate-900/40 p-3 sm:p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          {/* Animated bottom underline */}
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-6 gap-2">
            <h3 className="text-base sm:text-xl font-bold text-white flex items-center">
              <Target size={24} className="mr-2 text-blue-600" />
              {selectedPlayerData.name} — Detailed Performance
            </h3>
            <button
              className="text-xs sm:text-sm text-cyan-400 hover:text-cyan-300 underline self-start sm:self-auto"
              onClick={() => openMatchDetailsForPlayer(selectedPlayerData.name)}
            >
              View Match Details
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-6">
            {/* Total Matches */}
            <div className="text-center">
              <div className="text-xl sm:text-3xl font-bold text-cyan-400">{selectedPlayerData.matches}</div>
              <div className="text-xs sm:text-sm text-slate-400">Matches</div>
            </div>

            {/* Win Rate */}
            <div className="text-center">
              <div className="text-xl sm:text-3xl font-bold text-green-400">{selectedPlayerData.winRate.toFixed(2)}%</div>
              <div className="text-xs sm:text-sm text-slate-400">Win Rate</div>
            </div>

            {/* Total Points */}
            <div className="text-center">
              <div className="text-xl sm:text-3xl font-bold text-purple-400">{selectedPlayerData.totalPoints}</div>
              <div className="text-xs sm:text-sm text-slate-400">Points</div>
            </div>

            {/* Avg Points/Match */}
            <div className="text-center col-span-2 sm:col-span-1">
              <div className="text-xl sm:text-3xl font-bold text-orange-400">{selectedPlayerData.avgPointsPerMatch.toFixed(2)}</div>
              <div className="text-xs sm:text-sm text-slate-400">Avg Pts</div>
            </div>

            {/* Most Valuable Beyblade */}
            <div className="text-center col-span-2 sm:col-span-2 lg:col-span-1">
              <div className="text-sm sm:text-xl font-bold text-indigo-400 truncate">{selectedPlayerData.mvpCombo || 'N/A'}</div>
              <div className="text-xs sm:text-sm text-slate-400">MVP Beyblade</div>
              {selectedPlayerData.mvpCombo && (
                <div className="text-sm sm:text-lg font-bold text-indigo-300 mt-1">
                  {selectedPlayerData.mvpComboScore} pts
                </div>
              )}
            </div>
          </div>
        </div>
        </>
      )}

      {/* Wins & Losses per Finish (side-by-side) */}
      {selectedPlayerData && (
        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">
          {/* Wins per Finish */}
          <div className="group relative border border-slate-700 bg-slate-900/40 p-3 sm:p-6 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            {/* Animated bottom underline */}
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Wins per Finish</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">Beyblade</th>
                    {FINISH_TYPES.map(finish => (
                      <th key={finish} className="px-1 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">
                        {finish.split(' ')[0].substring(0, 4)}
                      </th>
                    ))}
                    <th className="px-1 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Pts</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                  {Object.keys(selectedPlayerData.winsByFinish).map(beyblade => (
                    <tr key={beyblade} className="hover:bg-slate-800/50">
                      <td className="px-2 sm:px-6 py-2 sm:py-4 text-sm font-medium text-white">
                        <div className="truncate max-w-[100px] sm:max-w-none" title={beyblade}>
                          {beyblade}
                        </div>
                      </td>
                      {FINISH_TYPES.map(finish => (
                        <td key={finish} className="px-1 sm:px-6 py-2 sm:py-4 text-sm text-center font-medium text-green-400">
                          {selectedPlayerData.winsByFinish[beyblade]?.[finish] || 0}
                        </td>
                      ))}
                      <td className="px-1 sm:px-6 py-2 sm:py-4 text-sm text-center font-bold text-green-300">
                        {selectedPlayerData.pointsGainedByBey[beyblade] || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Losses per Finish */}
          <div className="group relative border border-slate-700 bg-slate-900/40 p-3 sm:p-6 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            {/* Animated bottom underline */}
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Losses per Finish</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">Beyblade</th>
                    {FINISH_TYPES.map(finish => (
                      <th key={finish} className="px-1 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">
                        {finish.split(' ')[0].substring(0, 4)}
                      </th>
                    ))}
                    <th className="px-1 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Pts</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                  {Object.keys(selectedPlayerData.lossesByFinish).map(beyblade => (
                    <tr key={beyblade} className="hover:bg-slate-800/50">
                      <td className="px-2 sm:px-6 py-2 sm:py-4 text-sm font-medium text-white">
                        <div className="truncate max-w-[100px] sm:max-w-none" title={beyblade}>
                          {beyblade}
                        </div>
                      </td>
                      {FINISH_TYPES.map(finish => (
                        <td key={finish} className="px-1 sm:px-6 py-2 sm:py-4 text-sm text-center font-medium text-red-400">
                          {selectedPlayerData.lossesByFinish[beyblade]?.[finish] || 0}
                        </td>
                      ))}
                      <td className="px-1 sm:px-6 py-2 sm:py-4 text-sm text-center font-bold text-red-300">
                        {selectedPlayerData.pointsGivenByBey[beyblade] || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Charts (Radar + Phase Performance) */}
      {selectedPlayerData && (
        <div className="space-y-6">
          {/* Finish Type Radar Chart */}
          <div className="group relative border border-slate-700 bg-slate-900/40 p-3 sm:p-6 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            {/* Animated bottom underline */}
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Points per Finish Type</h3>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart
                data={Object.entries(selectedPlayerData.finishDistribution).map(([finish, count]) => ({
                  finish,
                  points: count * (FINISH_POINTS[finish as keyof typeof FINISH_POINTS] || 0),
                  count,
                }))}
              >
                <PolarGrid />
                <PolarAngleAxis dataKey="finish" />
                <PolarRadiusAxis />
                <Radar name="Points" dataKey="points" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Phase Performance */}
          {Object.keys(selectedPlayerData.phasePerformance).length > 0 && (
            <div className="group relative border border-slate-700 bg-slate-900/40 p-3 sm:p-6 rounded-none 
                           transition-all duration-300 hover:border-cyan-400/70 
                           hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              {/* Animated bottom underline */}
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Phase Performance</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-xs font-medium text-cyan-400 uppercase">Phase</th>
                      <th className="px-1 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">M</th>
                      <th className="px-1 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">W</th>
                      <th className="px-1 sm:px-6 py-2 sm:py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">WR%</th>
                      <th className="hidden sm:table-cell px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Avg Pts</th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                    {Object.entries(selectedPlayerData.phasePerformance)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([phase, stats]) => (
                        <tr key={phase} className="hover:bg-slate-800/50">
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-sm font-medium text-white text-center">{phase}</td>
                          <td className="px-1 sm:px-6 py-2 sm:py-4 text-sm text-white text-center">{stats.matches}</td>
                          <td className="px-1 sm:px-6 py-2 sm:py-4 text-sm text-green-400 text-center font-medium">{stats.wins}</td>
                          <td className="px-1 sm:px-6 py-2 sm:py-4 text-sm text-center">
                            <span className={`font-medium ${
                              stats.matches > 0 && (stats.wins / stats.matches) * 100 >= 50 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {stats.matches > 0 ? ((stats.wins / stats.matches) * 100).toFixed(2) : '0.00'}%
                            </span>
                          </td>
                          <td className="hidden sm:table-cell px-6 py-4 text-sm text-white text-center">
                            {stats.matches > 0 ? (stats.points / stats.matches).toFixed(2) : '0.00'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

{/* Head-to-Head */}
{selectedPlayerData && (
  <div className="group relative border border-slate-700 bg-slate-900/40 p-3 sm:p-6 rounded-none 
                 transition-all duration-300 hover:border-cyan-400/70 
                 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
    {/* Animated bottom underline */}
    <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                     w-0 transition-all duration-500 group-hover:w-full" />
    <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">
      Head-to-Head Matchups
    </h2>

    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
        <thead className="bg-slate-800/50">
          <tr>
            <th className="px-2 py-2 text-left text-xs font-medium text-cyan-400 uppercase">Opponent</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-cyan-400 uppercase">TO</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-cyan-400 uppercase">Matches</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-cyan-400 uppercase">Wins</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-cyan-400 uppercase">Losses</th>
            <th className="px-2 py-2 text-center text-xs font-medium text-cyan-400 uppercase">Win Rate</th>
          </tr>
        </thead>
        <tbody className="bg-slate-950/50 divide-y divide-slate-800">
          {Object.values(
            selectedPlayerData.allMatches.reduce((rounds, match) => {
              const player = selectedPlayerData.name;
              const opponent =
                match.player1_name === player ? match.player2_name : match.player1_name;
              const key = [player, opponent, match.tournament_official].sort().join('_');

              if (!rounds[key]) {
                rounds[key] = {
                  opponent,
                  toName: match.tournament_official,
                  matches: 0,
                  wins: 0,
                  losses: 0,
                };
              }

              rounds[key].matches++;
              if (match.winner_name === player) {
                rounds[key].wins++;
              } else {
                rounds[key].losses++;
              }

              return rounds;
            }, {} as Record<string, any>)
          ).map((round: any, idx) => (
            <tr key={idx} className="hover:bg-slate-800/50">
              <td className="px-2 py-2 text-sm text-white">{round.opponent}</td>
              <td className="px-2 py-2 text-sm text-white text-center">{round.toName}</td>
              <td className="px-2 py-2 text-sm text-white text-center">{round.matches}</td>
              <td className="px-2 py-2 text-sm text-green-400 text-center">{round.wins}</td>
              <td className="px-2 py-2 text-sm text-red-400 text-center">{round.losses}</td>
              <td className="px-2 py-2 text-sm text-center">
                <span
                  className={
                    round.matches > 0 && (round.wins / round.matches) * 100 >= 50
                      ? 'text-green-400'
                      : 'text-red-400'
                  }
                >
                  {((round.wins / round.matches) * 100).toFixed(2)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}


      {/* Modals */}
      <ShowAllModal
        isOpen={showAllModal.isOpen}
        onClose={() => setShowAllModal(m => ({ ...m, isOpen: false }))}
        title={showAllModal.title}
        data={showAllModal.data}
        columns={showAllModal.columns}
        onRowClick={showAllModal.onRowClick}
      />

      <MatchDetailsModal
        isOpen={matchDetailsModal.isOpen}
        onClose={() => setMatchDetailsModal(m => ({ ...m, isOpen: false }))}
        title={matchDetailsModal.title}
        matches={matchDetailsModal.matches}
      />
    </div>
  );
}