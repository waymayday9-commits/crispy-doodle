import React, { useState } from 'react';
import { User, Users, Globe, Lock, Calendar, MapPin, Shield, Type, FileText } from 'lucide-react';
import { TournamentFormData } from './TournamentWizard';
import ReactQuill from 'react-quill';

interface BasicInformationStepProps {
  formData: TournamentFormData;
  updateFormData: (updates: Partial<TournamentFormData>) => void;
  userCommunities: any[];
}

export function BasicInformationStep({ formData, updateFormData, userCommunities }: BasicInformationStepProps) {
  const [showRichEditor, setShowRichEditor] = useState(false);

  const generateCustomUrl = (name: string) => {
    const url = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    updateFormData({ customUrl: url });
  };

  return (
    <div className="space-y-6">
      {/* Host Options */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Users size={20} className="mr-2 text-cyan-400" />
          Host Options
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center space-x-3 p-4 border border-slate-600 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors">
            <input
              type="radio"
              name="hostType"
              value="individual"
              checked={formData.hostType === 'individual'}
              onChange={(e) => updateFormData({ hostType: e.target.value as 'individual' })}
              className="w-4 h-4 text-cyan-600"
            />
            <div>
              <div className="font-medium text-white flex items-center">
                <User size={16} className="mr-2 text-blue-400" />
                Host as Individual
              </div>
              <div className="text-sm text-slate-400">You will be the tournament organizer</div>
            </div>
          </label>
          
          <label className="flex items-center space-x-3 p-4 border border-slate-600 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors">
            <input
              type="radio"
              name="hostType"
              value="community"
              checked={formData.hostType === 'community'}
              onChange={(e) => updateFormData({ hostType: e.target.value as 'community' })}
              className="w-4 h-4 text-cyan-600"
              disabled={userCommunities.length === 0}
            />
            <div>
              <div className="font-medium text-white flex items-center">
                <Users size={16} className="mr-2 text-pink-400" />
                Host as Community
              </div>
              <div className="text-sm text-slate-400">
                {userCommunities.length === 0 ? 'No communities available' : 'Host on behalf of your community'}
              </div>
            </div>
          </label>
        </div>

        {formData.hostType === 'community' && userCommunities.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-cyan-400 mb-2">
              Select Community *
            </label>
            <select
              value={formData.hostCommunityId || ''}
              onChange={(e) => updateFormData({ hostCommunityId: e.target.value })}
              className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">-- Select Community --</option>
              {userCommunities.map(community => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Basic Details */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Type size={20} className="mr-2 text-cyan-400" />
          Tournament Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-cyan-400 mb-2">
              Tournament Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                updateFormData({ name: e.target.value });
                if (!formData.customUrl) {
                  generateCustomUrl(e.target.value);
                }
              }}
              placeholder="Enter tournament name"
              className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-cyan-400 mb-2">
              Custom URL (Future Feature)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-sm">
                obcportal.app/
              </span>
              <input
                type="text"
                value={formData.customUrl}
                onChange={(e) => updateFormData({ customUrl: e.target.value })}
                placeholder="custom-url"
                disabled
                className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-28 pr-4 py-3 text-slate-400 placeholder-slate-600 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Description */}
          {/* <div className="md:col-span-2">
            <label className="block text-sm font-medium text-cyan-400 mb-2">
              Description
            </label>
            <ReactQuill
              theme="snow"
              value={formData.description}
              onChange={(value) => updateFormData({ description: value })}
              className="bg-slate-900 text-white rounded-lg border border-cyan-500/30"
            />
            <p className="text-xs text-slate-400 mt-1">
              Supports <b>bold</b>, <i>italic</i>, links, lists, and more
            </p>
          </div> */}

          <div>
            <label className="block text-sm font-medium text-cyan-400 mb-2">
              Tournament Password *
            </label>
            <input
              type="text"
              value={formData.password}
              onChange={(e) => updateFormData({ password: e.target.value })}
              placeholder="Enter password for match tracking"
              className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              Required for mobile app match tracking access
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-cyan-400 mb-2">
              Location *
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => updateFormData({ location: e.target.value })}
              placeholder="Venue Address"
              className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Important Dates */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Calendar size={20} className="mr-2 text-cyan-400" />
          Important Dates
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-cyan-400 mb-2">
              Registration Deadline *
            </label>
            <input
              type="datetime-local"
              value={formData.registrationDeadline}
              onChange={(e) => updateFormData({ registrationDeadline: e.target.value })}
              className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-cyan-400 mb-2">
              Tournament Start *
            </label>
            <input
              type="datetime-local"
              value={formData.tournamentStart}
              onChange={(e) => updateFormData({ tournamentStart: e.target.value })}
              className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}