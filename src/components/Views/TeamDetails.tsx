import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, Crown, Calendar, BarChart3, UserPlus, UserMinus, Trophy, Target, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';

interface TeamDetailsProps {
  teamId: string;
  onBack: () => void;
}

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

export function TeamDetails({ teamId, onBack }: TeamDetailsProps) {
  const { user } = useAuth();
  const { confirm, alert } = useConfirmation();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<string>('all');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [showRecruitModal, setShowRecruitModal] = useState(false);
  const [recruitUsername, setRecruitUsername] = useState('');

  const isTeamLeader = user?.id === team?.leader_id;
  const isTeamMember = teamMembers.some(member => member.user_id === user?.id);

  useEffect(() => {
    fetchTeamDetails();
    fetchTournaments();
  }, [teamId]);

  useEffect(() => {
    if (team && teamMembers.length > 0) {
      fetchTeamStats();
    }
  }, [team, teamMembers, selectedTournament]);

  const fetchTeamDetails = async () => {
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('teams_with_members')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      // Fetch team members
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select(`
          *,
          profiles!inner(username)
        `)
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;
      
      const members = (membersData || []).map(member => ({
        id: member.id,
        team_id: member.team_id,
        user_id: member.user_id,
        username: member.profiles.username,
        role: member.role,
        joined_at: member.joined_at
      }));
      
      setTeamMembers(members);
    } catch (error) {
      console.error('Error fetching team details:', error);
    } finally {
      setLoading(false);
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

  const fetchTeamStats = async () => {
    if (!team || teamMembers.length === 0) return;
    
    try {
      const memberUsernames = teamMembers.map(m => m.username);

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

  const recruitMember = async () => {
    if (!recruitUsername.trim()) {
      await alert('Missing Information', 'Please enter a username to recruit.');
      return;
    }

    try {
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', recruitUsername.trim())
        .single();

      if (userError || !userProfile) {
        await alert('User Not Found', 'No user found with that username.');
        return;
      }

      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', userProfile.id)
        .single();

      if (existingMember) {
        await alert('Already in Team', 'This user is already a member of a team.');
        return;
      }

      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: team?.id,
          user_id: userProfile.id,
          role: 'member'
        });

      if (error) throw error;

      await fetchTeamDetails();
      setShowRecruitModal(false);
      setRecruitUsername('');
      await alert('Success', `${userProfile.username} has been recruited to the team!`);
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

      await fetchTeamDetails();
      await alert('Success', `${username} has been removed from the team.`);
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
      if (team && user?.id === team.leader_id) {
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', team.id);

        if (error) throw error;
        await alert('Success', 'Team disbanded successfully.');
      } else {
        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('user_id', user?.id);

        if (error) throw error;
        await alert('Success', 'You have left the team.');
      }

      onBack();
    } catch (error) {
      console.error('Error leaving team:', error);
      await alert('Error', 'Failed to leave team. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading team details...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={32} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Team Not Found</h2>
          <p className="text-slate-400 mb-6">The requested team could not be found.</p>
          <button
            onClick={onBack}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200"
          >
            Back to Teams
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
            className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Teams</span>
          </button>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                {team.tag}
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">{team.name}</h1>
                <div className="flex items-center space-x-4 text-slate-400">
                  <span className="text-cyan-400">Tag: {team.tag}</span>
                  <span>{team.member_count} members</span>
                  <span>Leader: {team.leader_username}</span>
                </div>
                {team.description && (
                  <p className="text-slate-300 mt-2">{team.description}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {isTeamLeader && (
                <button
                  onClick={() => setShowRecruitModal(true)}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all duration-200 flex items-center space-x-2"
                >
                  <UserPlus size={16} />
                  <span>Recruit Member</span>
                </button>
              )}
              {isTeamMember && (
                <button
                  onClick={leaveTeam}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <UserMinus size={16} />
                  <span>{isTeamLeader ? 'Disband Team' : 'Leave Team'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Team Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Team Stats */}
            {teamStats && (
              <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                             transition-all duration-300 hover:border-cyan-400/70 
                             hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                                 w-0 transition-all duration-500 group-hover:w-full" />
                
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center">
                    <BarChart3 size={24} className="mr-2 text-cyan-400" />
                    Team Performance
                  </h2>
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
                  <div className="text-center p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-none">
                    <div className="text-3xl font-bold text-cyan-400">{teamStats.totalMatches}</div>
                    <div className="text-sm text-slate-400">Total Matches</div>
                  </div>
                  <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-none">
                    <div className="text-3xl font-bold text-green-400">{teamStats.winRate.toFixed(1)}%</div>
                    <div className="text-sm text-slate-400">Win Rate</div>
                  </div>
                  <div className="text-center p-4 bg-purple-500/10 border border-purple-500/20 rounded-none">
                    <div className="text-3xl font-bold text-purple-400">{teamStats.totalPoints}</div>
                    <div className="text-sm text-slate-400">Total Points</div>
                  </div>
                  <div className="text-center p-4 bg-orange-500/10 border border-orange-500/20 rounded-none">
                    <div className="text-3xl font-bold text-orange-400">{teamStats.tournamentsPlayed}</div>
                    <div className="text-sm text-slate-400">Tournaments</div>
                  </div>
                </div>
              </div>
            )}

            {/* Team Information */}
            <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                           transition-all duration-300 hover:border-cyan-400/70 
                           hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <Trophy size={24} className="mr-2 text-cyan-400" />
                Team Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center text-slate-300">
                    <Users size={16} className="mr-3 text-cyan-400" />
                    <div>
                      <div className="font-medium">Team Name</div>
                      <div className="text-sm text-slate-400">{team.name}</div>
                    </div>
                  </div>

                  <div className="flex items-center text-slate-300">
                    <Crown size={16} className="mr-3 text-cyan-400" />
                    <div>
                      <div className="font-medium">Team Tag</div>
                      <div className="text-sm text-slate-400">{team.tag}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center text-slate-300">
                    <Crown size={16} className="mr-3 text-cyan-400" />
                    <div>
                      <div className="font-medium">Team Leader</div>
                      <div className="text-sm text-slate-400">{team.leader_username}</div>
                    </div>
                  </div>

                  <div className="flex items-center text-slate-300">
                    <Calendar size={16} className="mr-3 text-cyan-400" />
                    <div>
                      <div className="font-medium">Created</div>
                      <div className="text-sm text-slate-400">
                        {new Date(team.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Team Members Sidebar */}
          <div className="lg:col-span-1">
            <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                           transition-all duration-300 hover:border-cyan-400/70 
                           hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                               w-0 transition-all duration-500 group-hover:w-full" />
              
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <Users size={24} className="mr-2 text-cyan-400" />
                Team Members ({teamMembers.length})
              </h2>

              <div className="space-y-4">
                {teamMembers.map((member) => (
                  <div key={member.id} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-white">{team.tag} {member.username}</div>
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
                    
                    {isTeamLeader && member.role !== 'leader' && (
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
          </div>
        </div>

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