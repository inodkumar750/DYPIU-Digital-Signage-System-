import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileEdit,
  Loader2,
  PauseCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';

export type BadgeTone =
  | 'Online'
  | 'Offline'
  | 'Active'
  | 'Scheduled'
  | 'Draft'
  | 'Paused'
  | 'Completed'
  | 'Archived'
  | 'Pending'
  | 'Publishing'
  | 'Published'
  | 'Failed'
  | 'Invited'
  | 'Suspended';

interface StatusBadgeProps {
  status: BadgeTone | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const getConfig = () => {
    switch (status) {
      case 'Online':
        return {
          classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: <Wifi className="w-3 h-3 shrink-0 text-emerald-600" />,
        };
      case 'Active':
      case 'Published':
        return {
          classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />,
        };
      case 'Offline':
      case 'Failed':
      case 'Suspended':
        return {
          classes: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: status === 'Offline'
            ? <WifiOff className="w-3 h-3 shrink-0 text-rose-600" />
            : <AlertCircle className="w-3 h-3 shrink-0 text-rose-600" />,
        };
      case 'Scheduled':
      case 'Pending':
      case 'Invited':
        return {
          classes: 'bg-[#EEE3B0]/55 text-[#290044] border-[#d8c982]',
          icon: <Clock className="w-3 h-3 shrink-0 text-[#500071]" />,
        };
      case 'Publishing':
        return {
          classes: 'bg-[#500071]/10 text-[#500071] border-[#500071]/25',
          icon: <Loader2 className="w-3 h-3 shrink-0 text-[#500071] animate-spin" />,
        };
      case 'Paused':
        return {
          classes: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: <PauseCircle className="w-3 h-3 shrink-0 text-amber-600" />,
        };
      case 'Completed':
        return {
          classes: 'bg-[#8A2A78]/10 text-[#500071] border-[#8A2A78]/25',
          icon: <CheckCircle2 className="w-3 h-3 shrink-0 text-[#8A2A78]" />,
        };
      case 'Draft':
      case 'Archived':
      default:
        return {
          classes: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: <FileEdit className="w-3 h-3 shrink-0 text-slate-500" />,
        };
    }
  };

  const { classes, icon } = getConfig();
  const sizing = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium whitespace-nowrap shrink-0 ${sizing} ${classes}`}
    >
      {icon}
      <span>{status}</span>
    </span>
  );
};
