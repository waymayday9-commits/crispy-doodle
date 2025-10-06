import React, { useState, useEffect } from 'react';
import { BarChart3, Target, TrendingUp, ChevronDown, ChevronUp, Eye, Search, X, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../../../lib/supabase';
import { parseBeybladeName, calculateWilsonScore, type AllPartsData, type ParsedBeyblade } from '../../../utils/beybladeParser';
import Select from "react-select";

interface MetaAnalysisSubTabProps {
  tournamentId: string;
  loading?: boolean;
}

interface MatchResult {
  player1_name: string;
  player2_name: string;
  player1_beyblade: string;
  player2_beyblade: string;
  player1_blade_line?: string;
  player2_blade_line?: string;
  winner_name: string;
  outcome: string;
  points_awarded: number;
}

interface ProcessedMatch {
  player: string;
  opponent: string;
  beyblade: string;
  opponentBeyblade: string;
  isWin: boolean;
  outcome: string;
  parsedParts: ParsedBeyblade;
  bladeLine: string;
}

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
  finishDistribution: { [finish: string]: number };
  bladeLine: string;
  allMatches: any[];
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

const FINISH_COLORS = {
  'Spin Finish': '#10B981',
  'Burst Finish': '#F59E0B',
  'Over Finish': '#EF4444',
  'Extreme Finish': '#8B5CF6'
};
function ShowAllModal({ isOpen, onClose, title, data, columns, onRowClick }: ShowAllModalProps) {
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
              className="p-2 hover:bg-gray-80- rounded-none transition-colors"
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {columns.map(col => (
                    <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-700">
                {filteredData.map((row, index) => (
                  <tr 
                    key={index} 
                    className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map(col => (
                      <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">
                        {typeof row[col.key] === 'number' ? 
                          (col.key.includes('Rate') || col.key.includes('Score') ? 
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

function MatchDetailsModal({ isOpen, onClose, title, matches }: MatchDetailsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-blue-500 px-6 py-4 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-auto max-h-[60vh]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Combo Used</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Player</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Opponent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Opponent Beyblade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Winner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Finish Type</th>
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-700">
              {matches.map((match, index) => (
                <tr key={index} className="hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-xs">
                    {match.player1_beyblade}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">{match.player1_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">{match.player2_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-xs">{match.player2_beyblade}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{match.winner_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">{match.outcome}</td>
                </tr>
              ))}
              {matches.map((match, index) => (
                <tr key={`p2-${index}`} className="hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-xs">
                    {match.player2_beyblade}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">{match.player2_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">{match.player1_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-xs">{match.player1_beyblade}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{match.winner_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">{match.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function MetaAnalysisSubTab({ tournamentId, loading = false }: MetaAnalysisSubTabProps) {
  const [partsData, setPartsData] = useState<AllPartsData>({
    blades: [],
    ratchets: [],
    bits: [],
    lockchips: [],
    assistBlades: []
  });
  
  const [partStats, setPartStats] = useState<{ [partType: string]: { [partName: string]: PartStats } }>({
    blade: {},
    ratchet: {},
    bit: {},
    lockchip: {},
    mainBlade: {},
    assistBlade: {}
  });
  
  const [comboStats, setComboStats] = useState<ComboStats[]>([]);
  const [processedMatches, setProcessedMatches] = useState<ProcessedMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Part search functionality
  const [selectedPartType, setSelectedPartType] = useState<string>('');
  const [selectedPartName, setSelectedPartName] = useState<string>('');
  const [partCombos, setPartCombos] = useState<ComboStats[]>([]);
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: 'comboScore', 
    direction: 'desc' 
  });
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
  const [matchDetailsModal, setMatchDetailsModal] = useState<{
    isOpen: boolean;
    title: string;
    matches: any[];
  }>({
    isOpen: false,
    title: '',
    matches: []
  });

  useEffect(() => {
    if (tournamentId) {
      fetchPartsData();
    }
  }, [tournamentId]);

  useEffect(() => {
    if (tournamentId && partsData.blades.length > 0) {
      processTournamentData();
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
  const processTournamentData = async () => {
    try {
      const { data: matches, error } = await supabase
        .from('match_results')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (error) throw error;

      if (!matches || matches.length === 0) {
        setIsLoading(false);
        return;
      }

      // Process matches
      const processed: ProcessedMatch[] = [];
      const stats = {
        blade: {} as { [name: string]: PartStats },
        ratchet: {} as { [name: string]: PartStats },
        bit: {} as { [name: string]: PartStats },
        lockchip: {} as { [name: string]: PartStats },
        mainBlade: {} as { [name: string]: PartStats },
        assistBlade: {} as { [name: string]: PartStats }
      };

      const comboStatsMap: { [key: string]: ComboStats } = {};

      matches.forEach((match: MatchResult) => {
        if (!match.winner_name || !match.player1_name || !match.player2_name) return;
        
        const p1Parts = parseBeybladeName(match.player1_beyblade, match.player1_blade_line, partsData);
        const p2Parts = parseBeybladeName(match.player2_beyblade, match.player2_blade_line, partsData);
        
        const outcome = match.outcome?.split(' (')[0] || 'Unknown';
        const points = match.points_awarded || FINISH_POINTS[outcome as keyof typeof FINISH_POINTS] || 0;

        const normalizedPlayer1 = match.normalized_player1_name || match.player1_name.toLowerCase();
        const normalizedPlayer2 = match.normalized_player2_name || match.player2_name.toLowerCase();
        const normalizedWinner = match.normalized_winner_name || match.winner_name.toLowerCase();
        
        const p1Match: ProcessedMatch = {
          player: match.player1_name,
          opponent: match.player2_name,
          beyblade: match.player1_beyblade,
          opponentBeyblade: match.player2_beyblade,
          isWin: normalizedWinner === normalizedPlayer1,
          outcome,
          parsedParts: p1Parts,
          bladeLine: match.player1_blade_line || 'Unknown'
        };
        
        const p2Match: ProcessedMatch = {
          player: match.player2_name,
          opponent: match.player1_name,
          beyblade: match.player2_beyblade,
          opponentBeyblade: match.player1_beyblade,
          isWin: normalizedWinner === normalizedPlayer2,
          outcome,
          parsedParts: p2Parts,
          bladeLine: match.player2_blade_line || 'Unknown'
        };
        
        processed.push(p1Match, p2Match);

        // Process combo stats
        [p1Match, p2Match].forEach(processedMatch => {
          const comboKey = `${processedMatch.beyblade}_${processedMatch.player}`;
          
          if (!comboStatsMap[comboKey]) {
            comboStatsMap[comboKey] = {
              combo: processedMatch.beyblade,
              player: processedMatch.player,
              wins: 0,
              losses: 0,
              totalMatches: 0,
              winRate: 0,
              weightedWinRate: 0,
              totalPoints: 0,
              avgPointsPerMatch: 0,
              comboScore: 0,
              finishDistribution: {},
              bladeLine: processedMatch.bladeLine,
              allMatches: []
            };
          }

          const combo = comboStatsMap[comboKey];
          combo.totalMatches++;
          combo.finishDistribution[outcome] = (combo.finishDistribution[outcome] || 0) + 1;
          combo.allMatches.push(match);

          if (processedMatch.isWin) {
            combo.wins++;
            combo.totalPoints += points;
          } else {
            combo.losses++;
          }
        });

        // Update part stats
        const updateStats = (parsedParts: ParsedBeyblade, isWin: boolean) => {
          Object.entries(parsedParts).forEach(([partType, partName]) => {
            if (partType === 'isCustom' || !partName) return;
            
            if (!stats[partType as keyof typeof stats][partName]) {
              stats[partType as keyof typeof stats][partName] = {
                name: partName,
                usage: 0,
                wins: 0,
                losses: 0,
                winRate: 0,
                weightedWinRate: 0
              };
            }
            
            const partStat = stats[partType as keyof typeof stats][partName];
            partStat.usage++;
            if (isWin) {
              partStat.wins++;
            } else {
              partStat.losses++;
            }
          });
        };
        
        updateStats(p1Parts, p1Match.isWin);
        updateStats(p2Parts, p2Match.isWin);
      });

      // Calculate final stats for parts
      Object.keys(stats).forEach(partType => {
        Object.values(stats[partType as keyof typeof stats]).forEach(partStat => {
          const total = partStat.wins + partStat.losses;
          partStat.winRate = total > 0 ? (partStat.wins / total) * 100 : 0;
          partStat.weightedWinRate = total > 0
            ? ((partStat.wins / total) * 100) * (total / (total + 10))
            : 0;
        });
      });

      // Calculate combo stats
      const comboStatsArray = Object.values(comboStatsMap).map(combo => {
        combo.winRate = combo.totalMatches > 0 ? (combo.wins / combo.totalMatches) * 100 : 0;
        combo.weightedWinRate = combo.totalMatches > 0 ? (combo.wins / combo.totalMatches) * (combo.totalMatches / (combo.totalMatches + 10)) : 0;
        combo.avgPointsPerMatch = combo.totalMatches > 0 ? combo.totalPoints / combo.totalMatches : 0;
        combo.comboScore = combo.weightedWinRate * (combo.avgPointsPerMatch / 3) * 100;
        return combo;
      });

      setPartStats(stats);
      setComboStats(comboStatsArray);
      setProcessedMatches(processed);
      
      if (selectedPartType && selectedPartName) {
        generatePartCombos();
      }

    } catch (error) {
      console.error('Error processing tournament data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePartCombos = () => {
    if (!selectedPartType || !selectedPartName) return;
    
    const combosWithPart = comboStats.filter(combo => {
      const comboMatches = processedMatches.filter(match => 
        match.beyblade === combo.combo && match.player === combo.player
      );
      
      return comboMatches.some(match => {
        const partValue = match.parsedParts[selectedPartType as keyof ParsedBeyblade];
        return partValue === selectedPartName;
      });
    });
    
    setPartCombos(combosWithPart.sort((a, b) => b.comboScore - a.comboScore));
  };

  React.useEffect(() => {
    if (selectedPartType && selectedPartName && comboStats.length > 0) {
      generatePartCombos();
    } else {
      setPartCombos([]);
    }
  }, [selectedPartType, selectedPartName, comboStats]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const showPartMatchDetails = (partName: string, partType: string) => {
    const partMatches = processedMatches.filter(match => 
      match.parsedParts[partType as keyof ParsedBeyblade] === partName
    );
    
    const enhancedMatches = partMatches.map(processedMatch => {
      const originalMatch = processedMatch.allMatches?.[0] || {};
      return {
        combo_used: processedMatch.beyblade,
        combo_against: processedMatch.opponentBeyblade,
        player1_name: processedMatch.player,
        player2_name: processedMatch.opponent,
        winner_name: originalMatch.winner_name,
        outcome: processedMatch.outcome,
        player1_beyblade: processedMatch.beyblade,
        player2_beyblade: processedMatch.opponentBeyblade
      };
    });
    
    setMatchDetailsModal({
      isOpen: true,
      title: `All Matches using ${partName}`,
      matches: enhancedMatches
    });
  };

  const showAllParts = (partType: string) => {
    const partData = Object.values(partStats[partType] || {})
      .filter(part => part.usage > 0)
      .sort((a, b) => b.weightedWinRate - a.weightedWinRate)
      .map(part => ({
        ...part,
        allMatches: processedMatches.filter(match => 
          match.parsedParts[partType as keyof ParsedBeyblade] === part.name
        )
      }));

    setShowAllModal({
      isOpen: true,
      title: `All ${partType.charAt(0).toUpperCase() + partType.slice(1)} Performance`,
      data: partData,
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'usage', label: 'Usage' },
        { key: 'wins', label: 'Wins' },
        { key: 'losses', label: 'Losses' },
        { key: 'winRate', label: 'Win Rate (%)' },
        { key: 'weightedWinRate', label: 'Weighted Win Rate (%)' }
      ],
      onRowClick: (row) => {
        setShowAllModal(prev => ({ ...prev, isOpen: false }));
        setTimeout(() => {
          showPartMatchDetails(row.name, partType);
        }, 100);
      }
    });
  };
  const showAllCombos = () => {
    setShowAllModal({
      isOpen: true,
      title: 'All Combo Performance Rankings',
      data: sortedComboStats,
      columns: [
        { key: 'combo', label: 'Combo' },
        { key: 'player', label: 'Player' },
        { key: 'bladeLine', label: 'Blade Line' },
        { key: 'totalMatches', label: 'Matches' },
        { key: 'winRate', label: 'Win Rate (%)' },
        { key: 'weightedWinRate', label: 'Weighted Win Rate (%)' },
        { key: 'avgPointsPerMatch', label: 'Avg Points' },
        { key: 'comboScore', label: 'Combo Score' }
      ],
      onRowClick: (row) => {
        setMatchDetailsModal({
          isOpen: true,
          title: `All Matches for ${row.combo} by ${row.player}`,
          matches: row.allMatches || []
        });
        setShowAllModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const sortedComboStats = [...comboStats].sort((a, b) => {
    const aVal = a[sortConfig.key as keyof ComboStats];
    const bVal = b[sortConfig.key as keyof ComboStats];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    const aStr = String(aVal);
    const bStr = String(bVal);
    return sortConfig.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  const SortableHeader = ({ children, sortKey }: { children: React.ReactNode; sortKey: string }) => (
    <th 
      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-600"
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortConfig.key === sortKey && (
          sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        )}
      </div>
    </th>
  );

  if (loading || isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Processing meta analysis...</p>
      </div>
    );
  }

  if (processedMatches.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="text-center">
          <BarChart3 size={48} className="mx-auto text-yellow-500 mb-4" />
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Meta Data Available</h3>
          <p className="text-yellow-700">
            This tournament has no completed matches yet. Meta analysis requires match results to generate statistics.
          </p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const topCombosChartData = sortedComboStats.slice(0, 10).map(combo => ({
    name: combo.combo,
    score: combo.comboScore,
    winRate: combo.winRate,
    matches: combo.totalMatches
  }));

  const partTypeOptions = [
  { value: "blade", label: "Blade" },
  { value: "mainBlade", label: "Main Blade" },
  { value: "ratchet", label: "Ratchet" },
  { value: "bit", label: "Bit" },
  { value: "lockchip", label: "Lockchip" },
  { value: "assistBlade", label: "Assist Blade" },
];

  const finishDistributionData = Object.entries(
    processedMatches.reduce((acc, match) => {
      if (match.isWin) {
        acc[match.outcome] = (acc[match.outcome] || 0) + 1;
      }
      return acc;
    }, {} as { [key: string]: number })
  ).map(([finish, count]) => ({
    name: finish,
    value: count,
    color: FINISH_COLORS[finish as keyof typeof FINISH_COLORS] || '#6B7280'
  }));

  return (
    <div className="space-y-8">
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
            <BarChart data={topCombosChartData} margin={{ bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                fontSize={9}
              />
              <YAxis />
              <Tooltip 
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
                data={finishDistributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {finishDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Part Analysis Section */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        {/* Animated bottom underline */}
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Search size={24} className="mr-2 text-purple-600" />
          Analysis by Part
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm text-yellow-400 mb-2">Part Type</label>
                <Select
                  value={selectedPartType ? { value: selectedPartType, label: partTypeOptions.find(opt => opt.value === selectedPartType)?.label } : null}
                  onChange={(option) => {
                    setSelectedPartType(option?.value || "");
                    setSelectedPartName("");
                  }}
                  options={partTypeOptions}
                  isSearchable={false}
                  placeholder="Select Part Type"
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>
          
          {selectedPartType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Part Name</label>
              <Select
                value={selectedPartName ? { value: selectedPartName, label: selectedPartName } : null}
                onChange={(option) => setSelectedPartName(option?.value || "")}
                options={Object.values(partStats[selectedPartType] || {})
                  .filter(part => part.usage > 0)
                  .sort((a, b) => a.name.localeCompare(b.name)) // alphabetical
                  .map(part => ({
                    value: part.name,
                    label: part.name
                  }))
                }
                isClearable
                placeholder="Select or Type Part Name"
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>
          )}
        </div>
        
        {/* Part Combos Table */}
        {selectedPartType && selectedPartName && partCombos.length > 0 && (
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-100 mb-4">
              Combos using {selectedPartName} ({selectedPartType})
            </h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-600">
                      Combo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-600">
                      Player
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-600">
                      Matches
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-600">
                      Win Rate
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-600">
                      Weighted Win Rate
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-600">
                      Avg Points
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
        
                <tbody className="bg-gray-900 divide-y divide-gray-700">
                  {partCombos.map((combo, index) => (
                    <tr key={index} className="hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">
                        {combo.combo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">
                        {combo.player}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100 text-center">
                        {combo.totalMatches}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <span
                          className={`font-medium ${
                            combo.winRate >= 60
                              ? "text-green-600"
                              : combo.winRate >= 40
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {combo.winRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 text-center">
                        {(combo.weightedWinRate * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100 text-center">
                        {combo.avgPointsPerMatch.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => {
                            setMatchDetailsModal({
                              isOpen: true,
                              title: `All Matches for ${combo.combo} by ${combo.player}`,
                              matches: combo.allMatches || []
                            });
                          }}
                          className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                        >
                          View Matches
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

            {/* Combo Statistics Table */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Combo Performance Rankings</h3>
          <button
            onClick={showAllCombos}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-4 py-2 rounded-none hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 flex items-center space-x-2 shadow-[0_0_15px_rgba(0,200,255,0.3)]"
          >
            <Eye size={16} />
            <span>Show All</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-800">
              <tr>
                <SortableHeader sortKey="combo">Combo</SortableHeader>
                <SortableHeader sortKey="player">Player</SortableHeader>
                <SortableHeader sortKey="bladeLine">Blade Line</SortableHeader>
                <SortableHeader sortKey="totalMatches">Matches</SortableHeader>
                <SortableHeader sortKey="winRate">Win Rate</SortableHeader>
                <SortableHeader sortKey="weightedWinRate">Weighted Win Rate</SortableHeader>
                <SortableHeader sortKey="avgPointsPerMatch">Avg Points</SortableHeader>
                <SortableHeader sortKey="comboScore">Combo Score</SortableHeader>
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-700">
              {sortedComboStats.slice(0, 20).map((combo, index) => (
                <tr key={index} className="hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">
                    {combo.combo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">
                    {combo.player}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      combo.bladeLine === 'Basic' ? 'bg-blue-100 text-blue-800' :
                      combo.bladeLine === 'Unique' ? 'bg-purple-100 text-purple-800' :
                      combo.bladeLine === 'Custom' ? 'bg-orange-100 text-orange-800' :
                      combo.bladeLine === 'X-Over' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {combo.bladeLine}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">
                    {combo.totalMatches}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">
                    {combo.winRate.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {(combo.weightedWinRate * 100).toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">
                    {combo.avgPointsPerMatch.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                    {combo.comboScore.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Part Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Blades and Main Blades */}
        <div className="space-y-6">
          {(['blade', 'mainBlade'] as const).map(partType => (
            <div key={partType} className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                               transition-all duration-300 hover:border-cyan-400/70 
                               hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white capitalize">
                  {partType === 'mainBlade' ? 'Main Blades' : 'Blades'} Performance
                </h3>
                <button
                  onClick={() => showAllParts(partType)}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-3 py-2 rounded-none hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 flex items-center space-x-2 text-sm shadow-[0_0_12px_rgba(0,200,255,0.25)]"
                >
                  <Eye size={14} />
                  <span>Show All</span>
                </button>
              </div>
              
              {Object.keys(partStats[partType] || {}).length === 0 ? (
                <div className="text-center py-6">
                  <BarChart3 size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-400 text-sm">No {partType} data available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Usage</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Win Rate</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Weighted Win Rate</th>
                      </tr>
                    </thead>
                    <tbody className="bg-gray-900 divide-y divide-gray-700">
                      {Object.values(partStats[partType] || {})
                        .filter(part => part.usage > 0)
                        .sort((a, b) => b.weightedWinRate - a.weightedWinRate)
                        .slice(0, 8)
                        .map((part, index) => (
                          <tr key={index} className="hover:bg-gray-800">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-100">{part.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-100 text-center">{part.usage}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                              <span className={`font-medium ${
                                part.winRate >= 60 ? 'text-green-600' :
                                part.winRate >= 40 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {part.winRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-100 text-center">
                              {part.weightedWinRate.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Other Parts */}
        <div className="space-y-6">
          {(['ratchet', 'bit', 'lockchip', 'assistBlade'] as const).map(partType => (
            <div key={partType} className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                               transition-all duration-300 hover:border-cyan-400/70 
                               hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white capitalize">
                  {partType === 'assistBlade' ? 'Assist Blades' : `${partType}s`} Performance
                </h3>
                <button
                  onClick={() => showAllParts(partType)}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-3 py-2 rounded-none hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 flex items-center space-x-2 text-sm shadow-[0_0_12px_rgba(0,200,255,0.25)]"
                >
                  <Eye size={14} />
                  <span>Show All</span>
                </button>
              </div>
              
              {Object.keys(partStats[partType] || {}).length === 0 ? (
                <div className="text-center py-6">
                  <BarChart3 size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-400 text-sm">No {partType} data available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Usage</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Win Rate</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Weighted Win Rate</th>
                      </tr>
                    </thead>
                    <tbody className="bg-gray-900 divide-y divide-gray-700">
                      {Object.values(partStats[partType] || {})
                        .filter(part => part.usage > 0)
                        .sort((a, b) => b.weightedWinRate - a.weightedWinRate)
                        .slice(0, 8)
                        .map((part, index) => (
                          <tr key={index} className="hover:bg-gray-800">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-100">{part.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-100 text-center">{part.usage}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                              <span className={`font-medium ${
                                part.winRate >= 60 ? 'text-green-600' :
                                part.winRate >= 40 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {part.winRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-100 text-center">
                              {part.weightedWinRate.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <ShowAllModal
        isOpen={showAllModal.isOpen}
        onClose={() => setShowAllModal(prev => ({ ...prev, isOpen: false }))}
        title={showAllModal.title}
        data={showAllModal.data}
        columns={showAllModal.columns}
        onRowClick={showAllModal.onRowClick}
      />

      <MatchDetailsModal
        isOpen={matchDetailsModal.isOpen}
        onClose={() => setMatchDetailsModal(prev => ({ ...prev, isOpen: false }))}
        title={matchDetailsModal.title}
        matches={matchDetailsModal.matches}
      />
    </div>
  );
}
