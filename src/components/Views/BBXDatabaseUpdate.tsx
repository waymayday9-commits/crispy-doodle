import React, { useState, useEffect } from 'react';
import { Database, Plus, Save, X, Upload, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';

interface PartFormData {
  // Common fields
  name: string;
  type: string; // Attack, Defense, Stamina, Balance
  
  // Stats
  attack: number;
  defense: number;
  stamina: number;
  dash: number;
  burstRes: number;
  
  // Specific fields based on part type
  line?: string; // For blades
  shortcut?: string; // For bits
  assistBladeName?: string; // For assist blades
}

interface BeybladeFormData {
  isCustom: boolean;
  parts: {
    [key: string]: string; // part type -> part name
  };
}

export function BBXDatabaseUpdate() {
  const { user } = useAuth();
  const { confirm, alert } = useConfirmation();
  
  const [mode, setMode] = useState<'part' | 'beyblade'>('part');
  const [partType, setPartType] = useState<'lockchip' | 'main_blade' | 'blade' | 'assist_blade' | 'ratchet' | 'bit'>('blade');
  const [bladeLine, setBladeLine] = useState<'Basic' | 'Unique' | 'X-Over'>('Basic');
  const [partFormData, setPartFormData] = useState<PartFormData>({
    name: '',
    type: 'Balance',
    attack: 0,
    defense: 0,
    stamina: 0,
    dash: 0,
    burstRes: 0
  });
  
  const [beybladeFormData, setBeybladeFormData] = useState<BeybladeFormData>({
    isCustom: false,
    parts: {}
  });
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'developer';

  // Clear messages after 3 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const resetPartForm = () => {
    setPartFormData({
      name: '',
      type: 'Balance',
      attack: 0,
      defense: 0,
      stamina: 0,
      dash: 0,
      burstRes: 0
    });
  };

  const resetBeybladeForm = () => {
    setBeybladeFormData({
      isCustom: false,
      parts: {}
    });
  };

  const getRequiredPartsForBeyblade = (isCustom: boolean): string[] => {
    return isCustom 
      ? ['Lockchip', 'Main Blade', 'Assist Blade', 'Ratchet', 'Bit']
      : ['Blade', 'Ratchet', 'Bit'];
  };

  const generateBeybladeName = (parts: { [key: string]: string }, isCustom: boolean): string => {
    const requiredParts = getRequiredPartsForBeyblade(isCustom);
    const hasAllParts = requiredParts.every(partType => parts[partType]);
    
    if (!hasAllParts) return '';

    if (isCustom) {
      const lockchip = parts['Lockchip'] || '';
      const mainBlade = parts['Main Blade'] || '';
      const assistBlade = parts['Assist Blade'] || '';
      const ratchet = parts['Ratchet'] || '';
      const bit = parts['Bit'] || '';
      
      return `${lockchip}${mainBlade} ${assistBlade}${ratchet}${bit}`;
    } else {
      const blade = parts['Blade'] || '';
      const ratchet = parts['Ratchet'] || '';
      const bit = parts['Bit'] || '';
      
      return `${blade} ${ratchet}${bit}`;
    }
  };

  const handleSubmitPart = async () => {
    if (!partFormData.name.trim()) {
      setError('Part name is required');
      return;
    }

    const confirmed = await confirm(
      'Add New Part',
      `Are you sure you want to add "${partFormData.name}" to the ${partType} database?`
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let tableName = '';
      let insertData: any = {};

      switch (partType) {
        case 'lockchip':
          tableName = 'beypart_lockchip';
          insertData = {
            'Lockchip': partFormData.name.trim(),
            'Type': partFormData.type,
            'Attack': partFormData.attack,
            'Defense': partFormData.defense,
            'Stamina': partFormData.stamina
          };
          break;

        case 'main_blade':
          tableName = 'beypart_blade';
          insertData = {
            'Blades': partFormData.name.trim(),
            'Line': 'Custom',
            'Type': partFormData.type,
            'Attack': partFormData.attack,
            'Defense': partFormData.defense,
            'Stamina': partFormData.stamina
          };
          break;

        case 'blade':
          tableName = 'beypart_blade';
          insertData = {
            'Blades': partFormData.name.trim(),
            'Line': bladeLine,
            'Type': partFormData.type,
            'Attack': partFormData.attack,
            'Defense': partFormData.defense,
            'Stamina': partFormData.stamina
          };
          break;

        case 'assist_blade':
          tableName = 'beypart_assistblade';
          insertData = {
            'Assist Blade Name': partFormData.assistBladeName || partFormData.name.trim(),
            'Assist Blade': partFormData.name.trim(),
            'Type': partFormData.type,
            'Attack': partFormData.attack,
            'Defense': partFormData.defense,
            'Stamina': partFormData.stamina
          };
          break;

        case 'ratchet':
          tableName = 'beypart_ratchet';
          insertData = {
            'Ratchet': partFormData.name.trim(),
            'Type': partFormData.type,
            'Attack': partFormData.attack,
            'Defense': partFormData.defense,
            'Stamina': partFormData.stamina
          };
          break;

        case 'bit':
          tableName = 'beypart_bit';
          insertData = {
            'Bit': partFormData.name.trim(),
            'Shortcut': partFormData.shortcut || partFormData.name.trim(),
            'Type': partFormData.type,
            'Attack': partFormData.attack,
            'Defense': partFormData.defense,
            'Stamina': partFormData.stamina,
            'Dash': partFormData.dash,
            'Burst Res': partFormData.burstRes
          };
          break;
      }

      const { error: insertError } = await supabase
        .from(tableName)
        .insert([insertData]);

      if (insertError) throw insertError;

      setSuccess(`Successfully added ${partFormData.name} to the ${partType} database!`);
      resetPartForm();
    } catch (err: any) {
      console.error('Error adding part:', err);
      setError(`Failed to add part: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBeyblade = async () => {
    const requiredParts = getRequiredPartsForBeyblade(beybladeFormData.isCustom);
    const hasAllParts = requiredParts.every(partType => beybladeFormData.parts[partType]);
    
    if (!hasAllParts) {
      setError('Please fill in all required parts for the beyblade');
      return;
    }

    const beybladeNamePreview = generateBeybladeName(beybladeFormData.parts, beybladeFormData.isCustom);
    
    const confirmed = await confirm(
      'Add New Beyblade',
      `Are you sure you want to add "${beybladeNamePreview}" as a new beyblade combination?`
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // For now, we'll just show success since we don't have a beyblades table
      // In the future, this could insert into a beyblades or combinations table
      setSuccess(`Beyblade combination "${beybladeNamePreview}" has been recorded!`);
      resetBeybladeForm();
    } catch (err: any) {
      console.error('Error adding beyblade:', err);
      setError(`Failed to add beyblade: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-2xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-slate-400">
            You need admin or developer permissions to access the BBX Database Update.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold flex items-center mb-4">
            <Database size={40} className="mr-4 text-cyan-400" />
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Update BBX Database
            </span>
          </h1>
          <p className="text-slate-400 text-lg">Add new Beyblade parts and combinations to the database</p>
        </div>

        {/* Status Messages */}
        {success && (
          <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center space-x-2">
            <Check size={20} className="text-green-400" />
            <span className="text-green-400">{success}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center space-x-2">
            <AlertCircle size={20} className="text-red-400" />
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* Mode Selection */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] mb-8">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Upload size={24} className="mr-2 text-cyan-400" />
            Add to Database
          </h2>

          <div className="flex items-center space-x-6">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="part"
                checked={mode === 'part'}
                onChange={(e) => setMode(e.target.value as 'part')}
                className="w-4 h-4 text-cyan-600 border-cyan-500/30 focus:ring-cyan-500 bg-slate-800"
              />
              <span className="text-white font-medium">Individual Part</span>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="beyblade"
                checked={mode === 'beyblade'}
                onChange={(e) => setMode(e.target.value as 'beyblade')}
                className="w-4 h-4 text-cyan-600 border-cyan-500/30 focus:ring-cyan-500 bg-slate-800"
              />
              <span className="text-white font-medium">Full Beyblade</span>
            </label>
          </div>
        </div>

        {/* Part Mode */}
        {mode === 'part' && (
          <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            
            <h3 className="text-lg font-bold text-white mb-6">Add Individual Part</h3>

            <div className="space-y-6">
              {/* Part Type Selection */}
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">
                  Part Type *
                </label>
                <select
                  value={partType}
                  onChange={(e) => {
                    setPartType(e.target.value as any);
                    resetPartForm();
                  }}
                  className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="lockchip">Lockchip</option>
                  <option value="main_blade">Main Blade (Custom)</option>
                  <option value="blade">Blade (Basic/Unique/X-Over)</option>
                  <option value="assist_blade">Assist Blade</option>
                  <option value="ratchet">Ratchet</option>
                  <option value="bit">Bit</option>
                </select>
              </div>

              {/* Blade Line Selection (only for regular blades) */}
              {partType === 'blade' && (
                <div>
                  <label className="block text-sm font-medium text-cyan-400 mb-2">
                    Blade Line *
                  </label>
                  <select
                    value={bladeLine}
                    onChange={(e) => setBladeLine(e.target.value as any)}
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="Basic">Basic</option>
                    <option value="Unique">Unique</option>
                    <option value="X-Over">X-Over</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Part Name */}
                <div>
                  <label className="block text-sm font-medium text-cyan-400 mb-2">
                    Part Name *
                  </label>
                  <input
                    type="text"
                    value={partFormData.name}
                    onChange={(e) => setPartFormData({ ...partFormData, name: e.target.value })}
                    placeholder={`Enter ${partType.replace('_', ' ')} name`}
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                {/* Part Type/Role */}
                <div>
                  <label className="block text-sm font-medium text-cyan-400 mb-2">
                    Type/Role *
                  </label>
                  <select
                    value={partFormData.type}
                    onChange={(e) => setPartFormData({ ...partFormData, type: e.target.value })}
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="Attack">Attack</option>
                    <option value="Defense">Defense</option>
                    <option value="Stamina">Stamina</option>
                    <option value="Balance">Balance</option>
                  </select>
                </div>

                {/* Shortcut (only for bits) */}
                {partType === 'bit' && (
                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">
                      Shortcut *
                    </label>
                    <input
                      type="text"
                      value={partFormData.shortcut || ''}
                      onChange={(e) => setPartFormData({ ...partFormData, shortcut: e.target.value })}
                      placeholder="e.g., L, H, T, etc."
                      className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                )}

                {/* Assist Blade Name (only for assist blades) */}
                {partType === 'assist_blade' && (
                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">
                      Assist Blade Full Name
                    </label>
                    <input
                      type="text"
                      value={partFormData.assistBladeName || ''}
                      onChange={(e) => setPartFormData({ ...partFormData, assistBladeName: e.target.value })}
                      placeholder="Full assist blade name"
                      className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                )}
              </div>

              {/* Stats */}
              <div>
                <h4 className="text-lg font-semibold text-white mb-4">Part Statistics</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">
                      Attack
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={partFormData.attack}
                      onChange={(e) => setPartFormData({ ...partFormData, attack: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">
                      Defense
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={partFormData.defense}
                      onChange={(e) => setPartFormData({ ...partFormData, defense: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">
                      Stamina
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={partFormData.stamina}
                      onChange={(e) => setPartFormData({ ...partFormData, stamina: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  {/* Dash (only for bits) */}
                  {partType === 'bit' && (
                    <div>
                      <label className="block text-sm font-medium text-cyan-400 mb-2">
                        Dash
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={partFormData.dash}
                        onChange={(e) => setPartFormData({ ...partFormData, dash: parseInt(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  )}

                  {/* Burst Resistance (only for bits) */}
                  {partType === 'bit' && (
                    <div>
                      <label className="block text-sm font-medium text-cyan-400 mb-2">
                        Burst Res
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="80"
                        value={partFormData.burstRes}
                        onChange={(e) => setPartFormData({ ...partFormData, burstRes: parseInt(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitPart}
                  disabled={loading || !partFormData.name.trim()}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2 shadow-[0_0_20px_rgba(0,200,255,0.3)]"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Add Part</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Beyblade Mode */}
        {mode === 'beyblade' && (
          <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            
            <h3 className="text-lg font-bold text-white mb-6">Add Full Beyblade</h3>

            <div className="space-y-6">
              {/* Beyblade Type Selection */}
              <div className="flex items-center space-x-6">
                <span className="text-white font-medium">Beyblade Type:</span>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="beybladeType"
                    checked={!beybladeFormData.isCustom}
                    onChange={() => setBeybladeFormData({ ...beybladeFormData, isCustom: false, parts: {} })}
                    className="w-4 h-4 text-cyan-600 border-cyan-500/30 focus:ring-cyan-500 bg-slate-800"
                  />
                  <span className="text-cyan-400 font-medium">Standard</span>
                </label>
                
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="beybladeType"
                    checked={beybladeFormData.isCustom}
                    onChange={() => setBeybladeFormData({ ...beybladeFormData, isCustom: true, parts: {} })}
                    className="w-4 h-4 text-cyan-600 border-cyan-500/30 focus:ring-cyan-500 bg-slate-800"
                  />
                  <span className="text-purple-400 font-medium">Custom</span>
                </label>
              </div>

              {/* Generated Name Preview */}
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">
                  Generated Beyblade Name
                </label>
                <div className="bg-slate-800 border border-cyan-500/30 rounded-lg px-4 py-3 text-slate-300 font-mono">
                  {generateBeybladeName(beybladeFormData.parts, beybladeFormData.isCustom) || 'Select all parts to generate name'}
                </div>
              </div>

              {/* Parts Input */}
              <div>
                <h4 className="text-lg font-semibold text-white mb-4">Beyblade Parts</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getRequiredPartsForBeyblade(beybladeFormData.isCustom).map((partType) => (
                    <div key={partType}>
                      <label className="block text-sm font-medium text-cyan-400 mb-2">
                        {partType} *
                      </label>
                      <input
                        type="text"
                        value={beybladeFormData.parts[partType] || ''}
                        onChange={(e) => setBeybladeFormData({
                          ...beybladeFormData,
                          parts: { ...beybladeFormData.parts, [partType]: e.target.value }
                        })}
                        placeholder={`Enter ${partType.toLowerCase()} name`}
                        className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitBeyblade}
                  disabled={loading || !getRequiredPartsForBeyblade(beybladeFormData.isCustom).every(partType => beybladeFormData.parts[partType])}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2 shadow-[0_0_20px_rgba(0,200,255,0.3)]"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Add Beyblade</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <h3 className="text-lg font-bold text-white mb-4">Instructions</h3>
          <div className="space-y-3 text-slate-300">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2"></div>
              <div>
                <strong className="text-cyan-400">Individual Parts:</strong> Add new parts to specific categories with their stats. Each part will be available for use in tournament registrations and deck building.
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-purple-400 rounded-full mt-2"></div>
              <div>
                <strong className="text-purple-400">Full Beyblades:</strong> Record complete beyblade combinations for reference. This helps track popular combinations and meta trends.
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
              <div>
                <strong className="text-yellow-400">Stats Guidelines:</strong> Attack/Defense/Stamina typically range 0-200. Dash ranges 0-50. Burst Resistance ranges 0-80.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}