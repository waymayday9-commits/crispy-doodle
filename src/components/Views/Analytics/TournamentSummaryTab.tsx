import React, { useState, useEffect } from 'react';
import { Award, Trophy, Crown, Medal, Star, Target, Calendar, BarChart3, Clock, Zap, Users, Activity } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';

interface TournamentSummaryTabProps {
  tournamentId: string;
  loading?: boolean;
}

interface AwardData {
  id: string;
  award_name: string;
  player_name: string;
  icon_type: string;
  icon_url: string | null;
  icon_data: any;
  award_tag?: string;
}

interface TournamentStats {
  totalMatches: number;
  totalPlayers: number;
  totalPoints: number;
  avgPointsPerMatch: number;
  mostCommonFinish: { type: string; percentage: number };
  fastestFinish: { type: string; avgPoints: number };
  mostUsedBladeLine: string;
  mostUsedBeyblade: string;
}

const FINISH_COLORS = {
  'Spin Finish': '#10B981',
  'Burst Finish': '#F59E0B',
  'Over Finish': '#EF4444',
  'Extreme Finish': '#8B5CF6'
};

const PREDEFINED_ICONS = [
  { name: "Trophy", icon: Trophy, color: "text-yellow-500" },
  { name: "Crown", icon: Crown, color: "text-yellow-400" },
  { name: "Medal", icon: Medal, color: "text-orange-500" },
  { name: "Star", icon: Star, color: "text-purple-500" },
  { name: "Award", icon: Award, color: "text-blue-500" },
  { name: "Target", icon: Target, color: "text-green-500" },
];

const getIconComponent = (iconData: any) => {
  if (!iconData?.name) return Award;
  return PREDEFINED_ICONS.find(i => i.name === iconData.name)?.icon || Award;
};

