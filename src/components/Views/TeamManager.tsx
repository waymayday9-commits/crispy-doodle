import React, { useState, useEffect } from 'react';
import { Users, Crown, BarChart3, UserPlus, UserMinus, Search, Plus, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { TeamDetails} from './TeamDetails';

interface Team {
  id: string;
  name: string;
  tag: string;
  description?: string;
  leader_id: string;
  leader_username: string;
  created_at: string;
  member_count: number;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  username: string;
  role: 'leader' | 'member';
  joined_at: string;
}

interface TeamStats {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPoints: number;
  avgPointsPerMatch: number;
  tournamentsPlayed: number;
}

export function TeamManager() {
  const { user } = useAuth();
  const { confirm, alert } = useConfirmation();
  
  const [currentView, setCurrentView] = useState<'teams' | 'my-team' | 'create'>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTournament, setSelectedTournament] = useState<string>('all');
  const [tournaments, setTournaments] = useState<any[]>([]);
  
  // Create team form
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    description: ''
  });
  
  // Recruit member
  const [showRecruitModal, setShowRecruitModal] = useState(false);
  const [recruitUsername, setRecruitUsername] = useState('');
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [viewingTeam, setViewingTeam] = useState<string | null>(null);

  useEffect(() => {
    if (user && !user.id.startsWith('guest-')) {
      fetchTeams();
      fetchMyTeam();
      fetchTournaments();
    }
  }, [user]);

  useEffect(() => {
    if (myTeam) {
      const loadTeamData = async () => {
        const members = await fetchTeamMembers();
        if (members && members.length > 0) {
          await fetchTeamStats(members);
        }
      };
      loadTeamData();
    }
  }, [myTeam, selectedTournament]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams_with_members')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyTeam = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          teams (*)
        `)
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.teams) {
        setMyTeam(data.teams as Team);
        setCurrentView('my-team');
      }
    } catch (error) {
      console.error('Error fetching my team:', error);
    }
  };

  const fetchTeamMembers = async () => {
    if (!myTeam) return;
    
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          profiles!inner(username)
        `)
        .eq('team_id', myTeam.id)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      
      const members = (data || []).map(member => ({
        id: member.id,
        team_id: member.team_id,
        user_id: member.user_id,
        username: member.profiles.username,
        role: member.role,
        joined_at: member.joined_at
      }));
      
      setTeamMembers(members);
      return members;
    } catch (error) {
      console.error('Error fetching team members:', error);
      return [];
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

  const fetchTeamStats = async (members?: TeamMember[]) => {
    if (!myTeam) return;
    
    // Use provided members or current state
    const teamMembersList = members || teamMembers;
    
    if (teamMembersList.length === 0) {
      setTeamStats({
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalPoints: 0,
        avgPointsPerMatch: 0,
        tournamentsPlayed: 0
      });
      return;
    }
    
    try {
      // Get all team member usernames
      const memberUsernames = teamMembersList.map(m => m.username);

      // Fetch matches for team members
      let query = supabase
        .from('match_results')
        .select(`
          *,
          tournaments!inner(is_practice)
        `)
        .or(memberUsernames.map(username => 
          `player1_name.eq.${username},player2_name.eq.${username},normalized_player1_name.eq.${username.toLowerCase()},normalized_player2_name.eq.${username.toLowerCase()}`
        ).join(','));

      if (selectedTournament !== 'all') {
        query = query.eq('tournament_id', selectedTournament);
      }

      const { data: matches, error } = await query;
      if (error) throw error;

      // Filter out practice tournament matches
      const filteredMatches = (matches || []).filter(match => 
        match.tournament_type !== 'practice'
      );

      if (filteredMatches.length === 0) {
        setTeamStats({
          totalMatches: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          totalPoints: 0,
          avgPointsPerMatch: 0,
          tournamentsPlayed: 0
        });
        return;
      }

      let wins = 0;
      let totalPoints = 0;
      const tournamentsSet = new Set<string>();

      filteredMatches.forEach(match => {
        const isTeamMemberWinner = memberUsernames.some(username => 
          match.winner_name === username || 
          match.normalized_winner_name === username.toLowerCase()
        );
        
        if (isTeamMemberWinner) {
          wins++;
          totalPoints += match.points_awarded || 0;
        }
        
        tournamentsSet.add(match.tournament_id);
      });

      const totalMatches = filteredMatches.length;
      const losses = totalMatches - wins;
      const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;
      const avgPointsPerMatch = totalMatches > 0 ? totalPoints / totalMatches : 0;

      setTeamStats({
        totalMatches,
        wins,
        losses,
        winRate,
        totalPoints,
        avgPointsPerMatch,
        tournamentsPlayed: tournamentsSet.size
      });
    } catch (error) {
      console.error('Error fetching team stats:', error);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .not('id', 'in', `(${teamMembers.map(m => `"${m.user_id}"`).join(',')})`)
        .order('username');

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error fetching available users:', error);
    }
  };

  const createTeam = async () => {
    if (!formData.name.trim() || !formData.tag.trim()) {
      await alert('Missing Information', 'Please enter both team name and tag.');
      return;
    }

    if (formData.tag.length > 10) {
      await alert('Invalid Tag', 'Team tag must be 10 characters or less.');
      return;
    }

    try {
      // Check if tag already exists
      const { data: existingTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('tag', formData.tag.trim())
        .single();

      if (existingTeam) {
        await alert('Tag Taken', 'This team tag is already taken. Please choose a different one.');
        return;
      }

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: formData.name.trim(),
          tag: formData.tag.trim(),
          description: formData.description.trim() || null,
          leader_id: user?.id
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add creator as team leader
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: user?.id,
          role: 'leader'
        });

      if (memberError) throw memberError;

      await fetchMyTeam();
      setIsCreating(false);
      setFormData({ name: '', tag: '', description: '' });
      await alert('Success', 'Team created successfully!');
    } catch (error) {
      console.error('Error creating team:', error);
      await alert('Error', 'Failed to create team. Please try again.');
    }
  };

  const recruitMember = async () => {
    if (!recruitUsername.trim()) {
      await alert('Missing Information', 'Please enter a username to recruit.');
      return;
    }

    try {
      // Find user by username
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', recruitUsername.trim())
        .single();

      if (userError || !userProfile) {
        await alert('User Not Found', 'No user found with that username.');
        return;
      }

      // Check if user is already in a team
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', userProfile.id)
        .single();

      if (existingMember) {
        await alert('Already in Team', 'This user is already a member of a team.');
        return;
      }

      // Add to team
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: myTeam?.id,
          user_id: userProfile.id,
          role: 'member'
        });

      if (error) throw error;

      await fetchTeamMembers();
      setShowRecruitModal(false);
      setRecruitUsername('');
      await alert('Success', `${userProfile.username} has been recruited to the team!`);
      
      // Refresh team stats after recruiting
      const updatedMembers = await fetchTeamMembers();
      if (updatedMembers && updatedMembers.length > 0) {
        await fetchTeamStats(updatedMembers);
      }
    } catch (error) {
      console.error('Error recruiting member:', error);
      await alert('Error', 'Failed to recruit member. Please try again.');
    }
  };

  const removeMember = async (memberId: string, username: string) => {
    const confirmed = await confirm(
      'Remove Team Member',
      `Are you sure you want to remove ${username} from the team?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      await fetchTeamMembers();
      await alert('Success', `${username} has been removed from the team.`);
      
      // Refresh team stats after removing member
      const updatedMembers = await fetchTeamMembers();
      if (updatedMembers && updatedMembers.length > 0) {
        await fetchTeamStats(updatedMembers);
      } else {
        // No members left, clear stats
        setTeamStats({
          totalMatches: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          totalPoints: 0,
          avgPointsPerMatch: 0,
          tournamentsPlayed: 0
        });
      }
    } catch (error) {
      console.error('Error removing member:', error);
      await alert('Error', 'Failed to remove member. Please try again.');
    }
  };

  const leaveTeam = async () => {
    const confirmed = await confirm(
      'Leave Team',
      'Are you sure you want to leave this team? If you are the leader, the team will be disbanded.'
    );

    if (!confirmed) return;

    try {
      if (myTeam && user?.id === myTeam.leader_id) {
        // Delete entire team if leader leaves
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', myTeam.id);

        if (error) throw error;
        await alert('Success', 'Team disbanded successfully.');
      } else {
        // Remove member
        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('user_id', user?.id);

        if (error) throw error;
        await alert('Success', 'You have left the team.');
      }

      setMyTeam(null);
      setTeamMembers([]);
      setTeamStats(null);
      setCurrentView('teams');
      await fetchTeams();
    } catch (error) {
      console.error('Error leaving team:', error);
      await alert('Error', 'Failed to leave team. Please try again.');
    }
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.tag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If viewing team details, show that component
  if (viewingTeam) {
    return (
      <TeamDetails
        teamId={viewingTeam}
        onBack={() => setViewingTeam(null)}
      />
    );
  }

  if (!user || user.id.startsWith('guest-')) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={32} className="text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Login Required</h2>
          <p className="text-slate-400">
            Please log in to access team management features.
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
          <p className="text-slate-400">Loading teams...</p>
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
            <Users size={40} className="mr-4 text-cyan-400" />
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Team Manager
            </span>
          </h1>
          <p className="text-slate-400 text-lg">Create teams, recruit members, and compete together</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-4 sm:space-x-8 border-b border-slate-700 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'teams', label: 'All Teams', icon: <Users size={16} /> },
            { id: 'my-team', label: 'My Team', icon: <Crown size={16} /> },
            { id: 'create', label: 'Create Team', icon: <Plus size={16} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentView(tab.id as any)}
              className={`relative pb-2 text-sm font-medium transition-colors group flex items-center whitespace-nowrap ${
                currentView === tab.id ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-300'
              }`}
            >
              {tab.icon}
              <span className="ml-1 sm:ml-2 hidden sm:inline">{tab.label}</span>
              <span className="ml-1 sm:hidden">
                {tab.id === 'teams' ? 'Teams' : tab.id === 'my-team' ? 'My' : 'Create'}
              </span>
              <span
                className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500
                ${currentView === tab.id ? 'w-full' : 'w-0 group-hover:w-full'}`}
              />
            </button>
          ))}
        </div>

        {/* All Teams View */}
        {currentView === 'teams' && (
          <div className="space-y-6">
            {/* Search */}
            <div className="bg-slate-900/50 border border-cyan-500/30 rounded-none backdrop-blur-sm p-6">
              <div className="relative w-full max-w-md">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search teams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-cyan-500/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Teams Grid */}
            {filteredTeams.length === 0 ? (
              <div className="group relative border border-slate-700 bg-slate-900/40 p-12 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] text-center">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users size={32} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Teams Found</h3>
                <p className="text-slate-400">
                  {teams.length === 0 ? 'No teams have been created yet' : 'No teams match your search'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTeams.map((team) => (
                  <div 
                    key={team.id} 
                    onClick={() => setViewingTeam(team.id)}
                    className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                                                transition-all duration-300 hover:border-cyan-400/70 
                                                hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] cursor-pointer">
                    <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                     w-0 transition-all duration-500 group-hover:w-full" />
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {team.tag}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">{team.name}</h3>
                          <p className="text-sm text-cyan-400">Tag: {team.tag}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">{team.member_count} members</div>
                        <div className="text-xs text-slate-500">Leader: {team.leader_username}</div>
                      </div>
                    </div>

                    {team.description && (
                      <p className="text-slate-400 text-sm mb-4">{team.description}</p>
                    )}

                    <div className="text-xs text-slate-500">
                      Created: {new Date(team.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Team View */}
        {currentView === 'my-team' && (
          <div className="space-y-8">
            {!myTeam ? (
              <div className="group relative border border-slate-700 bg-slate-900/40 p-12 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] text-center">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users size={32} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Team</h3>
                <p className="text-slate-400 mb-6">You're not currently a member of any team.</p>
                <button
                  onClick={() => setCurrentView('create')}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200"
                >
                  Create a Team
                </button>
              </div>
            ) : (
              <>
                {/* Team Header */}
                <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                               transition-all duration-300 hover:border-cyan-400/70 
                               hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                  <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                   w-0 transition-all duration-500 group-hover:w-full" />
                  
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                        {myTeam.tag}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">{myTeam.name}</h2>
                        <p className="text-cyan-400">Tag: {myTeam.tag}</p>
                        {myTeam.description && (
                          <p className="text-slate-400 mt-1">{myTeam.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {user?.id === myTeam.leader_id && (
                        <button
                          onClick={() => {
                            setShowRecruitModal(true);
                            fetchAvailableUsers();
                          }}
                          className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all duration-200 flex items-center space-x-2"
                        >
                          <UserPlus size={16} />
                          <span>Recruit</span>
                        </button>
                      )}
                      <button
                        onClick={leaveTeam}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <UserMinus size={16} />
                        <span>{user?.id === myTeam.leader_id ? 'Disband' : 'Leave'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Team Stats */}
                {teamStats && (
                  <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                                 transition-all duration-300 hover:border-cyan-400/70 
                                 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                    <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                     w-0 transition-all duration-500 group-hover:w-full" />
                    
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-white flex items-center">
                        <BarChart3 size={20} className="mr-2 text-cyan-400" />
                        Team Performance
                      </h3>
                      <select
                        value={selectedTournament}
                        onChange={(e) => setSelectedTournament(e.target.value)}
                        className="bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="all">All Tournaments</option>
                        {tournaments.map(tournament => (
                          <option key={tournament.id} value={tournament.id}>
                            {tournament.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-cyan-400">{teamStats.totalMatches}</div>
                        <div className="text-sm text-slate-400">Total Matches</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-400">{teamStats.winRate.toFixed(1)}%</div>
                        <div className="text-sm text-slate-400">Win Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-400">{teamStats.totalPoints}</div>
                        <div className="text-sm text-slate-400">Total Points</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-orange-400">{teamStats.tournamentsPlayed}</div>
                        <div className="text-sm text-slate-400">Tournaments</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Team Members */}
                <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                               transition-all duration-300 hover:border-cyan-400/70 
                               hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                  <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                   w-0 transition-all duration-500 group-hover:w-full" />
                  
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <Users size={20} className="mr-2 text-cyan-400" />
                    Team Members ({teamMembers.length})
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4 flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                            {member.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-white">{myTeam.tag} {member.username}</div>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                member.role === 'leader' 
                                  ? 'bg-yellow-500/20 text-yellow-400' 
                                  : 'bg-cyan-500/20 text-cyan-400'
                              }`}>
                                {member.role === 'leader' ? 'Leader' : 'Member'}
                              </span>
                              <span className="text-xs text-slate-500">
                                Joined: {new Date(member.joined_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {user?.id === myTeam.leader_id && member.role !== 'leader' && (
                          <button
                            onClick={() => removeMember(member.id, member.username)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <UserMinus size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Create Team View */}
        {currentView === 'create' && (
          <div className="max-w-2xl mx-auto">
            {myTeam ? (
              <div className="group relative border border-slate-700 bg-slate-900/40 p-12 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] text-center">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Crown size={32} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Already in Team</h3>
                <p className="text-slate-400 mb-6">You're already a member of {myTeam.name}.</p>
                <button
                  onClick={() => setCurrentView('my-team')}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200"
                >
                  View My Team
                </button>
              </div>
            ) : (
              <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                  <Plus size={24} className="mr-2 text-cyan-400" />
                  Create New Team
                </h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">
                      Team Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter team name"
                      className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">
                      Team Tag * (Max 10 characters)
                    </label>
                    <input
                      type="text"
                      value={formData.tag}
                      onChange={(e) => setFormData({ ...formData, tag: e.target.value.slice(0, 10) })}
                      placeholder="e.g., Z-Axis, OBC, etc."
                      className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      This will appear before your name in tournaments: {formData.tag} {user?.username}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Team description, goals, or motto..."
                      rows={3}
                      className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setFormData({ name: '', tag: '', description: '' });
                        setCurrentView('teams');
                      }}
                      className="px-6 py-3 bg-slate-800 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createTeam}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 flex items-center space-x-2"
                    >
                      <Save size={16} />
                      <span>Create Team</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recruit Member Modal */}
        {showRecruitModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-950 border border-cyan-500/30 rounded-xl shadow-[0_0_40px_rgba(0,200,255,0.3)] max-w-md w-full">
              <div className="bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-4 text-white">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">Recruit Team Member</h3>
                  <button
                    onClick={() => {
                      setShowRecruitModal(false);
                      setRecruitUsername('');
                    }}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-cyan-400 mb-2">
                    Username to Recruit
                  </label>
                  <input
                    type="text"
                    value={recruitUsername}
                    onChange={(e) => setRecruitUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowRecruitModal(false);
                      setRecruitUsername('');
                    }}
                    className="px-4 py-2 bg-slate-800 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={recruitMember}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all duration-200"
                  >
                    Recruit
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