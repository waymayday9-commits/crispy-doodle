import React from 'react';
import { Users, BarChart3, TrendingUp, Target } from 'lucide-react';

export function CommunityAnalyticsTab() {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">

        {/* Coming Soon Card */}
        <div className="max-w-4xl mx-auto">
          <div className="group relative border border-slate-700 bg-slate-900/40 p-12 rounded-none 
                         transition-all duration-300 hover:border-cyan-400/70 
                         hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] text-center">
            {/* Animated bottom underline */}
            <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                             w-0 transition-all duration-500 group-hover:w-full" />
            
            <div className="w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(16,185,129,0.5)]">
              <BarChart3 size={48} className="text-white" />
            </div>
            
            <h2 className="text-4xl font-bold text-green-400 mb-4">Community Analytics</h2>
            <div className="inline-block bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-2 rounded-none font-bold text-lg mb-6 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              COMING SOON
            </div>
            
            <p className="text-green-300 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
              Soon, every community will be able to track engagement, growth, and tournament participation. 
              Gain insights, compare statistics, and help your community thrive.
            </p>

            {/* Feature Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-slate-800/60 backdrop-blur-sm rounded-none p-6 border border-green-400/30">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <TrendingUp size={24} className="text-green-400" />
                </div>
                <h3 className="font-bold text-green-400 mb-2">Growth Metrics</h3>
                <p className="text-green-300 text-sm">Track new member growth and community activity trends</p>
              </div>
              
              <div className="bg-slate-800/60 backdrop-blur-sm rounded-none p-6 border border-green-400/30">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Target size={24} className="text-emerald-400" />
                </div>
                <h3 className="font-bold text-green-400 mb-2">Engagement Insights</h3>
                <p className="text-green-300 text-sm">Analyze posts, discussions, and tournament participation</p>
              </div>
              
              <div className="bg-slate-800/60 backdrop-blur-sm rounded-none p-6 border border-green-400/30">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users size={24} className="text-green-400" />
                </div>
                <h3 className="font-bold text-green-400 mb-2">Community Comparison</h3>
                <p className="text-green-300 text-sm">Compare stats across different communities for insights and growth opportunities</p>
              </div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-sm border border-green-400/30 rounded-none p-6 max-w-md mx-auto">
              <h4 className="font-bold text-green-400 mb-3">Planned Features:</h4>
              <div className="space-y-2 text-sm text-green-300 text-left">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                  Community growth tracking
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                  Engagement analytics and trends
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                  Community comparison and insights
                </div>
              </div>
            </div>

            <div className="mt-8 text-green-400 text-sm">
              Community analytics is coming soon — empowering every community to grow stronger!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
