import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Award, Trophy, Crown, Medal, Star, Target, Zap, Calendar, X } from 'lucide-react';

interface AwardsTabProps {
  awards: any[];
  onRefresh: () => void;
}

export function AwardsTab({ awards, onRefresh }: AwardsTabProps) {
  const [showcaseModalOpen, setShowcaseModalOpen] = useState(false);
  const [selectedShowcase, setSelectedShowcase] = useState<string[]>(
    awards.filter(a => a.showcase !== false).map(a => a.id)
  );

  const renderAwardIcon = (award: any, size: number = 24) => {
    if (award.icon_type === 'predefined' && award.icon_data) {
      const iconName = award.icon_data.name;
      const iconColor = award.icon_data.color || 'text-yellow-500';
      
      const IconComponent = {
        Trophy,
        Crown,
        Medal,
        Star,
        Award,
        Target,
        Zap
      }[iconName] || Trophy;
      
      return <IconComponent size={size} className={iconColor} />;
    } else if (award.icon_type === 'upload' && award.icon_url) {
      return (
        <img
          src={award.icon_url}
          alt={award.award_name}
          className="object-cover rounded"
          style={{ width: size, height: size }}
        />
      );
    }
    
    return <Trophy size={size} className="text-yellow-500" />;
  };

  if (awards.length === 0) {
    return (
      <div className="group relative border border-slate-700 bg-slate-900/40 p-12 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] text-center">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <div className="w-24 h-24 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(251,191,36,0.5)]">
          <Award size={48} className="text-white" />
        </div>
        
        <h2 className="text-4xl font-bold text-yellow-400 mb-4">No Awards Yet</h2>
        <p className="text-yellow-300 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
          Participate in tournaments and showcase your skills to earn awards and recognition from tournament organizers.
        </p>

        <div className="bg-slate-800/40 backdrop-blur-sm border border-yellow-400/30 rounded-none p-6 max-w-md mx-auto">
          <h4 className="font-bold text-yellow-400 mb-3">How to Earn Awards:</h4>
          <div className="space-y-2 text-sm text-yellow-300 text-left">
            <div className="flex items-center">
              <span className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></span>
              Win tournaments to earn Champion awards
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></span>
              Show exceptional performance for special recognition
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></span>
              Tournament organizers can create custom awards
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Awards Summary */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Award size={24} className="mr-2 text-yellow-400" />
            Your Awards Collection
          </h2>
          
          <div className="flex items-center space-x-3">
            <div className="text-sm text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full">
              {awards.length} award{awards.length !== 1 ? 's' : ''}
            </div>
            <button
              onClick={() => setShowcaseModalOpen(true)}
              className="px-3 py-1 text-xs rounded bg-cyan-600 text-white hover:bg-cyan-500 transition"
            >
              Manage Showcase
            </button>
          </div>
        </div>

        {/* Award Type Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { type: 'Champion', icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
            { type: 'Swiss', icon: Target, color: 'text-green-400', bg: 'bg-green-500/10' },
            { type: 'Best', icon: Star, color: 'text-purple-400', bg: 'bg-purple-500/10' },
            { type: 'Special', icon: Medal, color: 'text-orange-400', bg: 'bg-orange-500/10' }
          ].map(({ type, icon: IconComponent, color, bg }) => {
            const count = awards.filter(award => 
              award.award_name.toLowerCase().includes(type.toLowerCase())
            ).length;
            
            return (
              <div key={type} className={`text-center p-4 ${bg} border border-slate-700 rounded-none`}>
                <IconComponent size={24} className={`${color} mx-auto mb-2`} />
                <div className={`text-2xl font-bold ${color}`}>{count}</div>
                <div className="text-sm text-slate-400">{type} Awards</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trophy Shelf */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-6">Trophy Shelf</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {awards.map((award) => (
            <div key={award.id} className="bg-slate-800/50 border border-yellow-500/20 rounded-lg p-6 hover:border-yellow-400/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(251,191,36,0.2)]">
              {/* Award Header */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                  {renderAwardIcon(award, 32)}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-yellow-400">{award.award_name}</h4>
                  <p className="text-sm text-slate-400">
                    {award.tournaments?.name || 'Unknown Tournament'}
                  </p>
                </div>
              </div>

              {/* Award Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-slate-300">
                  <Calendar size={14} className="mr-2 text-yellow-400" />
                  <span>
                    {award.tournaments?.tournament_date 
                      ? new Date(award.tournaments.tournament_date).toLocaleDateString()
                      : 'Unknown Date'
                    }
                  </span>
                </div>
                
                <div className="flex items-center text-slate-300">
                  <Trophy size={14} className="mr-2 text-yellow-400" />
                  <span>
                    Awarded: {new Date(award.awarded_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Award Shine Effect */}
              <div className="mt-4 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Awards Timeline */}
      {/* <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-6">Awards Timeline</h3>

        <div className="space-y-4">
          {awards.map((award) => (
            <div key={award.id} className="flex items-center space-x-4 bg-slate-800/50 border border-yellow-500/20 rounded-lg p-4">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                {renderAwardIcon(award, 20)}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-yellow-400">{award.award_name}</h4>
                    <p className="text-sm text-slate-400">{award.tournaments?.name}</p>
                  </div>
                  <div className="text-right text-sm text-slate-400">
                    <div>{new Date(award.awarded_at).toLocaleDateString()}</div>
                    {award.tournaments?.tournament_date && (
                      <div className="text-xs">
                        Tournament: {new Date(award.tournaments.tournament_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div> */}

      {/* Showcase Modal */}
      {showcaseModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-lg p-6 w-full max-w-lg relative">
            <button
              onClick={() => setShowcaseModalOpen(false)}
              className="absolute top-2 right-2 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">Choose Awards to Showcase</h3>

            <div className="max-h-80 overflow-y-auto space-y-3">
              {awards.map((award) => (
                <label key={award.id} className="flex items-center space-x-3 p-2 bg-slate-800/40 rounded-lg">
                  <input
                    type="checkbox"
                    checked={selectedShowcase.includes(award.id)}
                    onChange={() => {
                      setSelectedShowcase((prev) =>
                        prev.includes(award.id)
                          ? prev.filter(id => id !== award.id)
                          : [...prev, award.id]
                      );
                    }}
                    className="form-checkbox h-4 w-4 text-cyan-500 rounded"
                  />
                  <div className="flex items-center space-x-2">
                    {renderAwardIcon(award, 20)}
                    <span className="text-sm text-white">{award.award_name}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setShowcaseModalOpen(false)}
                className="px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
onClick={async () => {
  try {
    const updates = awards.map(a => {
      const { tournaments, ...rest } = a; // remove join
      return {
        ...rest,
        showcase: selectedShowcase.includes(a.id)
      };
    });

    const { error } = await supabase
      .from('tournament_awards')
      .upsert(updates, { onConflict: 'id' });

    if (error) throw error;

    setShowcaseModalOpen(false);
    onRefresh?.();
  } catch (err) {
    console.error('Error updating showcase:', err);
  }
}}

                className="px-4 py-2 rounded bg-cyan-600 text-white hover:bg-cyan-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
