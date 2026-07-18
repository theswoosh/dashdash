import { useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Ban, Plus, Check, Sparkles } from 'lucide-react';
import type { WallpaperEntry, BuiltinWallpaperEntry } from '../hooks/use-board.hook';
import { useBehavior } from '../hooks/use-behavior.hook';
import { useHoldAction } from '../hooks/use-hold-action.hook';
import { useT } from '../i18n';
import './wallpaper-picker.css';

const MAX_WALLPAPERS = 8; // uploads only — "theme default" / "no background" tiles sit outside the cap

function HoldDeleteWallpaperButton({ wallpaperId, holdToDeleteMs, onDelete }: {
  wallpaperId: string;
  holdToDeleteMs: number;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  const deleteWallpaper = useCallback(() => onDelete(wallpaperId), [onDelete, wallpaperId]);
  const { isHolding, startHold, cancelHold } = useHoldAction(deleteWallpaper, holdToDeleteMs);

  return (
    <button
      className={`wp-delete${isHolding ? ' wp-delete--holding' : ''}`}
      style={{ '--hold-delete-duration': `${holdToDeleteMs}ms` } as React.CSSProperties}
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      title={t('widgetCard.holdToDelete')}
      aria-label={t('wallpaper.deleteWallpaper')}
    >
      <span className="wp-delete__fill" />
      <span className="wp-delete__icon"><X size={11} /></span>
    </button>
  );
}

interface Props {
  boardId: string;
  wallpapers: readonly WallpaperEntry[];
  builtinWallpapers: readonly BuiltinWallpaperEntry[];
  activeWallpaperId: string | null;
  onSetActive: (id: string | null) => void;
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function WallpaperPickerModal({
  boardId,
  wallpapers,
  builtinWallpapers,
  activeWallpaperId,
  onSetActive,
  onUpload,
  onDelete,
  onClose,
}: Props) {
  const t = useT();
  const { holdToDeleteMs } = useBehavior();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusables = modal.querySelectorAll<HTMLElement>(FOCUSABLE);
    focusables[0]?.focus();

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = modal.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (els.length === 0) return;
      const first = els[0]!;
      const last = els[els.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [onClose]);

  const triggerUpload = () => uploadInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onUpload(file);
  };

  const isThemeDefaultActive = activeWallpaperId === null;
  const isNoBgActive = activeWallpaperId === 'none';
  const imageSlots = Array.from({ length: MAX_WALLPAPERS }, (_, slotIndex) => slotIndex);

  return createPortal(
    <div className="chrome wp-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="wp-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('wallpaper.library')}
      >
        <div className="wp-header">
          <span className="wp-title">{t('wallpaper.library')}</span>
          <button className="wp-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>

        <div className="wp-grid">
          {/* Slot 0: Theme default */}
          <button
            className={`wp-slot wp-slot--theme-default${isThemeDefaultActive ? ' wp-slot--active' : ''}`}
            onClick={() => onSetActive(null)}
            title={t('wallpaper.themeDefault')}
            aria-pressed={isThemeDefaultActive}
          >
            <Sparkles size={22} />
            <span className="wp-slot-label">{t('wallpaper.themeDefault')}</span>
            {isThemeDefaultActive && (
              <span className="wp-check" aria-hidden="true">
                <Check size={10} />
              </span>
            )}
          </button>

          {/* Slot 1: No background */}
          <button
            className={`wp-slot wp-slot--none${isNoBgActive ? ' wp-slot--active' : ''}`}
            onClick={() => onSetActive('none')}
            title={t('wallpaper.noBackground')}
            aria-pressed={isNoBgActive}
          >
            <Ban size={22} />
            <span className="wp-slot-label">{t('wallpaper.none')}</span>
            {isNoBgActive && (
              <span className="wp-check" aria-hidden="true">
                <Check size={10} />
              </span>
            )}
          </button>

          {/* Slots 2–7: image → upload → empty */}
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
                    title={t('wallpaper.setAsWallpaper')}
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
                  <HoldDeleteWallpaperButton
                    wallpaperId={wallpaper.id}
                    holdToDeleteMs={holdToDeleteMs}
                    onDelete={onDelete}
                  />
                </div>
              );
            }

            if (slotIndex === wallpapers.length) {
              return (
                <button
                  key={`upload-${slotIndex}`}
                  className="wp-slot wp-slot--upload"
                  onClick={triggerUpload}
                  title={t('wallpaper.upload')}
                  aria-label={t('wallpaper.upload')}
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

        {builtinWallpapers.length > 0 && (
          <div className="wp-section">
            <span className="wp-section-label">{t('wallpaper.builtin')}</span>
            <div className="wp-grid">
              {builtinWallpapers.map(builtinWallpaper => {
                const id = `builtin:${builtinWallpaper.file}`;
                const isActive = id === activeWallpaperId;
                return (
                  <div
                    key={builtinWallpaper.file}
                    className={`wp-slot wp-slot--image${isActive ? ' wp-slot--active' : ''}`}
                  >
                    <button
                      className="wp-thumb-btn"
                      onClick={() => onSetActive(id)}
                      aria-pressed={isActive}
                      title={t('wallpaper.setAsWallpaper')}
                    >
                      <img src={builtinWallpaper.url} alt="" className="wp-thumb" />
                    </button>
                    {isActive && (
                      <span className="wp-check" aria-hidden="true">
                        <Check size={10} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
