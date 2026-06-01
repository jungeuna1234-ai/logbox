import React from 'react';

interface InfoCellProps {
  label: string;
  value: string;
  sub?: string;
}

export const InfoCell: React.FC<InfoCellProps> = ({ label, value, sub }) => {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0f1320] p-4 flex flex-col justify-between hover:border-cyan-500/30 transition-all duration-300 shadow-lg">
      <div>
        <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">{label}</p>
        <p className="mt-2 text-xs font-semibold text-slate-200 break-all">{value}</p>
      </div>
      {sub && (
        <p className="mt-1.5 text-[9px] text-cyan-400/70 font-mono tracking-wider">{sub}</p>
      )}
    </div>
  );
};
