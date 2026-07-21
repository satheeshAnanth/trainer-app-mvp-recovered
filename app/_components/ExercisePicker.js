"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ExerciseThumb from "app/_components/ExerciseThumb";
import { useModalDismiss } from "app/_components/useModalDismiss";

const RECENT_KEY = "trainer-recent-exercises-v1";

function primaryMedia(exercise) {
  return exercise?.media?.gifMedia ?? exercise?.media?.primaryMedia ?? null;
}

function previewImage(exercise) {
  const media = primaryMedia(exercise);
  if (media?.type === "image" && media.imageUrl) return media.imageUrl;
  if (media?.thumbnailUrl) return media.thumbnailUrl;
  if (exercise?.imageUrl) return exercise.imageUrl;
  return "";
}

function readRecents() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((item) => item?.id && item?.name).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function pushRecent(exercise) {
  if (!exercise?.id) return;
  try {
    const next = [
      { id: exercise.id, name: exercise.name, category: exercise.category, equipment: exercise.equipment },
      ...readRecents().filter((item) => item.id !== exercise.id),
    ].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export default function ExercisePicker({
  open,
  title = "Choose exercise",
  initialQuery = "",
  confirmLabel = "Add exercise",
  mode = "single",
  alreadySelectedIds = [],
  onClose,
  onSelect,
  onConfirm,
}) {
  const multi = mode === "multi";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [recents, setRecents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [basket, setBasket] = useState([]);
  const [basketOpen, setBasketOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const requestIdRef = useRef(0);

  useModalDismiss(open, onClose);

  // Lock page scroll while the picker is open so Android keyboard resize
  // doesn't shove the sheet into the middle of the screen.
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    window.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery || "");
    setSelected(null);
    setBasket([]);
    setBasketOpen(false);
    setError("");
    setResults([]);
    setRecents(readRecents());
    setSearchFocused(true);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [initialQuery, open]);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    setSelected(null);

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          q: term,
          withKeys: "1",
          limit: term ? "60" : "16",
        });
        const response = await fetch(`/api/exercises/master/search?${params}`, {
          signal: controller.signal,
        });
        const json = await response.json();
        if (!response.ok || !json?.ok) throw new Error(json?.message ?? "Unable to load exercises.");
        if (requestId !== requestIdRef.current) return;
        setResults(Array.isArray(json?.data?.exercises) ? json.data.exercises : []);
        // Keep the result list pinned under the search field while typing.
        resultsRef.current?.scrollTo({ top: 0 });
      } catch (err) {
        if (err?.name !== "AbortError" && requestId === requestIdRef.current) {
          setResults([]);
          setError(err?.message ?? "Unable to load exercises.");
        }
      } finally {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, term ? 180 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const alreadySet = useMemo(() => new Set(alreadySelectedIds.map(String)), [alreadySelectedIds]);

  const groupedHint = useMemo(() => {
    if (loading) return "Searching…";
    if (query.trim()) return `${results.length} match${results.length === 1 ? "" : "es"}`;
    return "Type to search — results stay above the keyboard";
  }, [loading, query, results.length]);

  function toggleBasket(exercise) {
    setBasket((current) => {
      if (current.some((item) => item.id === exercise.id)) {
        return current.filter((item) => item.id !== exercise.id);
      }
      return [...current, exercise];
    });
  }

  function confirmSelected() {
    if (!selected) return;
    pushRecent(selected);
    if (multi) {
      toggleBasket(selected);
      return;
    }
    onSelect?.(selected);
  }

  function finishMulti() {
    basket.forEach(pushRecent);
    onConfirm?.(basket);
  }

  function selectRow(item) {
    setSelected(item);
    setSearchFocused(false);
    // Hide keyboard so the Add action is fully visible.
    inputRef.current?.blur();
  }

  if (!open) return null;

  const media = primaryMedia(selected);
  const imageUrl = previewImage(selected);
  const inBasket = selected ? basket.some((item) => item.id === selected.id) : false;
  const alreadyOnPlan = selected ? alreadySet.has(String(selected.id)) : false;
  const actionLabel = multi
    ? inBasket
      ? "Remove from plan"
      : alreadyOnPlan
        ? "Already on template"
        : "Add to plan"
    : confirmLabel;
  const showBrowseLabel = !query.trim();
  // While typing, keep the sticky preview collapsed so results stay visible.
  const showStickyPreview = Boolean(selected) && !searchFocused;

  return (
    <div className="exercise-picker-backdrop" role="presentation">
      <section
        className={[
          "exercise-picker",
          showStickyPreview ? "exercise-picker-with-preview" : "",
          multi ? "exercise-picker-with-footer" : "",
          searchFocused ? "exercise-picker-searching" : "",
        ].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="exercise-picker-header">
          <div className="exercise-picker-title-row">
            <div>
              {!searchFocused ? (
                <p className="eyebrow" style={{ margin: 0 }}>Exercise library</p>
              ) : null}
              <h2 style={{ margin: searchFocused ? 0 : "4px 0 0", fontSize: searchFocused ? 17 : undefined }}>
                {searchFocused ? "Search exercises" : title}
              </h2>
            </div>
            <button className="ghost-button" type="button" onClick={onClose}>Close</button>
          </div>
          <label className="exercise-picker-search">
            <span className="sr-only">Search exercises</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => {
                setSearchFocused(true);
                window.scrollTo(0, 0);
              }}
              onBlur={() => {
                // Delay so a result tap still registers before blur state flips.
                window.setTimeout(() => setSearchFocused(false), 180);
              }}
              placeholder="Type squat, press, row…"
              inputMode="search"
              enterKeyHint="search"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <div className="exercise-picker-search-meta">
            <p className="item-sub" style={{ margin: 0 }}>{groupedHint}</p>
            {query ? (
              <button
                type="button"
                className="ghost-button ghost-button-sm"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery("");
                  setSelected(null);
                  inputRef.current?.focus({ preventScroll: true });
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
          {multi && basket.length > 0 && !searchFocused ? (
            <div className="exercise-picker-basket">
              <button
                type="button"
                className="exercise-picker-basket-toggle"
                onClick={() => setBasketOpen((value) => !value)}
              >
                <span>{basket.length} selected ▸</span>
                <span className="item-sub">{basketOpen ? "Hide" : "Show"}</span>
              </button>
              {basketOpen ? (
                <div className="exercise-picker-basket-chips">
                  {basket.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="filter-chip filter-chip-active"
                      onClick={() => toggleBasket(item)}
                      title="Remove from selection"
                    >
                      {item.name} ×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        {showStickyPreview ? (
          <article className="exercise-picker-preview exercise-picker-preview-sticky">
            <div className="exercise-picker-preview-head">
              <div style={{ minWidth: 0 }}>
                <p className="item-title" style={{ margin: 0 }}>{selected.name}</p>
                <p className="item-sub" style={{ margin: "3px 0 0" }}>
                  {[selected.category, selected.equipment].filter(Boolean).join(" · ") || "Exercise"}
                </p>
              </div>
              <span className="status-chip">{media?.type === "image" ? "GIF" : "Selected"}</span>
            </div>
            <div className="exercise-picker-preview-compact">
              {imageUrl ? (
                <div className="exercise-picker-media exercise-picker-media-compact">
                  <img src={imageUrl} alt={`${selected.name} form preview`} />
                </div>
              ) : (
                <div className="exercise-picker-no-media exercise-picker-no-media-compact">
                  <ExerciseThumb exercise={selected} size={56} />
                  <p className="item-sub">No approved GIF yet.</p>
                </div>
              )}
              <button
                className="continue-btn"
                type="button"
                disabled={multi && alreadyOnPlan && !inBasket}
                onClick={confirmSelected}
              >
                {actionLabel}
              </button>
            </div>
          </article>
        ) : null}

        <div className="exercise-picker-scroll" ref={resultsRef}>
          {!query.trim() && recents.length > 0 ? (
            <div className="exercise-picker-recents">
              <p className="exercise-picker-section-label">Recent</p>
              <div className="exercise-picker-recent-row">
                {recents.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="exercise-picker-recent"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectRow(item)}
                  >
                    <ExerciseThumb exercise={item} size={44} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {showBrowseLabel && !loading ? (
            <p className="exercise-picker-section-label">
              {recents.length ? "Or browse" : "Browse"} · keep typing to filter
            </p>
          ) : null}

          {error ? <p className="item-sub exercise-picker-message">{error}</p> : null}
          {!loading && !error && results.length === 0 ? (
            <p className="item-sub exercise-picker-message">
              {query.trim()
                ? `No matches for “${query.trim()}”. Try “squat” or “press”.`
                : "No exercises available."}
            </p>
          ) : null}

          <div className="exercise-picker-results">
            {results.map((item) => {
              const active = selected?.id === item.id;
              const picked = basket.some((entry) => entry.id === item.id) || alreadySet.has(String(item.id));
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`exercise-picker-result ${active ? "exercise-picker-result-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectRow(item)}
                >
                  <ExerciseThumb exercise={item} size={52} />
                  <span className="exercise-picker-result-copy">
                    <strong>{item.name}</strong>
                    <small>{[item.category, item.equipment].filter(Boolean).join(" · ") || "Tap to select"}</small>
                  </span>
                  <span className="exercise-picker-result-action">
                    {active ? "Selected" : picked ? "In plan" : "Select"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {multi ? (
          <div className="exercise-picker-footer">
            <button
              className="continue-btn"
              type="button"
              disabled={basket.length === 0}
              onClick={finishMulti}
            >
              {basket.length === 0
                ? "Select exercises to continue"
                : `Done · ${basket.length} exercise${basket.length === 1 ? "" : "s"}`}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
