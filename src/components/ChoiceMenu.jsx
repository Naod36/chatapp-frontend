import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ChoiceMenu.css";

export default function ChoiceMenu({ label, value, options, onChange, disabled = false, placeholder = "Choose", themeTokens: t, actions = false }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const id = useId();
  const close = () => { setOpen(false); triggerRef.current?.focus({ preventScroll: true }); };
  useLayoutEffect(() => {
    if (!open || disabled) return;
    const menu = menuRef.current;
    const position = () => {
      const trigger = triggerRef.current.getBoundingClientRect();
      menu.style.width = `${Math.min(Math.max(trigger.width, 190), window.innerWidth - 16)}px`;
      const height = menu.getBoundingClientRect().height;
      menu.style.left = `${Math.max(8, Math.min(trigger.left, window.innerWidth - menu.offsetWidth - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(trigger.bottom + 4, window.innerHeight - height - 8))}px`;
    };
    position();
    (menu.querySelector('[aria-checked="true"]:not(:disabled)') || menu.querySelector("button:not(:disabled)"))?.focus();
    const outside = (event) => {
      if (!menu.contains(event.target) && !triggerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open, disabled]);
  return <>
    <button type="button" ref={triggerRef} className="ht-choice-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open && !disabled} aria-controls={open && !disabled ? id : undefined} disabled={disabled}
      style={{ background: t.inputBg || t.cardBg, color: t.text, border: t.inputBorder || t.border }}
      onClick={() => setOpen(!open)} onKeyDown={(event) => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setOpen(true); } }}>
      <span>{options.find((option) => option.value === value)?.label || placeholder}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && !disabled && createPortal(<div id={id} ref={menuRef} role="menu" aria-label={label} className="ht-choice-menu" style={{ background: t.sidebarBg || t.cardBg, color: t.text, border: t.border }} onKeyDown={(event) => {
      if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); event.stopPropagation(); close(); return; }
      const buttons = [...menuRef.current.querySelectorAll("button:not(:disabled)")];
      const current = buttons.indexOf(document.activeElement);
      let index;
      if (event.key === "Home") index = 0;
      else if (event.key === "End") index = buttons.length - 1;
      else if (event.key === "ArrowDown") index = (current + 1) % buttons.length;
      else if (event.key === "ArrowUp") index = (current - 1 + buttons.length) % buttons.length;
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) index = buttons.findIndex((button, position) => position > current && button.textContent.toLowerCase().startsWith(event.key.toLowerCase()));
      if (index !== undefined) { event.preventDefault(); buttons[index]?.focus(); }
    }}>
      {options.map((option) => <button key={option.value} type="button" role={actions ? "menuitem" : "menuitemradio"} aria-checked={actions ? undefined : option.value === value} disabled={option.disabled} onClick={() => { close(); onChange(option.value); }}>
        <span>{option.label}</span>{!actions && option.value === value && <span aria-hidden="true">&#10003;</span>}
      </button>)}
    </div>, document.body)}
  </>;
}