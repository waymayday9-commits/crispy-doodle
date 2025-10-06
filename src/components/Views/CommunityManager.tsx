import React, { useState, useEffect } from 'react';
import { 
  Heart, Users, Plus, Search, Crown, Calendar, Trophy, BarChart3, 
  Settings, UserPlus, UserMinus, Edit, Save, X, ArrowLeft, Globe,
  Lock, Unlock, CheckCircle, Clock, AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { CommunityPage } from './CommunityPage';

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

interface JoinRequest {
  id: string;
  community_id: string;
  user_id: string;
  username: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
}

interface Season {
  id: string;
  community_id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
}

type View = 'communities' | 'my-communities' | 'create' | 'community-detail' | 'community-page';

export function CommunityManager() {
  const { user } = useAuth();
  const { confirm, alert } = useConfirmation();
  
  const [currentView, setCurrentView] = useState<View>('communities');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [communityMembers, setCommunityMembers] = useState<CommunityMember[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create community form
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'open' as 'open' | 'invite_only'
  });
  
  // Season management
  const [isCreatingSeason, setIsCreatingSeason] = useState(false);
  const [seasonForm, setSeasonForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    if (user && !user.id.startsWith('guest-')) {
      fetchCommunities();
      fetchMyCommunities();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCommunity) {
      fetchCommunityDetails();
    }
  }, [selectedCommunity]);

  const fetchCommunities = async () => {
    try {
      const { data, error } = await supabase
        .from('community_stats')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCommunities(data || []);
    } catch (error) {
      console.error('Error fetching communities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyCommunities = async () => {
    try {
      const { data, error } = await supabase
        .from('community_members')
        .select(`
          communities:community_id (*)
        `)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      const myCommunitiesData = (data || [])
        .map(item => item.communities)
        .filter(Boolean);
      
      setMyCommunities(myCommunitiesData);
    } catch (error) {
      console.error('Error fetching my communities:', error);
    }
  };

const fetchCommunityDetails = async () => {
  if (!selectedCommunity) {
    console.log("[fetchCommunityDetails] No community selected.");
    return;
  }

  console.log("[fetchCommunityDetails] Fetching details for:", selectedCommunity.id);

  try {
    // 1. Fetch members (with disambiguated joins)
  const { data: membersData, error: membersError } = await supabase
    .from("community_members")
    .select(`
      id,
      community_id,
      user_id,
      role,
      joined_at,
      user_profile:profiles!community_members_user_id_fkey ( id, username )
    `)
    .eq("community_id", selectedCommunity.id)
    .order("joined_at", { ascending: true });


    if (membersError) {
      console.error("[fetchCommunityDetails] membersError:", membersError);
      throw membersError;
    }

    console.log("[fetchCommunityDetails] Raw membersData:", membersData);

    // Map into a cleaner structure for state
    const members = (membersData || []).map(m => ({
      id: m.id,
      community_id: m.community_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      username: m.user_profile?.username || "Unknown",
      invited_by: m.inviter_profile?.username || null,
    }));

    console.log("[fetchCommunityDetails] Final mapped members:", members);
    setCommunityMembers(members);

    // 2. Check if current user is a member
    const userMember = members.find(m => m.user_id === user?.id);
    console.log("[fetchCommunityDetails] Current user membership:", userMember);

    // 3. Fetch join requests if leader/admin
    if (userMember && ["leader", "admin"].includes(userMember.role)) {
      const { data: requestsData, error: requestsError } = await supabase
        .from("community_join_requests")
        .select("id, community_id, user_id, status, requested_at")
        .eq("community_id", selectedCommunity.id)
        .eq("status", "pending")
        .order("requested_at", { ascending: false });

      if (requestsError) {
        console.error("[fetchCommunityDetails] requestsError:", requestsError);
        throw requestsError;
      }

      console.log("[fetchCommunityDetails] joinRequests:", requestsData);
      setJoinRequests(requestsData || []);
    }

    // 4. Fetch seasons
    const { data: seasonsData, error: seasonsError } = await supabase
      .from("community_seasons")
      .select("*")
      .eq("community_id", selectedCommunity.id)
      .order("created_at", { ascending: false });

    if (seasonsError) {
      console.error("[fetchCommunityDetails] seasonsError:", seasonsError);
      throw seasonsError;
    }

    console.log("[fetchCommunityDetails] seasonsData:", seasonsData);
    setSeasons(seasonsData || []);
  } catch (error) {
    console.error("[fetchCommunityDetails] Fatal error:", error);
  }
};

  const createCommunity = async () => {
    if (!formData.name.trim()) {
      await alert('Missing Information', 'Please enter a community name.');
      return;
    }

    try {
      // Generate custom ID
      const { data: customIdData, error: customIdError } = await supabase
        .rpc('generate_community_custom_id', { community_name: formData.name.trim() });

      if (customIdError) throw customIdError;

      const { error } = await supabase
        .from('communities')
        .insert({
          name: formData.name.trim(),
          custom_id: customIdData,
          description: formData.description.trim() || null,
          type: formData.type,
          created_by: user?.id
        });

      if (error) throw error;

      await fetchCommunities();
      await fetchMyCommunities();
      setIsCreating(false);
      setFormData({ name: '', description: '', type: 'open' });
      await alert('Success', 'Community created successfully!');
    } catch (error: any) { // Add ': any' to the error type for easier logging
      console.error('Error creating community:', error);
      await alert('Error', `Failed to create community: ${error.message || 'Unknown error'}. Please try again.`);
    }
  };

  const joinCommunity = async (communityId: string, communityType: string) => {
    try {
      if (communityType === 'open') {
        // Join directly
        const { error } = await supabase
          .from('community_members')
          .insert({
            community_id: communityId,
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
            community_id: communityId,
            user_id: user?.id
          });

        if (error) throw error;
        await alert('Success', 'Join request sent! Community leaders will review your request.');
      }

      await fetchCommunities();
      await fetchMyCommunities();
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
              community_id: request.community_id,
              user_id: request.user_id,
              role: 'member'
            });

          if (memberError) throw memberError;
        }
      }

      await fetchCommunityDetails();
      await alert('Success', `Join request ${action}d successfully!`);
    } catch (error) {
      console.error('Error handling join request:', error);
      await alert('Error', 'Failed to process join request. Please try again.');
    }
  };

  const createSeason = async () => {
    if (!seasonForm.name.trim() || !seasonForm.start_date) {
      await alert('Missing Information', 'Please enter season name and start date.');
      return;
    }

    try {
      const { error } = await supabase
        .from('community_seasons')
        .insert({
          community_id: selectedCommunity?.id,
          name: seasonForm.name.trim(),
          description: seasonForm.description.trim() || null,
          start_date: seasonForm.start_date,
          end_date: seasonForm.end_date || null,
          created_by: user?.id
        });

      if (error) throw error;

      await fetchCommunityDetails();
      setIsCreatingSeason(false);
      setSeasonForm({ name: '', description: '', start_date: '', end_date: '' });
      await alert('Success', 'Season created successfully!');
    } catch (error) {
      console.error('Error creating season:', error);
      await alert('Error', 'Failed to create season. Please try again.');
    }
  };

  const filteredCommunities = communities.filter(community =>
    community.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    community.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isUserMember = (communityId: string) => {
    return myCommunities.some(c => c.id === communityId) || 
           communityMembers.some(m => m.user_id === user?.id);
  };

  const getUserRole = (communityId: string) => {
    // First check if user is the creator
    const community = communities.find(c => c.id === communityId);
    if (community && community.created_by === user?.id) {
      return 'leader';
    }
    
    // Then check community members
    const member = communityMembers.find(m => m.user_id === user?.id && m.community_id === communityId);
    return member?.role || null;
  };

  // If viewing community page, show that component
  if (currentView === 'community-page' && selectedCommunity) {
    return (
      <CommunityPage
        communityId={selectedCommunity.id}
        onBack={() => {
          setCurrentView('communities');
          setSelectedCommunity(null);
        }}
      />
    );
  }
  if (!user || user.id.startsWith('guest-')) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart size={32} className="text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Login Required</h2>
          <p className="text-slate-400">
            Please log in to access community features.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading communities...</p>
        </div>
      </div>
    );
  }

  // Community Detail View
  if (currentView === 'community-detail' && selectedCommunity) {
    const userRole = getUserRole(selectedCommunity.id);
    const canManage = userRole && ['leader', 'admin'].includes(userRole);

    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-6 pt-28 pb-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => {
                setCurrentView('communities');
                setSelectedCommunity(null);
              }}
              className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 mb-4 transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back to Communities</span>
            </button>
            
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-rose-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {selectedCommunity.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2">{selectedCommunity.name}</h1>
                  <div className="flex items-center space-x-4 text-slate-400">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedCommunity.type === 'open' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {selectedCommunity.type === 'open' ? (
                        <><Globe size={14} className="inline mr-1" />Open</>
                      ) : (
                        <><Lock size={14} className="inline mr-1" />Invite Only</>
                      )}
                    </span>
                    <span>{selectedCommunity.member_count} members</span>
                    <span>Leader: {selectedCommunity.leader_username}</span>
                  </div>
                  {selectedCommunity.description && (
                    <p className="text-slate-300 mt-2">{selectedCommunity.description}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setCurrentView('community-page');
                  }}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 flex items-center space-x-2"
                >
                  <Eye size={16} />
                  <span>View Community Page</span>
                </button>
                {!isUserMember(selectedCommunity.id) && (
                  <button
                    onClick={() => joinCommunity(selectedCommunity.id, selectedCommunity.type)}
                    className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-6 py-3 rounded-lg hover:from-pink-400 hover:to-rose-500 transition-all duration-200 flex items-center space-x-2"
                  >
                    <UserPlus size={16} />
                    <span>{selectedCommunity.type === 'open' ? 'Join Community' : 'Request to Join'}</span>
                  </button>
                )}
                
                {canManage && (
                  <button
                    onClick={() => setIsCreatingSeason(true)}
                    className="bg-gradient-to-r from-purple-500 to-violet-600 text-white px-4 py-2 rounded-lg hover:from-purple-400 hover:to-violet-500 transition-all duration-200 flex items-center space-x-2"
                  >
                    <Plus size={16} />
                    <span>Create Season</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Community Stats */}
              <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <BarChart3 size={24} className="mr-2 text-cyan-400" />
                  Community Statistics
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center p-4 bg-pink-500/10 border border-pink-500/20 rounded-none">
                    <div className="text-3xl font-bold text-pink-400">{selectedCommunity.tournaments_hosted}</div>
                    <div className="text-sm text-slate-400">Tournaments</div>
                  </div>
                  <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-none">
                    <div className="text-3xl font-bold text-green-400">{selectedCommunity.total_matches}</div>
                    <div className="text-sm text-slate-400">Total Matches</div>
                  </div>
                  <div className="text-center p-4 bg-purple-500/10 border border-purple-500/20 rounded-none">
                    <div className="text-3xl font-bold text-purple-400">{selectedCommunity.active_seasons}</div>
                    <div className="text-sm text-slate-400">Active Seasons</div>
                  </div>
                  <div className="text-center p-4 bg-orange-500/10 border border-orange-500/20 rounded-none">
                    <div className="text-3xl font-bold text-orange-400">{selectedCommunity.member_count}</div>
                    <div className="text-sm text-slate-400">Members</div>
                  </div>
                </div>
              </div>

              {/* Seasons */}
              <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Calendar size={24} className="mr-2 text-cyan-400" />
                  Seasons
                </h2>

                {seasons.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar size={48} className="mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-400">No seasons created yet</p>
                    {canManage && (
                      <button
                        onClick={() => setIsCreatingSeason(true)}
                        className="mt-4 text-pink-400 hover:text-pink-300 underline"
                      >
                        Create the first season
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {seasons.map(season => (
                      <div key={season.id} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
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
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Members */}
              <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Users size={24} className="mr-2 text-cyan-400" />
                  Members ({communityMembers.length})
                </h2>

                <div className="space-y-3">
                  {communityMembers.map(member => (
                    <div key={member.id} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-3 flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-rose-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {member.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-white">{member.username}</div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            member.role === 'leader' ? 'bg-yellow-500/20 text-yellow-400' :
                            member.role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {member.role === 'leader' ? <Crown size={12} className="inline mr-1" /> : null}
                            {member.role}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Join Requests (for leaders/admins) */}
              {canManage && joinRequests.length > 0 && (
                <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                               transition-all duration-300 hover:border-cyan-400/70 
                               hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                  <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                   w-0 transition-all duration-500 group-hover:w-full" />
                  
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                    <AlertCircle size={24} className="mr-2 text-orange-400" />
                    Join Requests ({joinRequests.length})
                  </h2>

                  <div className="space-y-3">
                    {joinRequests.map(request => (
                      <div key={request.id} className="bg-slate-800/50 border border-orange-500/20 rounded-lg p-3">
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
            </div>
          </div>

          {/* Create Season Modal */}
          {isCreatingSeason && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-slate-950 border border-cyan-500/30 rounded-xl shadow-[0_0_40px_rgba(0,200,255,0.3)] max-w-md w-full">
                <div className="bg-gradient-to-r from-purple-500 to-violet-500 px-6 py-4 text-white">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Create New Season</h3>
                    <button
                      onClick={() => {
                        setIsCreatingSeason(false);
                        setSeasonForm({ name: '', description: '', start_date: '', end_date: '' });
                      }}
                      className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">Season Name *</label>
                    <input
                      type="text"
                      value={seasonForm.name}
                      onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                      placeholder="e.g., Spring 2024 Championship"
                      className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">Description</label>
                    <textarea
                      value={seasonForm.description}
                      onChange={(e) => setSeasonForm({ ...seasonForm, description: e.target.value })}
                      placeholder="Season description..."
                      rows={3}
                      className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-cyan-400 mb-2">Start Date *</label>
                      <input
                        type="date"
                        value={seasonForm.start_date}
                        onChange={(e) => setSeasonForm({ ...seasonForm, start_date: e.target.value })}
                        className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-cyan-400 mb-2">End Date</label>
                      <input
                        type="date"
                        value={seasonForm.end_date}
                        onChange={(e) => setSeasonForm({ ...seasonForm, end_date: e.target.value })}
                        className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={() => {
                        setIsCreatingSeason(false);
                        setSeasonForm({ name: '', description: '', start_date: '', end_date: '' });
                      }}
                      className="px-4 py-2 bg-slate-800 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createSeason}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg hover:from-purple-400 hover:to-violet-500 transition-all duration-200"
                    >
                      Create Season
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
            <Heart size={40} className="mr-4 text-pink-400" />
            <span className="bg-gradient-to-r from-pink-400 via-rose-400 to-pink-400 bg-clip-text text-transparent">
              Community Manager
            </span>
          </h1>
          <p className="text-slate-400 text-lg">Create communities, host tournaments, and build your local scene</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-4 sm:space-x-8 border-b border-slate-700 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'communities', label: 'All Communities', icon: <Heart size={16} /> },
            { id: 'my-communities', label: 'My Communities', icon: <Users size={16} /> },
            { id: 'create', label: 'Create Community', icon: <Plus size={16} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentView(tab.id as View)}
              className={`relative pb-2 text-sm font-medium transition-colors group flex items-center whitespace-nowrap ${
                currentView === tab.id ? 'text-pink-400' : 'text-slate-400 hover:text-pink-300'
              }`}
            >
              {tab.icon}
              <span className="ml-1 sm:ml-2 hidden sm:inline">{tab.label}</span>
              <span className="ml-1 sm:hidden">
                {tab.id === 'communities' ? 'All' : tab.id === 'my-communities' ? 'My' : 'Create'}
              </span>
              <span
                className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-pink-400 to-rose-400 transition-all duration-500
                ${currentView === tab.id ? 'w-full' : 'w-0 group-hover:w-full'}`}
              />
            </button>
          ))}
        </div>

        {/* All Communities View */}
        {currentView === 'communities' && (
          <div className="space-y-6">
            {/* Search */}
            <div className="bg-slate-900/50 border border-cyan-500/30 rounded-none backdrop-blur-sm p-6">
              <div className="relative w-full max-w-md">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search communities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Communities Grid */}
            {filteredCommunities.length === 0 ? (
              <div className="group relative border border-slate-700 bg-slate-900/40 p-12 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] text-center">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart size={32} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Communities Found</h3>
                <p className="text-slate-400">
                  {communities.length === 0 ? 'No communities have been created yet' : 'No communities match your search'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCommunities.map((community) => (
                  <div 
                    key={community.id} 
                    onClick={() => {
                      setSelectedCommunity(community);
                      setCurrentView('community-page');
                    }}
                    className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                               transition-all duration-300 hover:border-cyan-400/70 
                               hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] cursor-pointer">
                    <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                     w-0 transition-all duration-500 group-hover:w-full" />
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-600 rounded-full flex items-center justify-center text-white font-bold">
                          {community.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">{community.name}</h3>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              community.type === 'open' 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-orange-500/20 text-orange-400'
                            }`}>
                              {community.type === 'open' ? (
                                <><Globe size={12} className="inline mr-1" />Open</>
                              ) : (
                                <><Lock size={12} className="inline mr-1" />Invite Only</>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">{community.member_count} members</div>
                        <div className="text-xs text-slate-500">Leader: {community.leader_username}</div>
                      </div>
                    </div>

                    {community.description && (
                      <p className="text-slate-400 text-sm mb-4 line-clamp-2">{community.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-pink-400">{community.tournaments_hosted}</div>
                        <div className="text-xs text-slate-400">Tournaments</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-purple-400">{community.active_seasons}</div>
                        <div className="text-xs text-slate-400">Active Seasons</div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-800">
                      Created: {new Date(community.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Communities View */}
        {currentView === 'my-communities' && (
          <div className="space-y-6">
            {myCommunities.length === 0 ? (
              <div className="group relative border border-slate-700 bg-slate-900/40 p-12 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] text-center">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart size={32} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Communities</h3>
                <p className="text-slate-400 mb-6">You're not a member of any communities yet.</p>
                <button
                  onClick={() => setCurrentView('create')}
                  className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-6 py-3 rounded-lg hover:from-pink-400 hover:to-rose-500 transition-all duration-200"
                >
                  Create a Community
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myCommunities.map((community) => (
                  <div 
                    key={community.id} 
                    onClick={() => {
                      setSelectedCommunity(community);
                      setCurrentView('community-page');
                    }}
                    className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                               transition-all duration-300 hover:border-cyan-400/70 
                               hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] cursor-pointer">
                    <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                     w-0 transition-all duration-500 group-hover:w-full" />
                    
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-600 rounded-full flex items-center justify-center text-white font-bold">
                        {community.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{community.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          community.type === 'open' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {community.type === 'open' ? 'Open' : 'Invite Only'}
                        </span>
                      </div>
                    </div>

                    {community.description && (
                      <p className="text-slate-400 text-sm mb-4">{community.description}</p>
                    )}

                    <div className="text-xs text-slate-500">
                      {community.member_count} members • {community.tournaments_hosted} tournaments
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Community View */}
        {currentView === 'create' && (
          <div className="max-w-2xl mx-auto">
            <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                           transition-all duration-300 hover:border-cyan-400/70 
                           hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <Plus size={24} className="mr-2 text-pink-400" />
                Create New Community
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-pink-400 mb-2">
                    Community Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter community name"
                    className="w-full bg-slate-900 border border-pink-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-pink-400 mb-2">
                    Community Type
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center space-x-3 p-4 border border-slate-600 rounded-lg cursor-pointer hover:border-pink-400 transition-colors">
                      <input
                        type="radio"
                        name="type"
                        value="open"
                        checked={formData.type === 'open'}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as 'open' })}
                        className="w-4 h-4 text-pink-600"
                      />
                      <div>
                        <div className="font-medium text-white flex items-center">
                          <Globe size={16} className="mr-2 text-green-400" />
                          Open Community
                        </div>
                        <div className="text-sm text-slate-400">Anyone can join freely</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center space-x-3 p-4 border border-slate-600 rounded-lg cursor-pointer hover:border-pink-400 transition-colors">
                      <input
                        type="radio"
                        name="type"
                        value="invite_only"
                        checked={formData.type === 'invite_only'}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as 'invite_only' })}
                        className="w-4 h-4 text-pink-600"
                      />
                      <div>
                        <div className="font-medium text-white flex items-center">
                          <Lock size={16} className="mr-2 text-orange-400" />
                          Invite Only
                        </div>
                        <div className="text-sm text-slate-400">Members must be invited</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-pink-400 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe your community, its goals, and what makes it special..."
                    rows={4}
                    className="w-full bg-slate-900 border border-pink-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setFormData({ name: '', description: '', type: 'open' });
                      setCurrentView('communities');
                    }}
                    className="px-6 py-3 bg-slate-800 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createCommunity}
                    className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-lg hover:from-pink-400 hover:to-rose-500 transition-all duration-200 flex items-center space-x-2"
                  >
                    <Save size={16} />
                    <span>Create Community</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}