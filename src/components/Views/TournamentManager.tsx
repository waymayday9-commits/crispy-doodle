import React, { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit, Trash2, Save, X, Calendar, MapPin, Users, Trophy, Eye, EyeOff, Wand2, Monitor, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';
// import { TournamentWizard } from './TournamentWizard/TournamentWizard';
import { AwardModal } from './AwardModal';

/* ===================== Types ===================== */
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
  registration_open: boolean;
  is_practice: boolean;
  password?: string;
  created_at: string;
  tournament_code?: string; // present in your list render
}

interface Registration {
  id: string;
  tournament_id: string;
  player_name: string;
  payment_mode: string;
  registered_at: string;
  status: string;
  payment_status: string;
  beyblades: Array<{
    beyblade_id: string;
    beyblade_name: string;
    blade_line: string;
  }>;
}

type View = 'tournaments' | 'registrations';

interface TournamentManagerProps {
  onOpenDashboard?: (tournamentId: string) => void;
}

/* ===================== Component ===================== */
export function TournamentManager({ onOpenDashboard }: TournamentManagerProps) {
  const { user } = useAuth();
  const { confirm, alert } = useConfirmation();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [currentView, setCurrentView] = useState<View>('tournaments');
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userCommunities, setUserCommunities] = useState<any[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [selectedTournamentForAward, setSelectedTournamentForAward] = useState<string | null>(null);

const [searchQuery, setSearchQuery] = useState('');
const [sortColumn, setSortColumn] = useState<'player' | 'date' | 'payment' | 'status' | ''>('');
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
const [currentPage, setCurrentPage] = useState(1);
const rowsPerPage = 10;

const handleSort = (col: string) => {
  if (sortColumn === col) {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  } else {
    setSortColumn(col as any);
    setSortDirection('asc');
  }
};

const filteredRegistrations = registrations.filter((r) =>
  r.player_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
  r.beyblades.some(b => b.beyblade_name.toLowerCase().includes(searchQuery.toLowerCase()))
);

const sortedRegistrations = [...filteredRegistrations].sort((a, b) => {
  let valA: any, valB: any;
  switch (sortColumn) {
    case 'player':
      valA = a.player_name; valB = b.player_name; break;
    case 'date':
      valA = new Date(a.registered_at).getTime(); valB = new Date(b.registered_at).getTime(); break;
    case 'payment':
      valA = a.payment_mode; valB = b.payment_mode; break;
    case 'status':
      valA = a.status; valB = b.status; break;
    default:
      return 0;
  }
  if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
  if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
  return 0;
});

const totalPages = Math.ceil(sortedRegistrations.length / rowsPerPage);
const paginatedRegistrations = sortedRegistrations.slice(
  (currentPage - 1) * rowsPerPage,
  currentPage * rowsPerPage
);
  
  // Form state (includes unlimited toggle, practice, registration_open)
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    tournament_date: string;
    location: string;
    max_participants?: number;
    registration_deadline: string;
    prize_pool: string;
    beyblades_per_player?: number;
    players_per_team?: number;
    entry_fee?: number;
    is_free: boolean;
    tournament_type: 'ranked' | 'casual';
    is_practice: boolean;
    registration_open: boolean;
    password: string;
    unlimited_participants: boolean;
    hosted_by_type: 'individual' | 'community';
    hosted_by_community_id?: string;
  }>({
    name: '',
    description: '',
    tournament_date: '',
    location: '',
    max_participants: 16,
    registration_deadline: '',
    prize_pool: '',
    beyblades_per_player: 3,
    players_per_team: 1,
    entry_fee: 0,
    is_free: true,
    tournament_type: 'casual',
    is_practice: false,
    registration_open: true,
    password: '',
    unlimited_participants: false,
    hosted_by_type: 'individual',
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'developer';

  useEffect(() => {
    if (isAdmin) {
      fetchTournaments();
      fetchUserCommunities();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (selectedTournament && currentView === 'registrations') {
      fetchRegistrations();
    }
  }, [selectedTournament, currentView]);

  const fetchUserCommunities = async () => {
    try {
      const { data, error } = await supabase
        .from('community_members')
        .select(`
          communities:community_id (id, name)
        `)
        .eq('user_id', user?.id)
        .in('role', ['leader', 'admin']);

      if (error) throw error;
      
      const communities = (data || [])
        .map(item => item.communities)
        .filter(Boolean);
      
      setUserCommunities(communities);
    } catch (error) {
      console.error('Error fetching user communities:', error);
    }
  };
  /* ===================== Data ===================== */
  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('tournament_date', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
    } catch (e) {
      console.error('Error fetching tournaments:', e);
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async () => {
    if (!selectedTournament) return;
    try {
      const { data, error } = await supabase
        .from('tournament_registration_details')
        .select('*')
        .eq('tournament_id', selectedTournament)
        .order('registered_at', { ascending: false });

      if (error) throw error;

      const grouped: Record<string, Registration> = {};
      data?.forEach((row: any) => {
        if (!grouped[row.registration_id]) {
          grouped[row.registration_id] = {
            id: row.registration_id,
            tournament_id: row.tournament_id,
            player_name: row.player_name,
            payment_mode: row.payment_mode,
            registered_at: row.registered_at,
            status: row.status,
            payment_status: row.payment_status || 'confirmed',
            beyblades: [],
          };
        }
        if (row.beyblade_id) {
          const exists = grouped[row.registration_id].beyblades
            .some(b => b.beyblade_id === row.beyblade_id);
          if (!exists) {
            grouped[row.registration_id].beyblades.push({
              beyblade_id: row.beyblade_id,
              beyblade_name: row.beyblade_name,
              blade_line: row.blade_line,
            });
          }
        }
      });

      setRegistrations(Object.values(grouped));
    } catch (e) {
      console.error('Error fetching registrations:', e);
    }
  };

  /* ===================== CRUD ===================== */
  const startCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      tournament_date: '',
      location: '',
      max_participants: 16,
      registration_deadline: '',
      prize_pool: '',
      beyblades_per_player: 3,
      players_per_team: 1,
      entry_fee: 0,
      is_free: true,
      tournament_type: 'casual',
      is_practice: false,
      registration_open: true,
      password: '',
      unlimited_participants: false,
    });
  };

  const startEdit = (t: Tournament) => {
    setEditingId(t.id);
    setIsCreating(false);
    setFormData({
      name: t.name,
      description: t.description || '',
      tournament_date: t.tournament_date,
      location: t.location,
      max_participants: t.max_participants,
      registration_deadline: t.registration_deadline,
      prize_pool: t.prize_pool || '',
      beyblades_per_player: t.beyblades_per_player,
      players_per_team: t.players_per_team,
      entry_fee: t.entry_fee,
      is_free: t.is_free,
      tournament_type: t.tournament_type,
      is_practice: t.is_practice,
      registration_open: t.registration_open,
      password: t.password || '',
      unlimited_participants: t.max_participants === 999999,
      hosted_by_type: t.hosted_by_type || 'individual',
      hosted_by_community_id: t.hosted_by_community_id || '',
    });
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      tournament_date: '',
      location: '',
      max_participants: 16,
      registration_deadline: '',
      prize_pool: '',
      beyblades_per_player: 3,
      players_per_team: 1,
      entry_fee: 0,
      is_free: true,
      tournament_type: 'casual',
      is_practice: false,
      registration_open: true,
      password: '',
      unlimited_participants: false,
      hosted_by_type: 'individual',
    });
  };

  const saveTournament = async () => {
    if (!formData.name.trim()) return alert('Missing Information', 'Please enter a tournament name.');
    if (!formData.password.trim()) return alert('Missing Information', 'Please enter a tournament password.');
    if (!formData.tournament_date) return alert('Missing Information', 'Please select a tournament date.');
    if (!formData.location.trim()) return alert('Missing Information', 'Please enter a tournament location.');
    if (!formData.registration_deadline) return alert('Missing Information', 'Please select a registration deadline.');
    if (formData.hosted_by_type === 'community' && !formData.hosted_by_community_id) {
      return alert('Missing Information', 'Please select a community to host this tournament.');
    }

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        tournament_date: formData.tournament_date,
        location: formData.location.trim(),
        max_participants: formData.unlimited_participants ? 999999 : (formData.max_participants ?? 16),
        registration_deadline: formData.registration_deadline,
        prize_pool: formData.prize_pool.trim() || null,
        beyblades_per_player: formData.beyblades_per_player ?? 3,
        players_per_team: formData.players_per_team ?? 1,
        entry_fee: formData.is_free ? 0 : (formData.entry_fee ?? 0),
        is_free: formData.is_free,
        tournament_type: formData.tournament_type,
        is_practice: formData.is_practice,
        registration_open: formData.registration_open,
        password: formData.password.trim(),
        hosted_by_type: formData.hosted_by_type,
        hosted_by_community_id: formData.hosted_by_type === 'community' ? formData.hosted_by_community_id : null,
        hosted_by_user_id: formData.hosted_by_type === 'individual' ? user?.id : null,
        tournament_format: 'swiss', // Default format
        stadium_count: 6, // Default stadium count
        tournament_officers: [], // Empty array for officers
        allow_repeating_parts: false, // Default setting
        repeat_part_fee: 0, // Default fee
        decks_per_player: 1, // Default decks per player
      };

      if (isCreating) {
        const { error } = await supabase.from('tournaments').insert([payload]);
        if (error) throw error;
      } else if (editingId) {
        const { error } = await supabase.from('tournaments').update(payload).eq('id', editingId);
        if (error) throw error;
      }

      cancelEdit();
      await alert('Success', 'Tournament saved successfully!');
      await fetchTournaments();
    } catch (e) {
      console.error('Error saving tournament:', e);
      await alert('Error', 'Failed to save tournament. Please try again.');
    }
  };

  const updateTournamentStatus = async (tournamentId: string, newStatus: Tournament['status']) => {
    try {
      const { error } = await supabase.from('tournaments').update({ status: newStatus }).eq('id', tournamentId);
      if (error) throw error;
      await fetchTournaments();
      await alert('Success', `Tournament status updated to ${newStatus}!`);
    } catch (e) {
      console.error('Error updating status:', e);
      await alert('Error', 'Failed to update tournament status. Please try again.');
    }
  };

  const toggleRegistration = async (tournamentId: string, current: boolean) => {
    try {
      const { error } = await supabase.from('tournaments').update({ registration_open: !current }).eq('id', tournamentId);
      if (error) throw error;
      await fetchTournaments();
      await alert('Success', `Registration ${!current ? 'opened' : 'closed'} successfully!`);
    } catch (e) {
      console.error('Error toggling registration:', e);
      await alert('Error', 'Failed to toggle registration. Please try again.');
    }
  };

  const deleteTournament = async (id: string) => {
    const proceed = await confirm(
      'Delete Tournament',
      'Are you sure you want to delete this tournament? This will also delete all registrations and match data. This action cannot be undone.'
    );
    if (!proceed) return;

    try {
      // Delete in proper order to respect foreign key constraints
      // First, get all registration IDs for this tournament
      const { data: registrations } = await supabase
        .from('tournament_registrations')
        .select('id')
        .eq('tournament_id', id);

      if (registrations && registrations.length > 0) {
        const registrationIds = registrations.map(r => r.id);
        
        // Get all beyblade IDs for these registrations
        const { data: beyblades } = await supabase
          .from('tournament_beyblades')
          .select('id')
          .in('registration_id', registrationIds);

        if (beyblades && beyblades.length > 0) {
          const beybladeIds = beyblades.map(b => b.id);
          
          // Delete beyblade parts first
          await supabase
            .from('tournament_beyblade_parts')
            .delete()
            .in('beyblade_id', beybladeIds);
        }

        // Delete beyblades
        await supabase
          .from('tournament_beyblades')
          .delete()
          .in('registration_id', registrationIds);
      }

      // Delete match results
      await supabase
        .from('match_results')
        .delete()
        .eq('tournament_id', id);

      // Delete match sessions
      await supabase
        .from('match_sessions')
        .delete()
        .eq('tournament_id', id);

      // Delete registrations
      await supabase
        .from('tournament_registrations')
        .delete()
        .eq('tournament_id', id);

      // Finally, delete the tournament
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id);
        
      if (error) throw error;

      await fetchTournaments();
      await alert('Success', 'Tournament deleted successfully!');
    } catch (e) {
      console.error('Error deleting tournament:', e);
      await alert('Error', 'Failed to delete tournament. Please try again.');
    }
  };

  const deleteRegistration = async (registrationId: string) => {
    const proceed = await confirm(
      'Delete Registration',
      'Are you sure you want to delete this registration? This action cannot be undone.'
    );
    if (!proceed) return;

    try {
      const { error } = await supabase.from('tournament_registrations').delete().eq('id', registrationId);
      if (error) throw error;
      await fetchRegistrations();
      await alert('Success', 'Registration deleted successfully!');
    } catch (e) {
      console.error('Error deleting registration:', e);
      await alert('Error', 'Failed to delete registration. Please try again.');
    }
  };

  const confirmPayment = async (registrationId: string) => {
    const confirmed = await confirm(
      'Confirm Payment',
      'Mark this registration as paid and confirmed?'
    );
    
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('tournament_registrations')
        .update({ 
          status: 'confirmed',
          payment_status: 'paid'
        })
        .eq('id', registrationId);

      if (error) throw error;
      
      await fetchRegistrations();
      await alert('Success', 'Payment confirmed successfully!');
    } catch (error) {
      console.error('Error confirming payment:', error);
      await alert('Error', 'Failed to confirm payment. Please try again.');
    }
  };

  const openAwardModal = (tournamentId: string) => {
    setSelectedTournamentForAward(tournamentId);
    setShowAwardModal(true);
  };

  const closeAwardModal = () => {
    setShowAwardModal(false);
    setSelectedTournamentForAward(null);
  };

  /* ===================== Guards / Loading ===================== */
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="bg-slate-900/60 border border-red-500/30 p-8 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 mx-auto mb-4 flex items-center justify-center">🔒</div>
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-slate-400">You need admin or developer permissions to access tournament management.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold flex items-center">
                <Trophy size={36} className="mr-3 text-cyan-400" />
                <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  Tournament Manager
                </span>
              </h1>
              <p className="text-slate-400 mt-1">Create and manage tournaments</p>
            </div>

            {/* Top-right tabs (like tournaments page) */}
            <div className="flex space-x-6 border-b border-slate-700">
              {(['tournaments', 'registrations'] as View[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setCurrentView(tab)}
                  className={`relative pb-2 text-sm font-medium capitalize transition-colors group ${
                    currentView === tab ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-300'
                  }`}
                >
                  {tab}
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500
                      ${currentView === tab ? 'w-full' : 'w-0 group-hover:w-full'}`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Create button */}
        {currentView === 'tournaments' && (
          <div className="flex justify-end mb-6">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowWizard(true)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-medium
                           hover:from-cyan-400 hover:to-purple-500 transition-all duration-200
                           shadow-[0_0_18px_rgba(0,200,255,0.25)] flex items-center space-x-2"
              >
                <Wand2 size={18} />
                <span>Tournament Wizard</span>
              </button>
              
              <button
                onClick={startCreate}
                className="px-4 py-2 bg-slate-800 border border-slate-600 text-slate-300 font-medium
                           hover:bg-slate-700 hover:text-white transition-all duration-200
                           flex items-center space-x-2"
              >
                <Plus size={18} />
                <span>Quick Create</span>
              </button>
            </div>
          </div>
        )}

        {/* Create/Edit Form */}
        {currentView === 'tournaments' && (isCreating || editingId) && (
          <div className="bg-slate-900/50 border border-cyan-500/30 p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">
              {isCreating ? 'Create New Tournament' : 'Edit Tournament'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Name */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Tournament Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="Enter tournament name"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Tournament Date *</label>
                <input
                  type="date"
                  value={formData.tournament_date}
                  onChange={(e) => setFormData({ ...formData, tournament_date: e.target.value })}
                  className="w-full bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Location *</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="Enter tournament location"
                />
              </div>

              {/* Registration deadline */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Registration Deadline *</label>
                <input
                  type="date"
                  value={formData.registration_deadline}
                  onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                  className="w-full bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Max participants + Unlimited */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Max Participants</label>
                <input
                  type="number"
                  min={1}
                  disabled={formData.unlimited_participants}
                  value={formData.unlimited_participants ? '' : (formData.max_participants ?? '')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_participants: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                />
                <label className="mt-2 inline-flex items-center space-x-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.unlimited_participants}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        unlimited_participants: e.target.checked,
                        max_participants: e.target.checked ? 999999 : (formData.max_participants ?? 16),
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span>Unlimited Participants</span>
                </label>
              </div>

              {/* Beyblades per player */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Beyblades per Player</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={formData.beyblades_per_player ?? 3}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      beyblades_per_player: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Tournament type */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Tournament Type</label>
                <select
                  value={formData.tournament_type}
                  onChange={(e) => setFormData({ ...formData, tournament_type: e.target.value as 'ranked' | 'casual' })}
                  className="w-full bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="casual">Casual</option>
                  <option value="ranked">Ranked</option>
                </select>
              </div>

              {/* Host Type */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Host Type</label>
                <select
                  value={formData.hosted_by_type || 'individual'}
                  onChange={(e) => setFormData({ ...formData, hosted_by_type: e.target.value as 'individual' | 'community' })}
                  className="w-full bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="individual">Individual</option>
                  <option value="community">Community</option>
                </select>
              </div>

              {/* Community Selection (if hosting as community) */}
              {formData.hosted_by_type === 'community' && (
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Select Community</label>
                  <select
                    value={formData.hosted_by_community_id || ''}
                    onChange={(e) => setFormData({ ...formData, hosted_by_community_id: e.target.value })}
                    className="w-full bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Select Community --</option>
                    {userCommunities.map(community => (
                      <option key={community.id} value={community.id}>
                        {community.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Practice mode */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Tournament Mode</label>
                <label className="inline-flex items-center space-x-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.is_practice}
                    onChange={(e) => setFormData({ ...formData, is_practice: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span>Practice Tournament</span>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  Practice tournaments don't contribute to global or personal stats
                </p>
              </div>

              {/* Entry fee / free */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Entry Fee</label>
                <label className="inline-flex items-center space-x-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.is_free}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_free: e.target.checked,
                        entry_fee: e.target.checked ? 0 : (formData.entry_fee ?? 0),
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span>Free Tournament</span>
                </label>
                {!formData.is_free && (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.entry_fee ?? 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        entry_fee: e.target.value === '' ? 0 : parseFloat(e.target.value),
                      })
                    }
                    className="w-full bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 mt-2"
                    placeholder="0.00"
                  />
                )}
              </div>

              {/* Password */}
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-300 mb-1">Tournament Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-950/60 border border-slate-700 px-3 py-2 pr-10 text-sm focus:outline-none focus:border-cyan-500"
                    placeholder="Enter tournament password"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPassword(!showPassword);
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  This password will be required for match tracking access
                </p>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="Tournament description (optional)"
                />
              </div>

              {/* Prize pool */}
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-300 mb-1">Prize Pool</label>
                <input
                  type="text"
                  value={formData.prize_pool}
                  onChange={(e) => setFormData({ ...formData, prize_pool: e.target.value })}
                  className="w-full bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="e.g., ₱500 cash prize"
                />
              </div>
            </div>

            {/* Form actions */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 text-slate-300 border border-slate-600 hover:bg-slate-800 transition"
              >
                <div className="flex items-center space-x-2">
                  <X size={16} />
                  <span>Cancel</span>
                </div>
              </button>
              <button
                type="button"
                onClick={saveTournament}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-medium
                           hover:from-cyan-400 hover:to-purple-500 transition-all duration-200
                           shadow-[0_0_18px_rgba(0,200,255,0.25)]"
              >
                <div className="flex items-center space-x-2">
                  <Save size={16} />
                  <span>Save Tournament</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Tournaments list */}
        {currentView === 'tournaments' && (
          tournaments.length === 0 ? (
            <div className="text-center py-12">
              <Trophy size={48} className="mx-auto text-slate-500 mb-4" />
              <p className="text-slate-400">No tournaments created yet</p>
              <button
                onClick={startCreate}
                className="mt-4 text-cyan-400 hover:text-white transition"
              >
                Create your first tournament
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {tournaments.map((t) => (
                <div
                  key={t.id}
                  className="group relative border border-slate-700 bg-slate-900/50 p-5 rounded-none
                             transition-all duration-300 hover:border-cyan-400/70
                             hover:shadow-[0_0_18px_rgba(34,211,238,0.35)]"
                >
                  {/* Animated bottom line */}
                  <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500 group-hover:w-full" />

                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      {/* Title wraps under badges if long */}
                      <h3 className="text-lg font-semibold text-white break-words pr-28">
                        {t.name}
                      </h3>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Status */}
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-none
                          ${t.status === 'active'
                            ? 'text-green-400 bg-green-400/10'
                            : t.status === 'completed'
                            ? 'text-purple-400 bg-purple-400/10'
                            : 'text-cyan-400 bg-cyan-400/10'
                          }`}
                      >
                        {t.status.toUpperCase()}
                      </span>

                      {/* Practice tag (next to status) */}
                      {t.is_practice && (
                        <span className="px-2 py-0.5 text-xs font-semibold text-yellow-400 bg-yellow-400/10 rounded-none">
                          PRACTICE
                        </span>
                      )}

                      {/* Actions */}
                      <button
                        onClick={() => startEdit(t)}
                        className="p-1.5 text-cyan-400 hover:text-white hover:bg-cyan-500/20 transition"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => deleteTournament(t.id)}
                        className="p-1.5 text-red-400 hover:text-white hover:bg-red-500/20 transition"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <div className="flex items-center">
                      <Calendar size={14} className="mr-2 text-cyan-400" />
                      {new Date(t.tournament_date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center">
                      <MapPin size={14} className="mr-2 text-cyan-400" />
                      {t.location}
                    </div>
                    <div className="flex items-center">
                      <Users size={14} className="mr-2 text-cyan-400" />
                      {t.max_participants === 999999
                        ? `${t.current_participants} players`
                        : `${t.current_participants}/${t.max_participants} players`}
                    </div>
                    {t.tournament_code && (
                      <div className="flex items-center">
                        <span className="text-slate-400 mr-2">Code:</span>
                        <span className="font-mono font-semibold text-cyan-300">"{t.tournament_code}"</span>
                      </div>
                    )}
                    {t.password && (
                      <div className="text-xs text-orange-300">🔒 Password protected</div>
                    )}
                    <div className="text-xs">
                      <span className={`${t.registration_open ? 'text-green-300' : 'text-red-300'}`}>
                        {t.registration_open ? '✅ Registration Open' : '❌ Registration Closed'}
                      </span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-slate-800">
                    {/* Status select */}
                    <label className="text-xs text-slate-400">Status:</label>
                    <select
                      value={t.status}
                      onChange={(e) => updateTournamentStatus(t.id, e.target.value as Tournament['status'])}
                      className="text-xs bg-slate-950/60 border border-slate-700 px-2 py-1 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                    </select>

                    {/* Registration toggle */}
                    <button
                      onClick={() => onOpenDashboard?.(t.id)}
                      className="p-1.5 text-green-400 hover:text-white hover:bg-green-500/20 transition"
                      title="Open Dashboard"
                    >
                      <Monitor size={16} />
                    </button>
                    {t.status === 'completed' && (
                      <button
                        onClick={() => openAwardModal(t.id)}
                        className="p-1.5 text-yellow-400 hover:text-white hover:bg-yellow-500/20 transition"
                        title="Create Award"
                      >
                        <Award size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => toggleRegistration(t.id, t.registration_open)}
                      className={`text-xs px-3 py-1 border transition
                        ${t.registration_open
                          ? 'border-red-500/40 text-red-300 hover:bg-red-500/10'
                          : 'border-green-500/40 text-green-300 hover:bg-green-500/10'}`}
                    >
                      {t.registration_open ? 'Close Registration' : 'Open Registration'}
                    </button>
                  </div>

                  <div className="text-xs text-slate-500 pt-3 border-t border-slate-800 mt-3">
                    Created: {new Date(t.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

{/* Registrations view */}
{currentView === 'registrations' && (
  <>
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <label className="block text-sm text-slate-300 mb-1">Select Tournament</label>
        <select
          value={selectedTournament}
          onChange={(e) => {
            setSelectedTournament(e.target.value);
            setCurrentPage(1); // reset pagination
          }}
          className="bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 max-w-md w-full"
        >
          <option value="">-- Select Tournament --</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Search Box */}
      {selectedTournament && (
        <input
          type="text"
          placeholder="Search players or Beyblades..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1); // reset to first page
          }}
          className="bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 w-full sm:w-64"
        />
      )}

      {/* Export Players button */}
      {registrations.length > 0 && (
        <button
          onClick={() => {
            const names = filteredRegistrations.map(r => r.player_name).join('\n');
            navigator.clipboard.writeText(names);
            alert('Copied', 'All player names copied to clipboard for Challonge!');
          }}
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-medium hover:from-cyan-400 hover:to-purple-500 transition shadow-[0_0_12px_rgba(0,200,255,0.25)]"
        >
          Copy Player List
        </button>
      )}
    </div>

    {selectedTournament && (
      <>
        {filteredRegistrations.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Users size={48} className="mx-auto text-slate-600 mb-4" />
            No registrations found for this tournament
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900/70 text-slate-300 text-left">
                  {['Player', 'Date', 'Payment', 'Status', 'Beyblades', 'Actions'].map((header, idx) => (
                    <th
                      key={idx}
                      onClick={() => handleSort(header.toLowerCase())}
                      className="px-3 py-2 border-b border-slate-700 cursor-pointer select-none"
                    >
                      {header}
                      {sortColumn === header.toLowerCase() && (
                        <span className="ml-1">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRegistrations.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-800 hover:bg-slate-800/30 transition"
                  >
                    {/* Player Name */}
                    <td className="px-3 py-2 font-medium text-white">{r.player_name}</td>

                    {/* Registered Date */}
                    <td className="px-3 py-2 text-slate-400">
                      {new Date(r.registered_at).toLocaleDateString()}
                    </td>

                    {/* Payment */}
                    <td className="px-3 py-2 text-slate-400">
                      {r.payment_mode?.replace('_', ' ') || 'N/A'}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 text-[11px] rounded-none
                          ${r.status === 'confirmed'
                            ? 'text-green-300 bg-green-300/10'
                            : r.status === 'cancelled'
                            ? 'text-red-300 bg-red-300/10'
                            : 'text-yellow-300 bg-yellow-300/10'}`}
                      >
                        {r.status}
                      </span>
                    </td>

                    {/* Beyblades */}
                    <td className="px-3 py-2">
                      {r.beyblades.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.beyblades
                            .sort((a, b) => (a.beyblade_order || 0) - (b.beyblade_order || 0))
                            .map((b, i) => (
                            <span
                              key={b.beyblade_id}
                              className="inline-block border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-200 flex items-center space-x-1"
                            >
                              <span className="text-cyan-400 font-bold">{b.beyblade_order || i + 1}.</span>
                              <span>{b.beyblade_name}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">No Beyblades</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2">
                      <div className="flex items-center space-x-2">
                        {r.status === 'pending' && (
                          <button
                            onClick={() => confirmPayment(r.id)}
                            className="px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-medium hover:from-green-400 hover:to-emerald-500 transition-all duration-200 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                          >
                            Confirm Payment
                          </button>
                        )}
                      <button
                        onClick={() => deleteRegistration(r.id)}
                        className="p-1.5 text-red-400 hover:text-white hover:bg-red-500/20 transition rounded-none"
                        title="Delete Registration"
                      >
                        <Trash2 size={14} />
                      </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex justify-end items-center gap-2 mt-3">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-3 py-1 bg-slate-800 text-slate-300 text-xs disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-slate-400 text-xs">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-3 py-1 bg-slate-800 text-slate-300 text-xs disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </>
    )}
  </>
)}


      </div>

      {/* Tournament Wizard */}
      {showWizard && (
        <TournamentWizard
          onClose={() => setShowWizard(false)}
          onSuccess={fetchTournaments}
        />
      )}

      {/* Award Modal */}
      {showAwardModal && selectedTournamentForAward && (
        <AwardModal
          tournamentId={selectedTournamentForAward}
          onClose={closeAwardModal}
          onSuccess={() => {
            closeAwardModal();
            // Could refresh awards if needed
          }}
        />
      )}
    </div>
  );
}