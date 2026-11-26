import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  Clock,
  GripVertical,
  Repeat,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { MediaAsset, PlaylistItem } from '../../types/signage';
import { MediaThumbnail } from '../ui/MediaThumbnail';

interface SortablePlaylistItemProps {
  item: PlaylistItem;
  index: number;
  totalCount: number;
  media?: MediaAsset;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateDuration: (seconds: number) => void;
  onToggleMute: () => void;
  onToggleLoop: () => void;
  onRemove: () => void;
}

export const SortablePlaylistItem: React.FC<SortablePlaylistItemProps> = ({
  item,
  index,
  totalCount,
  media,
  onMoveUp,
  onMoveDown,
  onUpdateDuration,
  onToggleMute,
  onToggleLoop,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-2.5 p-2.5 rounded-lg border transition-colors ${
        isDragging
          ? 'opacity-40 bg-[#EEE3B0]/35 border-dashed border-[#8A2A78]'
          : 'bg-[#FAF8FC] border-[#E8E2EE] hover:border-[#8A2A78]/50'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${media?.title || item.mediaId}`}
          title="Drag to reorder"
          className="p-1.5 rounded-md text-[#645573] hover:text-[#290044] hover:bg-white cursor-grab active:cursor-grabbing touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A2A78] shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <span className="font-mono text-xs text-[#500071] font-semibold tabular-nums w-5 text-center shrink-0">
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="w-12 shrink-0 hidden sm:block">
          <MediaThumbnail
            src={media?.thumbnailUrl}
            alt={media?.title || item.mediaId}
            type={media?.type || 'Image'}
            accentTone={media?.accentTone}
            showDuration={false}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-xs font-semibold text-[#290044] truncate">
              {media?.title || item.mediaId}
            </p>
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                (media?.aspectRatio ||
                  (media?.dimensions?.includes('1080 × 1920') ? '9:16' : '16:9')) === '9:16'
                  ? 'bg-[#8A2A78]/15 text-[#8A2A78]'
                  : 'bg-[#500071]/10 text-[#500071]'
              }`}
            >
              {media?.aspectRatio ||
                (media?.dimensions?.includes('1080 × 1920') ? '9:16' : '16:9')}
            </span>
          </div>
          <p className="text-[11px] text-[#645573] truncate">
            {media?.type || 'Media'}
            {media?.category ? ` · ${media.category}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <div
          className="flex items-center gap-1.5 mr-1 bg-[#FAF8FC] px-2 py-1 rounded border border-[#E8E2EE]"
          title="Slide playback duration in seconds"
        >
          <Clock className="w-3 h-3 text-[#500071]" />
          <span className="text-[10px] font-semibold text-[#645573] hidden sm:inline">
            Slide:
          </span>
          <input
            type="number"
            min={1}
            max={600}
            aria-label="Slide duration in seconds"
            value={item.displayDurationSeconds}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              onUpdateDuration(isNaN(val) ? 1 : Math.max(1, Math.min(600, val)));
            }}
            className="w-12 px-1 py-0.5 text-xs font-mono font-bold text-[#500071] border border-[#D7CEE0] rounded bg-white text-right focus:outline-none focus:border-[#8A2A78]"
          />
          <span className="text-[10px] text-[#645573] font-mono">s</span>
        </div>

        {media?.type === 'Video' && (
          <>
            <button
              type="button"
              onClick={onToggleMute}
              title={item.muteAudio ? 'Unmute video' : 'Mute video'}
              aria-label={item.muteAudio ? 'Unmute video' : 'Mute video'}
              className={`p-1.5 rounded-md transition-colors ${
                item.muteAudio
                  ? 'text-[#645573] hover:bg-white'
                  : 'bg-[#EEE3B0]/70 text-[#290044]'
              }`}
            >
              {item.muteAudio ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onToggleLoop}
              title={item.loopVideo ? 'Disable video loop' : 'Loop video'}
              aria-label={item.loopVideo ? 'Disable video loop' : 'Loop video'}
              className={`p-1.5 rounded-md transition-colors ${
                item.loopVideo
                  ? 'bg-[#EEE3B0]/70 text-[#290044]'
                  : 'text-[#645573] hover:bg-white'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="Move item up"
          title="Move up"
          className="p-1.5 rounded-md text-[#645573] hover:text-[#290044] hover:bg-white disabled:opacity-30"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === totalCount - 1}
          aria-label="Move item down"
          title="Move down"
          className="p-1.5 rounded-md text-[#645573] hover:text-[#290044] hover:bg-white disabled:opacity-30"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove item from playlist"
          title="Remove"
          className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

interface DragOverlayCardProps {
  item: PlaylistItem;
  media?: MediaAsset;
}

export const DragOverlayCard: React.FC<DragOverlayCardProps> = ({ item, media }) => {
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white border-2 border-[#500071] shadow-xl ring-2 ring-[#EEE3B0]/60">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 rounded-md bg-[#EEE3B0]/60 text-[#290044] shrink-0">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="w-12 shrink-0">
          <MediaThumbnail
            src={media?.thumbnailUrl}
            alt={media?.title || item.mediaId}
            type={media?.type || 'Image'}
            accentTone={media?.accentTone}
            showDuration={false}
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#290044] truncate">
            {media?.title || item.mediaId}
          </p>
          <p className="text-[11px] text-[#500071] font-mono tabular-nums">
            {media?.type || 'Media'} · {item.displayDurationSeconds}s
          </p>
        </div>
      </div>
    </div>
  );
};
