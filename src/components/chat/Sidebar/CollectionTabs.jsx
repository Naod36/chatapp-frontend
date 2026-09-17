import { useEffect, useRef, useState } from "react";

export default function CollectionTabs({
  items,
  value,
  onChange,
  label = "Conversation collections",
}) {
  const scrollRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = () => {
    const node = scrollRef.current;
    if (node)
      setEdges({
        left: node.scrollLeft > 1,
        right: node.scrollLeft + node.clientWidth < node.scrollWidth - 1,
      });
  };
  useEffect(() => {
    const node = scrollRef.current;
    const wheel = (event) => {
      if (
        Math.abs(event.deltaX) >= Math.abs(event.deltaY) ||
        node.scrollWidth <= node.clientWidth
      )
        return;
      const previous = node.scrollLeft;
      node.scrollLeft += event.deltaY;
      if (node.scrollLeft !== previous) event.preventDefault();
    };
    node.addEventListener("wheel", wheel, { passive: false });
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      node.removeEventListener("wheel", wheel);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  useEffect(() => {
    const node = scrollRef.current;
    const selected = [...node.children].find(
      (button) => button.dataset.value === value,
    );
    if (selected) {
      const left = selected.offsetLeft - node.offsetLeft;
      if (left < node.scrollLeft) node.scrollLeft = left;
      else if (left + selected.offsetWidth > node.scrollLeft + node.clientWidth)
        node.scrollLeft = left + selected.offsetWidth - node.clientWidth;
    }
    measure();
  }, [value, items.map((item) => `${item.value}:${item.label}`).join("|")]);
  const scroll = (direction) =>
    scrollRef.current.scrollBy({
      left: direction * scrollRef.current.clientWidth * 0.75,
      behavior: "smooth",
    });
  const keyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = [...scrollRef.current.querySelectorAll("button")];
    const current = buttons.indexOf(document.activeElement);
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
            buttons.length;
    event.preventDefault();
    buttons[index]?.focus();
    buttons[index]?.click();
  };
  return (
    <div className="ht-collection-strip">
      <button
        type="button"
        className="ht-collection-arrow"
        disabled={!edges.left}
        aria-label={`Scroll ${label.toLowerCase()} left`}
        title="Scroll left"
        onClick={() => scroll(-1)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <div
        ref={scrollRef}
        className="ht-collection-tabs"
        role="group"
        aria-label={label}
        onScroll={measure}
        onKeyDown={keyDown}
      >
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            data-value={item.value}
            aria-label={item.ariaLabel}
            title={item.label}
            aria-pressed={value === item.value}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="ht-collection-arrow"
        disabled={!edges.right}
        aria-label={`Scroll ${label.toLowerCase()} right`}
        title="Scroll right"
        onClick={() => scroll(1)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
