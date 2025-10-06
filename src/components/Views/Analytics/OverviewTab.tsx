import React, { useState, useEffect } from 'react';
import { Trophy, Users, Target, TrendingUp, Crown, Search, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { BlockMath } from 'react-katex';
import { PersonalStats } from '../../Views/PersonalStats';

interface ShowAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  columns: { key: string; label: string }[];
  onRowClick?: (row: any) => void;
}

function ShowAllModal({ isOpen, onClose, title, data, columns, onRowClick }: ShowAllModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Helper to parse values (numbers, "56.25%", "1,234", or fallback to NaN)
  const parseValue = (val: any) => {
    if (val == null) return NaN;
    if (typeof val === 'number') return val;
    const s = String(val).replace(/[, ]+/g, '').replace('%', '');
    const n = Number(s);
    return isNaN(n) ? NaN : n;
  };

  // 1) Filtered data (search)
  const filteredData = React.useMemo(() => {
    if (!Array.isArray(data)) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(row =>
      columns.some(col =>
        String(row[col.key] ?? "").toLowerCase().includes(q)
      )
    );
  }, [data, columns, search]);

  // 2) Compute base rank (by weightedWinRate if present, falling back to original order).
  //    Attach _baseRank to each row so the Rank column shows this value.
  const baseRankedData = React.useMemo(() => {
    const key = 'weightedWinRate';
    // If no rows have weightedWinRate, just use the current filtered order as base rank
    const hasWeighted = filteredData.some(r => r[key] !== undefined && r[key] !== null && String(r[key]).length > 0);
    if (!hasWeighted) {
      return filteredData.map((r, i) => ({ ...r, _baseRank: i + 1 }));
    }
    // Sort a copy by numeric weightedWinRate (desc) to produce base ranks
    const arr = filteredData.map((r, i) => ({ __i: i, row: r }));
    arr.sort((A, B) => {
      const a = parseValue(A.row[key]);
      const b = parseValue(B.row[key]);
      if (!isNaN(a) && !isNaN(b)) return b - a; // desc
      return String(B.row[key] ?? '').localeCompare(String(A.row[key] ?? ''));
    });
    const rankMap = new Map<number, number>();
    arr.forEach((item, idx) => rankMap.set(item.__i, idx + 1));
    return filteredData.map((r, idx) => ({ ...r, _baseRank: rankMap.get(idx) ?? idx + 1 }));
  }, [filteredData]);

  // 3) Sorted data based on sortConfig. Handles numbers, percent-strings, and strings.
  const sortedData = React.useMemo(() => {
    const sortable = baseRankedData.map(r => ({ ...r })); // shallow copy
    if (!sortConfig) return sortable;

    sortable.sort((a, b) => {
      const key = sortConfig.key;

      // special-case "rank" -> use _baseRank
      if (key === 'rank') {
        const aR = a._baseRank ?? NaN;
        const bR = b._baseRank ?? NaN;
        if (!isNaN(aR) && !isNaN(bR)) {
          return sortConfig.direction === 'asc' ? aR - bR : bR - aR;
        }
        return 0;
      }

      const aRaw = a[key];
      const bRaw = b[key];

      const aNum = parseValue(aRaw);
      const bNum = parseValue(bRaw);

      // numeric compare (numbers or numeric-strings like "56.25%" or "1,234")
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // fallback string compare
      const aStr = String(aRaw ?? '');
      const bStr = String(bRaw ?? '');
      return sortConfig.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return sortable;
  }, [baseRankedData, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-950 border border-cyan-500/30 rounded-2xl shadow-[0_0_40px_rgba(0,200,255,0.3)] max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-4 toverciext-white">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">{title}</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* search */}
          <div className="mb-4">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search player..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* table */}
          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-900 sticky top-0">
                <tr>
                  {/* Rank (clickable) */}
                  <th
                    onClick={() => requestSort('rank')}
                    className="px-6 py-3 text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer select-none text-center"
                  >
                    Rank
                    {sortConfig?.key === 'rank' && <span className="ml-1">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                  </th>

                  {columns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => requestSort(col.key)}
                      className="px-6 py-3 text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer select-none text-center"
                    >
                      {col.label}
                      {sortConfig?.key === col.key && <span className="ml-1">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="bg-slate-950 divide-y divide-slate-800">
                {sortedData.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => onRowClick?.(row)}
                    className={`${(row.userId === user?.id || row.player === user?.username) ? 'bg-cyan-900/40 border-l-4 border-cyan-400' : 'hover:bg-slate-800/50'} ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {/* Show base rank so Rank column always shows weighted ranking */}
                    <td className="px-6 py-4 text-sm font-bold text-cyan-400 text-center">
                      {row._baseRank ?? (idx + 1)}
                    </td>

                    {columns.map(col => (
                      <td
                        key={col.key}
                        className={`px-6 py-4 whitespace-nowrap text-sm text-center ${
                          col.key === 'player'
                            ? 'text-cyan-400 hover:text-cyan-300 cursor-pointer underline'
                            : 'text-white'
                        }`}
                        onClick={() => {
                          if (col.key === 'player') {
                            localStorage.setItem("targetPlayer", row[col.key]);
                            const navEvent = new CustomEvent("navigateToPersonalStats");
                            window.dispatchEvent(navEvent);
                          } else {
                            onRowClick?.(row);
                          }
                        }}
                      >
                        {typeof row[col.key] === 'number' ? row[col.key] : String(row[col.key] ?? '')}
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

interface GlobalStats {
  totalMatches: number;
  totalPlayers: number;
  totalTournaments: number;
  avgPointsPerMatch: number;
  mostCommonFinish: string;
  topPlayer: string;
  topPlayerWinRate: number;
}

interface FinishKing {
  player: string;
  points: number;
}

interface GimmickAward {
  bestXSidePlayer: { player: string; winRate: number; weightedWinRate: number; points: number; matches: number };
  bestXSideByPoints: { player: string; winRate: number; weightedWinRate: number; points: number; matches: number };
  bestBSidePlayer: { player: string; winRate: number; weightedWinRate: number; points: number; matches: number };
  bestBSideByPoints: { player: string; winRate: number; weightedWinRate: number; points: number; matches: number };
  hotshotKing: { player: string; hotshots: number };
  longestWinStreak: { player: string; streak: number };
  allXSidePlayers: { player: string; winRate: number; weightedWinRate: number; points: number; matches: number }[];
  allBSidePlayers: { player: string; winRate: number; weightedWinRate: number; points: number; matches: number }[];
  allHotshots: { player: string; hotshots: number }[];
  allStreaks: { player: string; streak: number }[];
}

interface GlobalCombo {
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
  bladeLine: string;
}

interface PersonalOverview {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  weightedWinRate: number;
  totalPoints: number;
  avgPointsPerMatch: number;
  mvpCombo: string;
  mvpComboScore: number;
  favoriteFinish: string;
  tournamentsPlayed: number;
}

const FINISH_POINTS = {
  'Spin Finish': 1,
  'Burst Finish': 2,
  'Over Finish': 2,
  'Extreme Finish': 3
};

const FINISH_COLORS = {
  'Spin Finish': '#10B981',
  'Burst Finish': '#F59E0B',
  'Over Finish': '#EF4444',
  'Extreme Finish': '#8B5CF6'
};

export function OverviewTab({ onViewChange }: { onViewChange: (view: string) => void }) {
  const { user } = useAuth();
  const [personalOverview, setPersonalOverview] = useState<PersonalOverview | null>(null);
  const [showAllModal, setShowAllModal] = useState<{
    isOpen: boolean;
    title: string;
    data: any[];
    columns: { key: string; label: string }[];
    onRowClick?: (row: any) => void;
  }>({
    isOpen: false,
    title: '',
    data: [],
    columns: []
  });
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalMatches: 0,
    totalPlayers: 0,
    totalTournaments: 0,
    avgPointsPerMatch: 0,
    mostCommonFinish: '',
    topPlayer: '',
    topPlayerWinRate: 0
  });
  
  const [globalCombos, setGlobalCombos] = useState<GlobalCombo[]>([]);
  const [showPersonalStats, setShowPersonalStats] = useState(false);
  const [finishDistribution, setFinishDistribution] = useState<any[]>([]);
  const [playerStats, setPlayerStats] = useState<{ [name: string]: { wins: number; matches: number; points: number; tournaments: Set<string>; userId?: string } }>({});
  const [loading, setLoading] = useState(true);
  const [showWeightedInfo, setShowWeightedInfo] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [baseConstant, setBaseConstant] = useState(10);
  const [avgMatchesPerTournament, setAvgMatchesPerTournament] = useState(0);
  const [avgMatchesPerPlayer, setAvgMatchesPerPlayer] = useState(0);
  const [finishKings, setFinishKings] = useState<{
    spinFinish: FinishKing;
    burstFinish: FinishKing;
    overFinish: FinishKing;
    extremeFinish: FinishKing;
    allSpinFinish: FinishKing[];
    allBurstFinish: FinishKing[];
    allOverFinish: FinishKing[];
    allExtremeFinish: FinishKing[];
  }>({
    spinFinish: { player: 'N/A', points: 0 },
    burstFinish: { player: 'N/A', points: 0 },
    overFinish: { player: 'N/A', points: 0 },
    extremeFinish: { player: 'N/A', points: 0 },
    allSpinFinish: [],
    allBurstFinish: [],
    allOverFinish: [],
    allExtremeFinish: []
  });
  const [gimmickAwards, setGimmickAwards] = useState<GimmickAward>({
    bestXSidePlayer: { player: 'N/A', winRate: 0, weightedWinRate: 0, points: 0, matches: 0 },
    bestXSideByPoints: { player: 'N/A', winRate: 0, weightedWinRate: 0, points: 0, matches: 0 },
    bestBSidePlayer: { player: 'N/A', winRate: 0, weightedWinRate: 0, points: 0, matches: 0 },
    bestBSideByPoints: { player: 'N/A', winRate: 0, weightedWinRate: 0, points: 0, matches: 0 },
    hotshotKing: { player: 'N/A', hotshots: 0 },
    longestWinStreak: { player: 'N/A', streak: 0 },
    allXSidePlayers: [],
    allBSidePlayers: [],
    allHotshots: [],
    allStreaks: []
  });

  const saveBaseConstant = async (newValue: number) => {
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "baseConstant", value: String(newValue) });
  
    if (!error) {
      setBaseConstant(newValue);
      alert(`✅ Base Constant saved system-wide: ${newValue}`);
    } else {
      console.error("Error saving baseConstant:", error);
    }
  };

  useEffect(() => {
    const fetchBaseConstant = async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "baseConstant")
        .single();
  
      if (!error && data) {
        setBaseConstant(Number(data.value));
      }
    };
  
    fetchBaseConstant();
  }, []);

  useEffect(() => {
    fetchGlobalData();
    if (user && !user.id.startsWith('guest-')) {
      fetchPersonalData();
    }
  }, [user]);

  // ✅ Helper to fetch ALL matches (handles Supabase 1000 row limit)
  const fetchAllMatches = async () => {
    let from = 0;
    const size = 1000;
    let allMatches: any[] = [];
  
    while (true) {
      const { data, error } = await supabase
        .from("match_results")
        .select(`
          *,
          tournaments!inner(tournament_type)
        `)
        .range(from, from + size - 1);
  
      if (error) throw error;
      if (!data || data.length === 0) break;
  
      allMatches = allMatches.concat(data);
      if (data.length < size) break;
      from += size;
    }
  
    return allMatches;
  };

  
  const fetchGlobalData = async () => {
    try {
      // Fetch all matches across all tournaments
      const allMatches = await fetchAllMatches();

      // Filter out practice tournament matches
      const matches = (allMatches || []).filter(match => 
        match.tournaments?.tournament_type === "ranked"
      );
      
      if (matches.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate global stats
      const playerStatsMap: { 
        [name: string]: { 
          wins: number; 
          matches: number; 
          points: number; 
          tournaments: Set<string>; 
          userId?: string;
        } 
      } = {};

      const comboStats: { [key: string]: GlobalCombo } = {};
      const finishCounts: { [finish: string]: number } = {};
      let totalPoints = 0;

      matches.forEach(match => {
        if (!match.winner_name || !match.player1_name || !match.player2_name) return;

        const outcome = match.outcome?.split(' (')[0] || 'Unknown';
        const points = match.points_awarded || FINISH_POINTS[outcome as keyof typeof FINISH_POINTS] || 0;
        totalPoints += points;

        // Count finishes
        finishCounts[outcome] = (finishCounts[outcome] || 0) + 1;

        // Process both players
        const normalizedPlayer1 = match.normalized_player1_name || match.player1_name.toLowerCase();
        const normalizedPlayer2 = match.normalized_player2_name || match.player2_name.toLowerCase();
        const normalizedWinner = match.normalized_winner_name || match.winner_name.toLowerCase();
        
        // Use normalized names for consistent tracking, but display names for UI
        const players = [
          { normalized: normalizedPlayer1, display: match.player1_name, userId: match.player1_user_id || null },
          { normalized: normalizedPlayer2, display: match.player2_name, userId: match.player2_user_id || null }
        ];
        
        players.forEach(({ normalized, display, userId }) => {
          // Use display name as key for UI consistency
          const playerKey = display;
          
          if (!playerStatsMap[playerKey]) {
            playerStatsMap[playerKey] = { wins: 0, matches: 0, points: 0, tournaments: new Set(), userId: userId ?? undefined };
          }
        
          playerStatsMap[playerKey].matches++;
          playerStatsMap[playerKey].tournaments.add(match.tournament_id);
        
          if (normalizedWinner === normalized) {
            playerStatsMap[playerKey].wins++;
            playerStatsMap[playerKey].points += points;
          }
        });

        // Process combos
        const processCombo = (player: string, beyblade: string, bladeLine: string, isWin: boolean) => {
          const comboKey = `${beyblade}_${player}`;
          
          if (!comboStats[comboKey]) {
            comboStats[comboKey] = {
              combo: beyblade,
              player,
              wins: 0,
              losses: 0,
              totalMatches: 0,
              winRate: 0,
              weightedWinRate: 0,
              totalPoints: 0,
              avgPointsPerMatch: 0,
              comboScore: 0,
              bladeLine: bladeLine || 'Unknown'
            };
          }

          const combo = comboStats[comboKey];
          combo.totalMatches++;
          
          if (isWin) {
            combo.wins++;
            combo.totalPoints += points;
          } else {
            combo.losses++;
          }
        };

        processCombo(match.player1_name, match.player1_beyblade, match.player1_blade_line || 'Unknown', match.winner_name === match.player1_name);
        processCombo(match.player2_name, match.player2_beyblade, match.player2_blade_line || 'Unknown', match.winner_name === match.player2_name);
      });

      // Calculate combo scores
      Object.values(comboStats).forEach(combo => {
        combo.winRate = combo.totalMatches > 0 ? (combo.wins / combo.totalMatches) * 100 : 0;
        combo.weightedWinRate = combo.totalMatches > 0 ? (combo.wins / combo.totalMatches) * (combo.totalMatches / (combo.totalMatches + baseConstant)) * 100 : 0;
        combo.avgPointsPerMatch = combo.totalMatches > 0 ? combo.totalPoints / combo.totalMatches : 0;
        combo.comboScore = combo.weightedWinRate * (combo.avgPointsPerMatch / 3) * 100;
      });

      // Find top player
      const topPlayerEntry = Object.entries(playerStatsMap)
        .filter(([_, stats]) => stats.matches >= 5) // Minimum matches for consideration
        .sort((a, b) => {
          const aWinRate = a[1].wins / a[1].matches;
          const bWinRate = b[1].wins / b[1].matches;
          return bWinRate - aWinRate;
        })[0];

      const mostCommonFinish = Object.entries(finishCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

      // Get tournament count
      const { count: tournamentCount } = await supabase
        .from('tournaments')
        .select('*', { count: 'exact', head: true });

      setGlobalStats({
        totalMatches: matches.length,
        totalPlayers: Object.keys(playerStatsMap).length,
        totalTournaments: tournamentCount || 0,
        avgPointsPerMatch: matches.length > 0 ? totalPoints / matches.length : 0,
        mostCommonFinish,
        topPlayer: topPlayerEntry?.[0] || 'N/A',
        topPlayerWinRate: topPlayerEntry ? (topPlayerEntry[1].wins / topPlayerEntry[1].matches) * 100 : 0
      });

      // Compute developer metrics
      const avgMatchesPerTournament = (matches.length > 0 && (tournamentCount || 0) > 0)
        ? matches.length / (tournamentCount || 1)
        : 0;
      
      const avgMatchesPerPlayer = (matches.length > 0 && Object.keys(playerStatsMap).length > 0)
        ? matches.length / Object.keys(playerStatsMap).length
        : 0;
      
      setAvgMatchesPerTournament(avgMatchesPerTournament);
      setAvgMatchesPerPlayer(avgMatchesPerPlayer);

      setGlobalCombos(Object.values(comboStats).sort((a, b) => b.weightedWinRate - a.weightedWinRate));

      // Store player stats for global rankings
      setPlayerStats(playerStatsMap);

      // Calculate Finish Kings
      const finishPoints: { [finishType: string]: { [player: string]: number } } = {
        'Spin Finish': {},
        'Burst Finish': {},
        'Over Finish': {},
        'Extreme Finish': {}
      };

      matches.forEach(match => {
        if (!match.winner_name) return;
        const outcome = match.outcome?.split(' (')[0] || 'Unknown';
        const points = match.points_awarded || FINISH_POINTS[outcome as keyof typeof FINISH_POINTS] || 0;

        if (finishPoints[outcome]) {
          const winner = match.winner_name;
          finishPoints[outcome][winner] = (finishPoints[outcome][winner] || 0) + points;
        }
      });

      const getTopPlayer = (finishType: string) => {
        const players = finishPoints[finishType];
        const topEntry = Object.entries(players).sort((a, b) => b[1] - a[1])[0];
        return topEntry ? { player: topEntry[0], points: topEntry[1] } : { player: 'N/A', points: 0 };
      };

      const getAllPlayers = (finishType: string) => {
        const players = finishPoints[finishType];
        return Object.entries(players)
          .map(([player, points]) => ({ player, points }))
          .sort((a, b) => b.points - a.points);
      };

      setFinishKings({
        spinFinish: getTopPlayer('Spin Finish'),
        burstFinish: getTopPlayer('Burst Finish'),
        overFinish: getTopPlayer('Over Finish'),
        extremeFinish: getTopPlayer('Extreme Finish'),
        allSpinFinish: getAllPlayers('Spin Finish'),
        allBurstFinish: getAllPlayers('Burst Finish'),
        allOverFinish: getAllPlayers('Over Finish'),
        allExtremeFinish: getAllPlayers('Extreme Finish')
      });

// 🏆 Calculate Gimmick Awards (now based purely on total wins)
const sideStats: { [player: string]: { xWins: number; xMatches: number; xPoints: number; bWins: number; bMatches: number; bPoints: number } } = {};
const streaks: { [player: string]: number } = {};
const currentStreaks: { [player: string]: number } = {};
const hotshots: { [player: string]: number } = {};
const playerLastFinish: { [player: string]: string } = {};

matches.forEach(match => {
  if (!match.winner_name || !match.player1_name || !match.player2_name) return;

  const normalizedWinner = match.normalized_winner_name || match.winner_name.toLowerCase();
  const normalizedPlayer1 = match.normalized_player1_name || match.player1_name.toLowerCase();
  const normalizedPlayer2 = match.normalized_player2_name || match.player2_name.toLowerCase();
  const outcome = match.outcome?.split(' (')[0] || 'Unknown';
  const points = match.points_awarded || FINISH_POINTS[outcome as keyof typeof FINISH_POINTS] || 0;

  // ✅ Process both players for side stats (skip if no side info available)
  [
    {
      normalized: normalizedPlayer1,
      display: match.player1_name,
      side:
        match.x_side_player === match.player1_name
          ? "x"
          : match.b_side_player === match.player1_name
          ? "b"
          : null
    },
    {
      normalized: normalizedPlayer2,
      display: match.player2_name,
      side:
        match.x_side_player === match.player2_name
          ? "x"
          : match.b_side_player === match.player2_name
          ? "b"
          : null
    }
  ].forEach(({ normalized, display, side }) => {
    if (!side) return; // 🚀 skip if match has no side data

    if (!sideStats[display]) {
      sideStats[display] = {
        xWins: 0,
        xMatches: 0,
        xPoints: 0,
        bWins: 0,
        bMatches: 0,
        bPoints: 0
      };
    }

    if (side === "x") {
      sideStats[display].xMatches++;
      if (normalizedWinner === normalized) {
        sideStats[display].xWins++;
        sideStats[display].xPoints += points;
      }
    }

    if (side === "b") {
      sideStats[display].bMatches++;
      if (normalizedWinner === normalized) {
        sideStats[display].bWins++;
        sideStats[display].bPoints += points;
      }
    }
  });

  // Track win streaks
  const winner = match.winner_name;
  const loser = winner === match.player1_name ? match.player2_name : match.player1_name;

  currentStreaks[winner] = (currentStreaks[winner] || 0) + 1;
  streaks[winner] = Math.max(streaks[winner] || 0, currentStreaks[winner]);
  currentStreaks[loser] = 0;

  // Track HOTSHOTs (2 Extreme Finishes in a row)
  if (outcome === 'Extreme Finish') {
    if (playerLastFinish[winner] === 'Extreme Finish') {
      hotshots[winner] = (hotshots[winner] || 0) + 1;
    }
    playerLastFinish[winner] = 'Extreme Finish';
  } else {
    playerLastFinish[winner] = outcome;
  }
});

// ✅ Now based purely on total wins (not weighted win rate)
const xSidePlayers = Object.entries(sideStats)
  .filter(([_, stats]) => stats.xMatches >= 5)
  .map(([player, stats]) => ({
    player,
    wins: stats.xWins,
    points: stats.xPoints,
    matches: stats.xMatches
  }))
  .sort((a, b) => b.wins - a.wins);

const bestXSideByWins = xSidePlayers[0] || { player: 'N/A', wins: 0, points: 0, matches: 0 };
const bestXSideByPoints = [...xSidePlayers].sort((a, b) => b.points - a.points)[0] || bestXSideByWins;

const bSidePlayers = Object.entries(sideStats)
  .filter(([_, stats]) => stats.bMatches >= 5)
  .map(([player, stats]) => ({
    player,
    wins: stats.bWins,
    points: stats.bPoints,
    matches: stats.bMatches
  }))
  .sort((a, b) => b.wins - a.wins);

const bestBSideByWins = bSidePlayers[0] || { player: 'N/A', wins: 0, points: 0, matches: 0 };
const bestBSideByPoints = [...bSidePlayers].sort((a, b) => b.points - a.points)[0] || bestBSideByWins;

// Find HOTSHOT King
const hotshotKing = Object.entries(hotshots)
  .sort((a, b) => b[1] - a[1])[0];

// Find longest win streak
const longestStreak = Object.entries(streaks)
  .sort((a, b) => b[1] - a[1])[0];

// Prepare all hotshots and streaks for modals
const allHotshotsArray = Object.entries(hotshots)
  .map(([player, count]) => ({ player, hotshots: count }))
  .sort((a, b) => b.hotshots - a.hotshots);

const allStreaksArray = Object.entries(streaks)
  .map(([player, count]) => ({ player, streak: count }))
  .sort((a, b) => b.streak - a.streak);

setGimmickAwards({
  bestXSidePlayer: bestXSideByWins,
  bestXSideByPoints: bestXSideByPoints,
  bestBSidePlayer: bestBSideByWins,
  bestBSideByPoints: bestBSideByPoints,
  hotshotKing: hotshotKing ? { player: hotshotKing[0], hotshots: hotshotKing[1] } : { player: 'N/A', hotshots: 0 },
  longestWinStreak: longestStreak ? { player: longestStreak[0], streak: longestStreak[1] } : { player: 'N/A', streak: 0 },
  allXSidePlayers: xSidePlayers,
  allBSidePlayers: bSidePlayers,
  allHotshots: allHotshotsArray,
  allStreaks: allStreaksArray
});


      // Prepare finish distribution for chart
      const finishData = Object.entries(finishCounts).map(([finish, count]) => ({
        name: finish,
        value: count,
        color: FINISH_COLORS[finish as keyof typeof FINISH_COLORS] || '#6B7280'
      }));
      setFinishDistribution(finishData);

    } catch (error) {
      console.error('Error fetching global data:', error);
    } finally {
      setLoading(false);
    }
  };
  const fetchPersonalData = async () => {
    if (!user || user.id.startsWith('guest-')) return;

    try {
      // Fetch user's matches across all tournaments
      let { data: userMatches, error } = await supabase
        .from('match_results')
        .select(`
          *,
          tournaments!inner(tournament_type)
        `)
        .or(`player1_name.ilike.${user.username},player2_name.ilike.${user.username},normalized_player1_name.eq.${user.username.toLowerCase()},normalized_player2_name.eq.${user.username.toLowerCase()}`);

      if (error) throw error;

      // Filter out practice tournament matches
      const matches = (userMatches || []).filter(match => 
        !match.tournaments?.is_practice
      );
      
      if (matches.length === 0) {
        setPersonalOverview(null);
        return;
      }

      let wins = 0;
      let totalPoints = 0;
      const comboStats: { [combo: string]: { wins: number; matches: number; points: number } } = {};
      const finishCounts: { [finish: string]: number } = {};
      const tournamentsSet = new Set<string>();

      matches.forEach(match => {
        if (!match.winner_name) return;

        // Check both display name and normalized name for matches
        const normalizedUsername = user.username.toLowerCase();
        const isPlayer1 = match.player1_name === user.username || 
                          match.normalized_player1_name === normalizedUsername;
        const isPlayer2 = match.player2_name === user.username || 
                          match.normalized_player2_name === normalizedUsername;
        const isWinner = match.winner_name === user.username || 
                         match.normalized_winner_name === normalizedUsername;
        
        // Skip if this user is not involved in the match
        if (!isPlayer1 && !isPlayer2) return;
        
        const userBeyblade = isPlayer1 ? match.player1_beyblade : match.player2_beyblade;
        const opponent = isPlayer1 ? match.player2_name : match.player1_name;
        const outcome = match.outcome?.split(' (')[0] || 'Unknown';
        const points = match.points_awarded || FINISH_POINTS[outcome as keyof typeof FINISH_POINTS] || 0;

        tournamentsSet.add(match.tournament_id);

        if (isWinner) {
          wins++;
          totalPoints += points;
          finishCounts[outcome] = (finishCounts[outcome] || 0) + 1;
        }

        // Track combo performance
        if (!comboStats[userBeyblade]) {
          comboStats[userBeyblade] = { wins: 0, matches: 0, points: 0 };
        }
        comboStats[userBeyblade].matches++;
        if (isWinner) {
          comboStats[userBeyblade].wins++;
          comboStats[userBeyblade].points += points;
        }
      });

      // Find MVP combo
      const mvpComboEntry = Object.entries(comboStats)
        .map(([combo, stats]) => {
          const winRate = stats.matches > 0 ? stats.wins / stats.matches : 0;
          const weightedWinRate = stats.matches > 0 ? winRate * (stats.matches / (stats.matches + baseConstant)) : 0;
          const avgPoints = stats.matches > 0 ? stats.points / stats.matches : 0;
          const comboScore = weightedWinRate * (avgPoints / 3) * 100;
          return { combo, comboScore };
        })
        .sort((a, b) => b.comboScore - a.comboScore)[0];

      const favoriteFinish = Object.entries(finishCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      const totalMatches = matches.length;
      const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;
      const weightedWinRate = totalMatches > 0 ? (wins / totalMatches) * (totalMatches / (totalMatches + baseConstant)) : 0;

      setPersonalOverview({
        totalMatches,
        wins,
        losses: totalMatches - wins,
        winRate,
        weightedWinRate: weightedWinRate * 100,
        totalPoints,
        avgPointsPerMatch: totalMatches > 0 ? totalPoints / totalMatches : 0,
        mvpCombo: mvpComboEntry?.combo || 'N/A',
        mvpComboScore: mvpComboEntry?.comboScore || 0,
        favoriteFinish,
        tournamentsPlayed: tournamentsSet.size
      });

    } catch (error) {
      console.error('Error fetching personal data:', error);
    }
  };

  const topRankedPlayer = React.useMemo(() => {
    const players = Object.entries(playerStats).map(([name, stats]) => {
      const winRate = stats.matches > 0 ? (stats.wins / stats.matches) * 100 : 0;
      const weightedWinRate =
        stats.matches > 0
          ? (stats.wins / stats.matches) * (stats.matches / (stats.matches + baseConstant)) * 100
          : 0;

      return {
        name,
        matches: stats.matches,
        wins: stats.wins,
        tournaments: stats.tournaments.size,
        points: stats.points,
        winRate,
        weightedWinRate,
      };
    });

    return players.sort((a, b) => b.weightedWinRate - a.weightedWinRate)[0] || null;
  }, [playerStats]);
  
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading overview data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
{/* Global Champion Card - Hero Aura Edition */}
<div className="relative group overflow-hidden rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-900/10 via-amber-800/10 to-orange-900/20 p-8 backdrop-blur-md
                 transition-all duration-500 hover:border-yellow-400/60 hover:shadow-[0_0_60px_rgba(250,204,21,0.4)]">

  {/* Animated aura glow */}
  <div className="absolute inset-0 opacity-25 bg-[conic-gradient(from_0deg,rgba(250,204,21,0.25),rgba(255,161,22,0.25),rgba(251,191,36,0.25))] blur-3xl animate-spin-slow"></div>

  <div className="relative flex flex-col md:flex-row items-center gap-8 z-10">
    {/* Left Icon */}
    <div className="relative">
      <div className="w-32 h-32 rounded-full flex items-center justify-center bg-gradient-to-br from-yellow-400 via-orange-400 to-amber-500
                      shadow-[0_0_70px_rgba(251,191,36,0.6)] animate-pulse-slow">
        <Trophy size={64} className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
      </div>
      <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-gradient-to-tr from-yellow-300 to-amber-400
                      flex items-center justify-center shadow-[0_0_25px_rgba(251,191,36,0.6)] ring-2 ring-yellow-500/40">
        <Crown size={24} className="text-black" />
      </div>
    </div>

    {/* Right Info */}
    <div className="flex-1 text-center md:text-left space-y-4">
      <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400 tracking-wide">
        Global Champion
      </h2>
      <p className="text-5xl font-extrabold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
        {topRankedPlayer?.name || "N/A"}
      </p>

      {/* Unified Stat Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
        {[
          { label: "Win Rate", value: `${topRankedPlayer?.winRate.toFixed(2)}%` },
          { label: "Wins", value: topRankedPlayer?.wins ?? 0 },
          { label: "Matches", value: topRankedPlayer?.matches ?? 0 },
          { label: "Points", value: topRankedPlayer?.points ?? 0 },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={`relative rounded-xl p-4 backdrop-blur-sm transition-all duration-500 
                        bg-gradient-to-b from-transparent to-yellow-400/5 
                        hover:to-yellow-400/10
                        before:absolute before:inset-0 before:bg-gradient-to-b before:from-yellow-300/10 before:to-transparent before:opacity-0 
                        hover:before:opacity-100 hover:before:blur-md hover:before:scale-105
                        shadow-[inset_0_0_20px_rgba(251,191,36,0.15)] hover:shadow-[0_0_25px_rgba(251,191,36,0.25)]`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="text-3xl font-extrabold text-yellow-300 tracking-wide drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]">
              {stat.value}
            </div>
            <div className="text-sm text-yellow-200/80">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
</div>



      {/* Main Layout with Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-3 space-y-6">

{/* Render PersonalStats when button is clicked */}
{showPersonalStats && <PersonalStats />}


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Global Finish Distribution */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] backdrop-blur-sm">
          {/* Animated bottom underline */}
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          <h3 className="text-lg font-bold text-white mb-4">Global Finish Distribution</h3>
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
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Global Combos */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] backdrop-blur-sm">
          {/* Animated bottom underline */}
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          <h3 className="text-lg font-bold text-white mb-4">Top Global Combos by Score</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart 
              data={globalCombos.slice(0, 8).map(combo => ({
                name: combo.combo,
                score: combo.comboScore,
                winRate: combo.winRate,
                matches: combo.totalMatches
              }))}
              margin={{ bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                fontSize={10}
                stroke="#94a3b8"
              />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                formatter={(value, name) => [
                  typeof value === 'number' ? value.toFixed(2) : value,
                  name === 'score' ? 'Combo Score' : name === 'winRate' ? 'Win Rate (%)' : 'Matches'
                ]}
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '8px' }}
                labelStyle={{ color: '#06b6d4' }}
              />
              <Bar dataKey="score" fill="#06b6d4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                      transition-all duration-300 hover:border-cyan-400/70 
                      hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] backdrop-blur-sm mt-8">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Global Player Rankings</h3>

          {/* Show All Players button moved to top-right */}
          <div className="ml-4">
            <button
              onClick={() =>
                setShowAllModal({
                  isOpen: true,
                  title: "All Global Player Rankings",
                  data: Object.entries(playerStats).map(([name, stats]) => {
                    const winRate = stats.matches > 0 ? (stats.wins / stats.matches) * 100 : 0;
                    const weightedWinRate = stats.matches > 0
                      ? (stats.wins / stats.matches) * (stats.matches / (stats.matches + baseConstant)) * 100
                      : 0;
                    return {
                      player: name,
                      matches: stats.matches,
                      wins: stats.wins,   // 👈 add this line
                      tournaments: stats.tournaments.size,
                      points: stats.points,
                      winRate: winRate.toFixed(2) + "%",
                      weightedWinRate: weightedWinRate.toFixed(2) + "%",
                      userId: stats.userId ?? null,
                    };
                  }),
                  columns: [
                    { key: "player", label: "Player" },
                    { key: "matches", label: "Matches" },
                    { key: "wins", label: "Wins" },
                    { key: "tournaments", label: "Tourns" },
                    { key: "winRate", label: "WR%" },
                    { key: "weightedWinRate", label: "Weighted WR" },
                    { key: "points", label: "Points" },
                  ],
                })
              }
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-md transition"
            >
              Show All Players
            </button>
          </div>
        </div>
      
        <div>
          {/* Top 10 Table (kept and now considered "proper" table with weighted WR) */}
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">Player</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Matches</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Wins</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Tourns</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase">WR%</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase relative">
                      Weighted WR
                      <span className="ml-1 inline-block">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowWeightedInfo((prev) => !prev);
                          }}
                          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-cyan-600 text-white text-[10px] font-bold focus:outline-none"
                        >
                          ?
                        </button>
                    
                        {showWeightedInfo && (
                          <div className="absolute bg-slate-900 text-white text-xs rounded-lg p-3 w-72 -left-32 top-8 shadow-lg border border-cyan-500/30 z-50">
                            <div className="mb-2 text-cyan-300 font-semibold">Weighted Win Rate</div>
                    
                            {/* Formula */}
                            <div className="flex justify-center items-center text-white text-sm font-mono">
                              <span className="mr-2">WWR =</span>
                    
                              {/* First Fraction */}
                              <span className="inline-block mx-1 text-center">
                                <div className="border-b border-white px-1">Wins</div>
                                <div className="px-1">Matches</div>
                              </span>
                    
                              <span className="mx-1">×</span>
                    
                              {/* Second Fraction */}
                              <span className="inline-block mx-1 text-center">
                                <div className="border-b border-white px-1">Matches</div>
                                <div className="px-1">Matches + Constant</div>
                              </span>
                            </div>
                    
                            <p className="mt-3 text-gray-300 text-[11px] leading-snug">
                              This formula lowers inflated win rates for players with very few matches. The constant is the global average matches per player
                            </p>
                          </div>
                        )}
                      </span>
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Points</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                  {Object.entries(playerStats)
                    .map(([name, stats]) => {
                      const winRate = stats.matches > 0 ? (stats.wins / stats.matches) * 100 : 0;
                      const weightedWinRate = stats.matches > 0 
                        ? (stats.wins / stats.matches) * (stats.matches / (stats.matches + baseConstant)) * 100
                        : 0;
                      return {
                        name,
                        matches: stats.matches,
                        wins: stats.wins, // ✅ add this line
                        tournaments: stats.tournaments.size,
                        points: stats.points,
                        winRate,
                        weightedWinRate
                      };
                    })
                    .sort((a, b) => b.weightedWinRate - a.weightedWinRate)
                    .slice(0, 10)
                    .map((player, index) => (
                      <tr key={player.name} className="hover:bg-slate-800/50">
                        <td className="px-6 py-4 text-sm font-medium text-white flex items-center space-x-2">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <span
                            className="text-cyan-400 hover:text-cyan-300 cursor-pointer underline"
                            onClick={() => {
                              localStorage.setItem("targetPlayer", player.name);
                              const navEvent = new CustomEvent("navigateToPersonalStats");
                              window.dispatchEvent(navEvent);
                            }}
                          >
                            {player.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-white">{player.matches}</td>
                        <td className="px-6 py-4 text-center text-white">{player.wins}</td>
                        <td className="px-6 py-4 text-center text-white">{player.tournaments}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`font-medium ${
                            player.winRate >= 60 ? 'text-green-400' :
                            player.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {player.winRate.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-cyan-400 font-bold">
                          {player.weightedWinRate.toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 text-center text-white">{player.points}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Global Combo Rankings Table */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] backdrop-blur-sm">
        {/* Animated bottom underline */}
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Global Combo Rankings</h3>

          {/* Show All Combos button (top-right) */}
          <div>
            <button
              onClick={() => {
                // Build aggregated combo data for modal, including weighted WR
                const comboGroups: { [comboName: string]: {
                  combo: string;
                  players: string[];
                  totalMatches: number;
                  totalWins: number;
                  totalPoints: number;
                  playerData: any[];
                  weightedWinRate: number;
                  winRate: number;
                  avgPoints: number;
                }} = {};
                
                globalCombos.forEach(combo => {
                  if (!comboGroups[combo.combo]) {
                    comboGroups[combo.combo] = {
                      combo: combo.combo,
                      players: [],
                      totalMatches: 0,
                      totalWins: 0,
                      totalPoints: 0,
                      playerData: [],
                      weightedWinRate: 0,
                      winRate: 0,
                      avgPoints: 0
                    };
                  }
                  
                  const group = comboGroups[combo.combo];
                  group.players.push(combo.player);
                  group.totalMatches += combo.totalMatches;
                  group.totalWins += combo.wins;
                  group.totalPoints += combo.totalPoints;
                  group.playerData.push(combo);
                });

                // Compute weighted values per group
                Object.values(comboGroups).forEach(group => {
                  group.winRate = group.totalMatches > 0 ? (group.totalWins / group.totalMatches) * 100 : 0;
                  group.weightedWinRate = group.totalMatches > 0 ? (group.totalWins / group.totalMatches) * (group.totalMatches / (group.totalMatches + baseConstant)) * 100 : 0;
                  group.avgPoints = group.totalMatches > 0 ? group.totalPoints / group.totalMatches : 0;
                });

                const modalData = Object.values(comboGroups)
                  .sort((a, b) => b.weightedWinRate - a.weightedWinRate)
                  .map(g => ({
                    combo: g.combo,
                    users: g.players.length,
                    totalMatches: g.totalMatches,
                    winRate: g.winRate.toFixed(2) + '%',
                    weightedWinRate: g.weightedWinRate.toFixed(2) + '%',
                    avgPoints: g.avgPoints.toFixed(2)
                  }));

                setShowAllModal({
                  isOpen: true,
                  title: "All Global Combo Rankings",
                  data: modalData,
                  columns: [
                    { key: 'combo', label: 'Combo' },
                    { key: 'users', label: 'Users' },
                    { key: 'totalMatches', label: 'Matches' },
                    { key: 'winRate', label: 'Win Rate' },
                    { key: 'weightedWinRate', label: 'Weighted WR' },
                    { key: 'avgPoints', label: 'Avg Points' }
                  ]
                });
              }}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-md transition"
            >
              Show All Combos
            </button>
          </div>
        </div>
        {/* Group combos by name and calculate aggregate stats */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">
                  Combo
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">
                  Users
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">
                  Total Matches
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">
                  Weighted WR
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">
                  Avg Points
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700/50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-950/50 divide-y divide-slate-800">
              {(() => {
                // Group combos by name and calculate aggregate stats
                const comboGroups: { [comboName: string]: {
                  combo: string;
                  players: string[];
                  totalMatches: number;
                  totalWins: number;
                  totalPoints: number;
                  winRate: number;
                  weightedWinRate: number;
                  avgPoints: number;
                  playerData: any[];
                }} = {};
                
                globalCombos.forEach(combo => {
                  if (!comboGroups[combo.combo]) {
                    comboGroups[combo.combo] = {
                      combo: combo.combo,
                      players: [],
                      totalMatches: 0,
                      totalWins: 0,
                      totalPoints: 0,
                      winRate: 0,
                      weightedWinRate: 0,
                      avgPoints: 0,
                      playerData: []
                    };
                  }
                  
                  const group = comboGroups[combo.combo];
                  group.players.push(combo.player);
                  group.totalMatches += combo.totalMatches;
                  group.totalWins += combo.wins;
                  group.totalPoints += combo.totalPoints;
                  group.playerData.push(combo);
                });
                
                // Calculate final stats for each group (including weighted WR)
                Object.values(comboGroups).forEach(group => {
                  group.winRate = group.totalMatches > 0 ? (group.totalWins / group.totalMatches) * 100 : 0;
                  group.weightedWinRate = group.totalMatches > 0 ? (group.totalWins / group.totalMatches) * (group.totalMatches / (group.totalMatches + baseConstant)) * 100 : 0;
                  group.avgPoints = group.totalMatches > 0 ? group.totalPoints / group.totalMatches : 0;
                });
                
                return Object.values(comboGroups)
                  .sort((a, b) => b.weightedWinRate - a.weightedWinRate)
                  .slice(0, 10);
              })().map((comboGroup, index) => (
                <tr key={index} className="hover:bg-slate-800/50 cursor-pointer">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">
                    #{index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {comboGroup.combo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-center">
                    {comboGroup.players.length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-center">
                    {comboGroup.totalMatches}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span className={`font-medium ${
                      comboGroup.weightedWinRate >= 60 ? 'text-green-400' :
                      comboGroup.weightedWinRate >= 40 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {comboGroup.weightedWinRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-white">
                    {comboGroup.avgPoints.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => {
                        // Show modal with players who used this combo
                        const modalData = comboGroup.playerData.map(playerCombo => ({
                          player: playerCombo.player,
                          matches: playerCombo.totalMatches,
                          wins: playerCombo.wins,
                          winRate: playerCombo.winRate,
                          weightedWinRate: playerCombo.weightedWinRate.toFixed(2) + '%',
                          avgPoints: playerCombo.avgPointsPerMatch,
                          bladeLine: playerCombo.bladeLine
                        }));
                        
                        setShowAllModal({
                          isOpen: true,
                          title: `Players using ${comboGroup.combo}`,
                          data: modalData,
                          columns: [
                            { key: 'player', label: 'Player' },
                            { key: 'matches', label: 'Matches' },
                            { key: 'wins', label: 'Wins' },
                            { key: 'winRate', label: 'Win Rate (%)' },
                            { key: 'weightedWinRate', label: 'Weighted WR' },
                            { key: 'avgPoints', label: 'Avg Points' },
                            { key: 'bladeLine', label: 'Blade Line' }
                          ]
                        });
                      }}
                      className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                    >
                      View Players
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </div>

        {/* SIDEBAR */}
        <div className="xl:col-span-1 space-y-6">
          {/* Section 1: Quick Stats */}
          <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Total Matches</span>
                <span className="text-lg font-bold text-cyan-400">{globalStats.totalMatches.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Active Players</span>
                <span className="text-lg font-bold text-green-400">{globalStats.totalPlayers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Tournaments</span>
                <span className="text-lg font-bold text-purple-400">{globalStats.totalTournaments}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Avg Points/Match</span>
                <span className="text-lg font-bold text-orange-400">{globalStats.avgPointsPerMatch.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Finish Kings */}
          <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <Crown size={20} className="mr-2 text-yellow-400" />
              Finish Kings
            </h3>
            <div className="space-y-3">
              <div
                className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg cursor-pointer hover:bg-green-500/20 hover:border-green-500/40 transition-all duration-200"
                onClick={() => setShowAllModal({
                  isOpen: true,
                  title: "Spin Finish Masters - Top 10",
                  data: finishKings.allSpinFinish.slice(0, 10).map((p, i) => ({ rank: i + 1, player: p.player, points: p.points })),
                  columns: [
                    { key: 'player', label: 'Player' },
                    { key: 'points', label: 'Points' }
                  ]
                })}
              >
                <div className="text-xs text-green-400 mb-1">Spin Finish King</div>
                <div className="text-sm font-bold text-white">{finishKings.spinFinish.player}</div>
                <div className="text-xs text-slate-400">{finishKings.spinFinish.points} pts</div>
              </div>
              <div
                className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg cursor-pointer hover:bg-orange-500/20 hover:border-orange-500/40 transition-all duration-200"
                onClick={() => setShowAllModal({
                  isOpen: true,
                  title: "Burst Masters - Top 10",
                  data: finishKings.allBurstFinish.slice(0, 10).map((p, i) => ({ rank: i + 1, player: p.player, points: p.points })),
                  columns: [
                    { key: 'player', label: 'Player' },
                    { key: 'points', label: 'Points' }
                  ]
                })}
              >
                <div className="text-xs text-orange-400 mb-1">Burst Finish King</div>
                <div className="text-sm font-bold text-white">{finishKings.burstFinish.player}</div>
                <div className="text-xs text-slate-400">{finishKings.burstFinish.points} pts</div>
              </div>
              <div
                className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg cursor-pointer hover:bg-red-500/20 hover:border-red-500/40 transition-all duration-200"
                onClick={() => setShowAllModal({
                  isOpen: true,
                  title: "Over Finish Masters - Top 10",
                  data: finishKings.allOverFinish.slice(0, 10).map((p, i) => ({ rank: i + 1, player: p.player, points: p.points })),
                  columns: [
                    { key: 'player', label: 'Player' },
                    { key: 'points', label: 'Points' }
                  ]
                })}
              >
                <div className="text-xs text-red-400 mb-1">Over Finish King</div>
                <div className="text-sm font-bold text-white">{finishKings.overFinish.player}</div>
                <div className="text-xs text-slate-400">{finishKings.overFinish.points} pts</div>
              </div>
              <div
                className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg cursor-pointer hover:bg-purple-500/20 hover:border-purple-500/40 transition-all duration-200"
                onClick={() => setShowAllModal({
                  isOpen: true,
                  title: "Extreme Finish Masters - Top 10",
                  data: finishKings.allExtremeFinish.slice(0, 10).map((p, i) => ({ rank: i + 1, player: p.player, points: p.points })),
                  columns: [
                    { key: 'player', label: 'Player' },
                    { key: 'points', label: 'Points' }
                  ]
                })}
              >
                <div className="text-xs text-purple-400 mb-1">Extreme Finish King</div>
                <div className="text-sm font-bold text-white">{finishKings.extremeFinish.player}</div>
                <div className="text-xs text-slate-400">{finishKings.extremeFinish.points} pts</div>
              </div>
            </div>
          </div>

          {/* Section 3: Gimmick Awards */}
          <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <Trophy size={20} className="mr-2 text-yellow-400" />
              Special Awards
            </h3>
            <div className="space-y-3">
              <div
                className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg cursor-pointer hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all duration-200"
                onClick={() => setShowAllModal({
                  isOpen: true,
                  title: "X-Side Masters - Top 10",
                  data: gimmickAwards.allXSidePlayers.slice(0, 10).map((p, i) => ({
                    rank: i + 1,
                    player: p.player,
                    matches: p.matches,
                    winRate: p.winRate.toFixed(2) + '%',
                    weightedWinRate: p.weightedWinRate.toFixed(2) + '%',
                    points: p.points
                  })),
                  columns: [
                    { key: 'player', label: 'Player' },
                    { key: 'matches', label: 'Matches' },
                    { key: 'weightedWinRate', label: 'Weighted WR' },
                    { key: 'points', label: 'Points' }
                  ]
                })}
              >
                <div className="text-xs text-cyan-400 mb-1">Best X-Side Player</div>
                <div className="text-sm font-bold text-white">{gimmickAwards.bestXSidePlayer.player}</div>
                <div className="text-xs text-slate-400">{gimmickAwards.bestXSidePlayer.wins ?? 0} wins</div>
              </div>

              {/* {gimmickAwards.bestXSideByPoints.player !== gimmickAwards.bestXSidePlayer.player && (
                <div
                  className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg cursor-pointer hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all duration-200"
                  onClick={() => setShowAllModal({
                    isOpen: true,
                    title: "X-Side Masters - Top 10",
                    data: gimmickAwards.allXSidePlayers.slice(0, 10).map((p, i) => ({
                      rank: i + 1,
                      player: p.player,
                      matches: p.matches,
                      winRate: p.winRate.toFixed(2) + '%',
                      weightedWinRate: p.weightedWinRate.toFixed(2) + '%',
                      points: p.points
                    })),
                    columns: [
                      { key: 'player', label: 'Player' },
                      { key: 'matches', label: 'Matches' },
                      { key: 'weightedWinRate', label: 'Weighted WR' },
                      { key: 'points', label: 'Points' }
                    ]
                  })}
                >
                  <div className="text-xs text-cyan-400 mb-1">Best X-Side Player (Total Points)</div>
                  <div className="text-sm font-bold text-white">{gimmickAwards.bestXSideByPoints.player}</div>
                  <div className="text-xs text-slate-400">
                    {gimmickAwards.bestXSideByPoints.points} pts | {gimmickAwards.bestXSideByPoints.weightedWinRate.toFixed(1)}% WWR
                  </div>
                </div>
              )} */}

              <div
                className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg cursor-pointer hover:bg-blue-500/20 hover:border-blue-500/40 transition-all duration-200"
                onClick={() => setShowAllModal({
                  isOpen: true,
                  title: "B-Side Masters - Top 10",
                  data: gimmickAwards.allBSidePlayers.slice(0, 10).map((p, i) => ({
                    rank: i + 1,
                    player: p.player,
                    matches: p.matches,
                    winRate: p.winRate.toFixed(2) + '%',
                    weightedWinRate: p.weightedWinRate.toFixed(2) + '%',
                    points: p.points
                  })),
                  columns: [
                    { key: 'player', label: 'Player' },
                    { key: 'matches', label: 'Matches' },
                    { key: 'weightedWinRate', label: 'Weighted WR' },
                    { key: 'points', label: 'Points' }
                  ]
                })}
              >
                <div className="text-xs text-blue-400 mb-1">Best B-Side Player</div>
                <div className="text-sm font-bold text-white">{gimmickAwards.bestBSidePlayer.player}</div>
                <div className="text-xs text-slate-400">
                  {gimmickAwards.bestBSidePlayer.wins ?? 0} wins
                </div>
              </div>

              {/* {gimmickAwards.bestBSideByPoints.player !== gimmickAwards.bestBSidePlayer.player && (
                <div
                  className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg cursor-pointer hover:bg-blue-500/20 hover:border-blue-500/40 transition-all duration-200"
                  onClick={() => setShowAllModal({
                    isOpen: true,
                    title: "B-Side Masters - Top 10",
                    data: gimmickAwards.allBSidePlayers.slice(0, 10).map((p, i) => ({
                      rank: i + 1,
                      player: p.player,
                      matches: p.matches,
                      winRate: p.winRate.toFixed(2) + '%',
                      weightedWinRate: p.weightedWinRate.toFixed(2) + '%',
                      points: p.points
                    })),
                    columns: [
                      { key: 'player', label: 'Player' },
                      { key: 'matches', label: 'Matches' },
                      { key: 'weightedWinRate', label: 'Weighted WR' },
                      { key: 'points', label: 'Points' }
                    ]
                  })}
                >
                  <div className="text-xs text-blue-400 mb-1">Best B-Side Player (Total Points)</div>
                  <div className="text-sm font-bold text-white">{gimmickAwards.bestBSideByPoints.player}</div>
                  <div className="text-xs text-slate-400">
                    {gimmickAwards.bestBSideByPoints.points} pts | {gimmickAwards.bestBSideByPoints.weightedWinRate.toFixed(1)}% WWR
                  </div>
                </div>
              )} */}

              <div
                className="p-3 bg-pink-500/10 border border-pink-500/20 rounded-lg cursor-pointer hover:bg-pink-500/20 hover:border-pink-500/40 transition-all duration-200"
                onClick={() => setShowAllModal({
                  isOpen: true,
                  title: "HOTSHOT Kings - Top 10",
                  data: gimmickAwards.allHotshots.slice(0, 10).map((p, i) => ({
                    rank: i + 1,
                    player: p.player,
                    hotshots: p.hotshots
                  })),
                  columns: [
                    { key: 'player', label: 'Player' },
                    { key: 'hotshots', label: 'Hotshots' }
                  ]
                })}
              >
                <div className="text-xs text-pink-400 mb-1">HOTSHOT King</div>
                <div className="text-sm font-bold text-white">{gimmickAwards.hotshotKing.player}</div>
                <div className="text-xs text-slate-400">{gimmickAwards.hotshotKing.hotshots} hotshots</div>
              </div>

              <div
                className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg cursor-pointer hover:bg-yellow-500/20 hover:border-yellow-500/40 transition-all duration-200"
                onClick={() => setShowAllModal({
                  isOpen: true,
                  title: "Win Streak Leaders - Top 10",
                  data: gimmickAwards.allStreaks.slice(0, 10).map((p, i) => ({
                    rank: i + 1,
                    player: p.player,
                    streak: p.streak
                  })),
                  columns: [
                    { key: 'player', label: 'Player' },
                    { key: 'streak', label: 'Win Streak' }
                  ]
                })}
              >
                <div className="text-xs text-yellow-400 mb-1">Longest Win Streak</div>
                <div className="text-sm font-bold text-white">{gimmickAwards.longestWinStreak.player}</div>
                <div className="text-xs text-slate-400">{gimmickAwards.longestWinStreak.streak} wins</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    {/* ⚙️ Floating Developer Button */}
    {user?.role === "developer" && (
      <button
        onClick={() => setShowDevPanel(true)}
        className="fixed bottom-4 right-4 bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-full shadow-lg z-50"
      >
        ⚙️
      </button>
    )}
    
    {/* 🧠 Developer Panel */}
    {user?.role === "developer" && showDevPanel && (
      <div className="fixed bottom-20 right-4 bg-slate-900 border border-cyan-500/30 p-6 rounded-xl w-80 shadow-[0_0_25px_rgba(6,182,212,0.3)] z-50">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-cyan-400">Developer Panel</h3>
          <button onClick={() => setShowDevPanel(false)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
          <div className="space-y-3 text-sm text-slate-300">
            <div>
              Avg Matches per Tournament:{' '}
              <span className="text-cyan-400 font-semibold">{avgMatchesPerTournament.toFixed(2)}</span>
            </div>
            <div>
              Avg Matches per Player:{' '}
              <span className="text-cyan-400 font-semibold">{avgMatchesPerPlayer.toFixed(2)}</span>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Base Constant</label>
              <input
                type="number"
                value={baseConstant}
                onChange={(e) => setBaseConstant(Number(e.target.value))}
                className="w-full bg-slate-800 border border-cyan-500/30 rounded-md px-2 py-1 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
              />
            </div>
      
            {/* ⚡ Add these buttons below */}
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => saveBaseConstant(baseConstant)}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-md"
              >
                Save
              </button>
              
              <button
                onClick={() => {
                  const newConst = Math.round(avgMatchesPerPlayer);
                  saveBaseConstant(newConst);
                }}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-md"
              >
                Auto Adjust
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modals */}
      <ShowAllModal
        isOpen={showAllModal.isOpen}
        onClose={() => setShowAllModal(prev => ({ ...prev, isOpen: false }))}
        title={showAllModal.title}
        data={showAllModal.data}
        columns={showAllModal.columns}
        onRowClick={showAllModal.onRowClick}
      />
    </div>
  );
}
