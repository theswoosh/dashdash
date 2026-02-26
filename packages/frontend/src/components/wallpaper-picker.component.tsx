import { useRef } from 'react';
import { X, Ban, Plus, Check } from 'lucide-react';
import type { WallpaperEntry } from '../hooks/use-board.hook';
import './wallpaper-picker.css';

const MAX_WALLPAPERS = 80; // 9×9 grid − 1 reserved slot for "no background"

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
  const remainingSlots = Math.max(0, MAX_WALLPAPERS - wallpapers.length);
  // Show exactly one upload slot (the first empty), rest are visual padding
  const uploadSlotCount = remainingSlots > 0 ? 1 : 0;
  const paddingSlotCount = Math.max(0, remainingSlots - 1);

  return (
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

          {/* Uploaded wallpapers */}
          {wallpapers.map(w => {
            const isActive = w.id === activeWallpaperId;
            return (
              <div
                key={w.id}
                className={`wp-slot wp-slot--image${isActive ? ' wp-slot--active' : ''}`}
              >
                <button
                  className="wp-thumb-btn"
                  onClick={() => onSetActive(w.id)}
                  aria-pressed={isActive}
                  title="Set as wallpaper"
                >
                  <img
                    src={`/api/boards/${boardId}/wallpapers/${w.id}`}
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
                  onClick={() => onDelete(w.id)}
                  aria-label="Delete wallpaper"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}

          {/* One interactive upload slot */}
          {uploadSlotCount > 0 && (
            <button
              className="wp-slot wp-slot--upload"
              onClick={triggerUpload}
              title="Upload new wallpaper"
              aria-label="Upload new wallpaper"
            >
              <Plus size={22} />
            </button>
          )}

          {/* Visual padding to fill the 9×9 grid */}
          {Array.from({ length: paddingSlotCount }, (_, i) => (
            <div key={`pad-${i}`} className="wp-slot wp-slot--empty" aria-hidden="true" />
          ))}
        </div>

        <input
          ref={uploadInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
