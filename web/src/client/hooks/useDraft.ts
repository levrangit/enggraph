import { useEffect, useState } from "react";

export type Draft<T> = {
  value: T;
  update: (fields: Partial<T>) => void;
  isDirty: (field: keyof T) => boolean;
  dirtyCount: number;
  commit: () => void;
  discard: () => void;
};

const PREFIX = "draft:";

function load<T>(storageKey: string): Partial<T> {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + storageKey);
    return raw === null ? {} : (JSON.parse(raw) as Partial<T>);
  } catch {
    return {};
  }
}

function persist(storageKey: string, fields: object): void {
  try {
    if (Object.keys(fields).length === 0) {
      window.sessionStorage.removeItem(PREFIX + storageKey);
    } else {
      window.sessionStorage.setItem(
        PREFIX + storageKey,
        JSON.stringify(fields),
      );
    }
  } catch {
    return;
  }
}

function without<T>(
  fields: Partial<T>,
  secret: readonly (keyof T)[],
): Partial<T> {
  const kept: Partial<T> = { ...fields };
  for (const field of secret) {
    delete kept[field];
  }
  return kept;
}

/** Only the fields someone changed, shown over what is stored.
 * A reload refreshes untouched fields and never a typed one. */
export function useDraft<T extends Record<string, unknown>>(
  storageKey: string,
  stored: T,
  secret: readonly (keyof T)[] = [],
): Draft<T> {
  const signature = JSON.stringify(stored);
  const [owner, setOwner] = useState(storageKey);
  const [edits, setEdits] = useState<Partial<T>>(() => load<T>(storageKey));
  const [saved, setSaved] = useState<{
    fields: Partial<T>;
    over: string;
  } | null>(null);

  if (owner !== storageKey) {
    setOwner(storageKey);
    setEdits(load<T>(storageKey));
    setSaved(null);
  }

  useEffect(() => {
    persist(owner, without(edits, secret));
  }, [owner, edits, secret]);

  // A saved value is shown until the reload that follows the save arrives.
  const shown = saved !== null && saved.over === signature ? saved.fields : {};
  const value = { ...stored, ...shown, ...edits } as T;
  const isDirty = (field: keyof T): boolean =>
    field in edits && edits[field] !== stored[field];
  const dirtyCount = (Object.keys(edits) as (keyof T)[]).filter(isDirty).length;

  const update = (fields: Partial<T>) =>
    setEdits((current) => {
      const next: Partial<T> = { ...current };
      for (const field of Object.keys(fields) as (keyof T)[]) {
        if (fields[field] === stored[field]) {
          delete next[field];
        } else {
          next[field] = fields[field];
        }
      }
      return next;
    });

  const commit = () => {
    setSaved({
      fields: without({ ...shown, ...edits }, secret),
      over: signature,
    });
    setEdits({});
  };

  const discard = () => {
    setSaved(null);
    setEdits({});
  };

  return { value, update, isDirty, dirtyCount, commit, discard };
}

/** Add the unsaved marker to a class list when a field differs from storage. */
export function unsaved(
  base: string | undefined,
  dirty: boolean,
): string | undefined {
  if (!dirty) {
    return base;
  }
  return base === undefined ? "unsaved" : `${base} unsaved`;
}
