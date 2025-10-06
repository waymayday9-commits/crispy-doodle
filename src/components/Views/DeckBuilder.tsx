import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Edit, X, Layers, Zap, Shield, Clock, Activity, ShieldCheck, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';

interface DeckPreset {
  id: string;
  name: string;
  description?: string;
  beyblades: BeybladeConfig[];
  created_at: string;
  updated_at: string;
}

interface BeybladeConfig {
  id: string;
  name: string;
  isCustomLine: boolean;
  parts: { [key: string]: any };
}

interface InventoryItem {
  id: string;
  part_type: string;
  part_name: string;
  part_data: any;
  quantity: number;
}

export function DeckBuilder({ showHeader = true }: { showHeader?: boolean }) {
  const { user } = useAuth();
  const { confirm, alert } = useConfirmation();
  
  // Early return for guest users - don't load anything
  if (!user || user.id.startsWith('guest-')) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Deck Builder</h1>
          <p className="text-gray-600">Create and save Beyblade deck presets</p>
        </div>
        
        <div className="text-center py-12">
          <Layers size={64} className="mx-auto text-gray-400 mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Advanced Deck Builder</h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Create powerful Beyblade combinations from your inventory. Build multiple deck presets, 
            analyze stats, and save your favorite combinations for quick tournament registration.
          </p>
          
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-8 max-w-md mx-auto mb-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                🏗️
              </div>
            </div>
            <h3 className="text-xl font-bold text-purple-900 mb-3">Login to Start Building</h3>
            <p className="text-purple-800 text-sm mb-6">
              Create a free account to access the advanced deck builder and save your custom combinations!
            </p>
            <div className="space-y-2 text-sm text-purple-700">
              <div className="flex items-center justify-center">
                <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                Build from your inventory
              </div>
              <div className="flex items-center justify-center">
                <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                Save unlimited deck presets
              </div>
              <div className="flex items-center justify-center">
                <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                Analyze combined stats
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-6 max-w-lg mx-auto">
            <p className="text-gray-600 text-sm">
              <strong>Ready to build?</strong> Click the "Login" button in the top right corner to create your account and start building powerful deck combinations.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  const [presets, setPresets] = useState<DeckPreset[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [useInventory, setUseInventory] = useState(true);
  
  // Parts data state for free build mode
  const [partsData, setPartsData] = useState({
    blades: [],
    ratchets: [],
    bits: [],
    lockchips: [],
    assistBlades: []
  });
  
  // Form state
  const [deckName, setDeckName] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [deckSize, setDeckSize] = useState(3);
  const [beyblades, setBeyblades] = useState<BeybladeConfig[]>([
    { id: '1', name: '', isCustomLine: false, parts: {} }
  ]);

  useEffect(() => {
    fetchPresets();
    if (useInventory) {
      fetchInventory();
    }
    fetchPartsData();
  }, [user]);

  const fetchPresets = async () => {
    try {
      const { data, error } = await supabase
        .from('deck_presets')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setPresets(data || []);
    } catch (error) {
      console.error('Error fetching presets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch parts data when not using inventory
  useEffect(() => {
    if (!useInventory) {
      fetchPartsData();
    }
  }, [useInventory]);

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

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('user_inventory')
        .select('*')
        .eq('user_id', user.id)
        .gt('quantity', 0);

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const getRequiredParts = (isCustomLine: boolean): string[] => {
    return isCustomLine 
      ? ['Lockchip', 'Main Blade', 'Assist Blade', 'Ratchet', 'Bit']
      : ['Blade', 'Ratchet', 'Bit'];
  };

  const getAvailableParts = (partType: string) => {
    if (!useInventory) {
      // Free build mode - return all parts from database
      const mappedType = partType === 'Main Blade' ? 'Blade' : partType;
      switch (mappedType) {
        case 'Blade':
          const bladeFilter = partType === 'Main Blade' ? 'Custom' : undefined;
          return partsData.blades
            .filter(blade => bladeFilter ? blade.Line === bladeFilter : blade.Line !== 'Custom')
            .map(blade => ({
            id: `db-${blade.Blades}`,
            part_type: 'Blade',
            part_name: blade.Blades,
            part_data: blade,
            quantity: 999 // Unlimited in free build
          }));
        case 'Ratchet':
          return partsData.ratchets.map(ratchet => ({
            id: `db-${ratchet.Ratchet}`,
            part_type: 'Ratchet',
            part_name: ratchet.Ratchet,
            part_data: ratchet,
            quantity: 999
          }));
        case 'Bit':
          return partsData.bits.map(bit => ({
            id: `db-${bit.Bit}`,
            part_type: 'Bit',
            part_name: `${bit.Bit} (${bit.Shortcut})`,
            part_data: bit,
            quantity: 999
          }));
        case 'Lockchip':
          return partsData.lockchips.map(lockchip => ({
            id: `db-${lockchip.Lockchip}`,
            part_type: 'Lockchip',
            part_name: lockchip.Lockchip,
            part_data: lockchip,
            quantity: 999
          }));
        case 'Assist Blade':
          return partsData.assistBlades.map(assistBlade => ({
            id: `db-${assistBlade['Assist Blade']}`,
            part_type: 'Assist Blade',
            part_name: `${assistBlade['Assist Blade Name']} (${assistBlade['Assist Blade']})`,
            part_data: assistBlade,
            quantity: 999
          }));
        default:
          return [];
      }
    }
    
    // Inventory mode - return user's inventory with proper blade line filtering
    if (partType === 'Blade' || partType === 'Main Blade') {
      if (partType === 'Main Blade') {
        return inventory.filter(item => item.part_type === 'Blade (Custom)');
      } else {
        return inventory.filter(item => 
          item.part_type.startsWith('Blade (') && item.part_type !== 'Blade (Custom)'
        );
      }
    } else {
      // For other parts, use direct matching
      const parts = inventory.filter(item => item.part_type === partType);
      return parts;
    }
  };

  const getPartDisplayName = (part: any, partType: string): string => {
    switch (partType) {
      case 'Blade':
      case 'Main Blade':
        return part.Blades;
      case 'Ratchet':
        return part.Ratchet;
      case 'Bit':
        return `${part.Bit} (${part.Shortcut})`;
      case 'Lockchip':
        return part.Lockchip;
      case 'Assist Blade':
        return `${part['Assist Blade Name']} (${part['Assist Blade']})`;
      default:
        return '';
    }
  };

  const generateBeybladeName = (isCustomLine: boolean, parts: { [key: string]: any }): string => {
    const requiredParts = getRequiredParts(isCustomLine);
    const hasAllParts = requiredParts.every(partType => parts[partType]);
    
    if (!hasAllParts) return '';

    if (isCustomLine) {
      const lockchip = parts['Lockchip']?.Lockchip || '';
      const mainBlade = parts['Main Blade']?.Blades || '';
      const assistBlade = parts['Assist Blade']?.['Assist Blade'] || '';
      const ratchet = parts['Ratchet']?.Ratchet || '';
      const bit = parts['Bit']?.Shortcut || '';
      
      return `${lockchip}${mainBlade} ${assistBlade}${ratchet}${bit}`;
    } else {
      const blade = parts['Blade']?.Blades || '';
      const ratchet = parts['Ratchet']?.Ratchet || '';
      const bit = parts['Bit']?.Shortcut || '';
      
      return `${blade} ${ratchet}${bit}`;
    }
  };

  const calculateBeybladeStats = (parts: { [key: string]: any }) => {
    let stats = {
      attack: 0,
      defense: 0,
      stamina: 0,
      dash: 0,
      burstRes: 0
    };

    Object.values(parts).forEach((part: any) => {
      if (part) {
        stats.attack += part.Attack || 0;
        stats.defense += part.Defense || 0;
        stats.stamina += part.Stamina || 0;
        stats.dash += part.Dash || 0;
        stats.burstRes += part['Burst Res'] || 0;
      }
    });

    return stats;
  };

  const startCreate = () => {
    setIsCreating(true);
    setDeckName('');
    setDeckDescription('');
    setDeckSize(3);
    setBeyblades([{ id: '1', name: '', isCustomLine: false, parts: {} }]);
  };

  const startEdit = (preset: DeckPreset) => {
    setEditingId(preset.id);
    setDeckName(preset.name);
    setDeckDescription(preset.description || '');
    setDeckSize(preset.beyblades.length);
    setBeyblades(preset.beyblades);
  };

  const addBeyblade = () => {
    if (beyblades.length < deckSize) {
      setBeyblades([
        ...beyblades,
        { id: Date.now().toString(), name: '', isCustomLine: false, parts: {} }
      ]);
    }
  };

  const removeBeyblade = (id: string) => {
    if (beyblades.length > 1) {
      setBeyblades(beyblades.filter(b => b.id !== id));
    }
  };

  const updateBeyblade = (id: string, field: keyof BeybladeConfig, value: any) => {
    setBeyblades(beyblades.map(b => {
      if (b.id === id) {
        if (field === 'isCustomLine') {
          const newBeyblade = { ...b, [field]: value, parts: {} };
          newBeyblade.name = generateBeybladeName(value, {});
          return newBeyblade;
        }
        return { ...b, [field]: value };
      }
      return b;
    }));
  };

  const updatePart = (beybladeId: string, partType: string, selectedPart: any) => {
    setBeyblades(beyblades.map(b => {
      if (b.id === beybladeId) {
        const newParts = { ...b.parts, [partType]: selectedPart };
        const newName = generateBeybladeName(b.isCustomLine, newParts);
        return {
          ...b,
          parts: newParts,
          name: newName
        };
      }
      return b;
    }));
  };

  const savePreset = async () => {
    if (!deckName.trim()) {
      await alert('Missing Information', 'Please enter a deck name.');
      return;
    }

    const validBeyblades = beyblades.filter(b => {
      const requiredParts = getRequiredParts(b.isCustomLine);
      return requiredParts.every(partType => b.parts[partType]);
    });

    if (validBeyblades.length === 0) {
      await alert('Missing Information', 'Please configure at least one complete Beyblade.');
      return;
    }

    try {
      const presetData = {
        user_id: user.id,
        name: deckName.trim(),
        description: deckDescription.trim() || null,
        beyblades: validBeyblades
      };

      if (isCreating) {
        const { error } = await supabase
          .from('deck_presets')
          .insert([presetData]);
        
        if (error) throw error;
      } else if (editingId) {
        const { error } = await supabase
          .from('deck_presets')
          .update({ ...presetData, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        
        if (error) throw error;
      }

      await fetchPresets();
      cancelEdit();
      await alert('Success', 'Deck preset saved successfully!');
    } catch (error) {
      console.error('Error saving preset:', error);
      await alert('Error', 'Failed to save deck preset. Please try again.');
    }
  };

  const deletePreset = async (id: string) => {
    const confirmed = await confirm(
      'Delete Deck Preset',
      'Are you sure you want to delete this deck preset?'
    );
    
    if (!confirmed) {
      return;
    }

    try {
      const { error } = await supabase
        .from('deck_presets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchPresets();
    } catch (error) {
      console.error('Error deleting preset:', error);
      await alert('Error', 'Failed to delete deck preset. Please try again.');
    }
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditingId(null);
    setDeckName('');
    setDeckDescription('');
    setDeckSize(3);
    setBeyblades([{ id: '1', name: '', isCustomLine: false, parts: {} }]);
  };

  const getStatIcon = (stat: string) => {
    switch (stat) {
      case 'attack': return <span className="text-red-500 text-xs">⚡</span>;
      case 'defense': return <span className="text-blue-500 text-xs">🛡️</span>;
      case 'stamina': return <span className="text-green-500 text-xs">⏱️</span>;
      case 'dash': return <Activity size={12} className="text-yellow-500" />;
      case 'burstRes': return <span className="text-purple-500 text-xs">🔒</span>;
      default: return null;
    }
  };

  const getStatColor = (stat: string) => {
    switch (stat) {
      case 'attack': return 'bg-red-500';
      case 'defense': return 'bg-blue-500';
      case 'stamina': return 'bg-green-500';
      case 'dash': return 'bg-yellow-500';
      case 'burstRes': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading deck builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={showHeader ? "p-6 max-w-7xl mx-auto" : ""}>
      {showHeader && (
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Deck Builder</h1>
            <p className="text-gray-600">Create and save Beyblade deck presets from your inventory</p>
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2 order-2 sm:order-1">
              <label className="text-sm font-medium text-gray-700">Build Mode:</label>
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setUseInventory(true)}
                  className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    useInventory 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="hidden sm:inline">Use Inventory</span>
                  <span className="sm:hidden">Inventory</span>
                </button>
                <button
                  onClick={() => setUseInventory(false)}
                  className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    !useInventory 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="hidden sm:inline">Free Build</span>
                  <span className="sm:hidden">Free</span>
                </button>
              </div>
            </div>
            <button
              onClick={startCreate}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2 order-1 sm:order-2"
            >
              <Plus size={20} />
              <span>New Deck</span>
            </button>
          </div>
        </div>
      )}
      
      {!showHeader && (
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-2 order-2 sm:order-1">
            <label className="text-sm font-medium text-gray-700">Build Mode:</label>
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setUseInventory(true)}
                className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  useInventory 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="hidden sm:inline">Use Inventory</span>
                <span className="sm:hidden">Inventory</span>
              </button>
              <button
                onClick={() => setUseInventory(false)}
                className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  !useInventory 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="hidden sm:inline">Free Build</span>
                <span className="sm:hidden">Free</span>
              </button>
            </div>
          </div>
          <button
            onClick={startCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2 order-1 sm:order-2"
          >
            <Plus size={20} />
            <span>New Deck</span>
          </button>
        </div>
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {isCreating ? 'Create New Deck' : 'Edit Deck'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Deck Name</label>
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Enter deck name"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
              <input
                type="text"
                value={deckDescription}
                onChange={(e) => setDeckDescription(e.target.value)}
                placeholder="Deck strategy or notes"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Beyblades Configuration */}
          <div className="space-y-6">
            {beyblades.map((beyblade, index) => (
              <div key={beyblade.id} className="border border-gray-200 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Beyblade #{index + 1}
                  </h3>
                  {beyblades.length > 1 && (
                    <button
                      onClick={() => removeBeyblade(beyblade.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Generated Name</label>
                    <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-gray-700 font-mono text-sm break-all">
                      {beyblade.name || 'Select all parts to generate name'}
                    </div>
                  </div>
                </div>

                {/* Parts Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {/* Custom Line Toggle for this Beyblade */}
                  <div className="sm:col-span-2 lg:col-span-3 mb-4">
                    <div className="flex items-center justify-center space-x-4">
                      <span className={`text-sm font-medium ${!beyblade.isCustomLine ? 'text-cyan-400' : 'text-slate-400'}`}>
                        Standard Line
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={beyblade.isCustomLine}
                          onChange={(e) => updateBeyblade(beyblade.id, 'isCustomLine', e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-10 h-6 rounded-full transition-colors ${
                          beyblade.isCustomLine ? 'bg-purple-500' : 'bg-slate-600'
                        }`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
                            beyblade.isCustomLine ? 'translate-x-5' : 'translate-x-1'
                          } mt-1`}></div>
                        </div>
                      </label>
                      <span className={`text-sm font-medium ${beyblade.isCustomLine ? 'text-purple-400' : 'text-slate-400'}`}>
                        Custom Line
                      </span>
                    </div>
                  </div>

                  {getRequiredParts(beyblade.isCustomLine).map((partType) => (
                    <div key={partType}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {partType}
                      </label>
                      <select
                        value={beyblade.parts[partType] ? JSON.stringify(beyblade.parts[partType]) : ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            const selectedPart = JSON.parse(e.target.value);
                            updatePart(beyblade.id, partType, selectedPart);
                          }
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Select {partType}</option>
                        {getAvailableParts(partType)
                          .filter((item) => {
                            // Filter blades by blade line in free build mode
                            if (!useInventory && (partType === 'Blade' || partType === 'Main Blade') && item.part_data?.Line) {
                              return partType === 'Main Blade' ? 
                                item.part_data.Line === 'Custom' : 
                                item.part_data.Line !== 'Custom';
                            }
                            // In inventory mode, filtering is already done in getAvailableParts
                            if (useInventory && (partType === 'Blade' || partType === 'Main Blade')) {
                              return true; // Already filtered by blade line in getAvailableParts
                            }
                            return true;
                          })
                          .map((item) => (
                            <option key={item.id} value={JSON.stringify(item.part_data)}>
                              {item.part_name} {useInventory ? `(Qty: ${item.quantity})` : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Stats Display */}
                {Object.keys(beyblade.parts).length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <Activity size={16} className="mr-2" />
                      Combined Stats
                    </h5>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
                      {Object.entries(calculateBeybladeStats(beyblade.parts)).map(([stat, value]) => (
                        <div key={stat} className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            {getStatIcon(stat)}
                          </div>
                          <div className="text-xs font-medium text-gray-600 capitalize truncate">
                            {stat === 'burstRes' ? 'Burst Res' : stat}
                          </div>
                          <div className="text-sm sm:text-lg font-bold text-gray-900">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {beyblades.length < 5 && (
            <button
              onClick={addBeyblade}
              className="mt-4 w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center space-x-2"
            >
              <Plus size={20} />
              <span>Add Another Beyblade ({beyblades.length}/5)</span>
            </button>
          )}

          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
            <button
              onClick={cancelEdit}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
            >
              <X size={16} />
              <span>Cancel</span>
            </button>
            <button
              onClick={savePreset}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Save size={16} />
              <span>Save Preset</span>
            </button>
          </div>
        </div>
      )}

      {/* Presets List */}
      {presets.length === 0 ? (
        <div className="text-center py-12">
          <Layers size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No deck presets yet</p>
          <button
            onClick={startCreate}
            className="mt-4 text-blue-600 hover:text-blue-800 underline"
          >
            Create your first deck preset
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {presets.map((preset) => (
            <div key={preset.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{preset.name}</h3>
                  {preset.description && (
                    <p className="text-sm text-gray-600 mt-1">{preset.description}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => startEdit(preset)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => deletePreset(preset.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{preset.beyblades.length}</span> Beyblades configured
                </div>
                <div className="space-y-1">
                  {preset.beyblades.slice(0, 3).map((beyblade, index) => (
                    <div key={index} className="text-xs text-gray-500 font-mono break-all">
                      {beyblade.name || `Beyblade ${index + 1}`}
                    </div>
                  ))}
                  {preset.beyblades.length > 3 && (
                    <div className="text-xs text-gray-400">
                      +{preset.beyblades.length - 3} more...
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-500 pt-2 border-t">
                Updated: {new Date(preset.updated_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}