// src/components/Views/PersonalStats.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  User, Users, Trophy, Target, BarChart3, Activity, Database, Search, Medal, ArrowLeft, ChevronDown, ChevronRight, Crown,
  PieChart as PieIcon, HelpCircle, Award, Star, Zap
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { parseBeybladeName, calculateWilsonScore, type ParsedBeyblade, type AllPartsData } from '../../utils/beybladeParser';
import { AwardsTab } from './PersonalStats/AwardsTab';

// --- Types ---
interface PersonalStatsProps {
  targetPlayer?: string; // developer mode
}

interface OverviewStats {
  pointsPerMatch: number;
  pointsPerRound: number;
  kdRatio: number;
  winPercentage: number;
  roundWins: number;
  pointsDelta: number;
  matchWins: number;
  matchLosses: number;
  flawlessRounds: number;
  overdrive: number;
  bSideWinRate?: number;
  xSideWinRate?: number;
}

interface ComboStats {
  combo: string;
  tournaments: number;
  matches: number;
  winRate: number;
  kdRatio: number;
  pointsDelta: number;
  totalWins: number;
  totalLosses: number;
  totalPoints: number;
  pointsGiven: number;
  bladeLine: string;
  finishDistribution: { [finish: string]: number };
  pointsPerFinish: { [finish: string]: number };
  type: string;
}

interface PartStats {
  partName: string;
  partType: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  confidence: number;
  totalPoints: number;
  pointsGiven: number;
  finishDistribution: { [finish: string]: number };
  pointsPerFinish: { [finish: string]: number };
}

interface MatchData {
  id: string;
  tournamentName: string;
  tournamentDate: string;
  roundNumber: number;
  matchNumber: number;
  phaseNumber: number;
  playerBeyblade: string;
  opponentName: string;
  opponentBeyblade: string;
  outcome: string;
  winner: string;
  pointsGained: number;
  pointsGiven: number;
  isWin: boolean;
  tournamentOfficer: string;
  roundKey: string;
  tournament_id?: string;
  // additional fields used by fun-stats calc
  match_number?: number;
  player1_name?: string;
  player2_name?: string;
  normalized_player1_name?: string;
  normalized_player2_name?: string;
  normalized_winner_name?: string;
  winner_name?: string;
  b_side_player?: string;
  x_side_player?: string;
}

interface TournamentRound {
  tournamentName: string;
  tournamentDate: string;
  roundNumber: number;
  mvpBey: string;
  winLoss: string;
  kdRatio: number;
  pointsGained: number;
  pointsGiven: number;
  matches: MatchData[];
}

// --- Constants ---
const FINISH_POINTS: { [k: string]: number } = {
  'Spin Finish': 1,
  'Burst Finish': 2,
  'Over Finish': 2,
  'Extreme Finish': 3
};
const FINISH_COLORS: { [k: string]: string } = {
  'Spin Finish': '#10B981',
  'Burst Finish': '#F59E0B',
  'Over Finish': '#EF4444',
  'Extreme Finish': '#8B5CF6'
};

// --- Component ---
export function PersonalStats({ targetPlayer }: PersonalStatsProps) {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<'overview' | 'matches' | 'performance' | 'combos' | 'parts' | 'awards'>('overview');
  const [loading, setLoading] = useState(true);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [comboStats, setComboStats] = useState<ComboStats[]>([]);
  const [partStats, setPartStats] = useState<PartStats[]>([]);
  const [matchData, setMatchData] = useState<MatchData[]>([]);
  const [partsDatabase, setPartsDatabase] = useState<AllPartsData>({
    blades: [], ratchets: [], bits: [], lockchips: [], assistBlades: []
  });
  const [tournamentRounds, setTournamentRounds] = useState<TournamentRound[]>([]);
  const [finishDistribution, setFinishDistribution] = useState<any[]>([]);
  const [pointsPerFinish, setPointsPerFinish] = useState<any[]>([]);
  const [selectedCombo, setSelectedCombo] = useState<string>('');
  const [selectedPart, setSelectedPart] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tournamentFilter, setTournamentFilter] = useState<'all' | 'practice' | 'casual' | 'ranked'>('all');
  const [partSearchTerm, setPartSearchTerm] = useState('');
  const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set());
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [roleStats, setRoleStats] = useState<any>(null);
  const [allMatches, setAllMatches] = useState<any[]>([]);

  // New: Player search & privacy
  const [searchedPlayer, setSearchedPlayer] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | undefined>(targetPlayer || user?.username);
  const [isPrivate, setIsPrivate] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // New: Fun stats (kept on overview, always visible)
  const [funStats, setFunStats] = useState({
    clutchFactor: 0,
    comebackRate: 0,
    firstStrikeAdvantage: 0
  });

  // New: Awards
  const [playerAwards, setPlayerAwards] = useState<any[]>([]);

  const playerName = selectedPlayer;
  const normalizedPlayerName = playerName?.toLowerCase();

  const isDeveloper = user?.role === 'developer';

  // --- Effects: initial fetch of parts DB ---
  useEffect(() => {
    fetchPartsDatabase();
  }, []);

  // fetch matches once parts DB loaded and playerName present
  useEffect(() => {
    if (playerName && partsDatabase.blades.length > 0) {
      fetchAllMatches();
      fetchPlayerAwards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerName, partsDatabase.blades.length]);

  // Apply tournament filter on allMatches change
  useEffect(() => {
    if (allMatches.length === 0) {
      setOverviewStats(null);
      setMatchData([]);
      setComboStats([]);
      setPartStats([]);
      setTournamentRounds([]);
      setFinishDistribution([]);
      setPointsPerFinish([]);
      setFunStats({ clutchFactor: 0, comebackRate: 0, firstStrikeAdvantage: 0 });
      return;
    }

    let filtered = [...allMatches];
    if (tournamentFilter !== 'all') {
      filtered = filtered.filter(m => getTournamentCategory(m.tournaments) === tournamentFilter);
    }

    if (filtered.length === 0) {
      setOverviewStats({
        pointsPerMatch: 0,
        pointsPerRound: 0,
        kdRatio: 0,
        winPercentage: 0,
        roundWins: 0,
        pointsDelta: 0,
        matchWins: 0,
        matchLosses: 0,
        flawlessRounds: 0,
        overdrive: 0,
        bSideWinRate: 0,
        xSideWinRate: 0
      });
      setMatchData([]);
      setComboStats([]);
      setPartStats([]);
      setTournamentRounds([]);
      setFinishDistribution([]);
      setPointsPerFinish([]);
      setFunStats({ clutchFactor: 0, comebackRate: 0, firstStrikeAdvantage: 0 });
    } else {
      processMatchData(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentFilter, allMatches]);

  // --- Supabase helpers ---
  const fetchPartsDatabase = async () => {
    try {
      const [bladesRes, ratchetsRes, bitsRes, lockchipsRes, assistBladesRes] = await Promise.all([
        supabase.from('beypart_blade').select('*'),
        supabase.from('beypart_ratchet').select('*'),
        supabase.from('beypart_bit').select('*'),
        supabase.from('beypart_lockchip').select('*'),
        supabase
          .from('beypart_assistblade')
          .select('"Assist Blade","Assist Blade Name",Type,Height,Attack,Defense,Stamina,"Total Stat"'),
      ]);

      setPartsDatabase({
        blades: bladesRes.data || [],
        ratchets: ratchetsRes.data || [],
        bits: bitsRes.data || [],
        lockchips: lockchipsRes.data || [],
        assistBlades: assistBladesRes.data || []
      });
    } catch (error) {
      console.error('Error fetching parts database:', error);
    }
  };

const fetchAllMatches = async (target?: string) => {
  const player = target || selectedPlayer;
  if (!player) return;

  setLoading(true);
  try {
    const matchQuery = supabase
      .from('match_results')
      .select(`
        *,
        tournaments!inner(id, name, tournament_date, is_practice, tournament_type)
      `)
      .or(
        `player1_name.eq.${player},player2_name.eq.${player},normalized_player1_name.eq.${player.toLowerCase()},normalized_player2_name.eq.${player.toLowerCase()}`
      );

    const { data: userMatches, error } = await matchQuery;
    if (error) throw error;

    const normalized = (userMatches || []).map((m: any) => ({
      ...m,
      tournaments: Array.isArray(m.tournaments) ? m.tournaments[0] : m.tournaments,
    }));

    setAllMatches(normalized);
  } catch (err) {
    console.error('Error fetching matches:', err);
    setAllMatches([]);
  } finally {
    setLoading(false);
  }
};

  // original fetchPlayerAwards logic
  // const fetchPlayerAwards = async () => {
  //   try {
  //     const { data, error } = await supabase
  //       .from('tournament_awards')
  //       .select(`
  //         *,
  //         tournaments(name, tournament_date)
  //       `)
  //       .eq('player_name', playerName)
  //       .order('awarded_at', { ascending: false });

  //     if (error) throw error;
  //     setPlayerAwards(data || []);
  //   } catch (error) {
  //     console.error('Error fetching player awards:', error);
  //   }
  // };

const fetchPlayerAwards = async () => {
  try {
    const baseSelect = `
      *,
      tournaments(name, tournament_date)
    `;

    // Helpers to build normalized search term
    const normalizedNoSpaces = (playerName || '').replace(/\s+/g, '').toLowerCase();

    // We'll run up to three queries and merge results:
    // 1) by player_id (if available)
    // 2) by exact player_name
    // 3) by ilike using name-without-spaces (to catch "JetFire" vs "Jet Fire")
    const queries: Promise<any>[] = [];

    if (user?.id) {
      queries.push(
        supabase
          .from('tournament_awards')
          .select(baseSelect)
          .eq('player_id', user.id)
          .order('awarded_at', { ascending: false })
      );
    }

    // exact name
    if (playerName && playerName.trim().length > 0) {
      queries.push(
        supabase
          .from('tournament_awards')
          .select(baseSelect)
          .eq('player_name', playerName)
          .order('awarded_at', { ascending: false })
      );

      // relaxed normalized match (remove spaces in playerName and match any award that contains that token)
      // example: "Jet Fire" -> search "%jetfire%" to match "JetFire"
      const token = `%${normalizedNoSpaces}%`;
      queries.push(
        supabase
          .from('tournament_awards')
          .select(baseSelect)
          .ilike('player_name', token)
          .order('awarded_at', { ascending: false })
      );
    }

    // If no queries were created (no playerName and no user id), bail
    if (queries.length === 0) {
      setPlayerAwards([]);
      return;
    }

    // Execute queries in parallel
    const results = await Promise.all(queries);

    // Collect any errors and data
    const allRows: any[] = [];
    let anyError: any = null;
    for (const res of results) {
      if (!res) continue;
      const { data, error } = res as any;
      if (error) anyError = anyError || error;
      if (Array.isArray(data)) allRows.push(...data);
    }
    if (anyError) throw anyError;

    // Deduplicate by award id (keep the first occurrence), then sort by awarded_at desc
    const map = new Map<string, any>();
    allRows.forEach((r) => {
      if (!r || !r.id) return;
      if (!map.has(r.id)) map.set(r.id, r);
    });

    const merged = Array.from(map.values()).sort((a, b) => {
      const ta = a?.awarded_at ? new Date(a.awarded_at).getTime() : 0;
      const tb = b?.awarded_at ? new Date(b.awarded_at).getTime() : 0;
      return tb - ta;
    });

    setPlayerAwards(merged);
  } catch (err) {
    console.error('Error fetching player awards:', err);
  }
};

  
  // privacy fetch/update
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('is_private').eq('id', user.id).single();
        if (error) throw error;
        setIsPrivate(Boolean(data?.is_private));
      } catch (err) {
        console.error('Error fetching privacy setting:', err);
      }
    })();
  }, [user]);

  const togglePrivacy = async () => {
    if (!user) return;
    try {
      const newVal = !isPrivate;
      const { error } = await supabase.from('profiles').update({ is_private: newVal }).eq('id', user.id);
      if (error) throw error;
      setIsPrivate(newVal);
    } catch (err) {
      console.error('Error updating privacy:', err);
    }
  };

  // --- Player search (reads non-private profiles from 'profiles' or deduced from match_results) ---
