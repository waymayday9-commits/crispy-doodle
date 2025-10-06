import React, { useState, useEffect } from 'react';
import {
  BarChart3, Target, Eye, Search, X, Trophy, Globe, Database, Crown, TrendingUp
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend
} from 'recharts';
import { supabase } from '../../../lib/supabase';
import { parseBeybladeName, type AllPartsData, type ParsedBeyblade } from '../../../utils/beybladeParser';
import Select from "react-select";

interface PartStats {
  name: string;
  usage: number;
  wins: number;
  losses: number;
  winRate: number;
  weightedWinRate: number;
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
  bladeLine: string;
  allMatches: any[];
  parts: ParsedBeyblade | any;
}

interface TournamentMeta {
  id: string;
  name: string;
  tournament_date: string;
  topCombos: ComboStats[];
  diversityScore: number;
  totalMatches: number;
  uniqueCombos: number;
}

interface ShowAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  columns: { key: string; label: string }[];
  onRowClick?: (row: any) => void;
}

function SortableHeader({
  label,
  columnKey,
  sortConfig,
  onSort,
  align = "left"
}: {
  label: string;
  columnKey: string;
  sortConfig: { key: string; direction: "asc" | "desc" | null };
  onSort: (key: string) => void;
  align?: "left" | "center" | "right";
}) {
  const isActive = sortConfig.key === columnKey;
  return (
    <th
      onClick={() => onSort(columnKey)}
      className={`px-6 py-3 text-xs font-medium text-cyan-400 uppercase cursor-pointer select-none text-${align}`}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {isActive && (
          <span>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
        )}
      </div>
    </th>
  );
}

