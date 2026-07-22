"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ExerciseThumb from "app/_components/ExerciseThumb";
import { ExerciseMediaSheet } from "app/_components/ExerciseMediaSheet";
import TrainerShell from "app/_components/TrainerShell";
import ClientShell from "app/_components/ClientShell";

const CATEGORIES = [
  "All",
  "Legs",
  "Back",
  "Core",
  "Chest",
  "Functional",
  "Outdoor",
  "Arms",
  "Mobility/Warm-up",
  "Shoulders",
  "Cardio",
  "Bodyweight/Calisthenics",
];

export default function ExercisesPage() {
  const [role, setRole] = useState("trainer");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((json) => {
        if (json?.data?.authenticated) setRole("trainer");
      })
      .catch(() => null);
    fetch("/api/client-auth/session")
      .then((r) => r.json())
      .then((json) => {
        if (json?.data?.authenticated) setRole("client");
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (query.trim().length >= 2) params.set("q", query.trim());
        const res = await fetch(`/api/exercises/master/search?${params.toString()}`);
        const json = await res.json();
        if (!cancelled) {
          setExercises(Array.isArray(json?.data?.exercises) ? json.data.exercises : []);
        }
      } catch {
        if (!cancelled) setExercises([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query.trim().length >= 2 ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const filtered = useMemo(() => {
    if (category === "All") return exercises;
    return exercises.filter((ex) => String(ex.category ?? "") === category);
  }, [category, exercises]);

  const Shell = role === "client" ? ClientShell : TrainerShell;

  return (
    <Shell title="Exercise Library" subtitle="Search the catalog and watch form examples.">
      <article className="card panel">
        <label className="field full">
          <span>Search exercises</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type at least 2 characters…"
          />
        </label>
        <div className="filter-chip-row" style={{ marginTop: 10 }}>
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              className={`filter-chip ${category === item ? "filter-chip-active" : ""}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <p className="item-sub" style={{ marginTop: 8 }}>
          {query.trim().length < 2 ? "Start typing to load exercises from the master catalog." : `${filtered.length} result${filtered.length === 1 ? "" : "s"}`}
        </p>
      </article>

      <div className="list">
        {loading ? <p className="item-sub">Searching…</p> : null}
        {!loading && query.trim().length >= 2 && filtered.length === 0 ? (
          <p className="item-sub">No exercises matched your search.</p>
        ) : null}
        {filtered.map((exercise) => (
          <button
            key={exercise.id}
            type="button"
            className="list-item"
            style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
            onClick={() => setSelected(exercise)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
              <ExerciseThumb exercise={exercise} size={48} />
              <div style={{ minWidth: 0 }}>
                <p className="item-title" style={{ margin: 0 }}>{exercise.name}</p>
                <p className="item-sub" style={{ margin: "4px 0 0" }}>
                  {exercise.category ?? "Uncategorized"}
                  {exercise.equipment ? ` · ${exercise.equipment}` : ""}
                </p>
              </div>
            </div>
            <span className="status-chip">{exercise.media?.primaryMedia ? "Example" : "Details"}</span>
          </button>
        ))}
      </div>

      <p className="item-sub" style={{ marginTop: 8 }}>
        <Link href={role === "client" ? "/my-portal/profile" : "/profile"}>Back to profile</Link>
      </p>

      {selected ? (
        <ExerciseMediaSheet
          exercise={selected}
          onClose={() => setSelected(null)}
          allowSubmit={role === "trainer"}
        />
      ) : null}
    </Shell>
  );
}
