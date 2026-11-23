import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  tone?: 'default' | 'online' | 'offline' | 'highlight' | 'cream';
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  description,
  icon: Icon,
  tone = 'default',
  className = '',
  onClick,
}) => {
  const iconStyle = (() => {
    switch (tone) {
      case 'online':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'offline':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'highlight':
        return 'bg-[#500071] text-white border-[#500071]';
      case 'cream':
        return 'bg-[#EEE3B0]/80 text-[#290044] border-[#ded08e]';
      default:
        return 'bg-[#FAF8FC] text-[#500071] border-[#E6E0EC]';
    }
  })();

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full h-full text-left bg-white border border-[#E6E0EC] rounded-xl p-6 shadow-[0_1px_2px_rgba(41,0,68,0.04)] flex flex-col justify-between gap-4 transition-all duration-150 ${
        onClick
          ? 'hover:border-[#8A2A78]/60 hover:shadow-[0_4px_12px_rgba(41,0,68,0.06)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A2A78]'
          : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[15px] leading-[1.35] font-semibold text-[#290044]">
            {label}
          </p>
          <p className="type-kpi text-[#290044]">{value}</p>
        </div>

        <div
          className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${iconStyle}`}
          aria-hidden="true"
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {description && (
        <p className="type-support text-[#645573]">{description}</p>
      )}
    </Wrapper>
  );
};
