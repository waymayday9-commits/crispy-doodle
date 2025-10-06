import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  Grid,
  List,
  Zap,
  Shield,
  Clock,
  Activity,
  ShieldCheck,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Part {
  id: string;
  name: string;
  category: string; // Blade, Bit, Ratchet, etc.
  role?: string;    // Attack, Defense, Stamina, Balance (from Supabase)
  line?: string;
  stats: {
    attack: number;
    defense: number;
    stamina: number;
    dash: number;
    burstRes: number;
  };
  data: any;
}

export function PartsDatabase() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<
    'name' | 'role' | 'attack' | 'defense' | 'stamina' | 'dash' | 'burstRes'
  >('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [activeTab, setActiveTab] = useState<string>('lockchips');
  const [activeRole, setActiveRole] = useState<string>('');
  const [bladeFilter, setBladeFilter] = useState<string>('');

  const tabs = ['lockchips', 'blades (custom)', 'blades', 'ratchets', 'bits'];

  useEffect(() => {
    fetchAllParts();
  }, []);

  const fetchAllParts = async () => {
    setLoading(true);
    try {
      const [bladesRes, ratchetsRes, bitsRes, lockchipsRes, assistBladesRes] =
        await Promise.all([
          supabase.from('beypart_blade').select('*'),
          supabase.from('beypart_ratchet').select('*'),
          supabase.from('beypart_bit').select('*'),
          supabase.from('beypart_lockchip').select('*'),
          supabase.from('beypart_assistblade').select('*'),
        ]);

      const allParts: Part[] = [];

      (bladesRes.data || []).forEach((blade: any) => {
        allParts.push({
          id: `blade-${blade.Blades}`,
          name: blade.Blades,
          category: 'Blade',
          role: blade.Type,
          line: blade.Line,
          stats: {
            attack: blade.Attack || 0,
            defense: blade.Defense || 0,
            stamina: blade.Stamina || 0,
            dash: 0,
            burstRes: 0,
          },
          data: blade,
        });
      });

      (ratchetsRes.data || []).forEach((ratchet: any) => {
        allParts.push({
          id: `ratchet-${ratchet.Ratchet}`,
          name: ratchet.Ratchet,
          category: 'Ratchet',
          role: ratchet.Type,
          stats: {
            attack: ratchet.Attack || 0,
            defense: ratchet.Defense || 0,
            stamina: ratchet.Stamina || 0,
            dash: 0,
            burstRes: 0,
          },
          data: ratchet,
        });
      });

      (bitsRes.data || []).forEach((bit: any) => {
        allParts.push({
          id: `bit-${bit.Bit}`,
          name: `${bit.Bit} (${bit.Shortcut})`,
          category: 'Bit',
          role: bit.Type,
          stats: {
            attack: bit.Attack || 0,
            defense: bit.Defense || 0,
            stamina: bit.Stamina || 0,
            dash: bit.Dash || 0,
            burstRes: bit['Burst Res'] || 0,
          },
          data: bit,
        });
      });

      (lockchipsRes.data || []).forEach((lockchip: any) => {
        allParts.push({
          id: `lockchip-${lockchip.Lockchip}`,
          name: lockchip.Lockchip,
          category: 'Lockchip',
          role: lockchip.Type,
          stats: {
            attack: lockchip.Attack || 0,
            defense: lockchip.Defense || 0,
            stamina: lockchip.Stamina || 0,
            dash: 0,
            burstRes: 0,
          },
          data: lockchip,
        });
      });

      (assistBladesRes.data || []).forEach((assistBlade: any) => {
        allParts.push({
          id: `assistblade-${assistBlade['Assist Blade']}`,
          name: `${assistBlade['Assist Blade Name']} (${assistBlade['Assist Blade']})`,
          category: 'Assist Blade',
          role: assistBlade.Type,
          stats: {
            attack: assistBlade.Attack || 0,
            defense: assistBlade.Defense || 0,
            stamina: assistBlade.Stamina || 0,
            dash: 0,
            burstRes: 0,
          },
          data: assistBlade,
        });
      });

      setParts(allParts);
    } catch (error) {
      console.error('Error fetching parts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatIcon = (stat: string) => {
    switch (stat) {
      case 'attack':
        return <span className="text-red-500">⚡</span>;
      case 'defense':
        return <span className="text-blue-500">🛡️</span>;
      case 'stamina':
        return <span className="text-green-500">⏱️</span>;
      case 'dash':
        return <span className="text-yellow-500">💨</span>;
      case 'burstRes':
        return <span className="text-purple-500">🔒</span>;
      default:
        return null;
    }
  };

  const filteredAndSortedParts = parts
    .filter((part) => part.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      let aValue: any, bValue: any;
      if (sortBy === 'name') {
        aValue = a.name;
        bValue = b.name;
      } else if (sortBy === 'role') {
        aValue = a.role || '';
        bValue = b.role || '';
      } else {
        aValue = a.stats[sortBy];
        bValue = b.stats[sortBy];
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

  const tabFilteredParts = filteredAndSortedParts.filter((part) => {
    if (activeTab === 'blades (custom)')
      return part.category === 'Blade' && part.line?.toLowerCase() === 'custom';
    if (activeTab === 'blades') {
      if (!bladeFilter)
        return part.category === 'Blade' && ['basic', 'unique', 'x-over'].includes(part.line?.toLowerCase() || '');
      return part.category === 'Blade' && part.line?.toLowerCase() === bladeFilter.toLowerCase();
    }
    if (activeTab === 'lockchips') return part.category === 'Lockchip';
    if (activeTab === 'ratchets') return part.category === 'Ratchet';
    if (activeTab === 'bits') return part.category === 'Bit';
    return true;
  });

  const roleFilteredParts = tabFilteredParts.filter((part) => {
    if (!activeRole) return true;
    return (part.role || '').toLowerCase() === activeRole;
  });

const tableFolderMap: Record<string, string> = {
  Blade: 'beypart_blade',
  Bit: 'beypart_bit',
  Ratchet: 'beypart_ratchet',
  Lockchip: 'beypart_lockchip',
  'Assist Blade': 'beypart_assistblade',
};

const getPrimaryKeyField = (category: string) => {
  switch (category) {
    case 'Blade': return 'Blades';
    case 'Bit': return 'Bit';
    case 'Ratchet': return 'Ratchet';
    case 'Lockchip': return 'Lockchip';
    case 'Assist Blade': return 'Assist Blade';
    default: return '';
  }
};

const renderPartCard = (part: Part) => {
  const folder = tableFolderMap[part.category] || '';
  const primaryKeyField = getPrimaryKeyField(part.category);
  const filename = encodeURIComponent(part.data[primaryKeyField]);
  const imageUrl = `https://eymxpphofhhfeuvaqfad.supabase.co/storage/v1/object/public/beyblade-parts/${folder}/${filename}.png`;

  return (
    <div
      key={part.id}
      onClick={() => setSelectedPart(part)}
      className="group cursor-pointer bg-slate-900/40 border border-slate-700 rounded-none p-3 hover:border-cyan-400/70 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all duration-300 relative"
    >
      {/* Animated bottom underline */}
      <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 w-0 transition-all duration-500 group-hover:w-full" />
      
      <div className="w-full aspect-square bg-slate-800 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
        <img
          src={imageUrl}
          alt={part.name}
          width={128}      // force small web size
          height={128}     // force small web size
          loading="lazy"   // optional: lazy load for faster grid render
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            const fallback = document.createElement('div');
            fallback.textContent = 'Picture Not Available';
            fallback.className = 'text-slate-400 text-xs text-center';
            target.replaceWith(fallback);
          }}
          className="object-contain w-full h-full"
        />
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold truncate break-words text-white">{part.name}</h3>
        {part.role && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400">
            {part.role}
          </span>
        )}
      </div>
      {part.line && (
        <p className="text-xs text-slate-400 mt-1 truncate">{part.line}</p>
      )}
    </div>
  );
};


  if (loading) {
    return (
      <div className="page-container">
        <div className="content-wrapper">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading parts database...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-4xl font-bold flex items-center mb-4">
                <Database size={40} className="mr-4 text-cyan-400" />
                <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Parts Database
                </span>
              </h1>
              <p className="text-slate-400 text-lg">
                Explore all available Beyblade parts and their statistics
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid'
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Grid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list'
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <List size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Search + Role Filter */}
        <div className="bg-slate-900/50 border border-cyan-500/30 rounded-none backdrop-blur-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search
                size={20}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search parts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* Role Filter (always visible, right side) */}
            <div className="md:col-start-4">
              <select
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">All Roles</option>
                <option value="attack">Attack</option>
                <option value="defense">Defense</option>
                <option value="stamina">Stamina</option>
                <option value="balance">Balance</option>
              </select>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex space-x-8 border-b border-slate-700 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`relative pb-2 text-sm font-medium capitalize transition-colors group ${
                  activeTab === tab ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-300'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500
                  ${activeTab === tab ? 'w-full' : 'w-0 group-hover:w-full'}`}
                />
              </button>
            ))}
          </div>

          {/* Blade dropdown */}
          {activeTab === 'blades' && (
            <div className="mt-2">
              <select
                value={bladeFilter}
                onChange={(e) => setBladeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">All</option>
                <option value="Basic">Basic</option>
                <option value="Unique">Unique</option>
                <option value="X-Over">X-Over</option>
              </select>
            </div>
          )}
        </div>

        {/* Parts Display */}
        {roleFilteredParts.length === 0 ? (
          <div className="text-center py-12">
            <Database size={48} className="mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Parts Found
            </h3>
            <p className="text-slate-400">
              Try adjusting your search or filter criteria
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {roleFilteredParts.map(renderPartCard)}
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-cyan-500/30 rounded-none backdrop-blur-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-800/50">
                <tr>
                  {['name','role','attack','defense','stamina']
                    .concat(activeTab === 'bits' ? ['dash','burstRes'] : [])
                    .map((col) => (
                      <th
                        key={col}
                        className={`px-6 py-3 text-xs font-medium text-cyan-400 uppercase cursor-pointer hover:text-cyan-300 ${
                          col === 'name' ? 'text-left' : 'text-center'
                        }`}
                        onClick={() => {
                          setSortBy(col as any);
                          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                        }}
                      >
                        <div className="inline-flex items-center justify-center space-x-1">
                          <span>{col}</span>
                          <span className="w-4 inline-block">
                            {sortBy === col && (sortDirection === 'asc' ? '▲' : '▼')}
                          </span>
                        </div>
                      </th>
                    ))}
                  <th></th>
                </tr>
              </thead>
              <tbody className="bg-slate-950/50 divide-y divide-slate-800">
                {roleFilteredParts.map((part) => (
                  <tr key={part.id} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4 text-left truncate break-words text-white">{part.name}</td>
                    <td className="px-6 py-4 text-center text-white">{part.role || '-'}</td>
                    <td className="px-6 py-4 text-center text-white">{part.stats.attack}</td>
                    <td className="px-6 py-4 text-center text-white">{part.stats.defense}</td>
                    <td className="px-6 py-4 text-center text-white">{part.stats.stamina}</td>
                    {activeTab === 'bits' && (
                      <>
                        <td className="px-6 py-4 text-center text-white">{part.stats.dash}</td>
                        <td className="px-6 py-4 text-center text-white">{part.stats.burstRes}</td>
                      </>
                    )}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedPart(part)}
                        className="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Part Details Modal */}
        {selectedPart && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-950 border border-cyan-500/30 rounded-2xl shadow-[0_0_40px_rgba(0,200,255,0.3)] max-w-2xl w-full max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-4 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold truncate">{selectedPart.name}</h2>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="bg-white/20 px-2 py-1 rounded-full text-sm">
                        {selectedPart.category}
                      </span>
                      {selectedPart.role && (
                        <span className="bg-white/20 px-2 py-1 rounded-full text-sm">
                          {selectedPart.role}
                        </span>
                      )}
                      {selectedPart.line && (
                        <span className="bg-white/20 px-2 py-1 rounded-full text-sm">
                          {selectedPart.line} Line
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPart(null)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {Object.entries(selectedPart.stats)
                      .filter(([stat]) =>
                        selectedPart.category === 'Bit'
                          ? true
                          : !['dash','burstRes'].includes(stat)
                      )
                      .map(([stat, value]) => (
                        <div key={stat} className="text-center">
                          <div className="flex justify-center mb-1">{getStatIcon(stat)}</div>
                          <div className="text-sm font-medium capitalize text-slate-300">{stat}</div>
                          <div className="text-lg font-bold text-white">{value}</div>
                        </div>
                      ))}
                  </div>
                </div>
                
                <div className="mb-6 bg-slate-800/50 border border-cyan-500/20 rounded-xl p-6 text-center">
                  <h4 className="text-lg font-semibold text-white mb-2">Preview</h4>
                  {selectedPart && (
                    <div className="w-full aspect-square flex items-center justify-center bg-slate-900 rounded-lg overflow-hidden mx-auto max-h-64">
                      <img
                        src={`https://eymxpphofhhfeuvaqfad.supabase.co/storage/v1/object/public/beyblade-parts/${
                          tableFolderMap[selectedPart.category]
                        }/${encodeURIComponent(selectedPart.data[getPrimaryKeyField(selectedPart.category)])}.png`}
                        alt={selectedPart.name}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const fallback = document.createElement('div');
                          fallback.textContent = 'Picture Not Available';
                          fallback.className = 'text-slate-400 text-sm text-center';
                          target.replaceWith(fallback);
                        }}
                        className="object-contain w-full h-full"
                      />
                    </div>
                  )}
                </div>

                <div className="mb-6 bg-slate-800/50 border border-cyan-500/20 rounded-xl p-6 text-center">
                  <h4 className="text-lg font-semibold text-white mb-2">Win Rate</h4>
                  <p className="text-slate-400">Coming Soon</p>
                </div>

                <div className="mb-6 bg-slate-800/50 border border-cyan-500/20 rounded-xl p-6 text-center">
                  <h4 className="text-lg font-semibold text-white mb-2">Top 3 Combos</h4>
                  <p className="text-slate-400">Coming Soon</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
