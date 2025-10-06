import React from 'react';

interface StatBarProps {
  stats: {
    attack: number;
    defense: number;
    stamina: number;
    dash: number;
    burstRes: number;
  };
}

export function StatBar({ stats }: StatBarProps) {
  const statMeta = [
    { key: 'attack', label: 'Attack', gradient: 'from-red-500 via-pink-500 to-fuchsia-500', max: 200 },
    { key: 'defense', label: 'Defense', gradient: 'from-cyan-400 via-blue-500 to-indigo-500', max: 200 },
    { key: 'stamina', label: 'Stamina', gradient: 'from-green-400 via-emerald-500 to-teal-500', max: 200 },
    { key: 'dash', label: 'Dash', gradient: 'from-yellow-400 via-orange-500 to-red-500', max: 50 },
    { key: 'burstRes', label: 'Burst Res', gradient: 'from-purple-400 via-fuchsia-500 to-pink-600', max: 80 },
  ];

  return (
    <div className="bg-slate-950/80 border border-cyan-500/30 rounded-none p-4 shadow-[0_0_25px_rgba(0,200,255,0.2)]">
      <h5 className="text-xs uppercase font-exo2 tracking-wider text-cyan-400 mb-4">
        Combined Stats
      </h5>

      <div className="space-y-4">
        {statMeta.map(({ key, label, gradient, max }) => {
          const value = stats[key as keyof typeof stats];
          const percentage = Math.min((value / max) * 100, 100);

          return (
            <div key={key} className="w-full">
              {/* Label + Value */}
              <div className="flex justify-between mb-0.5">
                <span className="text-[10px] font-exo2 uppercase tracking-wide text-slate-400">
                  {label}
                </span>
                <span className="text-[11px] font-exo2 font-bold text-cyan-300">
                  {value}
                </span>
              </div>

              {/* Bar */}
              <div className="relative h-3 w-full bg-slate-800/70 overflow-hidden rounded-none">
                {/* Main Fill */}
                <div
                  className={`absolute top-0 left-0 h-full bg-gradient-to-r ${gradient} transition-all duration-700`}
                  style={{
                    width: `${percentage}%`,
                    clipPath: 'polygon(0 0, 100% 0, 95% 100%, 0% 100%)',
                  }}
                />

                {/* Glow Layer */}
                <div
                  className={`absolute top-0 left-0 h-full bg-gradient-to-r ${gradient} opacity-30 blur-sm`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