export function TournamentSummaryTab({ tournamentId, loading = false }: TournamentSummaryTabProps) {
  const [awards, setAwards] = useState<AwardData[]>([]);
  const [tournamentStats, setTournamentStats] = useState<TournamentStats | null>(null);
  const [finishDistribution, setFinishDistribution] = useState<any[]>([]);
  const [matchFormatBreakdown, setMatchFormatBreakdown] = useState<any[]>([]);
  const [officerDistribution, setOfficerDistribution] = useState<any[]>([]);
  const [submissionTimeline, setSubmissionTimeline] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentSummary();
    }
  }, [tournamentId]);

  const fetchTournamentSummary = async () => {
    try {
      setIsLoading(true);

      // Fetch awards
      const { data: awardsData } = await supabase
        .from('tournament_awards')
        .select('*')
        .eq('tournament_id', tournamentId);
      setAwards(awardsData || []);

      // Fetch matches for analysis
      const { data: matches, error } = await supabase
        .from('match_results')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (error) throw error;
      const allMatches = matches || [];

      if (allMatches.length === 0) {
        setIsLoading(false);
        return;
      }

      // --- stats calculation (unchanged) ---
      const uniquePlayers = new Set();
      let totalPoints = 0;
      const finishCounts: { [key: string]: number } = {};
      const finishPoints: { [key: string]: number[] } = {};
      const bladeLineCounts: { [key: string]: number } = {};
      const beybladeCounts: { [key: string]: number } = {};
      const formatCounts: { [key: string]: number } = {};
      const officerCounts: { [key: string]: number } = {};
      const submissionsByHour: { [key: string]: number } = {};

      allMatches.forEach(match => {
        uniquePlayers.add(match.player1_name);
        uniquePlayers.add(match.player2_name);

        const points = match.points_awarded || 0;
        totalPoints += points;

        const outcome = match.outcome?.split(' (')[0] || 'Unknown';
        finishCounts[outcome] = (finishCounts[outcome] || 0) + 1;

        if (!finishPoints[outcome]) finishPoints[outcome] = [];
        finishPoints[outcome].push(points);

        if (match.player1_blade_line) {
          bladeLineCounts[match.player1_blade_line] = (bladeLineCounts[match.player1_blade_line] || 0) + 1;
        }
        if (match.player2_blade_line) {
          bladeLineCounts[match.player2_blade_line] = (bladeLineCounts[match.player2_blade_line] || 0) + 1;
        }

        if (match.player1_beyblade) {
          beybladeCounts[match.player1_beyblade] = (beybladeCounts[match.player1_beyblade] || 0) + 1;
        }
        if (match.player2_beyblade) {
          beybladeCounts[match.player2_beyblade] = (beybladeCounts[match.player2_beyblade] || 0) + 1;
        }

        const phase = match.phase_number ? `Phase ${match.phase_number}` : 'Unknown Phase';
        formatCounts[phase] = (formatCounts[phase] || 0) + 1;

        if (match.tournament_officer) {
          officerCounts[match.tournament_officer] = (officerCounts[match.tournament_officer] || 0) + 1;
        }

        if (match.submitted_at) {
          const hour = new Date(match.submitted_at).getHours();
          const timeKey = `${hour}:00`;
          submissionsByHour[timeKey] = (submissionsByHour[timeKey] || 0) + 1;
        }
      });

      const mostCommonFinish = Object.entries(finishCounts).reduce((a, b) => a[1] > b[1] ? a : b);
      const fastestFinish = Object.entries(finishPoints).reduce((fastest, [finish, points]) => {
        const avgPoints = points.reduce((sum, p) => sum + p, 0) / points.length;
        return !fastest[1] || avgPoints > fastest[1] ? [finish, avgPoints] : fastest;
      }, ['', 0]);

      const mostUsedBladeLine = Object.entries(bladeLineCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0] || 'Unknown';
      const mostUsedBeyblade = Object.entries(beybladeCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0] || 'Unknown';

      setTournamentStats({
        totalMatches: allMatches.length,
        totalPlayers: uniquePlayers.size,
        totalPoints,
        avgPointsPerMatch: allMatches.length > 0 ? totalPoints / allMatches.length : 0,
        mostCommonFinish: {
          type: mostCommonFinish[0],
          percentage: (mostCommonFinish[1] / allMatches.length) * 100
        },
        fastestFinish: {
          type: fastestFinish[0],
          avgPoints: fastestFinish[1]
        },
        mostUsedBladeLine,
        mostUsedBeyblade
      });

      const finishData = Object.entries(finishCounts).map(([finish, count]) => ({
        name: finish,
        value: count,
        color: FINISH_COLORS[finish as keyof typeof FINISH_COLORS] || '#6B7280'
      }));
      setFinishDistribution(finishData);

      const formatData = Object.entries(formatCounts).map(([format, count]) => ({
        format,
        matches: count
      }));
      setMatchFormatBreakdown(formatData);

      const officerData = Object.entries(officerCounts).map(([officer, count]) => ({
        officer,
        matches: count
      }));
      setOfficerDistribution(officerData);

      const timelineData = Object.entries(submissionsByHour)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([time, count]) => ({
          time,
          matches: count
        }));
      setSubmissionTimeline(timelineData);

    } catch (error) {
      console.error('Error fetching tournament summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-400">Loading tournament summary...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hall of Fame */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center justify-center">
          <Trophy size={20} className="mr-2 text-yellow-400" />
          Hall of Fame
        </h2>

        {awards.length === 0 ? (
          <div className="border border-slate-700 bg-slate-900/40 p-6 text-center text-slate-400 rounded-none">
            Hall of Fame to be updated
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-6 w-full">
            {/* Row 1: Champion + Swiss King */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl">
              {["champion", "swiss_king"].map(tag => {
                const awardList = awards.filter(x => x.award_tag === tag);
                if (awardList.length === 0) return null;
                const isChampion = tag === "champion";
                return (
                  <div
                    key={tag}
                    className={`flex flex-col items-center justify-center border p-4 rounded-none ${
                      isChampion
                        ? "border-yellow-400 bg-yellow-900/30"
                        : "border-gray-400 bg-gray-800/40"
                    }`}
                  >
                    {/* Render icon + award name once */}
                    <div className="flex flex-col items-center mb-2">
                      {awardList[0].icon_type === "predefined" ? (
                        <Award
                          size={28}
                          className={isChampion ? "text-yellow-400 mb-1" : "text-gray-300 mb-1"}
                        />
                      ) : (
                        <img src={awardList[0].icon_url || ""} className="w-10 h-10 object-contain mb-1" />
                      )}
                      <div className={`font-bold ${isChampion ? "text-yellow-400 text-lg" : "text-gray-200"}`}>
                        {awardList[0].award_name}
                      </div>
                    </div>
                    
                    {/* Then list all players */}
                    <div className="space-y-1">
                      {awardList.map(a => (
                        <div key={a.id} className="text-sm text-slate-300 text-center">
                          {a.player_name}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Row 2: 2nd + 3rd Place */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
              {["second_place", "third_place"].map(tag => {
                const awardList = awards.filter(x => x.award_tag === tag);
                if (awardList.length === 0) return null;
                const isSecond = tag === "second_place";
                return (
                  <div
                    key={tag}
                    className={`flex flex-col items-center justify-center border p-4 rounded-none ${
                      isSecond
                        ? "border-orange-500 bg-orange-900/30"
                        : "border-blue-500 bg-blue-900/30"
                    }`}
                  >
                    {awardList.map(a => (
                      <div key={a.id} className="flex flex-col items-center mb-1">
                        {a.icon_type === "predefined" ? (
                          <Award size={24} className={isSecond ? "text-orange-400 mb-1" : "text-blue-400 mb-1"} />
                        ) : (
                          <img src={a.icon_url || ""} className="w-8 h-8 object-contain mb-1" />
                        )}
                        <div className="font-medium text-white">{a.award_name}</div>
                        <div className="text-sm text-slate-300">{a.player_name}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Row 3: 4th → 8th */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 w-full">
              {["fourth_place", "fifth_place", "sixth_place", "seventh_place", "eighth_place"]
                .map(tag => awards.filter(a => a.award_tag === tag))
                .flat()
                .map(a => (
                  <div
                    key={a.id}
                    className="flex flex-col items-center justify-center border border-slate-700 bg-slate-900/40 p-3 rounded-none"
                  >
                    {a.icon_type === "predefined" ? (
                      <Award size={20} className="text-slate-400 mb-1" />
                    ) : (
                      <img src={a.icon_url || ""} className="w-6 h-6 object-contain mb-1" />
                    )}
                    <div className="text-sm font-medium text-white text-center">{a.award_name}</div>
                    <div className="text-xs text-slate-400 text-center">{a.player_name}</div>
                  </div>
                ))}
            </div>

            {/* Row 4: Misc awards */}
            {awards.some(a => a.award_tag === "misc") && (
              <div className="w-full">
                <h3 className="text-base font-semibold text-slate-300 mb-3 text-center">
                  Miscellaneous Awards
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                  {awards
                    .filter(a => a.award_tag === "misc")
                    .map(a => (
                      <div
                        key={a.id}
                        className="flex flex-col items-center justify-center border border-slate-700 bg-slate-900/30 p-3 rounded-none"
                      >
                        {a.icon_type === "predefined" ? (
                          <Award size={20} className="text-slate-400 mb-1" />
                        ) : (
                          <img src={a.icon_url || ""} className="w-6 h-6 object-contain mb-1" />
                        )}
                        <div className="text-sm font-medium text-white text-center">{a.award_name}</div>
                        <div className="text-xs text-slate-400 text-center">{a.player_name}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tournament Overview Stats */}
      {tournamentStats && (
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <h2 className="text-xl font-bold text-white mb-6 flex items-center">
            <BarChart3 size={24} className="mr-2 text-cyan-400" />
            Tournament Overview
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-none">
              <div className="text-3xl font-bold text-cyan-400">{tournamentStats.totalMatches}</div>
              <div className="text-sm text-slate-400">Total Matches</div>
            </div>
            
            <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-none">
              <div className="text-3xl font-bold text-green-400">{tournamentStats.totalPlayers}</div>
              <div className="text-sm text-slate-400">Total Players</div>
            </div>
            
            <div className="text-center p-4 bg-purple-500/10 border border-purple-500/20 rounded-none">
              <div className="text-3xl font-bold text-purple-400">{tournamentStats.totalPoints}</div>
              <div className="text-sm text-slate-400">Total Points</div>
            </div>
            
            <div className="text-center p-4 bg-orange-500/10 border border-orange-500/20 rounded-none">
              <div className="text-3xl font-bold text-orange-400">{tournamentStats.avgPointsPerMatch.toFixed(1)}</div>
              <div className="text-sm text-slate-400">Avg Points/Match</div>
            </div>
          </div>

          {/* Key Insights */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-cyan-400 mb-3">Most Common Finish</h4>
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">{tournamentStats.mostCommonFinish.type}</span>
                <span className="text-cyan-400 font-bold">{tournamentStats.mostCommonFinish.percentage.toFixed(1)}%</span>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-cyan-400 mb-3">Fastest Finish (Avg Points)</h4>
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">{tournamentStats.fastestFinish.type}</span>
                <span className="text-purple-400 font-bold">{tournamentStats.fastestFinish.avgPoints.toFixed(1)} pts</span>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-cyan-400 mb-3">Most Used Blade Line</h4>
              <div className="text-white font-medium">{tournamentStats.mostUsedBladeLine}</div>
            </div>

            <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-cyan-400 mb-3">Most Used Beyblade</h4>
              <div className="text-white font-medium text-sm">{tournamentStats.mostUsedBeyblade}</div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Finish Distribution */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <h3 className="text-lg font-bold text-white mb-4">Finish Type Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={finishDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {finishDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid rgba(6, 182, 212, 0.3)', 
                  borderRadius: '8px' 
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Match Format Breakdown */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <h3 className="text-lg font-bold text-white mb-4">Match Format Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={matchFormatBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="format" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid rgba(6, 182, 212, 0.3)', 
                  borderRadius: '8px' 
                }}
                labelStyle={{ color: '#06b6d4' }}
              />
              <Bar dataKey="matches" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Officer Distribution & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Officer Match Distribution */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <h3 className="text-lg font-bold text-white mb-4">Officer Match Count</h3>
          {officerDistribution.length === 0 ? (
            <div className="text-center py-8">
              <Users size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-slate-400 text-sm">No officer data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={officerDistribution} margin={{ bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="officer" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  fontSize={10}
                  stroke="#94a3b8"
                />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid rgba(6, 182, 212, 0.3)', 
                    borderRadius: '8px' 
                  }}
                  labelStyle={{ color: '#06b6d4' }}
                />
                <Bar dataKey="matches" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Submission Timeline */}
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
          <h3 className="text-lg font-bold text-white mb-4">Match Submission Timeline</h3>
          {submissionTimeline.length === 0 ? (
            <div className="text-center py-8">
              <Clock size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-slate-400 text-sm">No timeline data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={submissionTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid rgba(6, 182, 212, 0.3)', 
                    borderRadius: '8px' 
                  }}
                  labelStyle={{ color: '#06b6d4' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="matches" 
                  stroke="#8B5CF6" 
                  strokeWidth={2}
                  dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}