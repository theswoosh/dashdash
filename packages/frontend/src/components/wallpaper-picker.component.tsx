import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Ban, Plus, Check } from 'lucide-react';
import type { WallpaperEntry } from '../hooks/use-board.hook';
import './wallpaper-picker.css';

const MAX_WALLPAPERS = 8; // 3×3 grid − 1 reserved slot for "no background"

interface Props {
  boardId: string;
  wallpapers: readonly WallpaperEntry[];
  activeWallpaperId: string | null;
  onSetActive: (id: string | null) => void;
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function WallpaperPickerModal({
  boardId,
  wallpapers,
  activeWallpaperId,
  onSetActive,
  onUpload,
  onDelete,
  onClose,
}: Props) {
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const triggerUpload = () => uploadInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onUpload(file);
  };

  const isNoBgActive = activeWallpaperId === null;
  // Slots 1–8: images fill from left; slot at wallpapers.length is the upload slot;
  // remaining slots are inert placeholders.
  const imageSlots = Array.from({ length: MAX_WALLPAPERS }, (_, slotIndex) => slotIndex);

  return createPortal(
    <div className="wp-overlay" onClick={onClose}>
      <div
        className="wp-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Wallpaper library"
      >
        <div className="wp-header">
          <span className="wp-title">Wallpaper Library</span>
          <button className="wp-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="wp-grid">
          {/* Slot 0: No background */}
          <button
            className={`wp-slot wp-slot--none${isNoBgActive ? ' wp-slot--active' : ''}`}
            onClick={() => onSetActive(null)}
            title="No background"
            aria-pressed={isNoBgActive}
          >
            <Ban size={22} />
            <span className="wp-slot-label">None</span>
            {isNoBgActive && (
              <span className="wp-check" aria-hidden="true">
                <Check size={10} />
              </span>
            )}
          </button>

          {/* Slots 1–8: image → upload → empty */}
          {imageSlots.map(slotIndex => {
            const wallpaper = wallpapers[slotIndex];

            if (wallpaper) {
              const isActive = wallpaper.id === activeWallpaperId;
              return (
                <div
                  key={wallpaper.id}
                  className={`wp-slot wp-slot--image${isActive ? ' wp-slot--active' : ''}`}
                >
                  <button
                    className="wp-thumb-btn"
                    onClick={() => onSetActive(wallpaper.id)}
                    aria-pressed={isActive}
                    title="Set as wallpaper"
                  >
                    <img
                      src={`/api/boards/${boardId}/wallpapers/${wallpaper.id}`}
                      alt=""
                      className="wp-thumb"
                    />
                  </button>
                  {isActive && (
                    <span className="wp-check" aria-hidden="true">
                      <Check size={10} />
                    </span>
                  )}
                  <button
                    className="wp-delete"
                    onClick={() => onDelete(wallpaper.id)}
                    aria-label="Delete wallpaper"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            }

            if (slotIndex === wallpapers.length) {
              return (
                <button
                  key={`upload-${slotIndex}`}
                  className="wp-slot wp-slot--upload"
                  onClick={triggerUpload}
                  title="Upload new wallpaper"
                  aria-label="Upload new wallpaper"
                >
                  <Plus size={22} />
                </button>
              );
            }

            return (
              <div
                key={`empty-${slotIndex}`}
                className="wp-slot wp-slot--empty"
                aria-hidden="true"
              />
            );
          })}
        </div>

        <input
          ref={uploadInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>,
    document.body,
  );
}
