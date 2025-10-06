import React, { useState, useEffect } from 'react';
import { User, Save, Clock, Shield, CheckCircle, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { supabase } from '../../lib/supabase';

export function Settings() {
  const { user, setUser } = useAuth();
  const { confirm, alert } = useConfirmation();
  const [newUsername, setNewUsername] = useState('');
  const [lastUsernameChange, setLastUsernameChange] = useState<string | null>(null);
  const [canChangeUsername, setCanChangeUsername] = useState(true);
  const [loading, setLoading] = useState(false);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [claimRequests, setClaimRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user && !user.id.startsWith('guest-')) {
      fetchUserSettings();
      fetchTournaments();
      fetchClaimRequests();
      if (user.is_admin) {
        setIsAdmin(true);
        fetchPendingRequests();
      }
    }
  }, [user]);

  useEffect(() => {
    if (selectedTournament) {
      fetchPlayersForTournament();
    }
  }, [selectedTournament]);

  const fetchUserSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('last_username_change')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      setLastUsernameChange(data?.last_username_change);
      
      // Check if user can change username (once per week)
      if (data?.last_username_change) {
        const lastChange = new Date(data.last_username_change);
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        setCanChangeUsername(lastChange < oneWeekAgo);
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
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
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    }
  };

  const fetchPlayersForTournament = async () => {
    try {
      const { data, error } = await supabase
        .from('match_results')
        .select('player1_name, player2_name')
        .eq('tournament_id', selectedTournament);

      if (error) throw error;

      const playerSet = new Set<string>();
      data?.forEach(match => {
        if (match.player1_name) playerSet.add(match.player1_name);
        if (match.player2_name) playerSet.add(match.player2_name);
      });

      setAvailablePlayers(Array.from(playerSet).sort());
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  const fetchClaimRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('stat_claim_requests')
        .select(`
          *,
          tournaments(name)
        `)
        .eq('requesting_user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClaimRequests(data || []);
    } catch (error) {
      console.error('Error fetching claim requests:', error);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('stat_claim_requests')
        .select(`
          *,
          tournaments(name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingRequests(data || []);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  };

  const handleUsernameChange = async () => {
    if (!newUsername.trim()) {
      await alert('Invalid Username', 'Please enter a valid username.');
      return;
    }

    if (newUsername.trim() === user?.username) {
      await alert('Same Username', 'Please enter a different username.');
      return;
    }

    if (!canChangeUsername) {
      await alert('Username Change Limit', 'You can only change your username once per week.');
      return;
    }

    const confirmed = await confirm(
      'Change Username',
      `Are you sure you want to change your username to "${newUsername.trim()}"? You can only do this once per week.`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      // Check if username is already taken
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', newUsername.trim())
        .single();

      if (existingUser) {
        await alert('Username Taken', 'This username is already taken. Please choose a different one.');
        setLoading(false);
        return;
      }

      // Update username
      const { error } = await supabase
        .from('profiles')
        .update({
          username: newUsername.trim(),
          last_username_change: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (error) throw error;

      // Update local user state
      if (user) {
        setUser({
          ...user,
          username: newUsername.trim()
        });
      }

      setNewUsername('');
      setCanChangeUsername(false);
      setLastUsernameChange(new Date().toISOString());
      
      await alert('Success', 'Username changed successfully!');
    } catch (error) {
      console.error('Error changing username:', error);
      await alert('Error', 'Failed to change username. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimRequest = async () => {
    if (!selectedTournament || !selectedPlayer) {
      await alert('Missing Information', 'Please select both a tournament and a player.');
      return;
    }

    // Check if request already exists
    const existingRequest = claimRequests.find(
      req => req.tournament_id === selectedTournament && 
             req.target_player_name === selectedPlayer &&
             req.status === 'pending'
    );

    if (existingRequest) {
      await alert('Request Already Exists', 'You already have a pending request for this player in this tournament.');
      return;
    }

    const confirmed = await confirm(
      'Request Stat Claim',
      `Request to claim stats for "${selectedPlayer}" in "${tournaments.find(t => t.id === selectedTournament)?.name}"?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('stat_claim_requests')
        .insert({
          requesting_user_id: user?.id,
          requesting_username: user?.username,
          target_player_name: selectedPlayer,
          tournament_id: selectedTournament,
          status: 'pending'
        });

      if (error) throw error;

      await fetchClaimRequests();
      setSelectedTournament('');
      setSelectedPlayer('');
      
      await alert('Success', 'Claim request submitted successfully! Admins will review your request.');
    } catch (error) {
      console.error('Error submitting claim request:', error);
      await alert('Error', 'Failed to submit claim request. Please try again.');
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    const request = pendingRequests.find(r => r.id === requestId);
    if (!request) return;
    
    const confirmed = await confirm(
      'Approve and Process Claim Request',
      `Are you sure you want to approve this stat claim request? This will transfer all stats for "${request.target_player_name}" in "${request.tournament_name}" to the account "${request.requesting_username}". This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      // First approve the request
      const { error: approveError } = await supabase
        .from('stat_claim_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.username
        })
        .eq('id', requestId);


      if (approveError) throw approveError;

      // Then process the stat claim using the database function
      const { data: claimResult, error: claimError } = await supabase
        .rpc('claim_player_stats', {
          p_request_id: requestId,
          p_new_player_name: request.requesting_username
        });

      if (claimError) throw claimError;

      if (!claimResult?.success) {
        throw new Error(claimResult?.error || 'Failed to claim stats');
      }

      await fetchPendingRequests();
      await fetchClaimRequests(); // Refresh user's own requests too
      await alert('Success', `Claim request processed successfully! ${claimResult.affected_matches} matches were transferred to ${request.requesting_username}.`);
    } catch (error) {
      console.error('Error approving request:', error);
      await alert('Error', `Failed to process claim request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const confirmed = await confirm(
      'Reject Claim Request',
      'Are you sure you want to reject this stat claim request?'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('stat_claim_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.username
        })
        .eq('id', requestId);


      if (error) throw error;

      await fetchPendingRequests();
      await fetchClaimRequests(); // Refresh user's own requests too
      await alert('Success', 'Claim request rejected.');
    } catch (error) {
      console.error('Error rejecting request:', error);
      await alert('Error', 'Failed to reject request. Please try again.');
    }
  };

  if (!user || user.id.startsWith('guest-')) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <User size={32} className="text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Login Required</h2>
          <p className="text-slate-400">
            Please log in to access your settings.
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
            <User size={40} className="mr-4 text-cyan-400" />
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Settings
            </span>
          </h1>
          <p className="text-slate-400 text-lg">Manage your account preferences</p>
        </div>

        <div className="space-y-8">
          {/* Username Change Section */}
          <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <User size={24} className="mr-2 text-cyan-400" />
              Username Settings
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">
                  Current Username
                </label>
                <div className="bg-slate-800 border border-cyan-500/30 rounded-lg px-3 py-2 text-white">
                  {user.username}
                </div>
              </div>

              {lastUsernameChange && (
                <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-3">
                  <div className="flex items-center text-sm text-slate-300">
                    <Clock size={16} className="mr-2 text-cyan-400" />
                    Last changed: {new Date(lastUsernameChange).toLocaleDateString()}
                  </div>
                  {!canChangeUsername && (
                    <div className="text-xs text-yellow-400 mt-1">
                      You can change your username again on {new Date(new Date(lastUsernameChange).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">
                  New Username
                </label>
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    disabled={!canChangeUsername || loading}
                    placeholder="Enter new username"
                    className="flex-1 bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                  />
                  <button
                    onClick={handleUsernameChange}
                    disabled={!canChangeUsername || !newUsername.trim() || loading}
                    className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 transition-all duration-200 flex items-center space-x-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    <span>Save</span>
                  </button>
                </div>
                {!canChangeUsername && (
                  <p className="text-xs text-yellow-400 mt-1">
                    Username can only be changed once per week
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Stat Claim Section */}
          <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <Shield size={24} className="mr-2 text-cyan-400" />
              Claim Tournament Stats
            </h2>
            
            <p className="text-slate-400 mb-6">
              If you played in a tournament under a different name, you can request to claim those stats for your account.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">
                  Tournament
                </label>
                <select
                  value={selectedTournament}
                  onChange={(e) => setSelectedTournament(e.target.value)}
                  className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">-- Select Tournament --</option>
                  {tournaments.map(tournament => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.name} - {new Date(tournament.tournament_date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">
                  Player Name
                </label>
                <select
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  disabled={!selectedTournament}
                  className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                >
                  <option value="">-- Select Player --</option>
                  {availablePlayers.map(player => (
                    <option key={player} value={player}>
                      {player}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleClaimRequest}
              disabled={!selectedTournament || !selectedPlayer}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-400 hover:to-emerald-500 disabled:opacity-50 transition-all duration-200 flex items-center space-x-2"
            >
              <Shield size={16} />
              <span>Request Claim</span>
            </button>
          </div>

          {/* My Claim Requests */}
          {claimRequests.length > 0 && (
            <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                           transition-all duration-300 hover:border-cyan-400/70 
                           hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              
              <h3 className="text-lg font-bold text-white mb-4">My Claim Requests</h3>
              
              <div className="space-y-3">
                {claimRequests.map(request => (
                  <div key={request.id} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-white">{request.target_player_name}</p>
                        <p className="text-sm text-slate-400">{tournaments.find(t => t.id === request.tournament_id)?.name || 'Unknown Tournament'}</p>
                        <p className="text-xs text-slate-500">
                          Requested: {new Date(request.created_at).toLocaleDateString()}
                        </p>
                        {request.reviewed_at && (
                          <p className="text-xs text-slate-500">
                            Reviewed: {new Date(request.reviewed_at).toLocaleDateString()}
                            {request.reviewed_by && ` by ${request.reviewed_by}`}
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        request.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        request.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        request.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {request.status === 'completed' ? 'COMPLETED' : request.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin: Pending Requests */}
          {isAdmin && pendingRequests.length > 0 && (
            <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                           transition-all duration-300 hover:border-cyan-400/70 
                           hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <AlertCircle size={20} className="mr-2 text-orange-400" />
                Pending Claim Requests
              </h3>
              
              <div className="space-y-4">
                {pendingRequests.map(request => (
                  <div key={request.id} className="bg-slate-800/50 border border-orange-500/20 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-white">
                          {request.requesting_username} → {request.target_player_name}
                        </p>
                        <p className="text-sm text-slate-400">{tournaments.find(t => t.id === request.tournament_id)?.name || 'Unknown Tournament'}</p>
                        <p className="text-xs text-slate-500">
                          Requested: {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApproveRequest(request.id)}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm transition-colors flex items-center space-x-1"
                        >
                          <CheckCircle size={14} />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm transition-colors flex items-center space-x-1"
                        >
                          <X size={14} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}