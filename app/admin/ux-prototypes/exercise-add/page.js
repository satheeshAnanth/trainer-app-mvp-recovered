"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "app/_components/AdminShell";
import ExerciseThumb from "app/_components/ExerciseThumb";

const FALLBACK = [
  { id: "squat", name: "Goblet Squat", category: "Strength", equipment: "Dumbbell" },
  { id: "press", name: "Incline Bench Press", category: "Strength", equipment: "Barbell" },
  { id: "row", name: "Seated Cable Row", category: "Back", equipment: "Cable" },
  { id: "lunge", name: "Reverse Lunge", category: "Lower Body", equipment: "Bodyweight" },
  { id: "plank", name: "Front Plank", category: "Core", equipment: "Bodyweight" },
  { id: "walk", name: "Treadmill Walk", category: "Cardio", equipment: "Treadmill" },
];

function mediaUrl(exercise) {
  const media = exercise?.media?.gifMedia ?? exercise?.media?.primaryMedia;
  if (media?.type === "image") return media.imageUrl || "";
  return media?.thumbnailUrl || exercise?.imageUrl || "";
}

export default function ExerciseAddPrototypePage() {
  const [option, setOption] = useState("hybrid");
  const [mode, setMode] = useState("goal");
  const [catalog, setCatalog] = useState(FALLBACK);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState(null);
  const [basket, setBasket] = useState([]);
  const [stage, setStage] = useState("pick");
  const [sets, setSets] = useState([{ reps: "10", load: "20" }]);

  useEffect(() => {
    fetch("/api/exercises/master/search?limit=24&q=")
      .then((response) => response.json())
      .then((json) => {
        const items = json?.data?.exercises;
        if (Array.isArray(items) && items.length) setCatalog(items);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSelected(null);
    setBasket([]);
    setStage("pick");
    setQuery("");
    setCategory("All");
  }, [mode, option]);

  const categories = useMemo(
    () => ["All", ...new Set(catalog.map((item) => item.category).filter(Boolean))].slice(0, 7),
    [catalog]
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog
      .filter((item) => category === "All" || item.category === category)
      .filter((item) => !needle || item.name.toLowerCase().includes(needle))
      .slice(0, 18);
  }, [catalog, category, query]);

  const toggleBasket = (exercise) => {
    setBasket((current) =>
      current.some((item) => item.id === exercise.id)
        ? current.filter((item) => item.id !== exercise.id)
        : [...current, exercise]
    );
  };

  return (
    <AdminShell title="ADMIN — EXERCISE FLOW UX LAB">
      <p style={{ color: "#94a3b8", fontSize: 13 }}>
        Review-only prototypes. Nothing on this page writes to trainer, client or session data.
      </p>

      <div className="prototype-option-grid">
        <OptionButton active={option === "search"} onClick={() => setOption("search")} title="A · Fast Search" copy="Search, preview, then add." />
        <OptionButton active={option === "browse"} onClick={() => setOption("browse")} title="B · Browse & Build" copy="Categories, visual cards and multi-select." />
        <OptionButton active={option === "hybrid"} onClick={() => setOption("hybrid")} title="C · Recommended Hybrid" copy="Recent exercises plus search; behavior adapts to context." />
      </div>

      <div className="prototype-mode-row">
        <button className={mode === "goal" ? "mint-button" : "ghost-button"} type="button" onClick={() => setMode("goal")}>Goal Template</button>
        <button className={mode === "session" ? "mint-button" : "ghost-button"} type="button" onClick={() => setMode("session")}>Live Logging</button>
      </div>

      <div className="prototype-phone">
        <div className="prototype-phone-status">Cadence prototype <span>13:42</span></div>
        {option === "search" ? (
          <FastSearch
            mode={mode}
            query={query}
            setQuery={setQuery}
            items={filtered}
            selected={selected}
            setSelected={setSelected}
            setStage={setStage}
            stage={stage}
            sets={sets}
            setSets={setSets}
          />
        ) : null}
        {option === "browse" ? (
          <BrowseBuild
            mode={mode}
            categories={categories}
            category={category}
            setCategory={setCategory}
            items={filtered}
            basket={basket}
            toggleBasket={toggleBasket}
            stage={stage}
            setStage={setStage}
          />
        ) : null}
        {option === "hybrid" ? (
          <Hybrid
            mode={mode}
            query={query}
            setQuery={setQuery}
            items={filtered}
            selected={selected}
            setSelected={setSelected}
            basket={basket}
            toggleBasket={toggleBasket}
            stage={stage}
            setStage={setStage}
            sets={sets}
            setSets={setSets}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}

function OptionButton({ active, onClick, title, copy }) {
  return (
    <button type="button" onClick={onClick} className={`prototype-option ${active ? "prototype-option-active" : ""}`}>
      <strong>{title}</strong>
      <span>{copy}</span>
    </button>
  );
}

function PrototypeHeader({ eyebrow, title, onBack }) {
  return (
    <header className="prototype-header">
      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
      </div>
      {onBack ? <button type="button" className="ghost-button ghost-button-sm" onClick={onBack}>Back</button> : <button type="button" className="ghost-button ghost-button-sm">Close</button>}
    </header>
  );
}

function FastSearch({ mode, query, setQuery, items, selected, setSelected, stage, setStage, sets, setSets }) {
  if (stage === "log" && selected) {
    return <LoggingEditor exercise={selected} sets={sets} setSets={setSets} onBack={() => setStage("pick")} />;
  }
  return (
    <>
      <PrototypeHeader eyebrow={mode === "goal" ? "Goal template" : "Live session"} title="Search exercise" />
      <div className="prototype-body">
        <input className="prototype-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercise name" autoFocus />
        {selected ? <Preview exercise={selected} action={mode === "goal" ? "Add to template" : "Start logging"} onAction={() => setStage(mode === "goal" ? "done" : "log")} /> : null}
        {stage === "done" ? <Notice text={`${selected?.name} added to the goal template.`} /> : null}
        <div className="prototype-list">
          {items.slice(0, 8).map((item) => <ExerciseRow key={item.id} item={item} action="Preview" onClick={() => { setSelected(item); setStage("pick"); }} />)}
        </div>
      </div>
    </>
  );
}

function BrowseBuild({ mode, categories, category, setCategory, items, basket, toggleBasket, stage, setStage }) {
  return (
    <>
      <PrototypeHeader eyebrow={mode === "goal" ? "Build a goal template" : "Add to live session"} title={stage === "configure" ? "Configure selection" : "Browse exercises"} onBack={stage === "configure" ? () => setStage("pick") : null} />
      <div className="prototype-body">
        {stage === "configure" ? (
          <ConfigureList items={basket} mode={mode} />
        ) : (
          <>
            <div className="prototype-chips">
              {categories.map((item) => <button key={item} type="button" className={category === item ? "filter-chip filter-chip-active" : "filter-chip"} onClick={() => setCategory(item)}>{item}</button>)}
            </div>
            <div className="prototype-visual-grid">
              {items.slice(0, 10).map((item) => {
                const checked = basket.some((entry) => entry.id === item.id);
                return (
                  <button type="button" key={item.id} className={`prototype-visual-card ${checked ? "prototype-visual-card-active" : ""}`} onClick={() => toggleBasket(item)}>
                    <ExerciseThumb exercise={item} size={72} />
                    <strong>{item.name}</strong>
                    <small>{checked ? "Selected ✓" : "Tap to select"}</small>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      {basket.length && stage !== "configure" ? <button type="button" className="prototype-sticky-action" onClick={() => setStage("configure")}>Continue with {basket.length}</button> : null}
    </>
  );
}

function Hybrid({ mode, query, setQuery, items, selected, setSelected, basket, toggleBasket, stage, setStage, sets, setSets }) {
  if (stage === "log" && selected) {
    return <LoggingEditor exercise={selected} sets={sets} setSets={setSets} onBack={() => setStage("pick")} />;
  }
  if (stage === "configure") {
    return (
      <>
        <PrototypeHeader eyebrow="Goal template" title="Set targets" onBack={() => setStage("pick")} />
        <div className="prototype-body"><ConfigureList items={basket} mode={mode} /></div>
      </>
    );
  }
  return (
    <>
      <PrototypeHeader eyebrow={mode === "goal" ? "Build goal template" : "Live session"} title={mode === "goal" ? "Choose exercises" : "Add exercise"} />
      <div className="prototype-body">
        {!query ? (
          <>
            <p className="prototype-section-label">Recent exercises</p>
            <div className="prototype-recent">
              {items.slice(0, 4).map((item) => <button key={item.id} type="button" onClick={() => setSelected(item)}><ExerciseThumb exercise={item} size={52} /><span>{item.name}</span></button>)}
            </div>
          </>
        ) : null}
        <input className="prototype-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all exercises" />
        {selected ? (
          <Preview
            exercise={selected}
            action={mode === "goal" ? (basket.some((item) => item.id === selected.id) ? "Remove from plan" : "Add to plan") : "Log this exercise"}
            onAction={() => {
              if (mode === "goal") toggleBasket(selected);
              else setStage("log");
            }}
          />
        ) : null}
        <div className="prototype-list">
          {items.slice(0, 8).map((item) => <ExerciseRow key={item.id} item={item} action="Preview" onClick={() => setSelected(item)} />)}
        </div>
      </div>
      {mode === "goal" && basket.length ? <button type="button" className="prototype-sticky-action" onClick={() => setStage("configure")}>Configure {basket.length} exercise{basket.length === 1 ? "" : "s"}</button> : null}
    </>
  );
}

function ExerciseRow({ item, action, onClick }) {
  return (
    <button type="button" className="prototype-exercise-row" onClick={onClick}>
      <ExerciseThumb exercise={item} size={52} />
      <span><strong>{item.name}</strong><small>{[item.category, item.equipment].filter(Boolean).join(" · ")}</small></span>
      <em>{action}</em>
    </button>
  );
}

function Preview({ exercise, action, onAction }) {
  const image = mediaUrl(exercise);
  return (
    <article className="prototype-preview">
      <div><strong>{exercise.name}</strong><small>{exercise.category || "Exercise"} · animated form preview</small></div>
      {image ? <img src={image} alt={`${exercise.name} preview`} /> : <div className="prototype-preview-placeholder"><ExerciseThumb exercise={exercise} size={80} /><span>No approved GIF yet</span></div>}
      <button className="mint-button" type="button" onClick={onAction}>{action}</button>
    </article>
  );
}

function ConfigureList({ items, mode }) {
  if (!items.length) return <Notice text="Select at least one exercise first." />;
  return (
    <div className="prototype-configure">
      {items.map((item) => (
        <article key={item.id}>
          <strong>{item.name}</strong>
          <label>Target <input defaultValue={mode === "goal" ? "3 × 10 progressive load" : "3 sets"} /></label>
          {mode === "goal" ? <label>Frequency <select defaultValue="every"><option value="every">Every session</option><option value="twice">2× weekly</option></select></label> : null}
        </article>
      ))}
      <button className="continue-btn" type="button">Save {mode === "goal" ? "goal template" : "session exercises"}</button>
    </div>
  );
}

function LoggingEditor({ exercise, sets, setSets, onBack }) {
  return (
    <>
      <PrototypeHeader eyebrow="Live session" title={exercise.name} onBack={onBack} />
      <div className="prototype-body">
        <Preview exercise={exercise} action="Hide preview" onAction={() => {}} />
        <p className="prototype-section-label">Sets</p>
        {sets.map((set, index) => (
          <div className="prototype-set-row" key={index}>
            <strong>{index + 1}</strong>
            <label>Reps<input inputMode="numeric" value={set.reps} onChange={(event) => setSets((rows) => rows.map((row, i) => i === index ? { ...row, reps: event.target.value } : row))} /></label>
            <label>Load kg<input inputMode="decimal" value={set.load} onChange={(event) => setSets((rows) => rows.map((row, i) => i === index ? { ...row, load: event.target.value } : row))} /></label>
          </div>
        ))}
        <button className="ghost-button" type="button" onClick={() => setSets((rows) => [...rows, { reps: "", load: "" }])}>+ Add set</button>
        <button className="continue-btn" type="button">Finish exercise</button>
      </div>
    </>
  );
}

function Notice({ text }) {
  return <div className="callout-card"><p className="item-title" style={{ margin: 0 }}>{text}</p></div>;
}
