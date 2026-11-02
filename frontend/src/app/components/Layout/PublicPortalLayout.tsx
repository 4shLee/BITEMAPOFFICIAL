import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';

const EDGE_HOVER_THRESHOLD_PX = 24;
const SCROLL_HIDE_DELAY_MS = 1000;

export function PublicPortalLayout() {
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const [canScroll, setCanScroll] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isHoveringEdge, setIsHoveringEdge] = useState(false);
  const [isHoveringBar, setIsHoveringBar] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const scrollTimeoutRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ startY: number; startScrollTop: number } | null>(null);

  // Reset scroll to top on route navigation across public portal pages
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.documentElement.classList.add('public-portal-route');
    document.body.classList.add('public-portal-route');

    return () => {
      document.documentElement.classList.remove('public-portal-route');
      document.body.classList.remove('public-portal-route');
    };
  }, []);

  useEffect(() => {
    const subScrollTimers = new WeakMap<HTMLElement, number>();

    const updateThumbMetrics = () => {
      const doc = document.documentElement;
      const scrollHeight = Math.max(doc.scrollHeight, document.body.scrollHeight);
      const clientHeight = window.innerHeight;
      const scrollTop = window.scrollY || doc.scrollTop;

      const scrollable = scrollHeight - clientHeight > 1;
      setCanScroll(scrollable);

      if (!scrollable || !thumbRef.current || !trackRef.current) {
        return;
      }

      const trackHeight = trackRef.current.clientHeight;
      const rawThumbHeight = (clientHeight / scrollHeight) * trackHeight;
      const thumbHeight = Math.min(trackHeight, Math.max(36, rawThumbHeight));
      const maxScrollTop = Math.max(1, scrollHeight - clientHeight);
      const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
      const thumbTop = Math.min(maxThumbTop, Math.max(0, (scrollTop / maxScrollTop) * maxThumbTop));

      thumbRef.current.style.height = `${thumbHeight}px`;
      thumbRef.current.style.transform = `translate3d(0, ${thumbTop}px, 0)`;
    };

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (target === document || target === document.documentElement || target === document.body) {
        updateThumbMetrics();
        setIsScrolling(true);
        if (scrollTimeoutRef.current !== null) {
          window.clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = window.setTimeout(() => {
          setIsScrolling(false);
        }, SCROLL_HIDE_DELAY_MS);
      } else if (target instanceof HTMLElement) {
        target.classList.add('is-scrolling');
        const prevTimer = subScrollTimers.get(target);
        if (prevTimer !== undefined) {
          window.clearTimeout(prevTimer);
        }
        const nextTimer = window.setTimeout(() => {
          target.classList.remove('is-scrolling');
        }, SCROLL_HIDE_DELAY_MS);
        subScrollTimers.set(target, nextTimer);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      const distanceFromRight = window.innerWidth - event.clientX;
      const nearRightEdge = distanceFromRight >= 0 && distanceFromRight <= EDGE_HOVER_THRESHOLD_PX;
      setIsHoveringEdge((prev) => (prev !== nearRightEdge ? nearRightEdge : prev));

      if (rootRef.current) {
        const subContainers = rootRef.current.querySelectorAll<HTMLElement>('.overflow-y-auto');
        subContainers.forEach((el) => {
          const rect = el.getBoundingClientRect();
          const insideY = event.clientY >= rect.top && event.clientY <= rect.bottom;
          const distRight = rect.right - event.clientX;
          const nearContainerEdge = insideY && distRight >= 0 && distRight <= EDGE_HOVER_THRESHOLD_PX;
          el.classList.toggle('is-edge-hover', nearContainerEdge);
        });
      }
    };

    const handleMouseLeaveWindow = (event: MouseEvent) => {
      if (!event.relatedTarget) {
        setIsHoveringEdge(false);
      }
    };

    updateThumbMetrics();

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', updateThumbMetrics, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseout', handleMouseLeaveWindow);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            updateThumbMetrics();
          })
        : null;

    resizeObserver?.observe(document.documentElement);
    resizeObserver?.observe(document.body);
    if (rootRef.current) {
      resizeObserver?.observe(rootRef.current);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updateThumbMetrics);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseout', handleMouseLeaveWindow);
      resizeObserver?.disconnect();
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStartRef.current || !trackRef.current || !thumbRef.current) return;
      event.preventDefault();

      const doc = document.documentElement;
      const scrollHeight = Math.max(doc.scrollHeight, document.body.scrollHeight);
      const clientHeight = window.innerHeight;
      const maxScrollTop = Math.max(1, scrollHeight - clientHeight);

      const trackHeight = trackRef.current.clientHeight;
      const thumbHeight = thumbRef.current.offsetHeight;
      const maxThumbTop = Math.max(1, trackHeight - thumbHeight);

      const deltaY = event.clientY - dragStartRef.current.startY;
      const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop;

      window.scrollTo({
        top: dragStartRef.current.startScrollTop + scrollDelta,
        behavior: 'auto',
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const handleThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    dragStartRef.current = {
      startY: event.clientY,
      startScrollTop: scrollTop,
    };
    document.body.style.userSelect = 'none';
    setIsDragging(true);
  };

  const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target === thumbRef.current || !trackRef.current || !thumbRef.current) return;
    event.preventDefault();

    const trackRect = trackRef.current.getBoundingClientRect();
    const thumbHeight = thumbRef.current.offsetHeight;
    const clickY = event.clientY - trackRect.top;
    const targetThumbTop = Math.max(0, Math.min(trackRect.height - thumbHeight, clickY - thumbHeight / 2));
    const maxThumbTop = Math.max(1, trackRect.height - thumbHeight);

    const doc = document.documentElement;
    const scrollHeight = Math.max(doc.scrollHeight, document.body.scrollHeight);
    const maxScrollTop = Math.max(0, scrollHeight - window.innerHeight);
    const targetScrollTop = (targetThumbTop / maxThumbTop) * maxScrollTop;

    window.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    });
  };

  const isVisible = canScroll && (isScrolling || isHoveringEdge || isHoveringBar || isDragging);
  const isInteractive = isHoveringBar || isDragging;

  return (
    <div ref={rootRef} className="public-portal-scroll">
      <Outlet />
      <div
        ref={trackRef}
        aria-hidden="true"
        data-testid="public-portal-scrollbar"
        onMouseEnter={() => setIsHoveringBar(true)}
        onMouseLeave={() => setIsHoveringBar(false)}
        onPointerDown={handleTrackPointerDown}
        className={[
          'public-spotify-scrollbar',
          isVisible ? 'is-visible' : '',
          isInteractive ? 'is-interactive' : '',
          isDragging ? 'is-dragging' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          ref={thumbRef}
          data-testid="public-portal-scrollbar-thumb"
          onPointerDown={handleThumbPointerDown}
          className="public-spotify-scrollbar-thumb"
        />
      </div>
    </div>
  );
}
