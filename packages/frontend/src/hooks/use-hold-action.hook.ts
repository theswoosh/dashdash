import { useState, useRef, useEffect, useCallback } from 'react';

/** Press-and-hold gating for destructive actions: fires `action` after
 *  `holdMs` of uninterrupted press; releasing or leaving the button cancels.
 *  Same pattern as HoldDeleteButton in widget-card/frame-card — new
 *  destructive buttons should use this hook instead of another copy. */
export function useHoldAction(action: () => void, holdMs: number) {
  const [isHolding, setIsHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const startHold = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsHolding(true);
    timer.current = setTimeout(action, holdMs);
  }, [action, holdMs]);

  const cancelHold = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setIsHolding(false);
  }, []);

  return { isHolding, startHold, cancelHold };
}
