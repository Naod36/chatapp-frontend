import { useEffect, useRef, useState } from "react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const SWIPE_THRESHOLD = 50;
const DOUBLE_TAP_MS = 300;

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

/**
 * Full-screen image viewer with zoom/pan/swipe navigation across a list of images.
 * `images` is an array of { id, src, caption }. `startIndex` sets the initially shown image.
 */
export default function ImageLightbox({
  images,
  startIndex = 0,
  onClose,
  t = {},
}) {
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null); // { startX, startY, panX, panY }
  const touchRef = useRef(null); // { startX, startY, lastTap }
  const total = images.length;
  const current = images[index];

  // Reset zoom/pan whenever the shown image changes.
  useEffect(() => {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  }, [index]);

  const goTo = (nextIndex) => {
    setIndex(((nextIndex % total) + total) % total);
  };
  const goPrev = () => goTo(index - 1);
  const goNext = () => goTo(index + 1);

  // Keyboard navigation; listeners are removed on unmount so no leaks.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, total, onClose]);

  const toggleDoubleZoom = () => {
    if (zoom > MIN_ZOOM) {
      setZoom(MIN_ZOOM);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(DOUBLE_TAP_ZOOM);
    }
  };

  const handleWheel = (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom((z) => clampZoom(z - e.deltaY * 0.01));
  };

  const handleMouseDown = (e) => {
    if (zoom <= MIN_ZOOM) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };
  const handleMouseMove = (e) => {
    if (!dragRef.current) return;
    const { startX, startY, panX, panY } = dragRef.current;
    setPan({ x: panX + (e.clientX - startX), y: panY + (e.clientY - startY) });
  };
  const stopDrag = () => {
    dragRef.current = null;
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    const now = Date.now();
    const lastTap = touchRef.current?.lastTap || 0;
    if (now - lastTap < DOUBLE_TAP_MS) {
      toggleDoubleZoom();
    }
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      panX: pan.x,
      panY: pan.y,
      lastTap: now,
    };
  };
  const handleTouchMove = (e) => {
    if (!touchRef.current) return;
    const touch = e.touches[0];
    if (zoom > MIN_ZOOM) {
      const { startX, startY, panX, panY } = touchRef.current;
      setPan({
        x: panX + (touch.clientX - startX),
        y: panY + (touch.clientY - startY),
      });
    }
  };
  const handleTouchEnd = (e) => {
    if (!touchRef.current || zoom > MIN_ZOOM) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 0) goPrev();
      else goNext();
    }
  };

  const controlButtonStyle = {
    background: "rgba(255, 255, 255, 0.12)",
    border: "none",
    borderRadius: "50%",
    color: "#fff",
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-label="Image viewer"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.92)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <button
        type="button"
        aria-label="Close lightbox"
        title="Close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{ ...controlButtonStyle, position: "absolute", top: 20, right: 20 }}
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {total > 1 && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            background: "rgba(255, 255, 255, 0.12)",
            padding: "4px 12px",
            borderRadius: 999,
          }}
        >
          {index + 1} / {total}
        </div>
      )}

      {total > 1 && (
        <button
          type="button"
          aria-label="Previous image"
          title="Previous image"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          style={{ ...controlButtonStyle, position: "absolute", left: 20 }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {total > 1 && (
        <button
          type="button"
          aria-label="Next image"
          title="Next image"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          style={{ ...controlButtonStyle, position: "absolute", right: 20 }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={current.src}
          alt={current.caption || "Attachment"}
          draggable={false}
          onDoubleClick={toggleDoubleZoom}
          style={{
            maxWidth: "90vw",
            maxHeight: "80vh",
            objectFit: "contain",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: dragRef.current ? "none" : "transform 0.15s ease-out",
            cursor: zoom > MIN_ZOOM ? "grab" : "zoom-in",
            userSelect: "none",
          }}
        />
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255, 255, 255, 0.12)",
          borderRadius: 999,
          padding: "6px 10px",
        }}
      >
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => setZoom((z) => clampZoom(z - 0.5))}
          style={{ ...controlButtonStyle, width: 32, height: 32 }}
        >
          −
        </button>
        <span style={{ color: "#fff", fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => setZoom((z) => clampZoom(z + 0.5))}
          style={{ ...controlButtonStyle, width: 32, height: 32 }}
        >
          +
        </button>
      </div>
    </div>
  );
}