const searchPlayers = async (q: string) => {
  setSearchedPlayer(q);
  if (!q.trim()) {
    setSearchResults([]);
    return;
  }
  setSearchLoading(true);
  try {
    // First, search non-private profiles
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('username')
      .ilike('username', `%${q}%`)
      .eq('is_private', false)
      .limit(20);

    if (profilesErr) throw profilesErr;

    const namesFromProfiles = (profiles || []).map((p: any) => p.username);

    // If not enough results, also search match_results
    if (namesFromProfiles.length < 10) {
      const { data: matchesRes, error: matchesErr } = await supabase
        .from('match_results')
        .select('player1_name, player2_name')
        .or(`player1_name.ilike.%${q}%,player2_name.ilike.%${q}%`)
        .limit(50);

      if (matchesErr) throw matchesErr;

      const extra = new Set<string>();
      (matchesRes || []).forEach((m: any) => {
        if (m.player1_name) extra.add(m.player1_name);
        if (m.player2_name) extra.add(m.player2_name);
      });

      const extraArr = Array.from(extra).filter(n => !namesFromProfiles.includes(n));
      setSearchResults([...namesFromProfiles, ...extraArr].slice(0, 20));
    } else {
      setSearchResults(namesFromProfiles.slice(0, 20));
    }
  } catch (err) {
    console.error('Error searching players:', err);
    setSearchResults([]);
  } finally {
    setSearchLoading(false);
  }
};


  // --- Utilities from original file preserved ---
  const normalizeTournamentObj = (t: any) => {
    if (!t) return null;
    return Array.isArray(t) ? t[0] : t;
  };
  const getTournamentCategory = (t: any) => {
    const obj = normalizeTournamentObj(t);
    if (!obj) return 'unknown';
    const type = String(obj.tournament_type || '').toLowerCase();
    if (type === 'practice') return 'practice';
    if (type === 'casual') return 'casual';
    if (type === 'ranked') return 'ranked';
    return 'unknown';
  };

  // --- Core processing from original file, with fun-stats integration ---
  const processMatchData = (matches: any[]) => {
    const normalizedPlayer = playerName?.toLowerCase();

    const matchDataArray: MatchData[] = [];
    const comboStatsMap: { [combo: string]: ComboStats } = {};
    const partStatsMap: { [typeKey: string]: { [name: string]: PartStats } } = {};

    const finishCounts: { [finish: string]: number } = {};
    const pointsPerFinishMap: { [finish: string]: number } = {};

    let totalPoints = 0;
    let totalPointsGiven = 0;
    let totalRoundWins = 0;
    let flawlessCount = 0;
    let overdriveCount = 0;

    const roundGroups: { [key: string]: any[] } = {};
    let lastExtremeKey: string | null = null;
    let consecutiveExtremes = 0;

    // For fun-stats: group by session (player1_player2_tournament_round)
    const sessionGroups: { [key: string]: any[] } = {};

    matches.forEach((match: any) => {
      const isPlayer1 = match.player1_name === playerName || match.normalized_player1_name === normalizedPlayer;
      const isPlayer2 = match.player2_name === playerName || match.normalized_player2_name === normalizedPlayer;
      const isWinner = match.winner_name === playerName || match.normalized_winner_name === normalizedPlayer;

      if (!isPlayer1 && !isPlayer2) return;

      const playerBeyblade = isPlayer1 ? match.player1_beyblade : match.player2_beyblade;
      const playerBladeLine = isPlayer1 ? match.player1_blade_line : match.player2_blade_line;
      const opponentName = isPlayer1 ? match.player2_name : match.player1_name;
      const opponentBeyblade = isPlayer1 ? match.player2_beyblade : match.player1_beyblade;
      const outcome = match.outcome?.split(' (')[0] || 'Unknown';
      const points = match.points_awarded || FINISH_POINTS[outcome] || 0;
      const tournamentOfficer = match.tournament_officer || 'Unknown';
      const roundKey = `${match.tournament_id}_${opponentName}__TO:${tournamentOfficer}__R:${match.round_number}`;

      // Overdrive detection (two consecutive Extreme Finish wins in same round)
      if (isWinner && outcome === 'Extreme Finish') {
        if (lastExtremeKey === roundKey) {
          consecutiveExtremes++;
        } else {
          consecutiveExtremes = 1;
          lastExtremeKey = roundKey;
        }
        if (consecutiveExtremes === 2) {
          overdriveCount++;
        }
      } else {
        consecutiveExtremes = 0;
        lastExtremeKey = null;
      }

      if (isWinner) {
        finishCounts[outcome] = (finishCounts[outcome] || 0) + 1;
        pointsPerFinishMap[outcome] = (pointsPerFinishMap[outcome] || 0) + points;
        totalPoints += points;
        totalRoundWins++;
      } else {
        totalPointsGiven += points;
      }

      if (!roundGroups[roundKey]) roundGroups[roundKey] = [];
      roundGroups[roundKey].push({ ...match, isWinner, points, playerBeyblade, opponentName, opponentBeyblade, tournamentOfficer });

      // push matchData
      matchDataArray.push({
        id: match.id,
        tournamentName: match.tournaments?.name || 'Unknown',
        tournamentDate: match.tournaments?.tournament_date || match.tournament_date || '',
        roundNumber: match.round_number,
        matchNumber: match.match_number,
        phaseNumber: match.phase_number,
        playerBeyblade,
        opponentName,
        opponentBeyblade,
        outcome,
        winner: match.winner_name,
        pointsGained: isWinner ? points : 0,
        pointsGiven: isWinner ? 0 : points,
        isWin: isWinner,
        tournamentOfficer,
        roundKey,
        tournament_id: match.tournament_id,
        match_number: match.match_number,
        player1_name: match.player1_name,
        player2_name: match.player2_name,
        normalized_player1_name: match.normalized_player1_name,
        normalized_player2_name: match.normalized_player2_name,
        normalized_winner_name: match.normalized_winner_name,
        winner_name: match.winner_name,
        b_side_player: match.b_side_player,
        x_side_player: match.x_side_player
      });

      // Combo handling (parse parts for combo classification)
      if (!comboStatsMap[playerBeyblade]) {
        const parsedParts: ParsedBeyblade = parseBeybladeName(playerBeyblade, playerBladeLine, partsDatabase as any);
        let comboType = 'Unknown';
        if (parsedParts.bit) {
          const bitName = String(parsedParts.bit).toLowerCase();
          if (bitName.includes('attack')) comboType = 'Attack';
          else if (bitName.includes('defense')) comboType = 'Defense';
          else if (bitName.includes('stamina')) comboType = 'Stamina';
          else if (bitName.includes('balance')) comboType = 'Balance';
        }
        comboStatsMap[playerBeyblade] = {
          combo: playerBeyblade,
          tournaments: 0,
          matches: 0,
          winRate: 0,
          kdRatio: 0,
          pointsDelta: 0,
          totalWins: 0,
          totalLosses: 0,
          totalPoints: 0,
          pointsGiven: 0,
          bladeLine: playerBladeLine || 'Unknown',
          finishDistribution: {},
          pointsPerFinish: {},
          type: comboType
        };
      }
      const combo = comboStatsMap[playerBeyblade];
      combo.matches++;
      if (isWinner) {
        combo.totalWins++;
        combo.totalPoints += points;
        combo.finishDistribution[outcome] = (combo.finishDistribution[outcome] || 0) + 1;
        combo.pointsPerFinish[outcome] = (combo.pointsPerFinish[outcome] || 0) + points;
      } else {
        combo.totalLosses++;
        combo.pointsGiven += points;
      }

      // Per-part stats using parseBeybladeName
      const parsedParts: ParsedBeyblade = parseBeybladeName(playerBeyblade, playerBladeLine, partsDatabase as any);
      Object.keys(parsedParts).forEach(k => {
        if (k === 'isCustom') return;
        if (!partStatsMap[k]) partStatsMap[k] = {};
      });
      Object.entries(parsedParts).forEach(([partKey, partValue]) => {
        if (partKey === 'isCustom' || !partValue) return;
        const partName = String(partValue);
        const displayType = partKey === 'blade' ? 'Blade' :
          partKey === 'ratchet' ? 'Ratchet' :
          partKey === 'bit' ? 'Bit' :
          partKey === 'lockchip' ? 'Lockchip' :
          partKey === 'assistBlade' ? 'Assist Blade' :
          partKey;
        if (!partStatsMap[partKey][partName]) {
          partStatsMap[partKey][partName] = {
            partName,
            partType: displayType,
            matches: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            confidence: 0,
            totalPoints: 0,
            pointsGiven: 0,
            finishDistribution: {},
            pointsPerFinish: {}
          };
        }
        const pstat = partStatsMap[partKey][partName];
        pstat.matches++;
        if (isWinner) {
          pstat.wins++;
          pstat.totalPoints += points;
          pstat.finishDistribution[outcome] = (pstat.finishDistribution[outcome] || 0) + 1;
          pstat.pointsPerFinish[outcome] = (pstat.pointsPerFinish[outcome] || 0) + points;
        } else {
          pstat.losses++;
          pstat.pointsGiven += points;
        }
      });

      // accumulate for session groups for fun-stats calculation
      const sessionKey = `${match.player1_name}_${match.player2_name}_${match.tournament_id}_${match.round_number}`;
      if (!sessionGroups[sessionKey]) sessionGroups[sessionKey] = [];
      sessionGroups[sessionKey].push(match);
    }); // end matches.forEach

    // Flawless detection
    Object.values(roundGroups).forEach(roundMatches => {
      const playerWins = roundMatches.filter((m: any) => m.isWinner).length;
      const totalMatches = roundMatches.length;
      if (playerWins === totalMatches && (totalMatches === 4 || totalMatches === 5)) {
        flawlessCount++;
      }
    });

    // Round wins per roundGroups
    let roundWins = 0;
    Object.values(roundGroups).forEach(roundMatches => {
      const playerWins = roundMatches.filter((m: any) => m.isWinner).length;
      const opponentWins = roundMatches.length - playerWins;
      if (playerWins > opponentWins) roundWins++;
    });

    // finalize combo stats
    const tournamentSets = new Set<string>();
    matches.forEach(m => tournamentSets.add(m.tournament_id));

    Object.values(comboStatsMap).forEach(combo => {
      combo.winRate = combo.matches > 0 ? (combo.totalWins / combo.matches) * 100 : 0;
      combo.kdRatio = combo.totalLosses > 0 ? combo.totalWins / combo.totalLosses : combo.totalWins;
      combo.pointsDelta = (combo.totalPoints - combo.pointsGiven) / Math.max(combo.matches, 1);
      combo.tournaments = tournamentSets.size;
    });

    // finalize part stats
    Object.keys(partStatsMap).forEach(typeKey => {
      Object.values(partStatsMap[typeKey]).forEach(part => {
        part.winRate = part.matches > 0 ? (part.wins / part.matches) * 100 : 0;
        part.confidence = calculateWilsonScore(part.wins, part.matches);
      });
    });

    const flattenedParts: PartStats[] = Object.values(partStatsMap).flatMap(obj => Object.values(obj)).filter(p => p.matches > 0);
    flattenedParts.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return b.winRate - a.winRate;
    });

    // overview
    const totalMatches = matchDataArray.length;
    const matchWins = matchDataArray.filter(m => m.isWin).length;
    const matchLosses = totalMatches - matchWins;

    const overviewData: OverviewStats = {
      pointsPerMatch: totalMatches > 0 ? totalPoints / totalMatches : 0,
      pointsPerRound: roundWins > 0 ? totalPoints / roundWins : 0,
      kdRatio: matchLosses > 0 ? matchWins / matchLosses : matchWins,
      winPercentage: totalMatches > 0 ? (matchWins / totalMatches) * 100 : 0,
      roundWins,
      pointsDelta: (totalPoints - totalPointsGiven) / Math.max(totalMatches, 1),
      matchWins,
      matchLosses,
      flawlessRounds: flawlessCount,
      overdrive: overdriveCount
    };

    // finish data & points per finish
    const finishData = Object.entries(finishCounts).map(([finish, count]) => ({
      name: finish,
      value: count,
      color: FINISH_COLORS[finish] || '#6B7280'
    }));

    const pointsData = Object.entries(pointsPerFinishMap).map(([finish, points]) => ({
      finish,
      points,
      count: finishCounts[finish] || 0
    }));

    // rounds aggregation
    const roundsMap: { [key: string]: TournamentRound } = {};
    matchDataArray.forEach(match => {
      const roundKey = `${match.tournamentName}_${match.roundNumber}_${match.tournamentOfficer}`;
      if (!roundsMap[roundKey]) {
        roundsMap[roundKey] = {
          tournamentName: match.tournamentName,
          tournamentDate: match.tournamentDate,
          roundNumber: match.roundNumber,
          mvpBey: '',
          winLoss: '',
          kdRatio: 0,
          pointsGained: 0,
          pointsGiven: 0,
          matches: []
        };
      }
      roundsMap[roundKey].matches.push(match);
    });
    Object.values(roundsMap).forEach(round => {
      const wins = round.matches.filter(m => m.isWin).length;
      const losses = round.matches.length - wins;
      round.winLoss = `${wins}-${losses}`;
      round.kdRatio = losses > 0 ? wins / losses : wins;
      round.pointsGained = round.matches.reduce((s, m) => s + (m.pointsGained || 0), 0);
      round.pointsGiven = round.matches.reduce((s, m) => s + (m.pointsGiven || 0), 0);
      const beybladePoints: { [b: string]: number } = {};
      round.matches.forEach(match => {
        if (match.isWin) beybladePoints[match.playerBeyblade] = (beybladePoints[match.playerBeyblade] || 0) + match.pointsGained;
      });
      const mvpEntry = Object.entries(beybladePoints).sort((a, b) => b[1] - a[1])[0];
      round.mvpBey = mvpEntry?.[0] || 'N/A';
    });
    const sortedRounds = Object.values(roundsMap)
      .sort((a, b) => new Date(b.tournamentDate).getTime() - new Date(a.tournamentDate).getTime())
      .slice(0, 10);

    // stadium side win rates (since Sept 13, 2025 in original file; keep logic but use present)
    const SEPT_13 = new Date('2025-09-13');
    let bSideMatches = 0, bSideWins = 0, xSideMatches = 0, xSideWins = 0;
    matches.forEach((match: any) => {
      const tDate = new Date(match.tournaments?.tournament_date || match.tournament_date || 0);
      if (tDate < SEPT_13) return;
      const isBPlayer = match.b_side_player === playerName;
      const isXPlayer = match.x_side_player === playerName;
      const isWinner = match.winner_name === playerName || match.normalized_winner_name === normalizedPlayer;
      if (isBPlayer) {
        bSideMatches++;
        if (isWinner) bSideWins++;
      }
      if (isXPlayer) {
        xSideMatches++;
        if (isWinner) xSideWins++;
      }
    });
    const bSideWinRate = bSideMatches > 0 ? (bSideWins / bSideMatches) * 100 : 0;
    const xSideWinRate = xSideMatches > 0 ? (xSideWins / xSideMatches) * 100 : 0;

    // role stats aggregation
    const newRoleStats: { [type: string]: { wins: number; losses: number; kills: number; deaths: number } } = {
      Attack: { wins: 0, losses: 0, kills: 0, deaths: 0 },
      Defense: { wins: 0, losses: 0, kills: 0, deaths: 0 },
      Stamina: { wins: 0, losses: 0, kills: 0, deaths: 0 },
      Balance: { wins: 0, losses: 0, kills: 0, deaths: 0 }
    };
    Object.values(comboStatsMap).forEach(combo => {
      if (!newRoleStats[combo.type]) return;
      newRoleStats[combo.type].wins += combo.totalWins;
      newRoleStats[combo.type].losses += combo.totalLosses;
      newRoleStats[combo.type].kills += combo.totalPoints;
      newRoleStats[combo.type].deaths += combo.pointsGiven;
    });

    // --- FUN-STATS calculation using sessionGroups gathered earlier ---
    let decidingRoundMatches = 0, decidingRoundWins = 0;
    let comebackMatches = 0, comebackWins = 0;
    let firstStrikeMatches = 0, firstStrikeWins = 0;

    Object.values(sessionGroups).forEach((sessionMatches: any[]) => {
      if (!sessionMatches || sessionMatches.length === 0) return;
      sessionMatches.sort((a, b) => (a.match_number || 0) - (b.match_number || 0));

      // we'll simulate running tally for the session for the selected player
      let playerScore = 0, opponentScore = 0;
      let playerScoredFirst = false;
      let wasTrailing0to3 = false;

      sessionMatches.forEach((m, idx) => {
        const normalizedWinner = m.normalized_winner_name || (m.winner_name || '').toLowerCase();
        const isPlayerWinner = normalizedWinner === normalizedPlayer;
        if (isPlayerWinner) {
          playerScore++;
          if (idx === 0) playerScoredFirst = true;
        } else {
          opponentScore++;
        }
        if (playerScore === 0 && opponentScore === 3) wasTrailing0to3 = true;
      });

      const finalPlayerScore = playerScore;
      const finalOpponentScore = opponentScore;
      // Deciding round detection: both reached at least 3 and close final (like 4-3, 3-4, etc).
      if (Math.min(finalPlayerScore, finalOpponentScore) >= 3 && Math.abs(finalPlayerScore - finalOpponentScore) === 1) {
        decidingRoundMatches++;
        if (finalPlayerScore > finalOpponentScore) decidingRoundWins++;
      }

      // comeback after trailing 0-3
      if (wasTrailing0to3) {
        comebackMatches++;
        if (finalPlayerScore > finalOpponentScore) comebackWins++;
      }

      // first strike advantage: if player scored first in that session and ended up winning
      if (sessionMatches.length >= 3) {
        firstStrikeMatches++;
        if (playerScoredFirst && finalPlayerScore > finalOpponentScore) firstStrikeWins++;
      }
    });

    const clutchFactor = decidingRoundMatches > 0 ? (decidingRoundWins / decidingRoundMatches) * 100 : 0;
    const comebackRate = comebackMatches > 0 ? (comebackWins / comebackMatches) * 100 : 0;
    const firstStrikeAdvantage = firstStrikeMatches > 0 ? (firstStrikeWins / firstStrikeMatches) * 100 : 0;

    // commit to state
    setRoleStats(newRoleStats);
    setOverviewStats({ ...overviewData, bSideWinRate, xSideWinRate });
    setComboStats(Object.values(comboStatsMap).sort((a, b) => b.winRate - a.winRate));
    setPartStats(flattenedParts);
    setMatchData(matchDataArray);
    setTournamentRounds(sortedRounds);
    setFinishDistribution(finishData);
    setPointsPerFinish(pointsData);
    setFunStats({ clutchFactor, comebackRate, firstStrikeAdvantage });
  };

  // --- UI helpers ---
  const organizeMatchesByRounds = () => {
    const organized: { [tournament: string]: { [roundGroupKey: string]: MatchData[] } } = {};
    matchData.forEach(match => {
      if (!organized[match.tournamentName]) organized[match.tournamentName] = {};
      const roundGroupKey = match.roundKey;
      if (!organized[match.tournamentName][roundGroupKey]) organized[match.tournamentName][roundGroupKey] = [];
      organized[match.tournamentName][roundGroupKey].push(match);
    });
    return organized;
  };

  const toggleTournament = (tournamentName: string) => {
    const newExpanded = new Set(expandedTournaments);
    if (newExpanded.has(tournamentName)) newExpanded.delete(tournamentName);
    else newExpanded.add(tournamentName);
    setExpandedTournaments(newExpanded);
  };

  const toggleRound = (roundKey: string) => {
    const newExpanded = new Set(expandedRounds);
    if (newExpanded.has(roundKey)) newExpanded.delete(roundKey);
    else newExpanded.add(roundKey);
    setExpandedRounds(newExpanded);
  };

  const filteredCombos = comboStats.filter(combo => combo.combo.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredParts = partStats.filter(part => part.partName.toLowerCase().includes(partSearchTerm.toLowerCase()));
  const selectedComboData = selectedCombo ? comboStats.find(c => c.combo === selectedCombo) : null;
  const selectedPartData = selectedPart ? partStats.find(p => p.partName === selectedPart) : null;
  const organizedMatches = organizeMatchesByRounds();

  // --- Part DB helpers (display) ---
  const getPartFromDatabase = (partName: string) => {
    const allParts = [
      ...partsDatabase.blades.map((p: any) => ({ ...p, type: 'Blade', tableName: 'beypart_blade', keyField: 'Blades' })),
      ...partsDatabase.ratchets.map((p: any) => ({ ...p, type: 'Ratchet', tableName: 'beypart_ratchet', keyField: 'Ratchet' })),
      ...partsDatabase.bits.map((p: any) => ({ ...p, type: 'Bit', tableName: 'beypart_bit', keyField: 'Bit' })),
      ...partsDatabase.lockchips.map((p: any) => ({ ...p, type: 'Lockchip', tableName: 'beypart_lockchip', keyField: 'Lockchip' })),
      ...partsDatabase.assistBlades.map((p: any) => ({ ...p, type: 'Assist Blade', tableName: 'beypart_assistblade', keyField: 'Assist Blade' }))
    ];
    let foundPart = allParts.find(part => {
      if (part.type === 'Blade') return part.Blades === partName;
      if (part.type === 'Ratchet') return part.Ratchet === partName;
      if (part.type === 'Bit') return part.Bit === partName || part.Shortcut === partName;
      if (part.type === 'Lockchip') return part.Lockchip === partName;
      if (part.type === 'Assist Blade') return part['Assist Blade'] === partName || part['Assist Blade Name'] === partName;
      return false;
    });
    if (!foundPart && partName.length <= 3) {
      foundPart = partsDatabase.bits.find(bit => bit.Shortcut === partName);
      if (foundPart) foundPart = { ...foundPart, type: 'Bit', tableName: 'beypart_bit', keyField: 'Bit' };
    }
    return foundPart;
  };

  const getPartDisplayInfo = (partName: string) => {
    const part = getPartFromDatabase(partName);
    if (!part) {
      return {
        displayName: partName,
        type: 'Unknown',
        stats: { attack: 0, defense: 0, stamina: 0, dash: 0, burstRes: 0 }
      };
    }
    let displayName = partName;
    if (part.type === 'Bit' && part.Bit && part.Shortcut) {
      displayName = `${part.Bit} (${part.Shortcut})`;
    } else if (part.type === 'Assist Blade' && part['Assist Blade Name'] && part['Assist Blade']) {
      displayName = `${part['Assist Blade Name']} (${part['Assist Blade']})`;
    }
    return {
      displayName,
      type: part.type,
      stats: {
        attack: part.Attack || 0,
        defense: part.Defense || 0,
        stamina: part.Stamina || 0,
        dash: part.Dash || 0,
        burstRes: part['Burst Res'] || 0
      }
    };
  };

  const getPartImageUrl = (partName: string) => {
    const part = getPartFromDatabase(partName);
    if (!part) return null;
    const filename = encodeURIComponent(part[part.keyField]);
    return `https://eymxpphofhhfeuvaqfad.supabase.co/storage/v1/object/public/beyblade-parts/${part.tableName}/${filename}.png`;
  };

  const getPartTypeColor = (type: string) => {
    switch (type) {
      case 'Lockchip': return 'text-red-400';
      case 'Main Blade (Custom)': return 'text-pink-400';
      case 'Blade': return 'text-blue-400';
      case 'Assist Blade': return 'text-purple-400';
      case 'Ratchet': return 'text-green-400';
      case 'Bit': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  // --- small guards for auth/guest ---
  if (!user || user.id.startsWith('guest-')) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <User size={32} className="text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Login Required</h2>
          <p className="text-slate-400">Please log in to view personal statistics.</p>
        </div>
      </div>
    );
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading personal stats...</p>
        </div>
      </div>
    );
  }

  // --- No data case ---
  if (!overviewStats) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-6 pt-28 pb-8">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy size={32} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Match History</h3>
            <p className="text-slate-400">
              {playerName ? `${playerName} hasn't participated in any recorded matches yet.` : "You haven't participated in any recorded matches yet. Join a tournament to start building your statistics!"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Render main UI (tabs + sidebar) ---
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-8">
{/* Header */}
<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-6">
  {/* Left side: Avatar + Name + Awards */}
  <div className="flex flex-col gap-3">
    {/* Avatar + name */}
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
        {playerName ? playerName.charAt(0).toUpperCase() : (user.username || 'U').charAt(0).toUpperCase()}
      </div>
      <div>
        <h1 className="text-4xl font-bold text-white">{playerName}</h1>
        <p className="text-slate-400 text-lg">Personal Statistics</p>
      </div>
    </div>

    {/* Awards Showcase */}
    {playerAwards.length > 0 && (
      <div className="flex flex-wrap gap-2 mt-2">
        {playerAwards.filter(a => a.showcase).slice(0, 5).map((award) => (
          <div
            key={award.id}
            className="flex items-center gap-1 bg-slate-800/50 border border-yellow-500/20 rounded-lg px-2 py-1"
            title={`${award.award_name} (${award.tournaments?.name || 'Unknown Tournament'})`}
          >
            {award.icon_type === 'predefined' ? (
              (() => {
                const iconName = award.icon_data?.name || 'Trophy';
                const IconComponent = {
                  Trophy, Crown, Medal, Star, Award, Target, Zap
                }[iconName] || Trophy;
                return <IconComponent size={14} className={award.icon_data?.color || 'text-yellow-400'} />;
              })()
            ) : (
              <img
                src={award.icon_url}
                alt={award.award_name}
                className="w-4 h-4 object-cover rounded"
              />
            )}
            <span className="text-xs text-yellow-400 font-medium truncate">
              {award.award_name} — {award.tournaments?.name || 'Unknown'}
            </span>
          </div>
        ))}
        {playerAwards.length > 5 && (
          <span className="text-xs text-slate-500">+{playerAwards.length - 5} more</span>
        )}
      </div>
    )}
  </div>

  {/* Right side: Controls (Search, Back, Privacy) */}
  <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
    {/* Search bar */}
    <div className="relative w-full sm:w-64">
      <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        placeholder="Search player..."
        value={searchedPlayer}
        onChange={(e) => searchPlayers(e.target.value)}
        className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
      {searchLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
        </div>
      )}
      {searchResults.length > 0 && searchedPlayer.trim() && (
        <div
          className="
            absolute left-0 right-0 sm:right-auto mt-2 
            w-full sm:w-72 
            bg-slate-900 border border-slate-800 rounded-lg p-3 z-50
          "
        >
          <div className="text-xs text-slate-400 mb-2">Search results</div>
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
            {searchResults.map(name => (
              <button
                key={name}
                onClick={() => {
                  setSelectedPlayer(name);
                  setSearchedPlayer('');
                  setSearchResults([]);
                  fetchAllMatches(name);
                }}
                className="text-left px-3 py-2 rounded hover:bg-slate-800/40"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>

    {/* Back button */}
    {selectedPlayer && selectedPlayer !== user?.username && (
      <button
        onClick={() => {
          const me = user?.username;
          setSelectedPlayer(me);
          setSearchedPlayer('');
          setSearchResults([]);
          fetchAllMatches(me);
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all duration-200 text-sm"
      >
        {/* <ArrowLeft size={16} /> */}
        <span>Back to Profile</span>
      </button>
    )}

    {/* Privacy toggle */}
    <button
      onClick={togglePrivacy}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 text-sm ${
        isPrivate
          ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30'
          : 'bg-green-500/20 border-green-500/30 text-green-400 hover:bg-green-500/30'
      }`}
    >
      {isPrivate ? <LockIcon size={14} /> : <UnlockIcon size={14} />}
      <span>{isPrivate ? 'Private' : 'Public'}</span>
    </button>
  </div>
</div>


        {/* Navigation Tabs */}
        <div className="flex space-x-8 border-b border-slate-700 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
            { id: 'matches', label: 'Matches', icon: <Activity size={16} /> },
            { id: 'performance', label: 'Performance', icon: <Target size={16} /> },
            { id: 'combos', label: 'Combos', icon: <Trophy size={16} /> },
            { id: 'parts', label: 'Parts', icon: <Database size={16} /> },
            { id: 'awards', label: 'Awards', icon: <Award size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id as any)}
              className={`relative pb-2 text-sm font-medium transition-colors group flex items-center whitespace-nowrap ${
                currentTab === tab.id ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-300'
              }`}
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
              <span className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500 ${currentTab === tab.id ? 'w-full' : 'w-0 group-hover:w-full'}`} />
            </button>
          ))}
        </div>

        {/* Tournament Filter (right under tabs) */}
          <div className="flex space-x-4 sm:space-x-8 border-b border-slate-700 pb-2 mb-8">
            {[
              { id: 'all', label: 'All Tournaments', icon: <Trophy size={16} /> },
              { id: 'practice', label: 'Practice', icon: <Target size={16} /> },
              { id: 'casual', label: 'Casual', icon: <Users size={16} /> },
              { id: 'ranked', label: 'Ranked', icon: <Crown size={16} /> }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setTournamentFilter(filter.id as any)}
                className={`relative pb-2 text-sm font-medium transition-colors group flex items-center whitespace-nowrap ${
                  tournamentFilter === filter.id ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                {filter.icon}
                <span className="ml-2 hidden sm:inline">{filter.label}</span>
                <span className="ml-2 sm:hidden">{filter.label.split(' ')[0]}</span>
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500
                  ${tournamentFilter === filter.id ? 'w-full' : 'w-0 group-hover:w-full'}`}
                />
              </button>
            ))}
          </div>

        {/* Tab content layout: main + sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-3">
            {/* OVERVIEW TAB */}
            {currentTab === 'overview' && (
              <div className="space-y-8">
                {/* Overview stats card */}
                <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                    <BarChart3 size={24} className="mr-2 text-cyan-400" />
                    Overview {tournamentFilter === 'all' ? '(All Tournaments)' : `(${tournamentFilter.charAt(0).toUpperCase() + tournamentFilter.slice(1)})`}
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-cyan-400">{overviewStats.pointsPerMatch.toFixed(2)}</div>
                      <div className="text-sm text-slate-400">Points/Match</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">{overviewStats.pointsPerRound.toFixed(2)}</div>
                      <div className="text-sm text-slate-400">Points/Round</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">{overviewStats.kdRatio.toFixed(2)}</div>
                      <div className="text-sm text-slate-400">K/D Ratio</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-400">{overviewStats.winPercentage.toFixed(1)}%</div>
                      <div className="text-sm text-slate-400">Win%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-400">{overviewStats.roundWins}</div>
                      <div className="text-sm text-slate-400">Round Wins</div>
                    </div>

                    <div className="text-center relative group">
                      <div className="text-2xl font-bold text-pink-400">{overviewStats.pointsDelta.toFixed(2)}</div>
                      <div className="text-sm text-slate-400">PΔ</div>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-cyan-500/30 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-60 text-center z-10">
                        Points Achieved – Points Given, averaged over rounds.
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-400">{overviewStats.matchWins}</div>
                      <div className="text-sm text-slate-400">Match Wins</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400">{overviewStats.matchLosses}</div>
                      <div className="text-sm text-slate-400">Match Losses</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-indigo-400">{overviewStats.flawlessRounds}</div>
                      <div className="text-sm text-slate-400">Flawless Rounds</div>
                    </div>
                    <div className="text-center relative group">
                      <div className="text-2xl font-bold text-violet-400">{overviewStats.overdrive}</div>
                      <div className="text-sm text-slate-400">HOTSHOT</div>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-cyan-500/30 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        Two Extreme Finishes in a row
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fun Stats — always visible in Overview */}
                <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <Target size={20} className="mr-2 text-cyan-400" />
                    Fun Stats
                  </h3>
                
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-lg relative group">
                      <div className="text-4xl font-bold text-yellow-400 mb-2">{funStats.clutchFactor.toFixed(1)}%</div>
                      <div className="text-sm text-slate-400 flex items-center justify-center">Clutch Factor <HelpCircle size={12} className="ml-2" /></div>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-cyan-500/30 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100">
                        Win rate in deciding rounds (3-3 scoreline)
                      </div>
                    </div>
                
                    <div className="text-center p-6 bg-green-500/10 border border-green-500/20 rounded-lg relative group">
                      <div className="text-4xl font-bold text-green-400 mb-2">{funStats.comebackRate.toFixed(1)}%</div>
                      <div className="text-sm text-slate-400 flex items-center justify-center">Comeback Rate <HelpCircle size={12} className="ml-2" /></div>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-cyan-500/30 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100">
                        Percentage of matches won after trailing 0-3
                      </div>
                    </div>
                
                    <div className="text-center p-6 bg-purple-500/10 border border-purple-500/20 rounded-lg relative group">
                      <div className="text-4xl font-bold text-purple-400 mb-2">{funStats.firstStrikeAdvantage.toFixed(1)}%</div>
                      <div className="text-sm text-slate-400 flex items-center justify-center">First-Strike Advantage <HelpCircle size={12} className="ml-2" /></div>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-cyan-500/30 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100">
                        Win rate when scoring first in a session
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Finish Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={finishDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {finishDistribution.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Points per Finish Type</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={pointsPerFinish}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="finish" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '8px' }} labelStyle={{ color: '#06b6d4' }} />
                        <Bar dataKey="points" fill="#06b6d4" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Combos */}
                <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Top Combos</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800">
                      <thead className="bg-slate-800/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">Combo</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Tournaments</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Matches</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Win%</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">K/D Ratio</th>
                        </tr>
                      </thead>
                      <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                        {comboStats.slice(0, 5).map((combo, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{combo.combo}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-center">{combo.tournaments}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-center">{combo.matches}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                              <span className={`font-medium ${combo.winRate >= 60 ? 'text-green-400' : combo.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {combo.winRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-center">{combo.kdRatio.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Last 10 Rounds */}
                <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Last 10 Rounds</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800">
                      <thead className="bg-slate-800/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">Tournament Name + Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">MVP Bey</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Win/Loss</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">K/D</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Points Gained</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Points Given</th>
                        </tr>
                      </thead>
                      <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                        {tournamentRounds.map((round, index) => (
                          <tr key={index} className="hover:bg-slate-800/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                              <div><div className="font-medium">{round.tournamentName}</div><div className="text-xs text-slate-400">{new Date(round.tournamentDate).toLocaleDateString()}</div></div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-cyan-400">{round.mvpBey}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-medium text-white">{round.winLoss}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-white">{round.kdRatio.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-green-400 font-medium">{round.pointsGained}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-red-400 font-medium">{round.pointsGiven}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* MATCHES TAB */}
            {currentTab === 'matches' && (
              <div className="space-y-6">
                {Object.entries(organizedMatches)
                  .sort(([, a], [, b]) => {
                    const aEarliest = Object.values(a)[0]?.[0]?.tournamentDate || '';
                    const bEarliest = Object.values(b)[0]?.[0]?.tournamentDate || '';
                    return new Date(bEarliest).getTime() - new Date(aEarliest).getTime();
                  })
                  .map(([tournamentName, opponents]) => (
                    <div key={tournamentName} className="bg-slate-900/50 border border-cyan-500/30 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleTournament(tournamentName)}
                        className="w-full px-6 py-4 bg-slate-800/50 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          {expandedTournaments.has(tournamentName) ? <ChevronDown size={20} className="text-cyan-400" /> : <ChevronRight size={20} className="text-cyan-400" />}
                          <div className="text-left">
                            <div className="font-bold text-white">{tournamentName}</div>
                            <div className="text-sm text-slate-400">{Object.values(opponents)[0]?.[0]?.tournamentDate ? new Date(Object.values(opponents)[0][0].tournamentDate).toLocaleDateString() : 'Unknown Date'}</div>
                          </div>
                        </div>
                        <div className="text-sm text-slate-400">{Object.keys(opponents).length} rounds</div>
                      </button>

                      {expandedTournaments.has(tournamentName) && (
                        <div className="border-t border-slate-700">
                          {Object.entries(opponents)
                            .map(([roundKey, matches]) => {
                              const earliestMatch = matches.reduce((earliest: number, m: any) => {
                                const t = new Date(m.tournamentDate).getTime();
                                return !earliest || t < earliest ? t : earliest;
                              }, 0);
                              return { roundKey, matches, sortKey: earliestMatch };
                            })
                            .sort((a, b) => a.sortKey - b.sortKey)
                            .map(({ roundKey, matches }, roundIndex) => {
                              let rawOpponent = roundKey.split('__TO:')[0] || 'Unknown';
                              // strip UUID-like prefix before underscore if present
                              const opponentPart = rawOpponent.includes('_')
                                ? rawOpponent.substring(rawOpponent.indexOf('_') + 1)
                                : rawOpponent;
                              const playerWins = matches.filter(m => m.isWin).length;
                              const opponentWins = matches.length - playerWins;
                              const winLoss = `${playerWins}-${opponentWins}`;
                              const resultLabel = playerWins > opponentWins ? 'Win' : 'Loss';
                              const playerScore = matches.reduce((s, m) => s + (m.pointsGained || 0), 0);
                              const opponentScore = matches.reduce((s, m) => s + (m.pointsGiven || 0), 0);
                              const roundNumber = roundIndex + 1;
                              const roundKeyForToggle = `${tournamentName}_${roundKey}`;
                              return (
                                <div key={roundKeyForToggle} className="border-b border-slate-800 last:border-b-0">
                                  <button onClick={() => toggleRound(roundKeyForToggle)} className="w-full px-8 py-3 bg-slate-900/30 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                                    <div className="flex flex-col text-left">
                                      <span className="font-medium text-white">Round {roundNumber} | vs {opponentPart}</span>
                                      <span className={`text-sm font-medium ${resultLabel === 'Win' ? 'text-blue-400' : 'text-red-400'}`}>{resultLabel} {playerScore} - {opponentScore}</span>
                                    </div>
                                    <div className="text-sm text-slate-400">{matches.length} matches</div>
                                  </button>

                                {expandedRounds.has(roundKeyForToggle) && (
                                  <div className="px-6 py-4 bg-slate-950/30">
                                    {/* Group matches by phase */}
                                    {Object.entries(
                                      matches.reduce((acc: any, m: MatchData) => {
                                        if (!acc[m.phaseNumber]) acc[m.phaseNumber] = [];
                                        acc[m.phaseNumber].push(m);
                                        return acc;
                                      }, {})
                                    ).map(([phase, phaseMatches]) => (
                                      <div key={phase} className="mb-4">
                                        <h4 className="text-sm font-semibold text-cyan-400 mb-2">
                                          Phase {phase}
                                        </h4>
                                
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                                          {phaseMatches
                                            .sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0))
                                            .map((match: MatchData, i: number) => (
                                              <div
                                                key={i}
                                                className={`border rounded-md p-2 text-sm ${
                                                  match.isWin
                                                    ? 'border-green-500/30 bg-green-500/5'
                                                    : 'border-red-500/30 bg-red-500/5'
                                                }`}
                                              >
                                                <div className="flex justify-between items-center mb-1">
                                                  <div className="text-xs text-slate-500">
                                                    M{match.matchNumber}
                                                  </div>
                                                  <div className="flex items-center space-x-2">
                                                    <span
                                                      className={`font-semibold ${
                                                        match.isWin ? 'text-green-400' : 'text-red-400'
                                                      }`}
                                                    >
                                                      {match.isWin ? 'WIN' : 'LOSS'}
                                                    </span>
                                                    <span className="text-slate-400">|</span>
                                                    <span className="text-cyan-400">{match.outcome}</span>
                                                  </div>
                                                </div>
                                
                                                <div className="flex justify-between">
                                                  <div className="text-left">
                                                    <div className="font-medium text-white">{playerName}</div>
                                                    <div className="text-xs text-cyan-400 truncate">
                                                      {match.playerBeyblade}
                                                    </div>
                                                    <div className="font-bold text-green-400">
                                                      {match.pointsGained} pts
                                                    </div>
                                                  </div>
                                
                                                  <div className="text-right">
                                                    <div className="font-medium text-white">
                                                      {match.opponentName}
                                                    </div>
                                                    <div className="text-xs text-slate-300 truncate">
                                                      {match.opponentBeyblade}
                                                    </div>
                                                    <div className="font-bold text-red-400">
                                                      {match.pointsGiven} pts
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* PERFORMANCE TAB (placeholder) */}
            {currentTab === 'performance' && (
              <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-12 text-center">
                <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4"><Target size={32} className="text-slate-400" /></div>
                <h3 className="text-xl font-bold text-white mb-2">Performance Analytics</h3>
                <div className="inline-block bg-gradient-to-r from-cyan-600 to-purple-600 text-white px-6 py-2 rounded-full font-bold text-lg mb-6">COMING SOON</div>
                <p className="text-slate-400 max-w-2xl mx-auto">Advanced performance analytics including heat maps, trend analysis, and predictive insights are coming soon.</p>
              </div>
            )}

            {/* COMBOS TAB */}
            {currentTab === 'combos' && (
              <div className="space-y-8">
                {comboStats.length > 0 && (
                  <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg p-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trophy size={32} className="text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-yellow-400 mb-2">MVP Combo</h3>
                    <div className="text-3xl font-bold text-white mb-4">{comboStats[0].combo}</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                      <div className="text-center"><div className="text-xl font-bold text-cyan-400">{comboStats[0].matches}</div><div className="text-sm text-slate-400">Matches</div></div>
                      <div className="text-center"><div className="text-xl font-bold text-green-400">{comboStats[0].winRate.toFixed(1)}%</div><div className="text-sm text-slate-400">Win Rate</div></div>
                      <div className="text-center"><div className="text-xl font-bold text-purple-400">{comboStats[0].kdRatio.toFixed(2)}</div><div className="text-sm text-slate-400">K/D Ratio</div></div>
                      <div className="text-center"><div className="text-xl font-bold text-orange-400">{comboStats[0].pointsDelta.toFixed(2)}</div><div className="text-sm text-slate-400">PΔ</div></div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Search combos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                  </div>
                  <select value={selectedCombo} onChange={(e) => setSelectedCombo(e.target.value)} className="bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="">Select combo for detailed analysis</option>
                    {comboStats.map(combo => <option key={combo.combo} value={combo.combo}>{combo.combo} ({combo.matches} matches)</option>)}
                  </select>
                </div>

                <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">All Combos</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800">
                      <thead className="bg-slate-800/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">Combo</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Tournaments</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Matches</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Win Rate</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">K/D</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">PΔ</th>
                        </tr>
                      </thead>
                      <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                        {filteredCombos.map((combo, idx) => (
                          <tr key={idx} onClick={() => setSelectedCombo(combo.combo === selectedCombo ? '' : combo.combo)} className={`hover:bg-slate-800/50 cursor-pointer ${selectedCombo === combo.combo ? 'bg-cyan-500/10' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{combo.combo}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-center">{combo.tournaments}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-center">{combo.matches}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center"><span className={`font-medium ${combo.winRate >= 60 ? 'text-green-400' : combo.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{combo.winRate.toFixed(1)}%</span></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white text-center">{combo.kdRatio.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center"><span className={`font-medium ${combo.pointsDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>{combo.pointsDelta >= 0 ? '+' : ''}{combo.pointsDelta.toFixed(2)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedComboData && (
                  <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-6">
                    <h4 className="text-lg font-bold text-cyan-400 mb-4">Detailed Analysis: {selectedComboData.combo}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="font-semibold text-white mb-3">Win Finishes</h5>
                        <div className="space-y-2">{Object.entries(selectedComboData.finishDistribution).map(([finish, count]) => <div key={finish} className="flex justify-between items-center"><span className="text-sm text-slate-300">{finish}</span><span className="text-sm font-medium text-white">{count}</span></div>)}</div>
                      </div>
                      <div>
                        <h5 className="font-semibold text-white mb-3">Points Breakdown</h5>
                        <div className="space-y-2">{Object.entries(selectedComboData.pointsPerFinish).map(([finish, points]) => <div key={finish} className="flex justify-between items-center"><span className="text-sm text-slate-300">{finish}</span><span className="text-sm font-medium text-white">{points} pts</span></div>)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PARTS TAB */}
            {currentTab === 'parts' && (
              <div className="space-y-8">
                {['Main Blade', 'Blade', 'Assist Blade', 'Ratchet', 'Bit', 'Lockchip'].map(type => {
                  const partsOfType = partStats.filter(p => p.partType === type);
                  if (partsOfType.length === 0) return null;
                  return (
                    <div key={type} className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
                      <h3 className="text-lg font-bold text-white mb-4">{type}</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-800">
                          <thead className="bg-slate-800/50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">Part</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Matches</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Wins</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Losses</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Win %</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">Confidence</th>
                            </tr>
                          </thead>
                          <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                            {partsOfType.map((p, idx) => (
                              <tr key={`${type}-${p.partName}-${idx}`} className="hover:bg-slate-800/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{p.partName}</td>
                                <td className="px-6 py-4 text-center text-sm text-white">{p.matches}</td>
                                <td className="px-6 py-4 text-center text-sm text-white">{p.wins}</td>
                                <td className="px-6 py-4 text-center text-sm text-white">{p.losses}</td>
                                <td className={`px-6 py-4 text-center text-sm font-medium ${p.winRate >= 60 ? 'text-green-400' : p.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{p.winRate.toFixed(1)}%</td>
                                <td className="px-6 py-4 text-center text-sm text-white">{p.confidence.toFixed(3)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* AWARDS TAB */}
            {currentTab === 'awards' && (
              <AwardsTab 
                awards={playerAwards} 
                onRefresh={fetchPlayerAwards}
              />
            )}
          </div>

          {/* SIDEBAR */}
          <div className="xl:col-span-1 space-y-6">
            {/* Last 20 Matches */}
            <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">Last 20 Matches</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {matchData.slice(0, 20).map((m, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${m.isWin ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-sm font-medium ${m.isWin ? 'text-green-400' : 'text-red-400'}`}>{m.isWin ? 'WIN' : 'LOSS'}</span>
                      <span className="text-xs text-slate-400">{m.outcome}</span>
                    </div>
                    <div className="text-xs text-slate-300">vs {m.opponentName}</div>
                    <div className="text-xs font-mono text-cyan-400">{m.playerBeyblade}</div>
                    <div className="text-xs font-mono text-slate-400">vs {m.opponentBeyblade}</div>
                    <div className="text-xs text-slate-500">{m.tournamentName}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stadium Side Win Rates */}
            <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">Stadium Side Win Rates</h3>
              <div className="space-y-4">
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-cyan-400">{overviewStats.bSideWinRate?.toFixed(1) ?? '---'}%</div>
                  <div className="text-sm text-slate-400">B Side Win Rate</div>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-400">{overviewStats.xSideWinRate?.toFixed(1) ?? '---'}%</div>
                  <div className="text-sm text-slate-400">X Side Win Rate</div>
                </div>
              </div>
            </div>

            {/* Type Performance */}
            {roleStats && (
              <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">Types Performance</h3>
                <div className="space-y-4">
                  {['Attack', 'Defense', 'Stamina', 'Balance'].map(type => {
                    const stat = roleStats[type];
                    if (!stat) return null;
                    const matches = stat.wins + stat.losses;
                    const wr = matches > 0 ? (stat.wins / matches) * 100 : 0;
                    const kda = stat.deaths > 0 ? (stat.kills / stat.deaths) : stat.kills;
                    return (
                      <div key={type} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <img src={`/${type.toLowerCase()}.png`} alt={type} className="w-6 h-6" />
                          <span className="font-medium text-white">{type}</span>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${wr >= 60 ? 'text-green-400' : wr >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                            WR {wr.toFixed(1)}%
                          </div>
                          <div className="text-sm text-slate-400">KDA {kda}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Finish Counts */}
            <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">Finish Counts</h3>
              <div className="space-y-3">
                {finishDistribution.map((data: any, i: number) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
                      <span className="text-sm text-slate-300">{data.name}</span>
                    </div>
                    <span className="text-sm font-medium text-white">{data.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 3 Parts (quick peek) */}
            <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">Top Parts (by confidence)</h3>
              <div className="space-y-3">
                {partStats.slice(0, 3).map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                    <div className="text-sm">
                      <div className="font-medium text-white">{p.partName}</div>
                      <div className="text-xs text-slate-400">{p.partType}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">{p.confidence.toFixed(3)}</div>
                      <div className="text-xs text-slate-400">{p.winRate.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function LockIcon() { return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 17v-2" /><rect x="4" y="11" width="16" height="10" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>; }
function UnlockIcon() { return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="11" width="16" height="10" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0" /></svg>; }