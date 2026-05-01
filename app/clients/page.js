"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/clients");
        const json = await response.json();
        const list = json?.data?.clients ?? [];
        if (!cancelled) {
          setClients(list);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load clients.");
          setClients([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TrainerShell title="Clients" subtitle="Track each client and progress details.">
      <article className="card panel">
        <h2>Client list</h2>
        {error ? <p className="item-sub">{error}</p> : null}
        <ul className="list">
          {clients.length === 0 && !error ? (
            <li className="list-item">
              <span>No clients yet.</span>
            </li>
          ) : (
            clients.map((c) => (
              <li className="list-item" key={c.id}>
                <div>
                  <p className="item-title">{c.name}</p>
                  <p className="item-sub">{c.goal ? `Goal: ${c.goal}` : "No goal set"}</p>
                </div>
                <Link href={`/clients/${c.id}`} className="ghost-button">
                  Open
                </Link>
              </li>
            ))
          )}
        </ul>
      </article>
    </TrainerShell>
  );
}
