// Tournaments.tsx
import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Search, Trophy, Plus, Settings, CreditCard as Edit3, Trash2, ClipboardList, Award, Lock, Unlock, Share2, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { TournamentRegistration } from './TournamentRegistration';
import { TournamentDetails } from './TournamentDetails';
import { TournamentWizardLite } from './TournamentWizardLite';
import { AwardModal } from './AwardModal';
import { TournamentRegistrationsPage } from './TournamentRegistrationsPage';
import { TournamentLogs } from './TournamentLogs';
import { RefreshCcw } from 'lucide-react';


interface Tournament {
  id: string;
  name: string;
  description?: string;
  tournament_date: string;
  location: string;
  max_participants: number;
  current_participants?: number;
  status: 'upcoming' | 'active' | 'completed';
  registration_deadline: string;
  prize_pool?: string;
  beyblades_per_player: number;
  players_per_team: number;
  entry_fee: number;
  is_free: boolean;
  tournament_type: 'ranked' | 'casual' | 'practice'; // 👈 also add "practice" if you use it
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
  hosted_by_type: 'individual' | 'community';
  hosted_by_user_id?: string;
  hosted_by_community_id?: string;
  decks_per_player: number; // 👈 add this
}
export function Tournaments() {
  const { user } = useAuth();
  const { alert, confirm } = useConfirmation();

  const [filter, setFilter] = useState<'all' | 'upcoming' | 'active' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPractice, setShowPractice] = useState(false);
  const [viewingTournament, setViewingTournament] = useState<string | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  const [managing, setManaging] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentCounts, setTournamentCounts] = useState<{ [key: string]: number }>({});
  const [hostingInfo, setHostingInfo] = useState<{ [key: string]: { type: string; name: string } }>({});
  const [loading, setLoading] = useState(true);

  const [viewingRegistrations, setViewingRegistrations] = useState<string | null>(null);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [selectedTournamentForAward, setSelectedTournamentForAward] = useState<string | null>(null);

  const [logsTournamentId, setLogsTournamentId] = useState<string | null>(null);

  const [manageTab, setManageTab] = useState<'my' | 'all'>('my');

  const [unlockedTournaments, setUnlockedTournaments] = useState<{ [id: string]: number }>({});
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('unlockedTournaments');
    if (stored) setUnlockedTournaments(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem('unlockedTournaments', JSON.stringify(unlockedTournaments));
  }, [unlockedTournaments]);

  const isUnlocked = (t: Tournament): boolean => {
    // ✅ if you are the host, always unlocked
    if (t.hosted_by_user_id === user?.id) return true;
  
    // otherwise use password unlock logic
    const ts = unlockedTournaments[t.id];
    if (!ts) return false;
    return Date.now() - ts < ONE_DAY_MS;
  };

  const handleAccess = (t: Tournament) => {
    const pass = prompt('Enter tournament password');
    if (pass === t.password) {
      setUnlockedTournaments(prev => ({ ...prev, [t.id]: Date.now() }));
      alert('Access granted', `You can now manage "${t.name}" for 24 hours.`);
    } else {
      alert('Wrong password', 'Access denied.');
    }
  };

  const copyShareableLink = async (tournamentId: string, tournamentName: string) => {
    const shareableUrl = `${window.location.origin}/tournament/${tournamentId}`;
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopiedLinkId(tournamentId);
      await alert('Link Copied!', `Shareable link for "${tournamentName}" has been copied to clipboard. Share this link to allow players to register directly!`);
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      await alert('Copy Failed', 'Failed to copy link to clipboard. Please try again.');
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

      // Delete awards
      await supabase
        .from('tournament_awards')
        .delete()
        .eq('tournament_id', id);


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
  
  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          host_user:hosted_by_user_id(username),
          host_community:hosted_by_community_id(name)
        `)
        .order('tournament_date', { ascending: false });
      if (error) throw error;
      setTournaments((data as any) || []);

      const hostingData: { [key: string]: { type: string; name: string } } = {};
      (data || []).forEach((t: any) => {
        if (t.hosted_by_type === 'community' && t.host_community?.name) {
          hostingData[t.id] = { type: 'community', name: t.host_community.name };
        } else if (t.hosted_by_type === 'individual' && t.host_user?.username) {
          hostingData[t.id] = { type: 'individual', name: t.host_user.username };
        } else {
          hostingData[t.id] = { type: 'unknown', name: 'Unknown' };
        }
      });
      setHostingInfo(hostingData);

      const counts: { [key: string]: number } = {};
      for (const t of (data || [])) {
        const { count } = await supabase
          .from('tournament_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', t.id)
          .eq('status', 'confirmed');
        counts[t.id] = count || 0;
      }
      setTournamentCounts(counts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTournaments(); }, [user]);

  const filteredTournaments = tournaments.filter(t => {
    const statusMatch = filter === 'all' || t.status === filter;
    const practiceMatch = showPractice || t.tournament_type !== 'practice';
    const searchMatch =
      t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.location?.toLowerCase().includes(searchTerm.toLowerCase());
    return statusMatch && practiceMatch && searchMatch;
  });

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
  
  // --- FULL PAGE HANDLERS ---
  if (logsTournamentId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <TournamentLogs tournamentId={logsTournamentId} onBack={() => setLogsTournamentId(null)} />
      </div>
    );
  }

  // Tournament Details: full-page (header hidden)
  if (viewingTournament) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <TournamentDetails
          tournamentId={viewingTournament}
          onBack={() => setViewingTournament(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-8">
{/* Header */}
<div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div>
    <h1 className="text-3xl sm:text-4xl font-bold flex items-center mb-2">
      <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
        Tournament Arena
      </span>
    </h1>
    <p className="text-slate-400 text-base sm:text-lg">Join and manage tournaments</p>
  </div>
  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
    <button
      onClick={() => { setEditingTournament(null); setShowCreateModal(true); }}
      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-medium hover:from-cyan-400 hover:to-purple-500 transition flex items-center justify-center gap-2"
    >
      <Plus size={18} /> Create
    </button>
    <button
      onClick={fetchTournaments}
      className="w-full sm:w-auto px-4 py-2 bg-slate-800 border border-slate-600 text-slate-300 font-medium hover:bg-slate-700 hover:text-white transition flex items-center justify-center gap-2"
    >
      <RefreshCcw size={18} /> Refresh
    </button>
    {!managing && !viewingRegistrations && !viewingTournament && (
      <button
        onClick={() => setManaging(true)}
        className="w-full sm:w-auto px-4 py-2 bg-slate-800 border border-slate-600 text-slate-300 font-medium hover:bg-slate-700 hover:text-white transition flex items-center justify-center gap-2"
      >
        <Settings size={18} /> Manage
      </button>
    )}
  </div>
</div>

        {/* Normal listing (poster style, sharp edges, underline hover, aligned buttons) */}
        {!managing && !viewingTournament && (
          <>
          {/* Controls */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-700 pb-2 mb-8">
            {/* Tabs scrollable on mobile */}
            <div className="flex items-center space-x-6 overflow-x-auto no-scrollbar">
              {['upcoming', 'active', 'completed', 'all'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab as any)}
                  className={`relative pb-2 text-sm font-medium capitalize transition-colors group whitespace-nowrap ${
                    filter === tab ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-300'
                  }`}
                >
                  {tab}
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500
                    ${filter === tab ? 'w-full' : 'w-0 group-hover:w-full'}`}
                  />
                </button>
              ))}
            </div>
          
            {/* Search + Practice */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6">
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tournaments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 bg-transparent border-b border-slate-700 text-sm focus:outline-none focus:border-cyan-500 transition"
                />
              </div>
              <button
                onClick={() => setShowPractice(!showPractice)}
                className={`px-3 py-2 sm:py-1 border text-sm text-center ${
                  showPractice
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Practice {showPractice ? '✓' : ''}
              </button>
            </div>
          </div>


            {/* Tournament Grid */}
            {loading ? (
              <div className="text-center py-12 text-slate-400">Loading tournaments...</div>
            ) : filteredTournaments.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No tournaments found</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTournaments.map((t) => (
                  <div
                    key={t.id}
                    className="relative border border-slate-700 bg-slate-900/50 rounded-none overflow-hidden shadow-lg flex flex-col group transition hover:shadow-cyan-500/10"
                  >
                    {/* Banner */}
                    <div className="h-32 bg-gradient-to-r from-cyan-600/40 to-purple-600/40 flex items-center justify-center">
                      <Trophy size={48} className="text-cyan-300 opacity-70" />
                    </div>

                    {/* Content */}
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-xl font-bold leading-tight line-clamp-1">{t.name}</h3>
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 rounded-none text-xs font-medium flex justify-center items-center text-center ${
                              t.status === 'active'
                                ? 'bg-green-500/20 text-green-400'
                                : t.status === 'completed'
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-cyan-500/20 text-cyan-400'
                            }`}
                          >
                            {t.status}
                          </span>
                          {t.tournament_type && (
                            <span className={`px-2 py-1 rounded-none text-xs font-medium flex justify-center items-center text-center ${
                              t.tournament_type === 'experimental' ? 'bg-red-500/20 text-red-400' :
                              t.tournament_type === 'practice' ? 'bg-gray-500/20 text-gray-400' :
                              t.tournament_type === 'casual' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {t.tournament_type.toUpperCase()}
                            </span>
                          )}
                          {t.tournament_settings?.match_format === 'teams' && (
                            <span className="px-2 py-1 rounded-none text-xs font-medium bg-purple-500/20 text-purple-400 flex justify-center items-center text-center">
                              TEAMS
                            </span>
                          )}
                        </div>
                      </div>

                      {t.description && (
                        <div 
                          className="text-slate-400 text-sm mb-3 line-clamp-3 prose prose-invert prose-sm max-w-none prose-p:text-slate-400 prose-strong:text-slate-300"
                          dangerouslySetInnerHTML={{ __html: t.description }}
                        />
                      )}

                      <div className="flex items-center text-slate-300 text-sm mb-1">
                        <Calendar size={14} className="mr-2 text-cyan-400" />
                        {new Date(t.tournament_date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center text-slate-300 text-sm mb-3">
                        <MapPin size={14} className="mr-2 text-cyan-400" />
                        {t.location}
                      </div>

{(t.prize_pool || t.entry_fee > 0) && (
  <>
    <div className="text-sm text-slate-400 mb-3">
      {t.prize_pool && <div>🏆 Prize: {t.prize_pool}</div>}
      {t.entry_fee > 0 && <div>💰 Entry Fee: ₱{t.entry_fee}</div>}
    </div>
    {t.tournament_settings?.match_format === 'teams' && (
      <div>👥 Teams: {t.tournament_settings.players_per_team} players per team</div>
    )}
  </>
)}

                      <div className="flex justify-between text-xs text-slate-400 mb-5">
                        <span>
                          👥{' '}
                          {t.max_participants === 999999
                            ? `${tournamentCounts[t.id] || 0} players`
                            : `${tournamentCounts[t.id] || 0} / ${t.max_participants} players`}
                        </span>
                        <span>Host: {hostingInfo[t.id]?.name || 'Unknown'}</span>
                      </div>

                      <div className="mt-auto flex justify-between items-center gap-2">
                        <button
                          onClick={() => setSelectedTournament(t)}
                          className="px-4 py-2 bg-cyan-600/20 text-cyan-300 text-sm font-medium rounded-none hover:bg-cyan-600/30 transition"
                        >
                          Register
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyShareableLink(t.id, t.name)}
                            className="p-2 text-slate-400 hover:text-cyan-400 transition"
                            title="Copy shareable link"
                          >
                            {copiedLinkId === t.id ? <Check size={16} className="text-green-400" /> : <Share2 size={16} />}
                          </button>
                          <button
                            onClick={() => setViewingTournament(t.id)}
                            className="text-sm text-slate-400 hover:text-cyan-400 transition"
                          >
                            Details →
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500 group-hover:w-full"></div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Create / Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="bg-slate-900 w-full max-w-4xl rounded-none shadow-lg relative p-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-3 right-3 text-slate-400 hover:text-white"
              >
                ✕
              </button>
                <TournamentWizardLite
                  onClose={() => setShowCreateModal(false)}
                  onCreated={fetchTournaments}
                  initialData={editingTournament}
                />
            </div>
          </div>
        )}

        {/* Registration modal */}
        {selectedTournament && (
          <TournamentRegistration
            tournament={selectedTournament}
            onClose={() => setSelectedTournament(null)}
            onRegistered={fetchTournaments}
          />
        )}

        {/* Registrations view */}
        {viewingRegistrations && (
          <TournamentRegistrationsPage
            tournamentId={viewingRegistrations}
            onBack={() => setViewingRegistrations(null)}
          />
        )}

        {/* Award modal */}
        {showAwardModal && selectedTournamentForAward && (
          <AwardModal
            tournamentId={selectedTournamentForAward}
            onClose={() => setShowAwardModal(false)}
          />
        )}

        {/* Manage view */}
        {managing && !viewingRegistrations && !viewingTournament && (
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={() => setManaging(false)}
              className="px-4 py-2 bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 transition"
            >
              ← Back
            </button>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-700 mb-4">
              <button
                onClick={() => setManageTab('my')}
                className={`pb-2 text-sm font-medium capitalize transition-colors ${
                  manageTab === 'my'
                    ? 'text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                My Tournaments
              </button>
              <button
                onClick={() => setManageTab('all')}
                className={`pb-2 text-sm font-medium capitalize transition-colors ${
                  manageTab === 'all'
                    ? 'text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                All Tournaments
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-700">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800/50 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Tournament</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Reg</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments
                    .filter((t) => manageTab === 'all' || t.hosted_by_user_id === user?.id)
                    .map((t) => (
                      <tr key={t.id} className="border-t border-slate-700 hover:bg-slate-900/30 transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold">{t.name}</div>
                          <div className="text-slate-400 text-sm">
                            Hosted by: {hostingInfo[t.id]?.name || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {new Date(t.tournament_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={t.status}
                            onChange={(e) =>
                              updateTournamentStatus(
                                t.id,
                                e.target.value as Tournament['status']
                              )
                            }
                            disabled={!isUnlocked(t)}
                            className={`px-3 py-1 text-sm border ${
                              isUnlocked(t)
                                ? 'bg-slate-800 text-slate-100 border-slate-600'
                                : 'bg-slate-800/60 text-slate-500 border-slate-700 cursor-not-allowed'
                            }`}
                          >
                            <option value="upcoming">Upcoming</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              if (!isUnlocked(t)) return;
                              toggleRegistration(t.id, t.registration_open);
                            }}
                            disabled={!isUnlocked(t)}
                            className={`px-3 py-1 text-sm border flex items-center gap-2 ${
                              t.registration_open
                                ? isUnlocked(t)
                                  ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                                  : 'bg-red-500/10 text-red-400/60 border-red-500/20'
                                : isUnlocked(t)
                                ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
                                : 'bg-green-500/10 text-green-400/60 border-green-500/20'
                            }`}
                          >
                            {t.registration_open ? <><Lock size={14}/> Close</> : <><Unlock size={14}/> Open</>}
                          </button>
                        </td>
                      <td className="px-4 py-3">
                        {isUnlocked(t) ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setViewingRegistrations(t.id)}
                              className="px-3 py-1 text-xs border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 flex items-center gap-1"
                            >
                              <Users size={12} /> Registrations
                            </button>
                            <button
                              onClick={() => setLogsTournamentId(t.id)}
                              className="px-3 py-1 text-xs border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 flex items-center gap-1"
                            >
                              <ClipboardList size={12} /> Logs
                            </button>
                            <button
                              onClick={() => setShowAwardModal(true) || setSelectedTournamentForAward(t.id)}
                              className="px-3 py-1 text-xs border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 flex items-center gap-1"
                            >
                              <Award size={12} /> Award
                            </button>
                            <button
                              onClick={() => { setEditingTournament(t); setShowCreateModal(true); }}
                              className="px-3 py-1 text-xs border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 flex items-center gap-1"
                            >
                              <Edit3 size={12} /> Edit
                            </button>
                            <button
                              onClick={() => deleteTournament(t.id)}
                              className="px-3 py-1 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/20 flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        ) : t.hosted_by_user_id !== user?.id ? (
                          <button
                            onClick={() => handleAccess(t)}
                            className="px-3 py-1 text-sm bg-slate-700 text-slate-300 hover:bg-slate-600"
                          >
                            Access
                          </button>
                        ) : null}
                      </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}