function ShowAllModal({ isOpen, onClose, title, data, columns, onRowClick }: ShowAllModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({ key: "", direction: null });

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const filteredData = data.filter(row =>
    columns.some(col =>
      String(row[col.key] || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (aVal === bVal) return 0;
    if (sortConfig.direction === "asc") return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-slate-700">
        <div className="bg-gradient-to-r from-cyan-600 to-purple-600 px-6 py-4 text-white">
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
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-700 bg-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-800/50 sticky top-0">
                <tr>
                  {columns.map(col => (
                    <SortableHeader
                      key={col.key}
                      label={col.label}
                      columnKey={col.key}
                      sortConfig={sortConfig}
                      onSort={handleSort}
                      align="left"
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                {sortedData.map((row, index) => (
                  <tr
                    key={index}
                    className={`hover:bg-slate-800/50 ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map(col => (
                      <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {typeof row[col.key] === 'number'
                          ? (col.key.includes('Rate') || col.key.includes('Score') || col.key.includes('Pts')
                            ? row[col.key].toFixed(1)
                            : row[col.key])
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
interface PerformanceCardProps {
  partType: string;
  partStats: { [key: string]: { [name: string]: PartStats } };
  showAllParts: (partType: string) => void;
}

function PerformanceCard({ partType, partStats, showAllParts }: PerformanceCardProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({ key: "weightedWinRate", direction: "desc" });

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedParts = [...Object.values(partStats[partType] || {})]
    .filter(part => part.usage > 0)
    .sort((a, b) => {
      if (!sortConfig.key || !sortConfig.direction) return 0;
      const aVal = a[sortConfig.key as keyof PartStats];
      const bVal = b[sortConfig.key as keyof PartStats];
      if (aVal === bVal) return 0;
      if (sortConfig.direction === "asc") return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });

  return (
    <div className="border border-slate-700 bg-slate-900/40 p-6 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white capitalize">
          Global {partType === 'assistBlade' ? 'Assist Blades' : partType === 'mainBlade' ? 'Main Blades' : `${partType}s`} Performance
        </h3>
        <button
          onClick={() => showAllParts(partType)}
          className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-3 py-2 rounded-md text-sm flex items-center space-x-2"
        >
          <Eye size={14} />
          <span>Show All</span>
        </button>
      </div>

      {Object.keys(partStats[partType] || {}).length === 0 ? (
        <div className="text-center py-6">
          <BarChart3 size={32} className="mx-auto text-slate-400 mb-2" />
          <p className="text-slate-400 text-sm">No {partType} data available</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800/50">
              <tr>
                <SortableHeader label="Name" columnKey="name" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Usage" columnKey="usage" sortConfig={sortConfig} onSort={handleSort} align="center" />
                <SortableHeader label="Win Rate" columnKey="winRate" sortConfig={sortConfig} onSort={handleSort} align="center" />
                <SortableHeader label="Weighted" columnKey="weightedWinRate" sortConfig={sortConfig} onSort={handleSort} align="center" />
              </tr>
            </thead>
            <tbody className="bg-slate-950/50 divide-y divide-slate-800">
              {sortedParts.slice(0, 5).map((part, index) => (
                <tr key={index} className="hover:bg-slate-800/50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">{part.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-white text-center">{part.usage}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                    <span className={`font-medium ${
                      part.winRate >= 60 ? 'text-green-400' :
                      part.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {part.winRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-cyan-400 text-center">
                    {part.weightedWinRate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export function MetaAnalysisTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [typeDistribution, setTypeDistribution] = useState<any[]>([]);
  const [sideWins, setSideWins] = useState({ bSide: 0, xSide: 0, totalMatches: 0 });
  const [partStats, setPartStats] = useState<{ [key: string]: { [name: string]: PartStats } }>({
    blade: {}, mainBlade: {}, ratchet: {}, bit: {}, lockchip: {}, assistBlade: {}
  });
  const [tournamentMetas, setTournamentMetas] = useState<TournamentMeta[]>([]);
  const [showAllModal, setShowAllModal] = useState<{ isOpen: boolean; title: string; data: any[]; columns: any[]; onRowClick?: (row:any)=>void }>({
    isOpen: false,
    title: '',
    data: [],
    columns: []
  });
  const [allCombos, setAllCombos] = useState<ComboStats[]>([]);

  const [partsData, setPartsData] = useState<AllPartsData>({
    blades: [],
    ratchets: [],
    bits: [],
    lockchips: [],
    assistBlades: []
  });

  const [selectedPartType, setSelectedPartType] = useState("");
  const [selectedPartName, setSelectedPartName] = useState("");
  const [partCombos, setPartCombos] = useState<ComboStats[]>([]);
  const [currentSubTab, setCurrentSubTab] = useState<'parts' | 'combos'>('parts');
  const [selectedCombo, setSelectedCombo] = useState<string>('');
  const [comboAnalysisData, setComboAnalysisData] = useState<any>(null);
  const [loadingComboAnalysis, setLoadingComboAnalysis] = useState(false);

  const partTypeOptions = [
    { value: "blade", label: "Blade" },
    { value: "mainBlade", label: "Main Blade" },
    { value: "ratchet", label: "Ratchet" },
    { value: "bit", label: "Bit" },
    { value: "lockchip", label: "Lockchip" },
    { value: "assistBlade", label: "Assist Blade" }
  ];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      try {
        const [bladesRes, ratchetsRes, bitsRes, lockchipsRes, assistBladesRes] = await Promise.all([
          supabase.from('beypart_blade').select('*'),
          supabase.from('beypart_ratchet').select('*'),
          supabase.from('beypart_bit').select('*'),
          supabase.from('beypart_lockchip').select('*'),
          supabase.from('beypart_assistblade').select('*')
        ]);
        
        const newPartsData: AllPartsData = {
          blades: bladesRes.data || [],
          ratchets: ratchetsRes.data || [],
          bits: bitsRes.data || [],
          lockchips: lockchipsRes.data || [],
          assistBlades: assistBladesRes.data || []
        };
        
        setPartsData(newPartsData);
        
        const fetchAllMatches = async () => {
          let from = 0;
          const size = 1000;
          let allMatches: any[] = [];

          while (true) {
            const { data, error } = await supabase
              .from("match_results")
              .select("*")
              .range(from, from + size - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;

            allMatches = allMatches.concat(data);
            if (data.length < size) break;
            from += size;
          }

          return allMatches;
        };

        const matchesData = await fetchAllMatches();

        const { data: tournaments, error: tournamentsError } = await supabase
          .from('tournaments')
          .select('id, name, tournament_date')
          .eq('is_practice', false)
          .order('tournament_date', { ascending: false });

        if (tournamentsError) throw tournamentsError;

        const partStatsObj: any = {
          blade: {}, mainBlade: {}, ratchet: {}, bit: {}, lockchip: {}, assistBlade: {}
        };
        const allCombosList: ComboStats[] = [];
        let bSideWins = 0, xSideWins = 0, totalSideMatches = 0;
        const typeCount: { Attack: number; Defense: number; Balance: number; Stamina: number } = {
          Attack: 0, Defense: 0, Balance: 0, Stamina: 0
        };

        const addOrUpdateCombo = (
          comboParts: ParsedBeyblade | any,
          playerName: string,
          isWin: boolean,
          points = 0,
          originalMatch: any = null,
          comboStr?: string
        ) => {
          const comboKey = (comboStr && String(comboStr).trim()) ||
            (originalMatch?.player1_beyblade ? String(originalMatch.player1_beyblade).trim() :
             originalMatch?.player2_beyblade ? String(originalMatch.player2_beyblade).trim() :
             originalMatch?.player1_combo ? String(originalMatch.player1_combo).trim() :
             originalMatch?.player2_combo ? String(originalMatch.player2_combo).trim() : '');

          let combo = allCombosList.find(c => c.combo === comboKey && c.player === playerName);
          if (!combo) {
            combo = {
              combo: comboKey,
              player: playerName,
              wins: 0,
              losses: 0,
              totalMatches: 0,
              winRate: 0,
              weightedWinRate: 0,
              totalPoints: 0,
              avgPointsPerMatch: 0,
              comboScore: 0,
              bladeLine: comboParts?.bladeLine || comboParts?.type || '',
              allMatches: [],
              parts: comboParts
            };
            allCombosList.push(combo);
          }
          combo.totalMatches++;
          if (isWin) combo.wins++;
          else combo.losses++;
          combo.totalPoints = (combo.totalPoints || 0) + (points || 0);
          if (originalMatch) combo.allMatches.push(originalMatch);
        };

        matchesData.forEach((match: any) => {
          if (!match.winner_name && !match.winner) return;

          const p1Name = match.player1_name || match.player1 || match.player1_normalized || '';
          const p2Name = match.player2_name || match.player2 || match.player2_normalized || '';
          const winnerName = match.winner_name || match.winner || '';

          const p1Parsed: ParsedBeyblade = parseBeybladeName(match.player1_beyblade || match.player1_combo || '', match.player1_blade_line || undefined, newPartsData);
          const p2Parsed: ParsedBeyblade = parseBeybladeName(match.player2_beyblade || match.player2_combo || '', match.player2_blade_line || undefined, newPartsData);

          const points = match.points_awarded || 0;

          [p1Parsed, p2Parsed].forEach(parsed => {
            const bitVal = parsed.bit;
            if (bitVal) {
              const bitRecord = newPartsData.bits.find((b:any) => b.Bit === bitVal || b.Shortcut === bitVal || b.Shortcut?.toString() === bitVal?.toString());
              if (bitRecord && bitRecord.Type && typeCount.hasOwnProperty(bitRecord.Type)) {
                (typeCount as any)[bitRecord.Type]++;
              }
            }
          });

          const bPlayer = (match.b_side_player || "").toLowerCase();
          const xPlayer = (match.x_side_player || "").toLowerCase();
          const winner = (match.normalized_winner_name || match.winner_name || "").toLowerCase();
          
          if (bPlayer && xPlayer) {
            totalSideMatches++;
          
            if (winner === bPlayer) {
              bSideWins++;
            } else if (winner === xPlayer) {
              xSideWins++;
            }
          }

          const normalizedWinner = (match.normalized_winner_name || String(winnerName || '').toLowerCase());
          const normalizedP1 = (match.normalized_player1_name || String(p1Name || '').toLowerCase());
          const normalizedP2 = (match.normalized_player2_name || String(p2Name || '').toLowerCase());

          const p1IsWin = normalizedWinner && normalizedP1 ? normalizedWinner === normalizedP1 : (winnerName === p1Name);
          const p2IsWin = normalizedWinner && normalizedP2 ? normalizedWinner === normalizedP2 : (winnerName === p2Name);

          addOrUpdateCombo(p1Parsed, p1Name, p1IsWin, points, match, match.player1_beyblade || match.player1_combo || '');
          addOrUpdateCombo(p2Parsed, p2Name, p2IsWin, points, match, match.player2_beyblade || match.player2_combo || '');

          const updateStats = (parsed: ParsedBeyblade, isWin: boolean) => {
            Object.entries(parsed).forEach(([pt, val]) => {
              if (!val) return;
              if (pt === 'isCustom') return;
              if (!partStatsObj[pt]) partStatsObj[pt] = {};
              if (!partStatsObj[pt][val]) {
                partStatsObj[pt][val] = { name: val, usage: 0, wins: 0, losses: 0, winRate: 0, weightedWinRate: 0 };
              }
              partStatsObj[pt][val].usage++;
              if (isWin) partStatsObj[pt][val].wins++;
              else partStatsObj[pt][val].losses++;
            });
          };

          updateStats(p1Parsed, p1IsWin);
          updateStats(p2Parsed, p2IsWin);
        });

        Object.keys(partStatsObj).forEach(pt => {
          Object.values(partStatsObj[pt]).forEach((p: any) => {
            const total = p.wins + p.losses;
            p.winRate = total > 0 ? (p.wins / total) * 100 : 0;
            p.weightedWinRate = total > 0 ? ((p.wins / total) * 100) * (total / (total + 10)) : 0;
          });
        });

        allCombosList.forEach(c => {
          c.winRate = c.totalMatches > 0 ? (c.wins / c.totalMatches) * 100 : 0;
          c.avgPointsPerMatch = c.totalMatches > 0 ? (c.totalPoints / c.totalMatches) : 0;
          const weighted = c.totalMatches > 0 ? (c.wins / c.totalMatches) * (c.totalMatches / (c.totalMatches + 10)) : 0;
          c.weightedWinRate = weighted * 100;
          c.comboScore = weighted * (c.avgPointsPerMatch / 3) * 100;
        });

        const tournamentMetaData: TournamentMeta[] = [];
        (tournaments || []).forEach((t: any) => {
          const tMatches = matchesData.filter((m: any) => m.tournament_id === t.id && !(m.tournaments?.is_practice));
          if (tMatches.length === 0) return;

          const tComboMap: { [k:string]: ComboStats } = {};
          const uniqueCombos = new Set<string>();

          tMatches.forEach((m: any) => {
            if (!m.winner_name) return;

            const normalizedPlayer1 = m.normalized_player1_name || (m.player1_name || m.player1 || '').toLowerCase();
            const normalizedPlayer2 = m.normalized_player2_name || (m.player2_name || m.player2 || '').toLowerCase();
            const normalizedWinner = m.normalized_winner_name || (m.winner_name || m.winner || '').toLowerCase();

            uniqueCombos.add(m.player1_beyblade || m.player1_combo);
            uniqueCombos.add(m.player2_beyblade || m.player2_combo);

            const processCombo = (playerName: string, beybladeStr: string, bladeLine: string, isWin: boolean) => {
              const key = `${beybladeStr}_${playerName}`;
              if (!tComboMap[key]) {
                tComboMap[key] = {
                  combo: beybladeStr,
                  player: playerName,
                  wins: 0,
                  losses: 0,
                  totalMatches: 0,
                  winRate: 0,
                  weightedWinRate: 0,
                  totalPoints: 0,
                  avgPointsPerMatch: 0,
                  comboScore: 0,
                  bladeLine: bladeLine || '',
                  allMatches: []
                } as ComboStats;
              }
              const combo = tComboMap[key];
              combo.totalMatches++;
              if (isWin) {
                combo.wins++;
                combo.totalPoints += m.points_awarded || 0;
              } else combo.losses++;
              combo.allMatches.push(m);
            };

            processCombo(m.player1_name || m.player1, m.player1_beyblade || m.player1_combo, m.player1_blade_line || '', normalizedWinner === normalizedPlayer1);
            processCombo(m.player2_name || m.player2, m.player2_beyblade || m.player2_combo, m.player2_blade_line || '', normalizedWinner === normalizedPlayer2);
          });

          const combosArr = Object.values(tComboMap).map((combo:any) => {
            combo.winRate = combo.totalMatches > 0 ? (combo.wins / combo.totalMatches) * 100 : 0;
            combo.weightedWinRate = combo.totalMatches > 0 ? (combo.wins / combo.totalMatches) * (combo.totalMatches / (combo.totalMatches + 10)) : 0;
            combo.avgPointsPerMatch = combo.totalMatches > 0 ? combo.totalPoints / combo.totalMatches : 0;
            combo.comboScore = combo.weightedWinRate * (combo.avgPointsPerMatch / 3) * 100;
            return combo;
          }).sort((a:any,b:any) => b.comboScore - a.comboScore).slice(0,5);

          const usage = Object.values(tComboMap).map((c:any)=>c.totalMatches);
          const totalUsage = usage.reduce((s:number,v:number)=>s+v,0);
          let diversity = 0;
          if (totalUsage > 0) {
            usage.forEach(u => {
              if (u > 0) {
                const p = u / totalUsage;
                diversity -= p * Math.log2(p);
              }
            });
          }
          const maxDiversity = usage.length > 1 ? Math.log2(usage.length) : 1;
          const normalizedDiversity = maxDiversity > 0 ? diversity / maxDiversity : 0;

          tournamentMetaData.push({
            id: t.id,
            name: t.name,
            tournament_date: t.tournament_date,
            topCombos: combosArr,
            diversityScore: normalizedDiversity,
            totalMatches: tMatches.length,
            uniqueCombos: uniqueCombos.size
          });
        });

        setTypeDistribution([
          { type: 'Attack', count: typeCount.Attack || 0 },
          { type: 'Defense', count: typeCount.Defense || 0 },
          { type: 'Balance', count: typeCount.Balance || 0 },
          { type: 'Stamina', count: typeCount.Stamina || 0 }
        ]);
        setSideWins({ bSide: bSideWins, xSide: xSideWins, totalMatches: totalSideMatches });
        setPartStats(partStatsObj);
        setAllCombos(allCombosList);
        setTournamentMetas(tournamentMetaData);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching/process data', err);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);
  
  useEffect(() => {
    if (!selectedPartType || !selectedPartName) {
      setPartCombos([]);
      return;
    }

    const filteredCombos = allCombos.filter(combo => {
      const parsedCombo = combo.parts || parseBeybladeName(
        combo.combo,
        combo.bladeLine || undefined,
        partsData
      );
      const partValue = parsedCombo ? parsedCombo[selectedPartType as keyof ParsedBeyblade] : undefined;
      return partValue === selectedPartName;
    });

    const grouped: { [combo: string]: any } = {};
    filteredCombos.forEach(c => {
      if (!grouped[c.combo]) {
        grouped[c.combo] = {
          combo: c.combo,
          totalMatches: 0,
          wins: 0,
          totalPoints: 0,
          players: []
        };
      }

      grouped[c.combo].totalMatches += c.totalMatches;
      grouped[c.combo].wins += c.wins;
      grouped[c.combo].totalPoints += c.totalPoints;
      grouped[c.combo].players.push({
        player: c.player,
        totalMatches: c.totalMatches,
        wins: c.wins,
        losses: c.losses,
        totalPoints: c.totalPoints
      });
    });

    const aggregated = Object.values(grouped).map((g: any) => {
      const winRate = g.totalMatches > 0 ? g.wins / g.totalMatches : 0;
      const avgPoints = g.totalMatches > 0 ? g.totalPoints / g.totalMatches : 0;
      const weighted = g.totalMatches > 0 ? winRate * (g.totalMatches / (g.totalMatches + 10)) : 0;

      return {
        ...g,
        users: new Set(g.players.map((p:any)=>p.player)).size,
        winRate: winRate * 100,
        weightedWinRate: weighted * 100,
        avgPointsPerMatch: avgPoints,
        comboScore: weighted * (avgPoints / 3) * 100
      };
    });

    setPartCombos(aggregated.sort((a, b) => b.comboScore - a.comboScore));
  }, [selectedPartType, selectedPartName, allCombos]);

  const fetchComboAnalysis = async (comboName: string) => {
    setLoadingComboAnalysis(true);
    try {
      // Fetch all matches for this combo
      const { data: allMatches, error } = await supabase
        .from('match_results')
        .select('*')
        .or(`player1_beyblade.eq.${comboName},player2_beyblade.eq.${comboName}`);

      if (error) throw error;

      // Process combo analysis data
      const comboMatches = (allMatches || []).filter(match => 
        match.player1_beyblade === comboName || match.player2_beyblade === comboName
      );

      // Calculate player baselines
      const playerBaselines: { [player: string]: { wins: number; total: number; winRate: number } } = {};
      
      (allMatches || []).forEach(match => {
        [match.player1_name, match.player2_name].forEach(playerName => {
          if (!playerBaselines[playerName]) {
            playerBaselines[playerName] = { wins: 0, total: 0, winRate: 0 };
          }
          playerBaselines[playerName].total++;
          if (match.winner_name === playerName) {
            playerBaselines[playerName].wins++;
          }
        });
      });

      Object.values(playerBaselines).forEach(baseline => {
        baseline.winRate = baseline.total > 0 ? (baseline.wins / baseline.total) * 100 : 0;
      });

      // Calculate combo performance by player
      const playerComboPerformance: { [player: string]: { wins: number; total: number; winRate: number; baseline: number } } = {};
      
      comboMatches.forEach(match => {
        const comboPlayer = match.player1_beyblade === comboName ? match.player1_name : match.player2_name;
        
        if (!playerComboPerformance[comboPlayer]) {
          playerComboPerformance[comboPlayer] = {
            wins: 0,
            total: 0,
            winRate: 0,
            baseline: playerBaselines[comboPlayer]?.winRate || 0
          };
        }
        
        playerComboPerformance[comboPlayer].total++;
        if (match.winner_name === comboPlayer) {
          playerComboPerformance[comboPlayer].wins++;
        }
      });

      Object.values(playerComboPerformance).forEach(perf => {
        perf.winRate = perf.total > 0 ? (perf.wins / perf.total) * 100 : 0;
      });

      // Calculate difficulty
      const performanceDiffs = Object.values(playerComboPerformance)
        .filter(perf => perf.total >= 3) // Minimum matches for reliable data
        .map(perf => ({
          baseline: perf.baseline,
          diff: perf.winRate - perf.baseline
        }));

      let difficulty = 'Neutral';
      if (performanceDiffs.length >= 3) {
        const avgDiff = performanceDiffs.reduce((sum, p) => sum + p.diff, 0) / performanceDiffs.length;
        const correlation = calculateCorrelation(
          performanceDiffs.map(p => p.baseline),
          performanceDiffs.map(p => p.diff)
        );

        if (correlation > 0.3 && avgDiff < -5) difficulty = 'Very Hard';
        else if (correlation > 0.15 && avgDiff < -2) difficulty = 'Hard';
        else if (correlation < -0.3 && avgDiff > 5) difficulty = 'Very Easy';
        else if (correlation < -0.15 && avgDiff > 2) difficulty = 'Easy';
      }

      // Top players using this combo
      const topPlayers = Object.entries(playerComboPerformance)
        .sort(([,a], [,b]) => b.winRate - a.winRate)
        .slice(0, 10)
        .map(([player, perf]) => ({
          player,
          matches: perf.total,
          wins: perf.wins,
          losses: perf.total - perf.wins,
          winRate: perf.winRate,
          baseline: perf.baseline,
          performance: perf.winRate - perf.baseline
        }));

      // Matchup analysis
      const matchupStats: { [opponent: string]: { wins: number; total: number; winRate: number } } = {};
      
      comboMatches.forEach(match => {
        const isPlayer1Combo = match.player1_beyblade === comboName;
        const opponentCombo = isPlayer1Combo ? match.player2_beyblade : match.player1_beyblade;
        const comboPlayer = isPlayer1Combo ? match.player1_name : match.player2_name;
        
        if (!matchupStats[opponentCombo]) {
          matchupStats[opponentCombo] = { wins: 0, total: 0, winRate: 0 };
        }
        
        matchupStats[opponentCombo].total++;
        if (match.winner_name === comboPlayer) {
          matchupStats[opponentCombo].wins++;
        }
      });

      Object.values(matchupStats).forEach(stat => {
        stat.winRate = stat.total > 0 ? (stat.wins / stat.total) * 100 : 0;
      });

      const bestMatchups = Object.entries(matchupStats)
        .filter(([, stat]) => stat.total >= 3)
        .sort(([,a], [,b]) => b.winRate - a.winRate)
        .slice(0, 10)
        .map(([opponent, stat]) => ({
          opponent,
          matches: stat.total,
          winRate: stat.winRate,
          weightedWinRate: stat.total > 0 ? stat.winRate * (stat.total / (stat.total + 10)) : 0
        }));

      const worstMatchups = Object.entries(matchupStats)
        .filter(([, stat]) => stat.total >= 3)
        .sort(([,a], [,b]) => a.winRate - b.winRate)
        .slice(0, 10)
        .map(([opponent, stat]) => ({
          opponent,
          matches: stat.total,
          winRate: stat.winRate,
          weightedWinRate: stat.total > 0 ? stat.winRate * (stat.total / (stat.total + 10)) : 0
        }));

      // Generate trend data (simplified - by month)
      const trendData = generateTrendData(comboMatches, comboName);

      setComboAnalysisData({
        comboName,
        topPlayers,
        bestMatchups,
        worstMatchups,
        difficulty,
        trendData,
        totalMatches: comboMatches.length,
        totalPlayers: Object.keys(playerComboPerformance).length
      });
    } catch (error) {
      console.error('Error fetching combo analysis:', error);
    } finally {
      setLoadingComboAnalysis(false);
    }
  };

  const calculateCorrelation = (x: number[], y: number[]): number => {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  };

  const generateTrendData = (matches: any[], comboName: string) => {
    const monthlyData: { [month: string]: { matches: number; wins: number; totalPoints: number } } = {};
    
    matches.forEach(match => {
      const date = new Date(match.submitted_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { matches: 0, wins: 0, totalPoints: 0 };
      }
      
      const isComboPlayer = match.player1_beyblade === comboName ? match.player1_name : match.player2_name;
      monthlyData[monthKey].matches++;
      
      if (match.winner_name === isComboPlayer) {
        monthlyData[monthKey].wins++;
        monthlyData[monthKey].totalPoints += match.points_awarded || 0;
      }
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        usage: data.matches,
        winRate: data.matches > 0 ? (data.wins / data.matches) * 100 : 0,
        avgPoints: data.matches > 0 ? data.totalPoints / data.matches : 0
      }));
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Very Easy': return 'text-green-400 bg-green-500/20';
      case 'Easy': return 'text-green-300 bg-green-500/15';
      case 'Neutral': return 'text-slate-400 bg-slate-500/20';
      case 'Hard': return 'text-orange-400 bg-orange-500/20';
      case 'Very Hard': return 'text-red-400 bg-red-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };

  const showAllParts = (partType: string) => {
    setShowAllModal({
      isOpen: true,
      title: `Global ${partType.charAt(0).toUpperCase() + partType.slice(1)} Performance`,
      data: Object.values(partStats[partType] || {}),
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'usage', label: 'Usage' },
        { key: 'wins', label: 'Wins' },
        { key: 'losses', label: 'Losses' },
        { key: 'winRate', label: 'Win Rate (%)' },
        { key: 'weightedWinRate', label: 'Weighted WR' }
      ],
      onRowClick: undefined
    });
  };

  const [comboSortConfig, setComboSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({ key: "comboScore", direction: "desc" });

  const handleComboSort = (key: string) => {
    setComboSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedCombos = [...partCombos].sort((a, b) => {
    if (!comboSortConfig.key || !comboSortConfig.direction) return 0;
    const aVal = a[comboSortConfig.key as keyof typeof a];
    const bVal = b[comboSortConfig.key as keyof typeof b];
    if (aVal === bVal) return 0;
    if (comboSortConfig.direction === "asc") return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-400">Processing global meta analysis...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex space-x-4 sm:space-x-8 border-b border-slate-700 pb-2">
        {[
          { id: 'parts', label: 'Part Analysis', icon: <Database size={16} /> },
          { id: 'combos', label: 'Combo Analysis', icon: <Target size={16} /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setCurrentSubTab(tab.id as 'parts' | 'combos');
              if (tab.id === 'combos') {
                setSelectedCombo('');
                setComboAnalysisData(null);
              }
            }}
            className={`relative pb-2 text-sm font-medium transition-colors group flex items-center whitespace-nowrap ${
              currentSubTab === tab.id ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            {tab.icon}
            <span className="ml-2">{tab.label}</span>
            <span
              className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500
              ${currentSubTab === tab.id ? 'w-full' : 'w-0 group-hover:w-full'}`}
            />
          </button>
        ))}
      </div>

      {/* Parts Analysis Tab */}
      {currentSubTab === 'parts' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <aside className="lg:col-span-1 space-y-6">
        <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-4">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center">
            <Target size={18} className="mr-2 text-cyan-400" />
            Global Type Distribution
          </h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={typeDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#94A3B8" />
                <YAxis dataKey="type" type="category" stroke="#94A3B8" />
                <Tooltip cursor={{ fill: '#1e293b' }} />
                <Bar dataKey="count" fill="#06B6D4" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-4">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center">
            <Globe size={18} className="mr-2 text-cyan-400" />
            B-Side vs X-Side
          </h3>
          <div className="flex justify-around text-center">
            <div>
              <div className="text-2xl font-bold text-blue-400">{sideWins.bSide}</div>
              <div className="text-xs text-slate-400">B-Side Wins</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">{sideWins.xSide}</div>
              <div className="text-xs text-slate-400">X-Side Wins</div>
            </div>
          </div>
          <div className="mt-2 space-y-1 text-xs text-slate-500 text-center">
            <div>Matches Tracked with B/X Side: {sideWins.totalMatches}</div>
            <div className="text-xs text-slate-400">
              B-Side: {sideWins.totalMatches > 0 ? ((sideWins.bSide / sideWins.totalMatches) * 100).toFixed(1) : 0}% | 
              X-Side: {sideWins.totalMatches > 0 ? ((sideWins.xSide / sideWins.totalMatches) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>

        <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-4">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center">
            <Trophy size={18} className="mr-2 text-cyan-400" />
            Recent Tournaments
          </h3>
          <div className="space-y-2 max-h-48 overflow-auto pr-1">
            {tournamentMetas.slice(0, 5).map(t => (
              <div key={t.id} className="bg-slate-800/50 rounded-md p-2">
                <div className="text-xs font-semibold text-white truncate">{t.name}</div>
                <div className="text-xs text-slate-400 flex justify-between">
                  <span>{new Date(t.tournament_date).toLocaleDateString()}</span>
                  <span>{t.totalMatches} matches</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="lg:col-span-3 space-y-6">
        <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Search size={20} className="mr-2 text-cyan-400" />
            Global Analysis by Part
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs text-slate-400 block mb-2">Part Type</label>
              <Select
                value={selectedPartType ? { value: selectedPartType, label: partTypeOptions.find(o => o.value === selectedPartType)?.label } : null}
                onChange={(opt:any) => { setSelectedPartType(opt?.value || ''); setSelectedPartName(''); }}
                options={partTypeOptions}
                isSearchable={false}
                placeholder="Select Part Type"
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>

            {selectedPartType && (
              <div>
                <label className="text-xs text-slate-400 block mb-2">Part Name</label>
                <Select
                  value={selectedPartName ? { value: selectedPartName, label: selectedPartName } : null}
                  onChange={(opt:any) => setSelectedPartName(opt?.value || '')}
                  options={Object.values(partStats[selectedPartType] || {})
                    .filter((p:any)=>p.usage>0)
                    .sort((a:any,b:any)=>a.name.localeCompare(b.name))
                    .map((p:any)=>({ value: p.name, label: p.name }))}
                  isClearable
                  placeholder="Select or Type Part Name"
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>
            )}
          </div>

          {selectedPartType && selectedPartName && sortedCombos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-800/50">
                  <tr>
                    <SortableHeader label="Rank" columnKey="rank" sortConfig={comboSortConfig} onSort={handleComboSort} />
                    <SortableHeader label="Combo" columnKey="combo" sortConfig={comboSortConfig} onSort={handleComboSort} />
                    <SortableHeader label="Users" columnKey="users" sortConfig={comboSortConfig} onSort={handleComboSort} align="center" />
                    <SortableHeader label="Matches" columnKey="totalMatches" sortConfig={comboSortConfig} onSort={handleComboSort} align="center" />
                    <SortableHeader label="Weighted WR" columnKey="weightedWinRate" sortConfig={comboSortConfig} onSort={handleComboSort} align="center" />
                    <SortableHeader label="Avg Pts" columnKey="avgPointsPerMatch" sortConfig={comboSortConfig} onSort={handleComboSort} align="center" />
                    <SortableHeader label="Score" columnKey="comboScore" sortConfig={comboSortConfig} onSort={handleComboSort} align="center" />
                    <th className="px-6 py-3 text-xs font-medium text-cyan-400 uppercase text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                  {sortedCombos.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-800/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">#{i + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{c.combo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-slate-300">{c.users}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-white">{c.totalMatches}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <span className={`font-medium ${
                          c.weightedWinRate >= 60 ? 'text-green-400' :
                          c.weightedWinRate >= 40 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {c.weightedWinRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-cyan-400">{c.avgPointsPerMatch.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-purple-400">{c.comboScore.toFixed(1)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <button
                          onClick={() => setShowAllModal({
                            isOpen: true,
                            title: `Players who used ${c.combo}`,
                            data: c.players.map((p:any) => ({
                              ...p,
                              winRate: p.totalMatches > 0 ? (p.wins / p.totalMatches) * 100 : 0
                            })),
                            columns: [
                              { key: "player", label: "Player" },
                              { key: "totalMatches", label: "Matches" },
                              { key: "wins", label: "Wins" },
                              { key: "losses", label: "Losses" },
                              { key: "winRate", label: "Win Rate (%)" },
                              { key: "avgPointsPerMatch", label: "Avg Pts" },
                              { key: "comboScore", label: "Score" }
                            ]
                          })}
                          className="bg-gradient-to-r from-cyan-500 to-purple-600 px-3 py-1 rounded text-white text-xs hover:opacity-90 transition"
                        >
                          View Players
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedPartType && selectedPartName && sortedCombos.length === 0 && (
            <div className="text-center text-slate-400 mt-4">
              No combos found that contain {selectedPartName} as {selectedPartType}.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(['blade', 'mainBlade'] as const).map(pt => (
            <PerformanceCard
              key={pt}
              partType={pt}
              partStats={partStats}
              showAllParts={showAllParts}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(['ratchet', 'bit', 'lockchip', 'assistBlade'] as const).map(pt => (
            <PerformanceCard
              key={pt}
              partType={pt}
              partStats={partStats}
              showAllParts={showAllParts}
            />
          ))}
        </div>

        <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Trophy size={20} className="mr-2 text-cyan-400" />
            Meta Evolution
          </h3>

          {tournamentMetas.length === 0 ? (
            <div className="text-center text-slate-400">No tournament data</div>
          ) : (
            <div className="space-y-4">
              {tournamentMetas.slice(0, 6).map(t => (
                <div key={t.id} className="bg-slate-800/40 rounded-md p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-white">{t.name}</span>
                    <span className="text-xs text-purple-400">
                      Diversity {(t.diversityScore * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mb-2">
                    {t.totalMatches} matches · {t.uniqueCombos} combos
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {t.topCombos.map((c, i) => (
                      <div
                        key={i}
                        className="bg-slate-900/50 p-2 rounded border border-slate-700"
                      >
                        <div className="text-xs text-white truncate">{c.combo}</div>
                        <div className="text-xs text-slate-400">by {c.player}</div>
                        <div className="text-xs flex justify-between mt-1">
                          <span className="text-green-400">{c.winRate.toFixed(1)}% WR</span>
                          <span className="text-purple-400">{c.comboScore.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
      )}

      {/* Combo Analysis Tab */}
      {currentSubTab === 'combos' && (
        <div className="space-y-6">
          {!selectedCombo ? (
            <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <Target size={20} className="mr-2 text-cyan-400" />
                Select Combo for Analysis
              </h3>
              
              <div className="mb-4">
                <Select
                  value={selectedCombo ? { value: selectedCombo, label: selectedCombo } : null}
                  onChange={(opt: any) => {
                    const combo = opt?.value || '';
                    setSelectedCombo(combo);
                    if (combo) {
                      fetchComboAnalysis(combo);
                    }
                  }}
                  options={allCombos
                    .filter(c => c.totalMatches >= 5)
                    .sort((a, b) => b.comboScore - a.comboScore)
                    .slice(0, 100)
                    .map(c => ({ value: c.combo, label: `${c.combo} (${c.totalMatches} matches)` }))}
                  placeholder="Search and select a combo..."
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>
              
              <div className="text-center text-slate-400">
                Select a combo from the dropdown above to view detailed analysis
              </div>
            </div>
          ) : loadingComboAnalysis ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Analyzing {selectedCombo}...</p>
            </div>
          ) : comboAnalysisData ? (
            <div className="space-y-6">
              {/* Combo Header */}
              <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">{comboAnalysisData.comboName}</h3>
                    <div className="flex items-center space-x-4 text-sm text-slate-400">
                      <span>{comboAnalysisData.totalMatches} total matches</span>
                      <span>{comboAnalysisData.totalPlayers} players</span>
                      <span className={`px-3 py-1 rounded-full font-medium ${getDifficultyColor(comboAnalysisData.difficulty)}`}>
                        {comboAnalysisData.difficulty}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCombo('');
                      setComboAnalysisData(null);
                    }}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Top Players */}
              <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-bold text-white">Top Players Using This Combo</h4>
                  <button
                    onClick={() => setShowAllModal({
                      isOpen: true,
                      title: `All Players Using ${comboAnalysisData.comboName}`,
                      data: comboAnalysisData.topPlayers,
                      columns: [
                        { key: 'player', label: 'Player' },
                        { key: 'matches', label: 'Matches' },
                        { key: 'wins', label: 'Wins' },
                        { key: 'losses', label: 'Losses' },
                        { key: 'winRate', label: 'Win Rate (%)' },
                        { key: 'baseline', label: 'Baseline (%)' },
                        { key: 'performance', label: 'Performance (+/-)' }
                      ]
                    })}
                    className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Show All
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Player</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Matches</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Win Rate</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Baseline</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-cyan-400 uppercase">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                      {comboAnalysisData.topPlayers.slice(0, 10).map((player: any, index: number) => (
                        <tr key={player.player} className="hover:bg-slate-800/50">
                          <td className="px-4 py-3 text-sm font-medium text-white">{player.player}</td>
                          <td className="px-4 py-3 text-sm text-center text-white">{player.matches}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className={`font-medium ${
                              player.winRate >= 60 ? 'text-green-400' :
                              player.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {player.winRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-slate-400">{player.baseline.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className={`font-medium ${
                              player.performance > 0 ? 'text-green-400' : 
                              player.performance < 0 ? 'text-red-400' : 'text-slate-400'
                            }`}>
                              {player.performance > 0 ? '+' : ''}{player.performance.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Trend Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-6">
                  <h4 className="text-lg font-bold text-white mb-4">Usage Trend</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={comboAnalysisData.trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(6, 182, 212, 0.3)' }} />
                      <Line type="monotone" dataKey="usage" stroke="#06b6d4" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-6">
                  <h4 className="text-lg font-bold text-white mb-4">Win Rate Trend</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={comboAnalysisData.trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(6, 182, 212, 0.3)' }} />
                      <Line type="monotone" dataKey="winRate" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-6">
                  <h4 className="text-lg font-bold text-white mb-4">Avg Points Trend</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={comboAnalysisData.trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(6, 182, 212, 0.3)' }} />
                      <Line type="monotone" dataKey="avgPoints" stroke="#8b5cf6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Matchup Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Best Matchups */}
                <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-6">
                  <h4 className="text-lg font-bold text-white mb-4 flex items-center">
                    <TrendingUp size={20} className="mr-2 text-green-400" />
                    Best Matchups
                  </h4>
                  
                  {comboAnalysisData.bestMatchups.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      <Target size={32} className="mx-auto mb-2" />
                      <p>No significant matchup data</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-700">
                        <thead className="bg-slate-800/50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-cyan-400 uppercase">Opponent</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-cyan-400 uppercase">Matches</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-cyan-400 uppercase">Win Rate</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-cyan-400 uppercase">Weighted</th>
                          </tr>
                        </thead>
                        <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                          {comboAnalysisData.bestMatchups.map((matchup: any, index: number) => (
                            <tr key={index} className="hover:bg-slate-800/50">
                              <td className="px-3 py-2 text-sm text-white">{matchup.opponent}</td>
                              <td className="px-3 py-2 text-sm text-center text-white">{matchup.matches}</td>
                              <td className="px-3 py-2 text-sm text-center text-green-400 font-medium">
                                {matchup.winRate.toFixed(1)}%
                              </td>
                              <td className="px-3 py-2 text-sm text-center text-cyan-400">
                                {matchup.weightedWinRate.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Worst Matchups */}
                <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-6">
                  <h4 className="text-lg font-bold text-white mb-4 flex items-center">
                    <Target size={20} className="mr-2 text-red-400" />
                    Worst Matchups
                  </h4>
                  
                  {comboAnalysisData.worstMatchups.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      <Target size={32} className="mx-auto mb-2" />
                      <p>No significant matchup data</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-700">
                        <thead className="bg-slate-800/50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-cyan-400 uppercase">Opponent</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-cyan-400 uppercase">Matches</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-cyan-400 uppercase">Win Rate</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-cyan-400 uppercase">Weighted</th>
                          </tr>
                        </thead>
                        <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                          {comboAnalysisData.worstMatchups.map((matchup: any, index: number) => (
                            <tr key={index} className="hover:bg-slate-800/50">
                              <td className="px-3 py-2 text-sm text-white">{matchup.opponent}</td>
                              <td className="px-3 py-2 text-sm text-center text-white">{matchup.matches}</td>
                              <td className="px-3 py-2 text-sm text-center text-red-400 font-medium">
                                {matchup.winRate.toFixed(1)}%
                              </td>
                              <td className="px-3 py-2 text-sm text-center text-cyan-400">
                                {matchup.weightedWinRate.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Difficulty Explanation */}
              <div className="border border-slate-700 bg-slate-900/40 rounded-lg p-6">
                <h4 className="text-lg font-bold text-white mb-4">Combo Difficulty Analysis</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className={`text-center p-4 rounded-lg border ${getDifficultyColor(comboAnalysisData.difficulty)}`}>
                      <div className="text-3xl font-bold mb-2">{comboAnalysisData.difficulty}</div>
                      <div className="text-sm">Difficulty Rating</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <h5 className="font-semibold text-cyan-400">How Difficulty is Calculated:</h5>
                    <div className="space-y-2 text-slate-300">
                      <div className="flex items-center">
                        <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2"></span>
                        Compare player's combo performance vs their overall baseline
                      </div>
                      <div className="flex items-center">
                        <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2"></span>
                        Easy combos: Low-skill players perform above baseline
                      </div>
                      <div className="flex items-center">
                        <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2"></span>
                        Hard combos: High-skill players perform below baseline
                      </div>
                      <div className="flex items-center">
                        <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2"></span>
                        Neutral: Performance consistent across skill levels
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

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