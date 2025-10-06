import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, MapPin, Users, Trophy, CreditCard as Edit, Save, X, Clock, DollarSign, Shield, AlertCircle, CheckCircle, Eye, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { TournamentRegistration } from './TournamentRegistration';

interface TournamentDetailsProps {
  tournamentId: string;
  onBack: () => void;
}

interface Tournament {
  id: string;
  name: string;
  description?: string;
  tournament_date: string;
  location: string;
  max_participants: number;
  current_participants: number;
  status: 'upcoming' | 'active' | 'completed';
  registration_deadline: string;
  prize_pool?: string;
  beyblades_per_player: number;
  players_per_team: number;
  entry_fee: number;
  is_free: boolean;
  tournament_type: 'ranked' | 'casual';
  tournament_settings?: {
    rules: {
      allow_self_finish: boolean;
      allow_deck_shuffling: boolean;
      allow_repeating_parts: boolean;
    };
    match_format: 'solo' | 'teams';
    players_per_team: number;
  };
  registration_open: boolean;
  password?: string;
  created_at: string;

  payment_options?: string[];
  payment_details?: Record<string, any>;
}

interface UserRegistration {
  id: string;
  player_name: string;
  payment_mode: string;
  status: string;
  payment_status: string;
  registered_at: string;
  edit_count: number;
  last_edited_at?: string;
  beyblades: Array<{
    id: string;
    beyblade_name: string;
    blade_line: string;
    parts: Array<{
      part_type: string;
      part_name: string;
      part_data: any;
    }>;
  }>;
}

