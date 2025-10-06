import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, CheckCircle, X, Clock, User, Trophy, Calendar, RotateCcw,
  ChevronDown, ChevronUp, Search, Undo
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';

interface ClaimRequest {
  id: string;
  requesting_user_id: string;
  requesting_username: string;
  target_player_name: string;
  tournament_id: string;
  tournament_name?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'revoked';
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  revoked_at?: string;
  revoked_by?: string;
  original_player_name?: string;
}

interface ClaimHistory {
  id: string;
  claim_request_id: string;
  action_type: string;
  performed_by: string;
  performed_at: string;
  affected_records: any;
  previous_state: any;
  can_undo: boolean;
}

export function ClaimRequests() {
  const { user } = useAuth();
  const { confirm, alert } = useConfirmation();

  // Existing states
  const [claimRequests, setClaimRequests] = useState<ClaimRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'completed' | 'rejected' | 'revoked'>('all');

  // Admin merge states (typable dropdown + merge)
  const [mergeOpen, setMergeOpen] = useState(false);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [merging, setMerging] = useState(false);

  // Typable dropdown states (target account)
  const [searchUser, setSearchUser] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const dropdownRef = useRef<HTMLUListElement | null>(null);

  // Proxy account UI
  const [creatingProxy, setCreatingProxy] = useState(false);
  const [proxyNameInput, setProxyNameInput] = useState('');
  const [proxyCreatedInfo, setProxyCreatedInfo] = useState<any | null>(null);

  // Undo history states
  const [claimHistories, setClaimHistories] = useState<Record<string, ClaimHistory[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});

  const isAdmin = user?.role === 'admin' || user?.role === 'developer';

  // -------------------------
  // EFFECTS
  // -------------------------
  useEffect(() => {
    if (isAdmin) {
      fetchAllClaimRequests();
      fetchTournaments();
    } else {
      // if not admin, still fetch? original code loaded only for admin; keep admin-only
      setLoading(false);
    }
  }, [isAdmin]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // -------------------------
  // FETCH helpers
  // -------------------------
  const fetchAllClaimRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('stat_claim_requests')
        .select('*, tournaments(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((r: any) => ({
        ...r,
        tournament_name: r.tournaments?.name || 'Unknown Tournament'
      }));
      setClaimRequests(formatted);
    } catch (err) {
      console.error('Error fetching claim requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClaimHistory = async (requestId: string) => {
    if (claimHistories[requestId]) return;

    setLoadingHistory(prev => ({ ...prev, [requestId]: true }));
    try {
      const { data, error } = await supabase
        .from('claim_history')
        .select('*')
        .eq('claim_request_id', requestId)
        .order('performed_at', { ascending: false });

      if (error) throw error;

      setClaimHistories(prev => ({
        ...prev,
        [requestId]: data || []
      }));
    } catch (err) {
      console.error('Error fetching claim history:', err);
    } finally {
      setLoadingHistory(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, tournament_date')
        .order('tournament_date', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
    }
  };

  const fetchPlayersForTournament = async (tournamentId: string) => {
    setSelectedPlayer('');
    setAvailablePlayers([]);
    if (!tournamentId) return;

    try {
      const { data, error } = await supabase
        .from('match_results')
        .select('player1_name, player2_name')
        .eq('tournament_id', tournamentId);

      if (error) throw error;

      const setPlayers = new Set<string>();
      (data || []).forEach((m: any) => {
        if (m.player1_name) setPlayers.add(m.player1_name);
        if (m.player2_name) setPlayers.add(m.player2_name);
      });

      setAvailablePlayers(Array.from(setPlayers).sort());
    } catch (err) {
      console.error('Error fetching players for tournament:', err);
    }
  };

  // -------------------------
  // Typable dropdown search
  // -------------------------
  // search logic: startsWith -> contains; sort so startsWith come first
  const handleUserSearch = async (query: string) => {
    setSearchUser(query);
    setSelectedUser(null);
    setProxyCreatedInfo(null);

    if (!query.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    // only run when >= 1 or 2 chars? We'll run for 1 char but can be tuned
    setLoadingUsers(true);
    try {
      // startsWith (case-insensitive)
      const startsQ = `%${query}%`; // ilike doesn't support anchored ^, so use ilike + positional comparison
      // Supabase/Postgres supports ilike 'query%' pattern. We'll attempt ilike(query + '%')
      const { data: startsWith, error: err1 } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `${query}%`)
        .limit(10);

      if (err1) throw err1;

      let results = startsWith || [];

      if (!results || results.length === 0) {
        // fallback contains
        const { data: contains, error: err2 } = await supabase
          .from('profiles')
          .select('id, username')
          .ilike('username', `%${query}%`)
          .limit(10);

        if (err2) throw err2;
        results = contains || [];
      }

      // Sort by relevance (startsWith first)
      const sorted = (results || []).sort((a: any, b: any) => {
        const aStarts = a.username.toLowerCase().startsWith(query.toLowerCase());
        const bStarts = b.username.toLowerCase().startsWith(query.toLowerCase());
        if (aStarts === bStarts) return a.username.localeCompare(b.username);
        return aStarts ? -1 : 1;
      });

      setSearchResults(sorted);
      setShowDropdown(true);
      setHighlightedIndex(sorted.length > 0 ? 0 : -1);
    } catch (err) {
      console.error('Error searching users:', err);
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
        const u = searchResults[highlightedIndex];
        setSelectedUser(u);
        setSearchUser(u.username);
        setSearchResults([]);
        setShowDropdown(false);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // -------------------------
  // Proxy account creation
  // -------------------------
  const createProxyAccount = async (displayName: string) => {
    if (!displayName || !displayName.trim()) {
      await alert('Invalid Name', 'Please provide a valid display name for the proxy account.');
      return;
    }

    const confirmed = await confirm(
      'Create Proxy Account',
      `Create a proxy profile for "${displayName}"? This will create a temporary profile you can merge stats into.`
    );

    if (!confirmed) return;

    setCreatingProxy(true);
    try {
      // generate uuid for id
      const id = (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
        ? (crypto as any).randomUUID()
        : `proxy-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      // Attempt to insert into profiles. Fields used: id, username, display_name, is_proxy, proxy_original_name, created_at
      const insertPayload: any = {
        id,
        username: `proxy_${id.slice(0, 8)}`,
        display_name: displayName,
        is_proxy: true,
        proxy_original_name: displayName,
        created_at: new Date().toISOString(),
        created_by_admin: user?.id || null
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('profiles')
        .insert(insertPayload)
        .select()
        .single();

      if (insertErr) throw insertErr;

      setProxyCreatedInfo(inserted);
      // auto-select the created proxy as target
      setSelectedUser({ id: inserted.id, username: inserted.username });
      setSearchUser(inserted.username);
      setSearchResults([]);
      setShowDropdown(false);

      await alert('Proxy Created', `Proxy account "${inserted.username}" created and selected.`);
    } catch (err) {
      console.error('Error creating proxy account:', err);
      await alert('Error', `Failed to create proxy account: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setCreatingProxy(false);
      setProxyNameInput('');
    }
  };

  // -------------------------
  // Manual merge handler
  // -------------------------
  const handleManualMerge = async () => {
    if (!selectedUser || !selectedTournament || !selectedPlayer) {
      await alert('Missing Information', 'Please select an account, a tournament, and a player name to merge.');
      return;
    }

    const confirmed = await confirm(
      'Manually Merge Stats',
      `Merge stats from "${selectedPlayer}" in "${tournaments.find(t => t.id === selectedTournament)?.name}" into "${selectedUser.username}"? This creates a claim record so it can be revoked later.`
    );

    if (!confirmed) return;

    setMerging(true);
    try {
      // 1) Create stat_claim_requests record as approved with reviewed_by (admin)
      const { data: inserted, error: insertError } = await supabase
        .from('stat_claim_requests')
        .insert({
          requesting_user_id: selectedUser.id,
          requesting_username: selectedUser.username,
          target_player_name: selectedPlayer,
          tournament_id: selectedTournament,
          status: 'approved',
          reviewed_by: user?.username,
          reviewed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!inserted || !inserted.id) throw new Error('Failed to insert claim request record');

      // 2) Call RPC to transfer stats
      const { data: claimResult, error: rpcError } = await supabase.rpc('claim_player_stats', {
        p_request_id: inserted.id,
        p_new_player_name: selectedUser.username
      });

      if (rpcError) throw rpcError;
      if (!claimResult?.success) throw new Error(claimResult?.error || 'RPC returned failure');

      // 3) Mark request completed
      await supabase
        .from('stat_claim_requests')
        .update({ status: 'completed' })
        .eq('id', inserted.id);

      await alert('Success', `Merged ${claimResult.affected_matches} matches into ${selectedUser.username}.`);
      // clear UI
      setSelectedUser(null);
      setSearchUser('');
      setSearchResults([]);
      setSelectedTournament('');
      setSelectedPlayer('');
      setAvailablePlayers([]);
      setProxyCreatedInfo(null);
      await fetchAllClaimRequests();
    } catch (err) {
      console.error('Manual merge error:', err);
      await alert('Error', `Failed to merge stats: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setMerging(false);
    }
  };

  // -------------------------
  // Revoke claim (admin only)
  // -------------------------
  const handleRevokeClaim = async (request: ClaimRequest) => {
    const confirmed = await confirm(
      'Revoke Claim',
      `Are you sure you want to revoke this claim for "${request.target_player_name}" merged into "${request.requesting_username}"? This will restore the original player name "${request.original_player_name || request.target_player_name}".`
    );

    if (!confirmed) return;

    try {
      const { data: revokeResult, error: revokeError } = await supabase.rpc('revoke_claimed_stats', {
        p_request_id: request.id
      });

      if (revokeError) throw revokeError;
      if (!revokeResult?.success)
        throw new Error(revokeResult?.error || 'RPC returned failure');

      const { error: updateError } = await supabase
        .from('stat_claim_requests')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_by: user?.username
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      await alert('Claim Revoked', `Successfully revoked! Restored ${revokeResult.affected_matches} matches to "${revokeResult.restored_name}".`);
      setClaimHistories(prev => {
        const newHistories = { ...prev };
        delete newHistories[request.id];
        return newHistories;
      });
      await fetchAllClaimRequests();
    } catch (err) {
      console.error('Error revoking claim:', err);
      await alert('Error', `Failed to revoke claim: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    }
  };

  // -------------------------
  // Undo any claim action
  // -------------------------
  const handleUndoAction = async (historyId: string, actionType: string, requestId: string) => {
    const actionName = actionType === 'claim' ? 'merge' : actionType;
    const confirmed = await confirm(
      'Undo Action',
      `Are you sure you want to undo this ${actionName}? This will restore the previous state.`
    );

    if (!confirmed) return;

    try {
      const { data: undoResult, error: undoError } = await supabase.rpc('undo_claim_action', {
        p_history_id: historyId
      });

      if (undoError) throw undoError;
      if (!undoResult?.success)
        throw new Error(undoResult?.error || 'Failed to undo action');

      await alert('Action Undone', `Successfully undid ${actionName}. Affected ${undoResult.affected_matches} matches.`);

      setClaimHistories(prev => {
        const newHistories = { ...prev };
        delete newHistories[requestId];
        return newHistories;
      });
      await fetchAllClaimRequests();
    } catch (err) {
      console.error('Error undoing action:', err);
      await alert('Error', `Failed to undo action: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    }
  };

  // ---------- inside your component return (place just below the header/title) ----------
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold flex items-center mb-4">
            <Shield size={40} className="mr-4 text-cyan-400" />
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Claim Requests Management
            </span>
          </h1>
          <p className="text-slate-400 text-lg">Manage player stat claim requests and transfers</p>
        </div>

        {/* ADMIN MANUAL MERGE TOOL (collapsed by default) */}
        {isAdmin && (
          <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none mb-6 transition-all duration-300 hover:border-cyan-400/70 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 w-0 transition-all duration-500 group-hover:w-full" />

            <div
              onClick={() => setMergeOpen(!mergeOpen)}
              className="flex justify-between items-center cursor-pointer"
            >
              <h2 className="text-xl font-bold text-white flex items-center">
                <User size={22} className="mr-2 text-cyan-400" />
                Admin: Manual Merge / Claim Stats
              </h2>
              {mergeOpen ? (
                <ChevronUp className="text-cyan-400" />
              ) : (
                <ChevronDown className="text-cyan-400" />
              )}
            </div>

            {mergeOpen && (
              <div className="mt-6 space-y-4 animate-fadeIn">
                {/* Typable Dropdown: Target Account */}
                <div>
                  <label className="block text-sm font-medium text-cyan-400 mb-2">Target Account</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchUser}
                      onChange={(e) => handleUserSearch(e.target.value)}
                      onFocus={() => { if (searchResults.length) setShowDropdown(true); }}
                      onKeyDown={handleKeyDown}
                      placeholder="Type to search username..."
                      className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <Search size={18} className="absolute right-3 top-2.5 text-slate-500" />
                    {loadingUsers && (
                      <div className="absolute right-10 top-2.5">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Dropdown */}
                  {showDropdown && searchResults.length > 0 && (
                    <ul
                      ref={dropdownRef}
                      className="mt-1 w-full max-h-56 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-lg"
                    >
                      {searchResults.map((u, i) => (
                        <li
                          key={u.id}
                          onMouseEnter={() => setHighlightedIndex(i)}
                          onClick={() => {
                            setSelectedUser(u);
                            setSearchUser(u.username);
                            setSearchResults([]);
                            setShowDropdown(false);
                          }}
                          className={`px-3 py-2 cursor-pointer text-sm transition-colors ${
                            highlightedIndex === i ? 'bg-cyan-600 text-white' : 'hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          {u.username}
                        </li>
                      ))}
                    </ul>
                  )}

                  {selectedUser && (
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-sm text-green-400">Selected: <span className="font-semibold">{selectedUser.username}</span></p>
                      <button
                        onClick={() => { setSelectedUser(null); setSearchUser(''); setProxyCreatedInfo(null); }}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Tournament select */}
                <div>
                  <label className="block text-sm font-medium text-cyan-400 mb-2">Tournament</label>
                  <select
                    value={selectedTournament}
                    onChange={(e) => {
                      setSelectedTournament(e.target.value);
                      fetchPlayersForTournament(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">-- Select Tournament --</option>
                    {tournaments.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} - {new Date(t.tournament_date).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Player name select */}
                <div>
                  <label className="block text-sm font-medium text-cyan-400 mb-2">Player Name (from match records)</label>
                  <select
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    disabled={!selectedTournament}
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                  >
                    <option value="">-- Select Player --</option>
                    {availablePlayers.map(p => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Proxy creation */}
                <div className="border-t border-slate-700 pt-4">
                  <h4 className="text-sm font-semibold text-white mb-2">No profile for this player?</h4>
                  <p className="text-xs text-slate-400 mb-2">Create a temporary proxy account to hold stats until the player creates their own account.</p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={proxyNameInput}
                      onChange={(e) => setProxyNameInput(e.target.value)}
                      placeholder="Proxy display name (e.g. 'TOINKS - Pasay Tourney')"
                      className="flex-1 bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <button
                      onClick={() => createProxyAccount(proxyNameInput.trim())}
                      disabled={!proxyNameInput.trim() || creatingProxy}
                      className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                    >
                      {creatingProxy ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Proxy'}
                    </button>
                  </div>

                  {proxyCreatedInfo && (
                    <div className="mt-2 text-sm">
                      Proxy <span className="font-semibold text-green-400">{proxyCreatedInfo.username}</span> created and selected.
                    </div>
                  )}
                </div>

                {/* Merge button */}
                <div className="pt-3">
                  <button
                    onClick={handleManualMerge}
                    disabled={!selectedUser || !selectedTournament || !selectedPlayer || merging}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-400 hover:to-emerald-500 disabled:opacity-50 transition-all duration-200 flex items-center space-x-2"
                  >
                    {merging ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={16} />}
                    <span>{merging ? 'Merging...' : 'Merge Stats'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* ---------------- CLAIM REQUESTS SUMMARY & LIST ---------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6 mb-8">
          {[
            { label: 'Total Requests', value: claimRequests.length, color: 'from-cyan-500 to-blue-500' },
            { label: 'Pending', value: claimRequests.filter(r => r.status === 'pending').length, color: 'from-yellow-500 to-orange-500' },
            { label: 'Completed', value: claimRequests.filter(r => r.status === 'completed').length, color: 'from-green-500 to-emerald-500' },
            { label: 'Rejected', value: claimRequests.filter(r => r.status === 'rejected').length, color: 'from-red-500 to-pink-500' },
            { label: 'Revoked', value: claimRequests.filter(r => r.status === 'revoked').length, color: 'from-gray-500 to-slate-500' }
          ].map((stat) => (
            <div key={stat.label} className="group relative border border-slate-700 bg-slate-900/40 p-4 sm:p-6 rounded-none transition-all duration-300 hover:border-cyan-400/70 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 w-0 transition-all duration-500 group-hover:w-full" />
              <div className="text-center">
                <div className={`text-2xl sm:text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mb-2`}>
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm font-medium text-slate-400">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Claim Requests List */}
        {loading ? (
          <div className="min-h-[200px] flex items-center justify-center text-slate-400">
            <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p>Loading claim requests...</p>
          </div>
        ) : claimRequests.length === 0 ? (
          <div className="group relative border border-slate-700 bg-slate-900/40 p-12 rounded-none transition-all duration-300 hover:border-cyan-400/70 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] text-center">
            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Claim Requests</h3>
            <p className="text-slate-400">
              {filter === 'all' ? 'No claim requests found' : `No ${filter} claim requests found`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex space-x-4 sm:space-x-8 border-b border-slate-700 mb-4 overflow-x-auto pb-2">
              {['all', 'pending', 'approved', 'completed', 'rejected', 'revoked'].map((tab) => (
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

            {claimRequests
              .filter(req => (filter === 'all' ? true : req.status === filter))
              .map(request => (
                <div key={request.id} className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none transition-all duration-300 hover:border-cyan-400/70 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {request.requesting_username?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-white break-words">
                            {request.requesting_username} → {request.target_player_name}
                          </h3>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-slate-400 gap-1 sm:gap-0">
                            <div className="flex items-center space-x-1">
                              <Trophy size={14} className="text-cyan-400" />
                              <span className="truncate">{request.tournament_name}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar size={14} className="text-cyan-400" />
                              <span>{new Date(request.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {request.reviewed_at && (
                          <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-3 min-w-0">
                            <div className="flex items-center space-x-2 text-slate-300">
                              <User size={14} className="text-cyan-400" />
                              <span className="truncate">Reviewed by: {request.reviewed_by}</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {new Date(request.reviewed_at).toLocaleString()}
                            </div>
                          </div>
                        )}

                        {request.revoked_at && (
                          <div className="bg-slate-800/50 border border-red-500/20 rounded-lg p-3 min-w-0">
                            <div className="flex items-center space-x-2 text-slate-300">
                              <RotateCcw size={14} className="text-red-400" />
                              <span className="truncate">Revoked by: {request.revoked_by}</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {new Date(request.revoked_at).toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                      <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border ${
                        request.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                        request.status === 'approved' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                        request.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                        request.status === 'rejected' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                        'bg-slate-500/20 text-slate-400 border-slate-500/30'
                      }`}>
                        <span className="text-sm font-medium uppercase">{request.status}</span>
                      </div>
                      {isAdmin && (request.status === 'completed' || request.status === 'revoked') && (
                        <div className="flex items-center space-x-2">
                          {request.status === 'completed' && (
                            <button
                              onClick={() => handleRevokeClaim(request)}
                              className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-red-600 to-pink-600 rounded-lg text-white text-sm hover:from-red-500 hover:to-pink-500 transition-all"
                              title="Revoke this claim and restore original name"
                            >
                              <RotateCcw size={14} />
                              <span>Revoke</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (!claimHistories[request.id]) {
                                fetchClaimHistory(request.id);
                              }
                            }}
                            className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white text-sm hover:from-purple-500 hover:to-blue-500 transition-all"
                            title="View undo history"
                          >
                            <Undo size={14} />
                            <span>Undo History</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {claimHistories[request.id] && (
                    <div className="mt-4 border-t border-slate-700 pt-4">
                      <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center">
                        <Undo size={16} className="mr-2" />
                        Action History
                      </h4>
                      {loadingHistory[request.id] ? (
                        <div className="text-sm text-slate-400">Loading history...</div>
                      ) : claimHistories[request.id].length === 0 ? (
                        <div className="text-sm text-slate-400">No history records found</div>
                      ) : (
                        <div className="space-y-2">
                          {claimHistories[request.id].map((history) => (
                            <div
                              key={history.id}
                              className="flex items-center justify-between bg-slate-800/30 border border-slate-700 rounded-lg p-3"
                            >
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                                    history.action_type === 'claim' ? 'bg-green-500/20 text-green-400' :
                                    history.action_type === 'revoke' ? 'bg-red-500/20 text-red-400' :
                                    history.action_type.startsWith('undo_') ? 'bg-purple-500/20 text-purple-400' :
                                    'bg-slate-500/20 text-slate-400'
                                  }`}>
                                    {history.action_type.toUpperCase()}
                                  </span>
                                  <span className="text-sm text-slate-300">
                                    {new Date(history.performed_at).toLocaleString()}
                                  </span>
                                </div>
                                {history.previous_state && (
                                  <div className="text-xs text-slate-400 mt-1">
                                    {history.action_type === 'claim' && (
                                      <span>
                                        Merged: {history.previous_state.original_player_name} → {history.previous_state.new_player_name}
                                      </span>
                                    )}
                                    {history.action_type === 'revoke' && (
                                      <span>
                                        Restored: {history.previous_state.requesting_username} → {history.previous_state.original_player_name}
                                      </span>
                                    )}
                                    {history.action_type.startsWith('undo_') && (
                                      <span>Undid previous {history.action_type.replace('undo_', '')} action</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              {history.can_undo && (
                                <button
                                  onClick={() => handleUndoAction(history.id, history.action_type, request.id)}
                                  className="flex items-center space-x-1 px-3 py-1 bg-gradient-to-r from-orange-600 to-yellow-600 rounded text-white text-xs hover:from-orange-500 hover:to-yellow-500 transition-all"
                                  title="Undo this action"
                                >
                                  <Undo size={12} />
                                  <span>Undo</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
} // <-- component end
