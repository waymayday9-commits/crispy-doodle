import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';

interface Tournament {
  id: string;
  name: string;
  tournament_date: string;
  location: string;
  current_participants: number;
  max_participants: number;
  status: string;
}

interface DashboardStats {
  totalTournaments: number;
  activePlayers: number;
  upcomingEvents: number;
  completedMatches: number;
}

interface TopPlayer {
  name: string;
  wins: number;
  tournaments: number;
  winRate: number;
}

interface DashboardProps {
  onViewChange?: (view: string) => void;
}

export function Dashboard({ onViewChange }: DashboardProps) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalTournaments: 0,
    activePlayers: 0,
    upcomingEvents: 0,
    completedMatches: 0,
  });
  const [upcomingTournaments, setUpcomingTournaments] = useState<Tournament[]>([]);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [selectedTournamentFilter, setSelectedTournamentFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll(
    containerRef.current
      ? {
          target: containerRef,
          offset: ['start start', 'end start'],
          layoutEffect: false,
        }
      : undefined
  );

  const heroY = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -100]);

  // Fetch top players
  const fetchTopPlayers = async () => {
    try {
      const { data: matches } = await supabase
        .from('match_results')
        .select('player1_name, player2_name, winner_name')
        .order('submitted_at', { ascending: false })
        .limit(1000);

      if (!matches) return;

      // Filter out practice tournament matches
      const filteredMatches = (matches || []).filter(match => 
        match.tournament_type !== 'practice'
      );

      const playerStats: { [key: string]: { wins: number; total: number; tournaments: Set<string> } } = {};
      filteredMatches.forEach((match) => {
        const { player1_name, player2_name, winner_name } = match;
        if (!playerStats[player1_name]) playerStats[player1_name] = { wins: 0, total: 0, tournaments: new Set() };
        if (!playerStats[player2_name]) playerStats[player2_name] = { wins: 0, total: 0, tournaments: new Set() };
        playerStats[player1_name].total++;
        playerStats[player2_name].total++;
        if (winner_name === player1_name) playerStats[player1_name].wins++;
        else if (winner_name === player2_name) playerStats[player2_name].wins++;
      });

      const playersArray = Object.entries(playerStats)
        .map(([name, stats]) => ({
          name,
          wins: stats.wins,
          tournaments: stats.tournaments.size,
          winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0,
        }))
        .filter((p) => p.wins > 0)
        .sort((a, b) => (b.wins !== a.wins ? b.wins - a.wins : b.winRate - a.winRate))
        .slice(0, 5);

      setTopPlayers(playersArray);
    } catch (err) {
      console.error('Error fetching top players:', err);
    }
  };

  // Fetch dashboard stats
  const fetchDashboardStats = async () => {
    try {
      const { data: tournaments } = await supabase.from('tournaments').select('*');
      const { data: matches } = await supabase.from('match_results').select('*');

      const uniquePlayers = new Set();
      matches?.forEach((match) => {
        if (match.player1_name) uniquePlayers.add(match.player1_name);
        if (match.player2_name) uniquePlayers.add(match.player2_name);
      });

      const now = new Date();
      const upcoming = tournaments?.filter((t) => new Date(t.tournament_date) > now && t.status !== 'completed') || [];

      setStats({
        totalTournaments: tournaments?.length || 0,
        activePlayers: uniquePlayers.size,
        upcomingEvents: upcoming.length,
        completedMatches: matches?.length || 0,
      });

      setUpcomingTournaments(upcoming.slice(0, 3));
      setAllTournaments(tournaments || []);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch live matches
  const fetchRecentMatches = async () => {
    try {
      let query = supabase
        .from('match_results')
        .select(`
          *,
          tournaments!inner(name)
        `)
        .order('submitted_at', { ascending: false });

      if (selectedTournamentFilter !== 'all') {
        query = query.eq('tournament_id', selectedTournamentFilter);
      }

      const { data: matches } = await query.limit(20);
      setRecentMatches(matches || []);
    } catch (err) {
      console.error('Error fetching matches:', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDashboardStats(), fetchTopPlayers(), fetchRecentMatches()]);
      setLoading(false);
    };
    loadData();
  }, [user]);

  useEffect(() => {
    fetchRecentMatches();
  }, [selectedTournamentFilter]);

  useEffect(() => {
    if (topPlayers.length > 1) {
      const interval = setInterval(() => {
        setCurrentPlayerIndex((prev) => (prev + 1) % topPlayers.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [topPlayers]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-white text-lg font-semibold animate-pulse">Loading Portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden relative">
      {/* Hero Section with Community Image */}
      <motion.section
        ref={containerRef}
        style={{ opacity: heroOpacity }}
        className="relative h-screen flex items-center justify-center overflow-hidden"
      >
        {/* Fixed Background Image */}
        <div className="absolute inset-0">
          <img
            src="/community.jpg"
            alt="Ormoc Beyblade Community"
            className="w-full h-full object-cover fixed inset-0"
          />
          <div className="absolute inset-0 bg-black/60"></div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:60px_60px] opacity-20" />
        </div>

        {/* Hero Content */}
        <motion.div
          className="relative z-10 text-center px-6 max-w-5xl mx-auto"
          style={{ y: heroY }}
        >
          <h1
            className="text-5xl md:text-6xl font-exo2 uppercase tracking-wide"
            style={{ fontWeight: 800 }}
          >
            <span className="bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Ormoc Beyblade Club
            </span>
          </h1>
          <p className="mt-4 text-lg md:text-xl text-slate-200 font-exo2 font-medium">
            Fight. Conquer. Win.
          </p>
<div className="mt-10 flex flex-col sm:flex-row gap-6 justify-center">
  <button
    onClick={() => onViewChange?.('tournaments')}
    className="relative px-10 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold uppercase tracking-wider hover:shadow-[0_0_20px_rgba(0,200,255,0.7)] transition overflow-hidden group"
  >
    Tournaments
    <span className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.2),transparent)] translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
  </button>

  <button
    onClick={() => onViewChange?.('analytics')}
    className="px-10 py-4 border border-slate-600 text-white font-bold uppercase tracking-wider hover:bg-slate-800 transition"
  >
    Analytics
  </button>

  <button
    onClick={() => onViewChange?.('personal-stats')}
    className="px-10 py-4 border border-green-600 text-white font-bold uppercase tracking-wider hover:bg-green-800 transition"
  >
    Personal Stats
  </button>
</div>
        </motion.div>
      </motion.section>

      {/* Stats Section (slight overlap so no gap appears) */}
      <motion.div style={{ y: contentY }} className="relative z-20 -mt-20">
        <section className="mt-20 border-y border-slate-800 bg-slate-950">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-800">
            {[
              { label: 'Tournaments', value: stats.totalTournaments },
              { label: 'Active Players', value: stats.activePlayers },
              { label: 'Upcoming', value: stats.upcomingEvents },
              { label: 'Matches', value: stats.completedMatches },
            ].map((stat) => (
              <div key={stat.label} className="py-14 text-center">
                <div className="text-5xl font-extrabold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="mt-2 text-sm uppercase tracking-wide text-slate-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Access Hub */}
        <section className="py-24 bg-slate-900/90 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                title: 'Tournament Hub',
                desc: 'Register and track upcoming tournaments.',
                color: 'from-cyan-500 to-purple-500',
                action: () => onViewChange?.('tournaments'),
              },
              {
                title: 'Analytics',
                desc: 'View stats and performance trends.',
                color: 'from-purple-500 to-pink-500',
                action: () => onViewChange?.('analytics'),
              },
              {
                title: 'Deck Builder',
                desc: 'Build and save your best Beyblade combinations.',
                color: 'from-orange-500 to-red-500',
                action: () => onViewChange?.('inventory'),
              },
            ].map((item) => (
              <div
                key={item.title}
                onClick={item.action}
                className="p-8 bg-slate-950 border border-slate-800 hover:shadow-[0_0_30px_rgba(0,200,255,0.2)] cursor-pointer transition relative group"
              >
                <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                <p className="text-slate-400 mb-6">{item.desc}</p>
                <span
                  className={`uppercase font-semibold bg-gradient-to-r ${item.color} bg-clip-text text-transparent`}
                >
                  Explore →
                </span>
                <div
                  className={`absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r ${item.color} group-hover:w-full transition-all duration-500`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Community Champions */}
        <section className="py-24 relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <h2 className="text-5xl font-extrabold text-center mb-16 uppercase tracking-tight">
              <span className="bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Community Champions
              </span>
            </h2>

            {topPlayers.length > 0 && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPlayerIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="text-center border border-cyan-500/30 bg-slate-950/70 backdrop-blur-xl rounded-md p-12 shadow-[0_0_40px_rgba(0,200,255,0.15)]"
                >
                  {/* Glowing orb avatar */}
                  <div className="flex items-center justify-center mb-10">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 flex items-center justify-center text-6xl font-bold text-white shadow-[0_0_30px_rgba(0,200,255,0.6)] animate-pulse">
                        {topPlayers[currentPlayerIndex]?.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute inset-0 rounded-full border-4 border-cyan-400/40 animate-spin-slow"></div>
                    </div>
                  </div>

                  <h3 className="text-3xl font-bold mb-3 text-white">
                    {topPlayers[currentPlayerIndex]?.name}
                  </h3>
                  <p className="text-cyan-400 font-semibold uppercase tracking-wide mb-10">
                    Champion Blader
                  </p>

                  <div className="grid grid-cols-3 gap-10 max-w-xl mx-auto">
                    <div>
                      <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        {topPlayers[currentPlayerIndex]?.wins}
                      </div>
                      <div className="text-slate-400 mt-2 text-sm uppercase">Wins</div>
                    </div>
                    <div>
                      <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        {topPlayers[currentPlayerIndex]?.tournaments}
                      </div>
                      <div className="text-slate-400 mt-2 text-sm uppercase">Tournaments</div>
                    </div>
                    <div>
                      <div className="text-4xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
                        {topPlayers[currentPlayerIndex]?.winRate}%
                      </div>
                      <div className="text-slate-400 mt-2 text-sm uppercase">Win Rate</div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}

            {topPlayers.length > 1 && (
              <div className="flex justify-center space-x-3 mt-10">
                {topPlayers.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPlayerIndex(index)}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      index === currentPlayerIndex
                        ? 'bg-cyan-400 scale-125 shadow-[0_0_10px_rgba(0,200,255,0.8)]'
                        : 'bg-slate-600 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </motion.div>
      
      {/* Live Match Feed */}
      <section className="py-24 bg-slate-900/80 backdrop-blur-sm relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12">
            <h2 className="text-4xl font-extrabold uppercase tracking-tight mb-6 md:mb-0">
              <span className="bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Live Match Feed
              </span>
            </h2>
            <div className="flex items-center gap-4">
              <select
                value={selectedTournamentFilter}
                onChange={(e) => setSelectedTournamentFilter(e.target.value)}
                className="bg-slate-950/80 border border-slate-700 text-white px-4 py-2 text-sm rounded-md focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">All Tournaments</option>
                {allTournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center space-x-2 bg-green-500/20 border border-green-500/30 rounded-lg px-3 py-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-medium">LIVE</span>
              </div>
            </div>
          </div>

          {recentMatches.length > 0 ? (
            <div className="overflow-x-auto border border-slate-800 rounded-md">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Tournament</th>
                    <th className="px-4 py-3">Player 1</th>
                    <th className="px-4 py-3">Player 1 Beyblade</th>
                    <th className="px-4 py-3">Player 2</th>
                    <th className="px-4 py-3">Player 2 Beyblade</th>
                    <th className="px-4 py-3">Winner</th>
                    <th className="px-4 py-3">Finish</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMatches.map((match) => (
                    <tr
                      key={match.id}
                      className="border-b border-slate-800 hover:bg-slate-900/60 transition"
                    >
                      <td className="px-4 py-3">
                        {new Date(match.submitted_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{match.tournaments?.name}</td>

                      {/* Player 1 + Beyblade */}
                      <td
                        className={`px-4 py-3 ${
                          match.winner_name === match.player1_name
                            ? 'text-cyan-400 font-semibold'
                            : ''
                        }`}
                      >
                        {match.player1_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {match.player1_beyblade || 'Unknown'}
                      </td>

                      {/* Player 2 + Beyblade */}
                      <td
                        className={`px-4 py-3 ${
                          match.winner_name === match.player2_name
                            ? 'text-cyan-400 font-semibold'
                            : ''
                        }`}
                      >
                        {match.player2_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {match.player2_beyblade || 'Unknown'}
                      </td>

                      {/* Winner + Finish */}
                      <td className="px-4 py-3 text-cyan-300 font-bold">
                        {match.winner_name}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {match.outcome?.split(' (')[0] || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-400">No matches available yet.</p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-800 bg-slate-950 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} Ormoc Beyblade Club. All rights reserved.</p>
      </footer>

      {/* Sidebar */}
      {isSidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        </>
      )}
    </div>
  );
}