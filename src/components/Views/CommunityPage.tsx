import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Users, Calendar, Trophy, BarChart3, Settings, 
  UserPlus, Crown, Globe, Lock, MapPin, Edit, Save, X,
  CheckCircle, Clock, AlertCircle, Plus, Eye
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';

interface CommunityPageProps {
  communityId: string;
  onBack: () => void;
}

interface Community {
  id: string;
  name: string;
  custom_id: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  type: 'open' | 'invite_only';
  created_by: string;
  leader_username: string;
  member_count: number;
  tournaments_hosted: number;
  completed_tournaments: number;
  total_matches: number;
  seasons_count: number;
  active_seasons: number;
  created_at: string;
}

interface CommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  username: string;
  role: 'leader' | 'admin' | 'member';
  joined_at: string;
}

interface Tournament {
  id: string;
  name: string;
  tournament_date: string;
  location: string;
  status: string;
  tournament_type: string;
  is_practice: boolean;
  current_participants: number;
  max_participants: number;
}

interface Season {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
}

interface JoinRequest {
  id: string;
  user_id: string;
  username: string;
  requested_at: string;
}

export function CommunityPage({ communityId, onBack }: CommunityPageProps) {
  const { user } = useAuth();
  const { confirm, alert } = useConfirmation();
  
  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [currentTab, setCurrentTab] = useState<'overview' | 'tournaments' | 'seasons' | 'analytics' | 'members'>('overview');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    type: 'open' as 'open' | 'invite_only'
  });

  const userMember = members.find(m => m.user_id === user?.id);
  const userRole = userMember?.role;
  const canManage = userRole && ['leader', 'admin'].includes(userRole);
  const isLeader = userRole === 'leader';
  const isMember = !!userMember;

  useEffect(() => {
    fetchCommunityData();
  }, [communityId]);

  const fetchCommunityData = async () => {
    try {
      // Fetch community details
      const { data: communityData, error: communityError } = await supabase
        .from('community_stats')
        .select('*')
        .eq('id', communityId)
        .single();

      if (communityError) throw communityError;
      setCommunity(communityData);

      // Fetch members
    const { data: membersData, error: membersError } = await supabase
      .from('community_members')
      .select(`
        id,
        community_id,
        user_id,
        role,
        joined_at,
        user_profile:profiles!community_members_user_id_fkey ( id, username )
      `)
      .eq('community_id', communityId)
      .order('joined_at', { ascending: true });

      if (membersError) throw membersError;
      
      const formattedMembers = (membersData || []).map(member => ({
        id: member.id,
        community_id: member.community_id,
        user_id: member.user_id,
        username: member.user_profile?.username || "Unknown",
        role: member.role,
        joined_at: member.joined_at
      }));
     
      setMembers(formattedMembers);

      // Fetch tournaments hosted by this community
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('hosted_by_community_id', communityId)
        .order('tournament_date', { ascending: false });

      if (tournamentsError) throw tournamentsError;
      setTournaments(tournamentsData || []);

      // Fetch seasons
      const { data: seasonsData, error: seasonsError } = await supabase
        .from('community_seasons')
        .select('*')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });

      if (seasonsError) throw seasonsError;
      setSeasons(seasonsData || []);

      // Fetch join requests if user can manage
      if (canManage) {
        const { data: requestsData, error: requestsError } = await supabase
          .from('community_join_requests')
          .select(`
            *,
            profiles!inner(username)
          `)
          .eq('community_id', communityId)
          .eq('status', 'pending')
          .order('requested_at', { ascending: false });

        if (requestsError) throw requestsError;
        
        const formattedRequests = (requestsData || []).map(request => ({
          id: request.id,
          user_id: request.user_id,
          username: request.profiles.username,
          requested_at: request.requested_at
        }));
        
        setJoinRequests(formattedRequests);
      }

    } catch (error) {
      console.error('Error fetching community data:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinCommunity = async () => {
    if (!community) return;

    try {
      if (community.type === 'open') {
        // Join directly
        const { error } = await supabase
          .from('community_members')
          .insert({
            community_id: community.id,
            user_id: user?.id,
            role: 'member'
          });

        if (error) throw error;
        await alert('Success', 'You have joined the community!');
      } else {
        // Send join request
        const { error } = await supabase
          .from('community_join_requests')
          .insert({
            community_id: community.id,
            user_id: user?.id
          });

        if (error) throw error;
        await alert('Success', 'Join request sent! Community leaders will review your request.');
      }

      await fetchCommunityData();
    } catch (error) {
      console.error('Error joining community:', error);
      await alert('Error', 'Failed to join community. Please try again.');
    }
  };

  const handleJoinRequest = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const { error } = await supabase
        .from('community_join_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', requestId);

      if (error) throw error;

      if (action === 'approve') {
        const request = joinRequests.find(r => r.id === requestId);
        if (request) {
          const { error: memberError } = await supabase
            .from('community_members')
            .insert({
              community_id: community?.id,
              user_id: request.user_id,
              role: 'member'
            });

          if (memberError) throw memberError;
        }
      }

      await fetchCommunityData();
      await alert('Success', `Join request ${action}d successfully!`);
    } catch (error) {
      console.error('Error handling join request:', error);
      await alert('Error', 'Failed to process join request. Please try again.');
    }
  };

  const updateCommunity = async () => {
    if (!community || !isLeader) return;

    try {
      const { error } = await supabase
        .from('communities')
        .update({
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          type: editForm.type,
          updated_at: new Date().toISOString()
        })
        .eq('id', community.id);

      if (error) throw error;

      await fetchCommunityData();
      setIsEditing(false);
      await alert('Success', 'Community updated successfully!');
    } catch (error) {
      console.error('Error updating community:', error);
      await alert('Error', 'Failed to update community. Please try again.');
    }
  };

  const startEdit = () => {
    if (!community) return;
    setEditForm({
      name: community.name,
      description: community.description || '',
      type: community.type
    });
    setIsEditing(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading community...</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Community Not Found</h2>
          <p className="text-slate-400 mb-6">The requested community could not be found.</p>
          <button
            onClick={onBack}
            className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-6 py-3 rounded-lg hover:from-pink-400 hover:to-rose-500 transition-all duration-200"
          >
            Back to Communities
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-pink-400 hover:text-pink-300 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Communities</span>
          </button>
          
          {/* Community Header */}
          <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                         transition-all duration-300 hover:border-pink-400/70 
                         hover:shadow-[0_0_15px_rgba(236,72,153,0.4)]">
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-pink-400 to-rose-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-rose-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {community.logo_url ? (
                    <img src={community.logo_url} alt={community.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    community.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2">{community.name}</h1>
                  <div className="flex items-center space-x-4 text-slate-400">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      community.type === 'open' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {community.type === 'open' ? (
                        <><Globe size={14} className="inline mr-1" />Open Community</>
                      ) : (
                        <><Lock size={14} className="inline mr-1" />Invite Only</>
                      )}
                    </span>
                    <span>{community.member_count} members</span>
                    <span>Leader: {community.leader_username}</span>
                  </div>
                  {community.description && !isEditing && (
                    <p className="text-slate-300 mt-2 max-w-2xl">{community.description}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {!isMember && user && !user.id.startsWith('guest-') && (
                  <button
                    onClick={joinCommunity}
                    className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-6 py-3 rounded-lg hover:from-pink-400 hover:to-rose-500 transition-all duration-200 flex items-center space-x-2"
                  >
                    <UserPlus size={16} />
                    <span>{community.type === 'open' ? 'Join Community' : 'Request to Join'}</span>
                  </button>
                )}
                
                {isLeader && (
                  <button
                    onClick={startEdit}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-400 hover:to-purple-500 transition-all duration-200 flex items-center space-x-2"
                  >
                    <Edit size={16} />
                    <span>Edit Community</span>
                  </button>
                )}
              </div>
            </div>

            {/* Edit Form */}
            {isEditing && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-pink-400 mb-2">Community Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-slate-900 border border-pink-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-pink-400 mb-2">Community Type</label>
                    <select
                      value={editForm.type}
                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value as 'open' | 'invite_only' })}
                      className="w-full bg-slate-900 border border-pink-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                    >
                      <option value="open">Open Community</option>
                      <option value="invite_only">Invite Only</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-pink-400 mb-2">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={4}
                      className="w-full bg-slate-900 border border-pink-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
                      placeholder="Describe your community..."
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-slate-800 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateCommunity}
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-lg hover:from-pink-400 hover:to-rose-500 transition-all duration-200 flex items-center space-x-2"
                  >
                    <Save size={16} />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-4 sm:space-x-8 border-b border-slate-700 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: <Users size={16} /> },
            { id: 'tournaments', label: 'Tournaments', icon: <Trophy size={16} /> },
            { id: 'seasons', label: 'Seasons', icon: <Calendar size={16} /> },
            { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
            { id: 'members', label: 'Members', icon: <Users size={16} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id as any)}
              className={`relative pb-2 text-sm font-medium transition-colors group flex items-center whitespace-nowrap ${
                currentTab === tab.id ? 'text-pink-400' : 'text-slate-400 hover:text-pink-300'
              }`}
            >
              {tab.icon}
              <span className="ml-2 hidden sm:inline">{tab.label}</span>
              <span className="ml-2 sm:hidden">{tab.label.split(' ')[0]}</span>
              <span
                className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-pink-400 to-rose-400 transition-all duration-500
                ${currentTab === tab.id ? 'w-full' : 'w-0 group-hover:w-full'}`}
              />
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {currentTab === 'overview' && (
            <>
              {/* Community Stats */}
              <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                             transition-all duration-300 hover:border-pink-400/70 
                             hover:shadow-[0_0_15px_rgba(236,72,153,0.4)]">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-pink-400 to-rose-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                  <BarChart3 size={24} className="mr-2 text-pink-400" />
                  Community Statistics
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center p-4 bg-pink-500/10 border border-pink-500/20 rounded-none">
                    <div className="text-3xl font-bold text-pink-400">{community.member_count}</div>
                    <div className="text-sm text-slate-400">Members</div>
                  </div>
                  <div className="text-center p-4 bg-purple-500/10 border border-purple-500/20 rounded-none">
                    <div className="text-3xl font-bold text-purple-400">{community.tournaments_hosted}</div>
                    <div className="text-sm text-slate-400">Tournaments</div>
                  </div>
                  <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-none">
                    <div className="text-3xl font-bold text-green-400">{community.total_matches}</div>
                    <div className="text-sm text-slate-400">Total Matches</div>
                  </div>
                  <div className="text-center p-4 bg-orange-500/10 border border-orange-500/20 rounded-none">
                    <div className="text-3xl font-bold text-orange-400">{community.active_seasons}</div>
                    <div className="text-sm text-slate-400">Active Seasons</div>
                  </div>
                </div>
              </div>

              {/* Join Requests (for leaders/admins) */}
              {canManage && joinRequests.length > 0 && (
                <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                               transition-all duration-300 hover:border-orange-400/70 
                               hover:shadow-[0_0_15px_rgba(251,146,60,0.4)]">
                  <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-orange-400 to-red-400 
                                   w-0 transition-all duration-500 group-hover:w-full" />
                  
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                    <AlertCircle size={24} className="mr-2 text-orange-400" />
                    Pending Join Requests ({joinRequests.length})
                  </h2>

                  <div className="space-y-3">
                    {joinRequests.map(request => (
                      <div key={request.id} className="bg-slate-800/50 border border-orange-500/20 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-white">{request.username}</div>
                            <div className="text-xs text-slate-400">
                              Requested: {new Date(request.requested_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleJoinRequest(request.id, 'approve')}
                              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm transition-colors flex items-center space-x-1"
                            >
                              <CheckCircle size={14} />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleJoinRequest(request.id, 'reject')}
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
            </>
          )}

          {/* Tournaments Tab */}
          {currentTab === 'tournaments' && (
            <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                           transition-all duration-300 hover:border-pink-400/70 
                           hover:shadow-[0_0_15px_rgba(236,72,153,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-pink-400 to-rose-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <Trophy size={24} className="mr-2 text-pink-400" />
                Community Tournaments
              </h2>

              {tournaments.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy size={48} className="mx-auto text-slate-400 mb-4" />
                  <p className="text-slate-400">No tournaments hosted by this community yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tournaments.map(tournament => (
                    <div key={tournament.id} className="bg-slate-800/50 border border-pink-500/20 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-white">{tournament.name}</h3>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            tournament.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            tournament.status === 'completed' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-cyan-500/20 text-cyan-400'
                          }`}>
                            {tournament.status.toUpperCase()}
                          </span>
                          {tournament.is_practice && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                              PRACTICE
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-slate-300">
                        <div className="flex items-center">
                          <Calendar size={14} className="mr-2 text-pink-400" />
                          {new Date(tournament.tournament_date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center">
                          <MapPin size={14} className="mr-2 text-pink-400" />
                          {tournament.location}
                        </div>
                        <div className="flex items-center">
                          <Users size={14} className="mr-2 text-pink-400" />
                          {tournament.max_participants === 999999 
                            ? `${tournament.current_participants} players`
                            : `${tournament.current_participants}/${tournament.max_participants} players`
                          }
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tournament.tournament_type === 'ranked' 
                            ? 'bg-yellow-500/20 text-yellow-400' 
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {tournament.tournament_type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Seasons Tab */}
          {currentTab === 'seasons' && (
            <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                           transition-all duration-300 hover:border-pink-400/70 
                           hover:shadow-[0_0_15px_rgba(236,72,153,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-pink-400 to-rose-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <Calendar size={24} className="mr-2 text-pink-400" />
                Community Seasons
              </h2>

              {seasons.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar size={48} className="mx-auto text-slate-400 mb-4" />
                  <p className="text-slate-400">No seasons created yet</p>
                  {canManage && (
                    <p className="text-sm text-pink-400 mt-2">Create seasons to track ranked tournament performance over time</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {seasons.map(season => (
                    <div key={season.id} className="bg-slate-800/50 border border-pink-500/20 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-white">{season.name}</h3>
                          {season.description && (
                            <p className="text-sm text-slate-400 mt-1">{season.description}</p>
                          )}
                          <div className="flex items-center space-x-4 mt-2 text-sm text-slate-400">
                            <span>Start: {new Date(season.start_date).toLocaleDateString()}</span>
                            {season.end_date && (
                              <span>End: {new Date(season.end_date).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          season.is_active 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {season.is_active ? 'Active' : 'Ended'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {currentTab === 'analytics' && (
            <div className="group relative border border-slate-700 bg-slate-900/40 p-12 rounded-none 
                           transition-all duration-300 hover:border-pink-400/70 
                           hover:shadow-[0_0_15px_rgba(236,72,153,0.4)] text-center">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-pink-400 to-rose-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              
              <div className="w-24 h-24 bg-gradient-to-r from-pink-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(236,72,153,0.5)]">
                <BarChart3 size={48} className="text-white" />
              </div>
              
              <h2 className="text-4xl font-bold text-pink-400 mb-4">Community Analytics</h2>
              <div className="inline-block bg-gradient-to-r from-pink-600 to-rose-600 text-white px-6 py-2 rounded-none font-bold text-lg mb-6 shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                COMING SOON
              </div>
              
              <p className="text-pink-300 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
                Community-scoped analytics will show performance trends, meta analysis, and player statistics 
                specifically for tournaments hosted by {community.name}.
              </p>

              <div className="bg-slate-800/40 backdrop-blur-sm border border-pink-400/30 rounded-none p-6 max-w-md mx-auto">
                <h4 className="font-bold text-pink-400 mb-3">Planned Features:</h4>
                <div className="space-y-2 text-sm text-pink-300 text-left">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-pink-400 rounded-full mr-3"></span>
                    Community casual tournament stats
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-pink-400 rounded-full mr-3"></span>
                    Community ranked tournament stats
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-pink-400 rounded-full mr-3"></span>
                    Season-based leaderboards
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-pink-400 rounded-full mr-3"></span>
                    Community meta analysis
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Members Tab */}
          {currentTab === 'members' && (
            <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                           transition-all duration-300 hover:border-pink-400/70 
                           hover:shadow-[0_0_15px_rgba(236,72,153,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-pink-400 to-rose-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <Users size={24} className="mr-2 text-pink-400" />
                Community Members ({members.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map(member => (
                  <div key={member.id} className="bg-slate-800/50 border border-pink-500/20 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-600 rounded-full flex items-center justify-center text-white font-bold">
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-white">{member.username}</div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            member.role === 'leader' ? 'bg-yellow-500/20 text-yellow-400' :
                            member.role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {member.role === 'leader' && <Crown size={12} className="inline mr-1" />}
                            {member.role}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Joined: {new Date(member.joined_at).toLocaleDateString()}
                        </div>
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