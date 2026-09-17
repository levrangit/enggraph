import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

export type PickerEntry = {
  value: string;
  label: string;
  group?: string;
};

const GAP = 4;
const MARGIN = 16;
const MIN_WIDTH = 256;
const MAX_HEIGHT = 384;

/** A select whose list scrolls inside the window and can be filtered. */
export function Picker({
  value,
  entries,
  onChange,
}: {
  value: string;
  entries: PickerEntry[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [place, setPlace] = useState<CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const current = entries.find((entry) => entry.value === value);
  const needle = filter.trim().toLowerCase();
  const shown = entries.filter(
    (entry) =>
      needle === "" ||
      entry.label.toLowerCase().includes(needle) ||
      (entry.group ?? "").toLowerCase().includes(needle),
  );

  useLayoutEffect(() => {
    if (!open || trigger.current === null) {
      return;
    }
    const rect = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - GAP - MARGIN;
    const above = rect.top - GAP - MARGIN;
    const upward = below < MAX_HEIGHT && above > below;
    const width = Math.max(rect.width, MIN_WIDTH);
    setPlace({
      left: Math.max(
        MARGIN,
        Math.min(rect.left, window.innerWidth - width - MARGIN),
      ),
      width,
      maxHeight: Math.min(MAX_HEIGHT, upward ? above : below),
      ...(upward
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
    });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function inside(target: EventTarget | null): boolean {
      return (
        target instanceof Node &&
        (trigger.current?.contains(target) === true ||
          panel.current?.contains(target) === true)
      );
    }
    function onPointer(event: MouseEvent) {
      if (!inside(event.target)) {
        setOpen(false);
      }
    }
    function onScroll(event: Event) {
      if (!inside(event.target)) {
        setOpen(false);
      }
    }
    function onResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function pick(next: string) {
    setOpen(false);
    setFilter("");
    trigger.current?.focus();
    if (next !== value) {
      onChange(next);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {current?.label ?? value}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            className="picker-panel"
            style={place}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                trigger.current?.focus();
              }
            }}
          >
            <input
              autoFocus
              placeholder="Filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && shown.length > 0) {
                  event.preventDefault();
                  pick(shown[0].value);
                }
              }}
            />
            <div className="picker-list" role="listbox">
              {shown.length === 0 && (
                <div className="picker-group">Nothing matches.</div>
              )}
              {shown.map((entry, index) => {
                const heading =
                  entry.group !== undefined &&
                  (index === 0 || shown[index - 1].group !== entry.group);
                return (
                  <div key={`${entry.group ?? ""}/${entry.value}`}>
                    {heading && (
                      <div className="picker-group">{entry.group}</div>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={entry.value === value}
                      className={
                        entry.group === undefined
                          ? "picker-option"
                          : "picker-option nested"
                      }
                      onClick={() => pick(entry.value)}
                    >
                      {entry.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
