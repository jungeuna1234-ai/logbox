import React from 'react';

interface InfoCellProps {
  label: string;
  value: string;
  sub?: string;
}

export const InfoCell: React.FC<InfoCellProps> = ({ label, value, sub }) => {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#12141C] p-6 flex flex-col justify-between hover:border-[#FF2E63]/30 hover:shadow-[0_0_15px_rgba(255,46,99,0.05)] transition-all duration-300 shadow-lg">
      <div>
        <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">{label}</p>
        <p className="mt-2 text-sm font-semibold text-slate-200 break-all">{value}</p>
      </div>
      {sub && (
        <p className="mt-2 text-[10px] text-[#00F5D4]/80 font-mono tracking-wider">{sub}</p>
      )}
    </div>
  );
};
