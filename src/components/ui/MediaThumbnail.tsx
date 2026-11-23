import React, { useState } from 'react';
import { Film, Image as ImageIcon, Play } from 'lucide-react';
import { MediaType } from '../../types/signage';

interface MediaThumbnailProps {
  src?: string;
  alt: string;
  type: MediaType;
  durationSeconds?: number;
  accentTone?: 'primary' | 'secondary' | 'accent' | 'cream';
  className?: string;
  showDuration?: boolean;
}

export const formatDuration = (seconds?: number): string => {
  if (!seconds && seconds !== 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  src,
  alt,
  type,
  durationSeconds,
  accentTone = 'primary',
  className = 'aspect-video',
  showDuration = true,
}) => {
  const [failed, setFailed] = useState(false);

  const fallbackGradient = (() => {
    switch (accentTone) {
      case 'secondary':
        return 'from-[#500071] to-[#8A2A78] text-white';
      case 'accent':
        return 'from-[#8A2A78] to-[#290044] text-white';
      case 'cream':
        return 'from-[#EEE3B0] to-[#d9cb8c] text-[#290044]';
      case 'primary':
      default:
        return 'from-[#290044] to-[#500071] text-white';
    }
  })();

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-[#290044]/10 border border-[#E8E2EE] select-none ${className}`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${fallbackGradient} flex flex-col items-center justify-center p-4 text-center`}
        >
          {type === 'Video' ? (
            <Film className="w-8 h-8 opacity-80 mb-1.5" />
          ) : (
            <ImageIcon className="w-8 h-8 opacity-80 mb-1.5" />
          )}
          <span className="text-xs font-medium line-clamp-2 opacity-90">{alt}</span>
        </div>
      )}

      {type === 'Video' && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
      )}

      {type === 'Video' && showDuration && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded bg-black/75 text-white text-[11px] font-mono tabular-nums">
          <Play className="w-2.5 h-2.5 fill-current" />
          <span>{formatDuration(durationSeconds || 30)}</span>
        </div>
      )}
    </div>
  );
};
