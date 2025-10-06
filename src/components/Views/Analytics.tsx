import React, { useState } from 'react';
import { BarChart3, Trophy, Users, User, Database } from 'lucide-react';
import { OverviewTab } from './Analytics/OverviewTab';
import { MetaAnalysisTab } from './Analytics/MetaAnalysisTab';
import { TournamentAnalysisTab } from './Analytics/TournamentAnalysisTab';
import { CommunityAnalyticsTab } from './Analytics/CommunityAnalyticsTab';
import { useAuth } from '../../context/AuthContext';

export function Analytics() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<'overview' | 'meta' | 'tournament' | 'community'>('overview');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleTabChange = (tab: 'overview' | 'meta' | 'tournament' | 'community') => {
    if (tab === currentTab) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentTab(tab);
      setIsTransitioning(false);
    }, 150);
  };

  if (isTransitioning) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Processing analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-[1800px] mx-auto px-8 pt-28 pb-6">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold flex items-center mb-4">
            <BarChart3 size={32} className="mr-3 text-cyan-400" />
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Tournament Analytics
            </span>
          </h1>
          <p className="text-slate-400 text-lg">
            Analysis of tournament data and player performance
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 sm:space-x-8 border-b border-slate-700 mb-4 overflow-x-auto pb-2">
            {[
              { id: 'overview', label: 'Overview', icon: <Trophy size={16} /> },
              { id: 'meta', label: 'Meta Analysis', icon: <BarChart3 size={16} /> },
              { id: 'tournament', label: 'Tournament Analysis', icon: <Database size={16} /> },
              { id: 'community', label: 'Community Analytics', icon: <Users size={16} /> },
            ].map((tab) => {
              const active = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as any)}
                  className={`relative pb-2 text-sm font-medium transition-colors group flex items-center whitespace-nowrap ${
                    active ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-300'
                  }`}
                >
                  {tab.icon}
                  <span className="ml-2 hidden sm:inline">{tab.label}</span>
                  <span className="ml-2 sm:hidden">{tab.label.split(' ')[0]}</span>
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-500
                    ${active ? 'w-full' : 'w-0 group-hover:w-full'}`}
                  />
                </button>
              );
            })}
        </div>

        {/* Tab Content */}
        <div>
          {currentTab === 'overview' && <OverviewTab />}
          {currentTab === 'meta' && <MetaAnalysisTab />}
          {currentTab === 'tournament' && <TournamentAnalysisTab />}
          {currentTab === 'community' && <CommunityAnalyticsTab />}
        </div>
      </div>
    </div>
  );
}