export function TournamentDetails({ tournamentId, onBack }: TournamentDetailsProps) {
  const { user } = useAuth();
  const { confirm, alert } = useConfirmation();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [userRegistrations, setUserRegistrations] = useState<UserRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRegistration, setEditingRegistration] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [partsData, setPartsData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  // ✅ Use one flag for guest checking
  const isGuest = !user || (typeof user.id === 'string' && user.id.startsWith('guest-'));

  useEffect(() => {
    fetchTournamentDetails();
    if (!isGuest) {
      fetchUserRegistrations();
    }
    fetchPartsData();
  }, [tournamentId, user]);

  const handleRegistrationSuccess = () => {
    fetchTournamentDetails();
    if (!isGuest) {
      fetchUserRegistrations();
    }
  };

  const fetchTournamentDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();
  
      if (error) throw error;
      setTournament(data);
    } catch (error) {
      console.error('Error fetching tournament details:', error);
    } finally {
      setLoading(false); // ✅ always clear loading
    }
  };

  const fetchUserRegistrations = async () => {
    if (!user?.username) return; // ✅ Guard against missing username

    try {
      const { data, error } = await supabase
        .from('tournament_registration_details')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('player_name', user.username);

      if (error) throw error;

      const grouped: { [key: string]: UserRegistration } = {};
      
      data?.forEach((row: any) => {
        if (!grouped[row.registration_id]) {
          grouped[row.registration_id] = {
            id: row.registration_id,
            player_name: row.player_name,
            payment_mode: row.payment_mode,
            status: row.status,
            payment_status: row.payment_status || 'confirmed',
            registered_at: row.registered_at,
            edit_count: row.edit_count || 0,
            last_edited_at: row.last_edited_at,
            beyblades: []
          };
        }

        if (row.beyblade_id) {
          const existingBeyblade = grouped[row.registration_id].beyblades
            .find(b => b.id === row.beyblade_id);
          
          if (!existingBeyblade) {
            grouped[row.registration_id].beyblades.push({
              id: row.beyblade_id,
              beyblade_name: row.beyblade_name,
              blade_line: row.blade_line,
              parts: row.beyblade_parts || []
            });
          }
        }
      });

      setUserRegistrations(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching user registrations:', error);
    } finally {
      setLoading(false);
    }
  };
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

  const startEdit = (registration: UserRegistration) => {
    if (registration.edit_count >= 2) {
      alert('Edit Limit Reached', 'This registration has reached the maximum edit limit of 2 changes.');
      return;
    }

    setEditingRegistration(registration.id);
    setEditFormData({
      player_name: registration.player_name,
      payment_mode: registration.payment_mode,
      beyblades: registration.beyblades.map(bey => ({
        ...bey,
        parts: bey.parts.reduce((acc, part) => {
          acc[part.part_type] = part.part_data;
          return acc;
        }, {} as any)
      }))
    });
  };

  const cancelEdit = () => {
    setEditingRegistration(null);
    setEditFormData({});
  };

  const saveEdit = async () => {
    if (!editingRegistration) return;

    const currentRegistration = userRegistrations.find(r => r.id === editingRegistration);
    if (!currentRegistration) return;

    if (currentRegistration.edit_count >= 2) {
      await alert('Edit Limit Reached', 'This registration has reached the maximum edit limit of 2 changes.');
      return;
    }

    const confirmed = await confirm(
      'Save Registration Changes',
      `Are you sure you want to save these changes? You will have ${2 - currentRegistration.edit_count - 1} edit(s) remaining after this change.`
    );

    if (!confirmed) return;

    setSaving(true);
    try {
      const { error: regError } = await supabase
        .from('tournament_registrations')
        .update({
          payment_mode: editFormData.payment_mode,
          edit_count: currentRegistration.edit_count + 1,
          last_edited_at: new Date().toISOString()
        })
        .eq('id', editingRegistration);

      if (regError) throw regError;

      for (const beyblade of editFormData.beyblades) {
        const beyName = generateBeybladeName(beyblade);
        
        const { error: beyError } = await supabase
          .from('tournament_beyblades')
          .update({
            beyblade_name: beyName
          })
          .eq('id', beyblade.id);

        if (beyError) throw beyError;

        const { error: deleteError } = await supabase
          .from('tournament_beyblade_parts')
          .delete()
          .eq('beyblade_id', beyblade.id);

        if (deleteError) throw deleteError;

        const partsToInsert = Object.entries(beyblade.parts).map(([partType, partData]) => ({
          beyblade_id: beyblade.id,
          part_type: partType,
          part_name: getPartDisplayName(partData, partType),
          part_data: partData
        }));

        if (partsToInsert.length > 0) {
          const { error: partsError } = await supabase
            .from('tournament_beyblade_parts')
            .insert(partsToInsert);

          if (partsError) throw partsError;
        }
      }

      await fetchUserRegistrations();
      setEditingRegistration(null);
      setEditFormData({});
      await alert('Success', 'Registration updated successfully!');
    } catch (error) {
      console.error('Error saving registration:', error);
      await alert('Error', 'Failed to save registration changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getRequiredParts = (bladeLine: string): string[] => {
    return bladeLine === 'Custom'
      ? ['Lockchip', 'Main Blade', 'Assist Blade', 'Ratchet', 'Bit']
      : ['Blade', 'Ratchet', 'Bit'];
  };

  const getPartOptions = (partType: string) => {
    switch (partType) {
      case 'Blade':
        return partsData.blades?.filter((blade: any) => blade.Line !== 'Custom') || [];
      case 'Main Blade':
        return partsData.blades?.filter((blade: any) => blade.Line === 'Custom') || [];
      case 'Ratchet':
        return partsData.ratchets || [];
      case 'Bit':
        return partsData.bits || [];
      case 'Lockchip':
        return partsData.lockchips || [];
      case 'Assist Blade':
        return partsData.assistBlades || [];
      default:
        return [];
    }
  };

  const getPartDisplayName = (part: any, partType: string): string => {
    switch (partType) {
      case 'Blade':
      case 'Main Blade':
        return part?.Blades || '';
      case 'Ratchet':
        return part?.Ratchet || '';
      case 'Bit':
        return `${part?.Bit || ''}${part?.Shortcut ? ` (${part.Shortcut})` : ''}`;
      case 'Lockchip':
        return part?.Lockchip || '';
      case 'Assist Blade':
        return `${part?.['Assist Blade Name'] || ''}${part?.['Assist Blade'] ? ` (${part['Assist Blade']})` : ''}`;
      default:
        return '';
    }
  };

  const generateBeybladeName = (beyblade: any): string => {
    const requiredParts = getRequiredParts(beyblade.blade_line);
    const hasAllParts = requiredParts.every(partType => beyblade.parts[partType]);
    
    if (!hasAllParts) return '';

    if (beyblade.blade_line === 'Custom') {
      const lockchip = beyblade.parts['Lockchip']?.Lockchip || '';
      const mainBlade = beyblade.parts['Main Blade']?.Blades || '';
      const assistBlade = beyblade.parts['Assist Blade']?.['Assist Blade'] || '';
      const ratchet = beyblade.parts['Ratchet']?.Ratchet || '';
      const bit = beyblade.parts['Bit']?.Shortcut || '';
      
      return `${lockchip}${mainBlade} ${assistBlade}${ratchet}${bit}`;
    } else {
      const blade = beyblade.parts['Blade']?.Blades || '';
      const ratchet = beyblade.parts['Ratchet']?.Ratchet || '';
      const bit = beyblade.parts['Bit']?.Shortcut || '';
      
      return `${blade} ${ratchet}${bit}`;
    }
  };

  const updateBeybladePart = (beybladeId: string, partType: string, selectedPart: any) => {
    setEditFormData((prev: any) => ({
      ...prev,
      beyblades: prev.beyblades.map((bey: any) => {
        if (bey.id === beybladeId) {
          const newParts = { ...bey.parts, [partType]: selectedPart };
          return { ...bey, parts: newParts };
        }
        return bey;
      })
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading tournament details...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Tournament Not Found</h2>
          <p className="text-slate-400 mb-6">The requested tournament could not be found.</p>
          <button
            onClick={onBack}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200"
          >
            Back to Tournaments
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Tournaments</span>
          </button>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">{tournament.name}</h1>
              <div className="flex items-center space-x-4 text-slate-400">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  tournament.status === 'active' ? 'bg-green-500/20 text-green-400' :
                  tournament.status === 'completed' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-cyan-500/20 text-cyan-400'
                }`}>
                  {tournament.status.toUpperCase()}
                </span>
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-500/20 text-slate-400 capitalize">
                  {tournament.tournament_type}
                </span>
                {tournament.tournament_settings?.match_format === 'teams' && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-500/20 text-purple-400">
                    TEAMS ({tournament.tournament_settings.players_per_team} per team)
                  </span>
                )}
              </div>
            </div>

            <div>
              {tournament.status === 'upcoming' && tournament.registration_open ? (
                <button
                  onClick={() => setShowRegistrationModal(true)}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 flex items-center space-x-2 shadow-[0_0_20px_rgba(0,200,255,0.3)]"
                >
                  <UserPlus size={20} />
                  <span className="font-semibold">Register Now</span>
                </button>
              ) : tournament.status === 'upcoming' && !tournament.registration_open ? (
                <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-6 py-3 rounded-lg flex items-center space-x-2">
                  <AlertCircle size={20} />
                  <span className="font-medium">Registration Closed</span>
                </div>
              ) : tournament.status === 'completed' ? (
                <div className="bg-purple-500/20 border border-purple-500/30 text-purple-400 px-6 py-3 rounded-lg flex items-center space-x-2">
                  <Trophy size={20} />
                  <span className="font-medium">Tournament Completed</span>
                </div>
              ) : (
                <div className="bg-green-500/20 border border-green-500/30 text-green-400 px-6 py-3 rounded-lg flex items-center space-x-2">
                  <CheckCircle size={20} />
                  <span className="font-medium">Tournament Active</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Guest User Registration Notice */}
        {(!user || user.id.startsWith('guest-')) && tournament.status === 'upcoming' && tournament.registration_open && (
          <div className="mb-6 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle size={20} className="text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-cyan-400 font-semibold mb-1">Registration Available</h3>
                <p className="text-slate-300 text-sm">
                  You can register as a guest, but <strong>creating an account</strong> allows you to view your personal stats, match history, and achievements across all tournaments!
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tournament Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Details */}
            <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                           transition-all duration-300 hover:border-cyan-400/70 
                           hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <Trophy size={24} className="mr-2 text-cyan-400" />
                Tournament Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center text-slate-300">
                    <Calendar size={16} className="mr-3 text-cyan-400" />
                    <div>
                      <div className="font-medium">Tournament Date</div>
                      <div className="text-sm text-slate-400">
                        {new Date(tournament.tournament_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center text-slate-300">
                    <MapPin size={16} className="mr-3 text-cyan-400" />
                    <div>
                      <div className="font-medium">Location</div>
                      <div className="text-sm text-slate-400">{tournament.location}</div>
                    </div>
                  </div>

                  <div className="flex items-center text-slate-300">
                    <Users size={16} className="mr-3 text-cyan-400" />
                    <div>
                      <div className="font-medium">Participants</div>
                      <div className="text-sm text-slate-400">
                        {tournament.max_participants === 999999 
                          ? `${tournament.current_participants} registered`
                          : `${tournament.current_participants} / ${tournament.max_participants} slots`
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center text-slate-300">
                    <Clock size={16} className="mr-3 text-cyan-400" />
                    <div>
                      <div className="font-medium">Registration Deadline</div>
                      <div className="text-sm text-slate-400">
                        {new Date(tournament.registration_deadline).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center text-slate-300">
                    <DollarSign size={16} className="mr-3 text-cyan-400" />
                    <div>
                      <div className="font-medium">Entry Fee</div>
                      <div className="text-sm text-slate-400">
                        {tournament.is_free ? 'Free Entry' : `₱${tournament.entry_fee}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center text-slate-300">
                    <Shield size={16} className="mr-3 text-cyan-400" />
                    <div>
                      <div className="font-medium">Deck Rules</div>
                      <div className="text-sm text-slate-400">
                        {tournament.beyblades_per_player} Beyblades per player
                        {tournament.tournament_settings?.match_format === 'teams' && 
                          ` • ${tournament.tournament_settings.players_per_team} players per team`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            {/* Payment Info */}
            {tournament.payment_details && (
              <div className="mt-6 border border-slate-700 bg-slate-900/40 p-6 rounded-lg">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <DollarSign size={20} className="mr-2 text-cyan-400" />
                  Payment Information
                </h2>
            
                {/* Payment Details */}
                <div>
                  <div className="text-slate-400 text-sm mb-1">Payment Details:</div>
                  <div className="space-y-2">
                    {Object.entries(tournament.payment_details).map(([method, detail]) => (
                      <div
                        key={method}
                        className="flex items-center justify-between bg-slate-800/50 px-3 py-2 rounded"
                      >
                        <span className="capitalize text-slate-300">{method.replace('_', ' ')}</span>
                        <span className="font-mono text-white">{detail as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

              {tournament.prize_pool && (
                <div className="mt-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-center">
                    <Trophy size={20} className="mr-2 text-yellow-400" />
                    <div>
                      <div className="font-medium text-yellow-400">Prize Pool</div>
                      <div className="text-yellow-300">{tournament.prize_pool}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {tournament.description && (
              <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                
                <h2 className="text-xl font-bold text-white mb-4">Description</h2>
                <div 
                  className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-white prose-em:text-slate-300 prose-a:text-cyan-400"
                  dangerouslySetInnerHTML={{ __html: tournament.description }}
                />
              </div>
            )}

            {/* Tournament Settings */}
            {tournament.tournament_settings && (
              <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                
                <h2 className="text-xl font-bold text-white mb-4">Tournament Settings</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-cyan-400 mb-3">Active Rules</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${
                          tournament.tournament_settings.rules.allow_self_finish ? 'bg-green-500' : 'bg-gray-500'
                        }`}></div>
                        <span className="text-slate-300">Self Finish Scoring (1 pt)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${
                          tournament.tournament_settings.rules.allow_deck_shuffling ? 'bg-green-500' : 'bg-gray-500'
                        }`}></div>
                        <span className="text-slate-300">Deck Shuffling</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${
                          tournament.allow_repeating_parts_in_deck || tournament.allow_repeating_parts_across_decks ? 'bg-green-500' : 'bg-gray-500'
                        }`}></div>
                        <span className="text-slate-300">Repeating Parts</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-cyan-400 mb-3">Match Format</h4>
                    <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <Users size={16} className="text-cyan-400" />
                        <span className="text-white font-medium capitalize">
                          {tournament.tournament_settings.match_format}
                        </span>
                        {tournament.tournament_settings.match_format === 'teams' && (
                          <span className="text-slate-400">
                            ({tournament.tournament_settings.players_per_team} players per team)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Registrations Sidebar */}
          <div className="lg:col-span-1">
            {user && !user.id.startsWith('guest-') ? (
              <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Users size={24} className="mr-2 text-cyan-400" />
                  Your Registrations
                </h2>

                {userRegistrations.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users size={24} className="text-slate-400" />
                    </div>
                    <p className="text-slate-400 mb-4">You haven't registered for this tournament yet.</p>
                    {tournament.status === 'upcoming' && tournament.registration_open && (
                      <p className="text-sm text-cyan-400">
                        Go back to the tournaments list to register.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userRegistrations.map((registration) => (
                      <div key={registration.id} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-bold text-white">{registration.player_name}</h3>
                            <div className="text-sm text-slate-400">
                              Registered: {new Date(registration.registered_at).toLocaleDateString()}
                            </div>
                            {registration.last_edited_at && (
                              <div className="text-xs text-slate-500">
                                Last edited: {new Date(registration.last_edited_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              registration.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                              registration.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {registration.status}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="text-sm">
                            <span className="text-slate-400">Payment:</span>
                            <span className="ml-2 text-white capitalize">
                              {registration.payment_mode.replace('_', ' ')}
                            </span>
                          </div>
                          {tournament.tournament_settings?.match_format === 'teams' && registration.team && (
                            <div className="text-sm">
                              <span className="text-slate-400">Team:</span>
                              <span className="ml-2 text-white">{registration.team}</span>
                            </div>
                          )}
                          <div className="text-sm">
                            <span className="text-slate-400">Edits used:</span>
                            <span className="ml-2 text-white">
                              {registration.edit_count} / 2
                            </span>
                          </div>
                        </div>

                        {/* Beyblades */}
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-cyan-400 mb-2">Beyblades</h4>
                          <div className="space-y-1">
                            {registration.beyblades.map((beyblade, index) => (
                              <div key={beyblade.id} className="text-xs font-mono text-slate-300 bg-slate-900/50 px-2 py-1 rounded">
                                {index + 1}. {beyblade.beyblade_name}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Edit Button */}
                        {tournament.status === 'upcoming' && registration.edit_count < 2 && (
                          <button
                            onClick={() => startEdit(registration)}
                            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-400 hover:to-purple-500 transition-all duration-200 flex items-center justify-center space-x-2"
                          >
                            <Edit size={16} />
                            <span>Edit Registration</span>
                          </button>
                        )}

                        {registration.edit_count >= 2 && (
                          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                            <div className="flex items-center justify-center space-x-2 text-red-400">
                              <AlertCircle size={16} />
                              <span className="text-sm font-medium">Edit limit reached</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] text-center">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                
                <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users size={24} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Login Required</h3>
                <p className="text-slate-400">
                  Please log in to view your tournament registrations.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Edit Registration Modal */}
        {editingRegistration && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-950 border border-cyan-500/30 rounded-xl shadow-[0_0_40px_rgba(0,200,255,0.3)] max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-4 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">Edit Registration</h2>
                    <p className="text-cyan-100">
                      {2 - (userRegistrations.find(r => r.id === editingRegistration)?.edit_count || 0)} edit(s) remaining
                    </p>
                  </div>
                  <button
                    onClick={cancelEdit}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {/* Payment Mode */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-cyan-400 mb-2">
                    Payment Mode
                  </label>
                  <select
                    value={editFormData.payment_mode || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, payment_mode: e.target.value })}
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {tournament.is_free && <option value="free">Free Entry</option>}
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                {/* Beyblades */}
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-white">Edit Beyblades</h3>
                  
                  {editFormData.beyblades?.map((beyblade: any, index: number) => (
                    <div key={beyblade.id} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
                      <h4 className="font-semibold text-white mb-4">Beyblade #{index + 1}</h4>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-cyan-400 mb-1">
                          Generated Name
                        </label>
                        <div className="bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm font-mono text-slate-300">
                          {generateBeybladeName(beyblade) || 'Select all parts to generate name'}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {getRequiredParts(beyblade.blade_line).map((partType) => (
                          <div key={partType}>
                            <label className="block text-sm font-medium text-cyan-400 mb-1">
                              {partType}
                            </label>
                            <select
                              value={beyblade.parts[partType] ? JSON.stringify(beyblade.parts[partType]) : ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  updateBeybladePart(beyblade.id, partType, JSON.parse(e.target.value));
                                }
                              }}
                              className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                              <option value="">Select {partType}</option>
                              {getPartOptions(partType).map((part: any, idx: number) => (
                                <option key={idx} value={JSON.stringify(part)}>
                                  {getPartDisplayName(part, partType)}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-slate-700">
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="px-6 py-3 bg-slate-800 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Registration Modal */}
        {showRegistrationModal && tournament && (
          <TournamentRegistration
            tournament={tournament}
            onClose={() => setShowRegistrationModal(false)}
            onRegistered={handleRegistrationSuccess}
          />
        )}
      </div>
    </div>
  );
}