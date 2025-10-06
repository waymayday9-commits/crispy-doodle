import React from 'react';
import { FileText } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // <- IMPORTANT
import { TournamentFormData } from './TournamentWizard';

interface TournamentDescriptionStepProps {
  formData: TournamentFormData;
  updateFormData: (updates: Partial<TournamentFormData>) => void;
}

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'clean'],
  ],
};

const quillFormats = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',
  'bullet',
  'link',
];

export function TournamentDescriptionStep({ formData, updateFormData }: TournamentDescriptionStepProps) {
  return (
    <div className="space-y-6">
      {/* Tournament Description */}
      <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                     transition-all duration-300 hover:border-cyan-400/70 
                     hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                         w-0 transition-all duration-500 group-hover:w-full" />
        
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <FileText size={20} className="mr-2 text-cyan-400" />
          Tournament Description
        </h3>

        <div>
          <label className="block text-sm font-medium text-cyan-400 mb-2">
            Description (Optional)
          </label>
         <div className="space-y-4">
           <ReactQuill
             theme="snow"
             value={formData.description}
             onChange={(value) => updateFormData({ description: value })}
             modules={quillModules}
             formats={quillFormats}
             className="bg-slate-900 text-white rounded-lg border border-cyan-500/30"
             placeholder="Describe your tournament, rules, prizes, and any special information..."
             style={{ height: '300px' }}
           />
           <div style={{ height: '60px' }}></div>
         </div>
          <p className="text-xs text-slate-400 mt-2">
            Supports <b>bold</b>, <i>italic</i>, <u>underline</u>, links, lists and headers. This will be displayed on the tournament details page.
          </p>
        </div>
      </div>

      {/* Description Preview */}
      {formData.description && formData.description.trim() && (
        <div className="group relative border border-slate-700 bg-slate-900/40 p-6 rounded-none 
                       transition-all duration-300 hover:border-cyan-400/70 
                       hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
          <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 
                           w-0 transition-all duration-500 group-hover:w-full" />
          
         <h4 className="text-lg font-semibold text-cyan-400 mb-4">Live Preview</h4>

          {/* Use Quill container + editor classes so Quill's CSS styles headings, lists, etc. */}
         <div className="ql-container ql-snow bg-slate-800/30 border border-cyan-500/20 rounded-lg shadow-none p-4 min-h-[200px]">
            <div
             className="ql-editor px-0 text-slate-300 max-w-none prose prose-invert prose-sm"
              dangerouslySetInnerHTML={{ __html: formData.description }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
