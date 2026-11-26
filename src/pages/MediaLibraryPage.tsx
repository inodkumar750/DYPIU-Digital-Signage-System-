import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Edit3,
  Eye,
  Film,
  Grid,
  Image as ImageIcon,
  List,
  ListPlus,
  Monitor,
  MoreVertical,
  Search,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  MediaAspectRatio,
  MediaAsset,
  MediaCategory,
  MediaType,
  Playlist,
} from '../types/signage';
import { MediaThumbnail, formatDuration } from '../components/ui/MediaThumbnail';
import { Modal } from '../components/ui/Modal';

const CATEGORIES: ('All' | MediaCategory)[] = [
  'All',
  'University Admissions',
  'Events',
  'Workshops',
  'Placements',
  'Student Activities',
  'Announcements',
];

interface MediaLibraryPageProps {
  mediaAssets: MediaAsset[];
  playlists: Playlist[];
  openUploadSignal: number;
  onAddMedia: (asset: MediaAsset, file?: File | null) => void;
  onUpdateMedia: (asset: MediaAsset) => void;
  onDeleteMedia: (id: string) => void;
  onAddToPlaylist: (playlistId: string, mediaId: string) => void;
}

// 4K Signage Image Optimizer for Instant TV (16:9) & Standy (9:16) Rendering
async function optimizeSignageImage(
  file: File,
  aspectRatio: MediaAspectRatio = '16:9'
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const originalWidth = img.naturalWidth || img.width;
      const originalHeight = img.naturalHeight || img.height;
      const MAX_WIDTH = aspectRatio === '9:16' ? 2160 : 3840; // 4K UHD TV / Standy Standard
      const MAX_HEIGHT = aspectRatio === '9:16' ? 3840 : 2160;

      const isOversized = originalWidth > MAX_WIDTH || originalHeight > MAX_HEIGHT;
      const isHeavy = file.size > 350 * 1024 || file.type === 'image/png';

      if (!isOversized && !isHeavy) {
        resolve(file);
        return;
      }

      let targetWidth = originalWidth;
      let targetHeight = originalHeight;

      if (isOversized) {
        if (originalWidth / MAX_WIDTH > originalHeight / MAX_HEIGHT) {
          targetHeight = Math.round((originalHeight * MAX_WIDTH) / originalWidth);
          targetWidth = MAX_WIDTH;
        } else {
          targetWidth = Math.round((originalWidth * MAX_HEIGHT) / originalHeight);
          targetHeight = MAX_HEIGHT;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
          const optimized = new File([blob], cleanName, { type: 'image/jpeg' });
          resolve(optimized);
        },
        'image/jpeg',
        0.92
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

export const MediaLibraryPage: React.FC<MediaLibraryPageProps> = ({
  mediaAssets,
  playlists,
  openUploadSignal,
  onAddMedia,
  onUpdateMedia,
  onDeleteMedia,
  onAddToPlaylist,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | MediaCategory>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | MediaType>('All');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState(false);

  // Modals
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const [editAsset, setEditAsset] = useState<MediaAsset | null>(null);
  const [playlistTargetAsset, setPlaylistTargetAsset] = useState<MediaAsset | null>(null);
  const [confirmDeleteAsset, setConfirmDeleteAsset] = useState<MediaAsset | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(playlists[0]?.id || '');

  useEffect(() => {
    if (!openMenuId) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-media-menu]')) {
        setOpenMenuId(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuId]);

  // Upload Form State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadType, setUploadType] = useState<MediaType>('Image');
  const [uploadAspectRatio, setUploadAspectRatio] = useState<MediaAspectRatio>('16:9');
  const [ratioManuallyChosen, setRatioManuallyChosen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<MediaCategory>('University Admissions');
  const [uploadDuration, setUploadDuration] = useState('30');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | undefined>(undefined);
  const [uploadFileSize, setUploadFileSize] = useState('2.4 MB');
  const [uploadError, setUploadError] = useState('');

  // Edit Form State
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<MediaCategory>('Announcements');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    if (openUploadSignal > 0) {
      setUploadOpen(true);
    }
  }, [openUploadSignal]);

  const detectImageOrientation = (file: File): Promise<MediaAspectRatio | null> => {
    if (!file.type.startsWith('image/')) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img.naturalHeight > img.naturalWidth ? '9:16' : '16:9');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  };

  const handleFileChosen = async (file: File) => {
    const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(file.name);

    // Max limits: 20 MB for Images, 30 MB for Videos
    if (!isVid && file.size > 20 * 1024 * 1024) {
      setUploadError(`Image size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 20 MB maximum limit.`);
      return;
    }
    if (isVid && file.size > 30 * 1024 * 1024) {
      setUploadError(`Video size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 30 MB maximum limit.`);
      return;
    }

    setUploadError('');
    setUploadFileName(file.name);
    if (!uploadTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setUploadTitle(cleanName);
    }
    setUploadType(isVid ? 'Video' : 'Image');

    let targetRatio = uploadAspectRatio;
    if (!isVid && !ratioManuallyChosen) {
      const detected = await detectImageOrientation(file);
      if (detected) {
        targetRatio = detected;
        setUploadAspectRatio(detected);
      }
    }

    // Auto-optimize images to crisp 4K UHD so they display INSTANTLY on Smart TVs & Standys
    let finalFile = file;
    if (!isVid) {
      finalFile = await optimizeSignageImage(file, targetRatio);
    }

    setSelectedFile(finalFile);
    const sizeMb = (finalFile.size / (1024 * 1024)).toFixed(1);
    setUploadFileSize(`${Math.max(0.1, Number(sizeMb))} MB`);

    const objUrl = URL.createObjectURL(finalFile);
    setUploadPreviewUrl(objUrl);
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setUploadTitle('');
    setUploadFileName('');
    setUploadType('Image');
    setUploadAspectRatio('16:9');
    setRatioManuallyChosen(false);
    setUploadCategory('University Admissions');
    setUploadDuration('30');
    setUploadDescription('');
    setUploadPreviewUrl(undefined);
    setUploadFileSize('2.4 MB');
    setUploadError('');
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      setUploadError('Please enter a display title for this media asset.');
      return;
    }
    const newAsset: MediaAsset = {
      id: `med-${Date.now().toString().slice(-4)}`,
      fileName:
        uploadFileName.trim() ||
        `${uploadTitle.toLowerCase().replace(/\s+/g, '-')}.${uploadType === 'Video' ? 'mp4' : 'jpg'}`,
      title: uploadTitle.trim(),
      type: uploadType,
      category: uploadCategory,
      uploadDate: new Date().toISOString().substring(0, 10),
      durationSeconds: uploadType === 'Video' ? Math.max(5, Number(uploadDuration) || 30) : undefined,
      fileSize: uploadFileSize,
      dimensions: uploadAspectRatio === '9:16' ? '1080 × 1920' : '1920 × 1080',
      aspectRatio: uploadAspectRatio,
      thumbnailUrl: uploadPreviewUrl,
      fileUrl: uploadPreviewUrl,
      accentTone: uploadType === 'Video' ? 'secondary' : 'primary',
      uploadedBy: 'Vinod Kumar Jain',
      description: uploadDescription.trim() || 'Uploaded via CampusCast Media Library.',
    };
    onAddMedia(newAsset, selectedFile);
    setUploadOpen(false);
    resetUploadForm();
  };

  const filteredAssets = mediaAssets.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.fileName.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);
    const matchesCat = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesType = typeFilter === 'All' || item.type === typeFilter;

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const refTime = new Date('2026-11-23').getTime();
      const itemTime = new Date(item.uploadDate).getTime();
      const diffDays = (refTime - itemTime) / (1000 * 60 * 60 * 24);
      matchesDate = dateFilter === '7d' ? diffDays <= 7 : diffDays <= 30;
    }

    return matchesSearch && matchesCat && matchesType && matchesDate;
  });

  const openEditModal = (asset: MediaAsset) => {
    setEditAsset(asset);
    setEditTitle(asset.title);
    setEditCategory(asset.category);
    setEditDescription(asset.description || '');
    setOpenMenuId(null);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAsset || !editTitle.trim()) return;
    onUpdateMedia({
      ...editAsset,
      title: editTitle.trim(),
      category: editCategory,
      description: editDescription.trim(),
    });
    setEditAsset(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar & Upload Dropzone */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="type-section-title text-[#290044]">
            Campus media assets
          </h2>
          <p className="type-support text-[#645573]">
            Upload posters, promotional reels, and official notices for campus playlists.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-white border border-[#E6E0EC] rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#500071] text-white'
                  : 'text-[#645573] hover:text-[#290044]'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#500071] text-white'
                  : 'text-[#645573] hover:text-[#290044]'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#500071] text-white type-button hover:bg-[#8A2A78] transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            Upload media
          </button>
        </div>
      </div>

      {/* Drag & Drop Quick Upload Strip */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverZone(true);
        }}
        onDragLeave={() => setDragOverZone(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverZone(false);
          const droppedFile = e.dataTransfer.files?.[0];
          if (droppedFile) {
            handleFileChosen(droppedFile);
          }
          setUploadOpen(true);
        }}
        onClick={() => setUploadOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setUploadOpen(true);
        }}
        className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${
          dragOverZone
            ? 'border-[#8A2A78] bg-[#EEE3B0]/30'
            : 'border-[#D7CEE0] bg-white hover:border-[#8A2A78] hover:bg-[#FAF8FC]'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#EEE3B0]/65 text-[#290044] flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5" />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold text-[#290044]">
              Drag and drop posters or promotional videos here
            </p>
            <p className="text-xs text-[#645573]">
              Supports 4K/1080p JPG, PNG, and MP4 reels (local preview simulated in browser)
            </p>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white border border-[#E8E2EE] rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#6E607D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by file name, title, or category..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78] focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center p-1 bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg">
              {(['All', 'Image', 'Video'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    typeFilter === t
                      ? 'bg-[#500071] text-white'
                      : 'text-[#645573] hover:text-[#290044]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#645573]" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as 'all' | '7d' | '30d')}
                aria-label="Filter by upload date"
                className="px-2.5 py-1.5 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg text-[#290044] focus:outline-none focus:border-[#8A2A78]"
              >
                <option value="all">All Dates</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#F1ECF6]">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-[#EEE3B0] text-[#290044] font-semibold'
                  : 'text-[#645573] hover:bg-[#FAF8FC] hover:text-[#290044]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State or Results */}
      {filteredAssets.length === 0 ? (
        <div className="bg-white border border-[#E6E0EC] rounded-xl p-12 text-center shadow-[0_1px_2px_rgba(41,0,68,0.04)]">
          <ImageIcon className="w-10 h-10 text-[#8A2A78]/50 mx-auto mb-3" />
          <h3 className="type-card-title text-[#290044]">No media assets found</h3>
          <p className="mt-1 type-support text-[#645573]">
            Adjust your search filters or upload a new campus poster or video.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategoryFilter('All');
              setTypeFilter('All');
              setDateFilter('all');
            }}
            className="mt-4 px-4 py-2 rounded-lg bg-[#500071] text-white type-button hover:bg-[#8A2A78]"
          >
            Reset filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredAssets.map((asset) => (
            <article
              key={asset.id}
              className={`group relative bg-white border border-[#E6E0EC] rounded-xl shadow-[0_1px_2px_rgba(41,0,68,0.04)] hover:border-[#8A2A78]/50 hover:shadow-sm transition-all flex flex-col ${
                openMenuId === asset.id ? 'z-20' : ''
              }`}
            >
              <div
                className="p-3 pb-0 cursor-pointer"
                onClick={() => setPreviewAsset(asset)}
              >
                <MediaThumbnail
                  src={asset.thumbnailUrl}
                  alt={asset.title}
                  type={asset.type}
                  durationSeconds={asset.durationSeconds}
                  accentTone={asset.accentTone}
                />
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      onClick={() => setPreviewAsset(asset)}
                      className="type-card-title text-[#290044] line-clamp-2 cursor-pointer hover:text-[#500071]"
                    >
                      {asset.title}
                    </h3>
                    <div className="relative flex items-center gap-0.5 shrink-0" data-media-menu>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          setConfirmDeleteAsset(asset);
                        }}
                        title={`Delete ${asset.title}`}
                        aria-label={`Delete ${asset.title}`}
                        className="p-1.5 rounded-md text-[#645573] hover:text-rose-700 hover:bg-rose-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A2A78]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId((cur) => (cur === asset.id ? null : asset.id))
                        }
                        aria-label={`More actions for ${asset.title}`}
                        aria-expanded={openMenuId === asset.id}
                        className="p-1.5 rounded-md text-[#645573] hover:text-[#290044] hover:bg-[#FAF8FC] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A2A78]"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === asset.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#E8E2EE] rounded-lg shadow-lg py-1 z-30 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewAsset(asset);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FAF8FC] text-[#290044]"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#500071]" />
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(asset)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FAF8FC] text-[#290044]"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[#500071]" />
                            Edit details
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPlaylistTargetAsset(asset);
                              setSelectedPlaylistId(playlists[0]?.id || '');
                              setOpenMenuId(null);
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FAF8FC] text-[#290044]"
                          >
                            <ListPlus className="w-3.5 h-3.5 text-[#500071]" />
                            Add to playlist
                          </button>
                          <div className="my-1 border-t border-[#F1ECF6]" />
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteAsset(asset);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-50 text-rose-700 font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete media
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] font-mono text-[#6E607D] truncate">
                    {asset.fileName}
                  </p>
                </div>

                {/* Unboxed Metadata with typographic separators */}
                <div className="pt-2.5 border-t border-[#F1ECF6] space-y-1 text-[11px] text-[#645573]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[#500071] truncate">{asset.category}</span>
                    <span className="font-mono tabular-nums shrink-0">{asset.fileSize}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 tabular-nums">
                    <span className="flex items-center gap-1.5 truncate">
                      <span>
                        {asset.type}
                        {asset.type === 'Video' && asset.durationSeconds
                          ? ` · ${formatDuration(asset.durationSeconds)}`
                          : ` · ${asset.dimensions}`}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0 ${
                          (asset.aspectRatio ||
                            (asset.dimensions?.includes('1080 × 1920') ? '9:16' : '16:9')) === '9:16'
                            ? 'bg-[#8A2A78]/15 text-[#8A2A78]'
                            : 'bg-[#500071]/10 text-[#500071]'
                        }`}
                      >
                        {asset.aspectRatio ||
                          (asset.dimensions?.includes('1080 × 1920') ? '9:16' : '16:9')}
                      </span>
                    </span>
                    <span className="font-mono shrink-0">{asset.uploadDate}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#E8E2EE] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8E2EE] bg-[#FAF8FC] text-[11px] font-semibold text-[#645573]">
                  <th className="py-3 px-4">Asset</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Upload Date</th>
                  <th className="py-3 px-4">Duration / Size</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1ECF6] text-xs">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-[#FAF8FC] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 shrink-0">
                          <MediaThumbnail
                            src={asset.thumbnailUrl}
                            alt={asset.title}
                            type={asset.type}
                            durationSeconds={asset.durationSeconds}
                            accentTone={asset.accentTone}
                            showDuration={false}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#290044] truncate max-w-xs">
                            {asset.title}
                          </p>
                          <p className="text-[11px] font-mono text-[#6E607D] truncate max-w-xs">
                            {asset.fileName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#290044]">
                      <span className="inline-flex items-center gap-1.5">
                        {asset.type === 'Video' ? (
                          <Film className="w-3.5 h-3.5 text-[#8A2A78]" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5 text-[#500071]" />
                        )}
                        {asset.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#500071] font-medium">{asset.category}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[#645573]">
                      {asset.uploadDate}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[#645573]">
                      {asset.durationSeconds ? `${formatDuration(asset.durationSeconds)} · ` : ''}
                      {asset.fileSize}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewAsset(asset)}
                          title="Preview"
                          className="p-1.5 rounded-md text-[#500071] hover:bg-[#EEE3B0]/40"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(asset)}
                          title="Edit details"
                          className="p-1.5 rounded-md text-[#500071] hover:bg-[#EEE3B0]/40"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPlaylistTargetAsset(asset);
                            setSelectedPlaylistId(playlists[0]?.id || '');
                          }}
                          title="Add to playlist"
                          className="p-1.5 rounded-md text-[#500071] hover:bg-[#EEE3B0]/40"
                        >
                          <ListPlus className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteAsset(asset)}
                          title="Delete media"
                          aria-label={`Delete ${asset.title}`}
                          className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Media Modal */}
      <Modal
        isOpen={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          resetUploadForm();
        }}
        title="Upload Media Asset"
        subtitle="Select an image or video file to upload directly to CampusCast storage and MySQL"
        size="lg"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#290044] inline-flex items-center gap-1.5">
                  {uploadAspectRatio === '9:16' ? (
                    <>
                      <Smartphone className="w-3.5 h-3.5 text-[#8A2A78]" />
                      Standy Preview (9:16 Portrait)
                    </>
                  ) : (
                    <>
                      <Monitor className="w-3.5 h-3.5 text-[#500071]" />
                      TV Preview (16:9 Landscape)
                    </>
                  )}
                </span>
                <span className="font-mono text-[#645573]">
                  {uploadAspectRatio === '9:16' ? '1080 × 1920' : '1920 × 1080'}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChosen(file);
                }}
                className="hidden"
              />
              <div
                className={`rounded-xl border border-[#E8E2EE] p-3 flex flex-col items-center justify-center transition-colors ${
                  uploadPreviewUrl ? 'bg-[#1A1025]' : 'bg-[#FAF8FC]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden ${
                    uploadAspectRatio === '9:16'
                      ? 'w-[175px] aspect-[9/16]'
                      : 'w-full aspect-video'
                  } ${
                    uploadPreviewUrl
                      ? 'border-[#8A2A78]/60 bg-[#290044] p-0'
                      : 'border-[#D7CEE0] hover:border-[#8A2A78] bg-white/80 p-4'
                  }`}
                >
                  {uploadPreviewUrl ? (
                    uploadType === 'Video' ? (
                      <video
                        src={uploadPreviewUrl}
                        controls
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <img
                        src={uploadPreviewUrl}
                        alt="Selected file preview"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    )
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-[#500071] mb-2" />
                      <span className="text-xs font-semibold text-[#290044] text-center">
                        {uploadFileName || 'Choose Image or Video File'}
                      </span>
                      <span className="text-[11px] text-[#645573] mt-1 text-center">
                        {uploadAspectRatio === '9:16'
                          ? 'Vertical Standy · 9:16 · Max 20/30 MB'
                          : 'Landscape TV · 16:9 · Max 20/30 MB'}
                      </span>
                    </>
                  )}
                </button>
                {uploadPreviewUrl && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-[11px] font-semibold text-[#EEE3B0] hover:underline"
                  >
                    Change file ({uploadFileName})
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#290044] mb-1">
                  Target Screen Ratio *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadAspectRatio('16:9');
                      setRatioManuallyChosen(true);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      uploadAspectRatio === '16:9'
                        ? 'bg-[#500071] text-white border-[#500071] shadow-xs'
                        : 'bg-[#FAF8FC] text-[#290044] border-[#E8E2EE] hover:border-[#8A2A78]'
                    }`}
                  >
                    <Monitor className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold leading-tight">
                        TV Landscape
                      </span>
                      <span
                        className={`block text-[10px] font-mono ${
                          uploadAspectRatio === '16:9' ? 'text-[#EEE3B0]' : 'text-[#645573]'
                        }`}
                      >
                        16:9 · 1920×1080
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUploadAspectRatio('9:16');
                      setRatioManuallyChosen(true);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      uploadAspectRatio === '9:16'
                        ? 'bg-[#500071] text-white border-[#500071] shadow-xs'
                        : 'bg-[#FAF8FC] text-[#290044] border-[#E8E2EE] hover:border-[#8A2A78]'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold leading-tight">
                        Standy Portrait
                      </span>
                      <span
                        className={`block text-[10px] font-mono ${
                          uploadAspectRatio === '9:16' ? 'text-[#EEE3B0]' : 'text-[#645573]'
                        }`}
                      >
                        9:16 · 1080×1920
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#290044] mb-1">
                  Display Title *
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => {
                    setUploadTitle(e.target.value);
                    setUploadError('');
                  }}
                  placeholder="e.g., Convocation 2026 Hall Directions"
                  className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#290044] mb-1">
                    Media Type
                  </label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value as MediaType)}
                    className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                  >
                    <option value="Image">Image</option>
                    <option value="Video">Video</option>
                  </select>
                </div>

                {uploadType === 'Video' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#290044] mb-1">
                      Duration (sec)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={600}
                      value={uploadDuration}
                      onChange={(e) => setUploadDuration(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg font-mono focus:outline-none focus:border-[#8A2A78]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#290044] mb-1">
                  Category
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as MediaCategory)}
                  className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#290044] mb-1">
              Description / Signage Notes
            </label>
            <textarea
              rows={2}
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="Optional context for playlist editors..."
              className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
            />
          </div>

          {uploadError && (
            <p className="text-xs text-rose-700 font-medium">{uploadError}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setUploadOpen(false);
                resetUploadForm();
              }}
              className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044] hover:bg-[#FAF8FC]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
            >
              Add to Media Library
            </button>
          </div>
        </form>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={Boolean(previewAsset)}
        onClose={() => setPreviewAsset(null)}
        title={previewAsset?.title || 'Media Preview'}
        subtitle={previewAsset ? `${previewAsset.fileName} · ${previewAsset.dimensions}` : ''}
        size="lg"
      >
        {previewAsset && (
          <div className="space-y-4">
            <div
              className={
                (previewAsset.aspectRatio ||
                  (previewAsset.dimensions?.includes('1080 × 1920') ? '9:16' : '16:9')) === '9:16'
                  ? 'max-w-[260px] mx-auto'
                  : ''
              }
            >
              <MediaThumbnail
                src={previewAsset.thumbnailUrl}
                alt={previewAsset.title}
                type={previewAsset.type}
                durationSeconds={previewAsset.durationSeconds}
                aspectRatio={
                  previewAsset.aspectRatio ||
                  (previewAsset.dimensions?.includes('1080 × 1920') ? '9:16' : '16:9')
                }
                accentTone={previewAsset.accentTone}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[#FAF8FC] border border-[#E8E2EE] text-xs">
              <div>
                <p className="text-[#645573]">Category</p>
                <p className="font-semibold text-[#290044] mt-0.5">{previewAsset.category}</p>
              </div>
              <div>
                <p className="text-[#645573]">File Size</p>
                <p className="font-mono font-semibold text-[#290044] mt-0.5">
                  {previewAsset.fileSize}
                </p>
              </div>
              <div>
                <p className="text-[#645573]">Upload Date</p>
                <p className="font-mono font-semibold text-[#290044] mt-0.5">
                  {previewAsset.uploadDate}
                </p>
              </div>
              <div>
                <p className="text-[#645573]">Uploaded By</p>
                <p className="font-semibold text-[#290044] mt-0.5">{previewAsset.uploadedBy}</p>
              </div>
            </div>
            {previewAsset.description && (
              <p className="text-xs text-[#645573] leading-relaxed">{previewAsset.description}</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#F1ECF6]">
              <button
                type="button"
                onClick={() => setConfirmDeleteAsset(previewAsset)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete media
              </button>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const target = previewAsset;
                    setPreviewAsset(null);
                    openEditModal(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044] hover:bg-[#FAF8FC]"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#500071]" />
                  Edit details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlaylistTargetAsset(previewAsset);
                    setSelectedPlaylistId(playlists[0]?.id || '');
                    setPreviewAsset(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  Add to playlist
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Details Modal */}
      <Modal
        isOpen={Boolean(editAsset)}
        onClose={() => setEditAsset(null)}
        title="Edit Media Details"
        subtitle={editAsset?.fileName}
        size="md"
      >
        <form onSubmit={handleEditSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#290044] mb-1">
              Display Title
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#290044] mb-1">Category</label>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value as MediaCategory)}
              className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
            >
              {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#290044] mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditAsset(null)}
              className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Add to Playlist Modal */}
      <Modal
        isOpen={Boolean(playlistTargetAsset)}
        onClose={() => setPlaylistTargetAsset(null)}
        title="Add Asset to Playlist"
        subtitle={playlistTargetAsset?.title}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#290044] mb-1.5">
              Select Target Playlist
            </label>
            <select
              value={selectedPlaylistId}
              onChange={(e) => setSelectedPlaylistId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
            >
              {playlists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({pl.items.length} items)
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPlaylistTargetAsset(null)}
              className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (playlistTargetAsset && selectedPlaylistId) {
                  onAddToPlaylist(selectedPlaylistId, playlistTargetAsset.id);
                  setPlaylistTargetAsset(null);
                }
              }}
              className="px-4 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
            >
              Append to Playlist
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(confirmDeleteAsset)}
        onClose={() => setConfirmDeleteAsset(null)}
        title="Delete Media Asset"
        subtitle={confirmDeleteAsset?.fileName}
        size="sm"
      >
        {confirmDeleteAsset && (
          <div className="space-y-4">
            <p className="text-xs text-[#645573] leading-relaxed">
              Are you sure you want to remove{' '}
              <span className="font-semibold text-[#290044]">
                “{confirmDeleteAsset.title}”
              </span>{' '}
              from the Media Library?
            </p>

            {(() => {
              const affectedPlaylists = playlists.filter((pl) =>
                pl.items.some((item) => item.mediaId === confirmDeleteAsset.id)
              );
              if (affectedPlaylists.length === 0) return null;
              return (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                  <p className="font-semibold">
                    Currently used in {affectedPlaylists.length} playlist
                    {affectedPlaylists.length > 1 ? 's' : ''}:
                  </p>
                  <p className="text-amber-800">
                    {affectedPlaylists.map((pl) => pl.name).join(', ')}. Deleting this
                    asset will also remove it from those playlists.
                  </p>
                </div>
              );
            })()}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteAsset(null)}
                className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044] hover:bg-[#FAF8FC]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToDelete = confirmDeleteAsset.id;
                  onDeleteMedia(idToDelete);
                  setConfirmDeleteAsset(null);
                  if (previewAsset?.id === idToDelete) {
                    setPreviewAsset(null);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete media
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
