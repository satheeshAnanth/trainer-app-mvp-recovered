"use client";

import { useEffect, useState } from "react";
import TrainerShell from "app/_components/TrainerShell";

export default function Page() {
  const [events, setEvents] = useState([]);
  const [message, setMessage] = useState("");

  async function loadEvents() {
    const response = await fetch("/api/schedule/events");
    const json = await response.json();
    setEvents(json?.data?.events ?? []);
  }

  useEffect(() => {
    loadEvents();
  }, []);

  async function setStatus(eventId, status) {
    setMessage("");
    const response = await fetch(`/api/schedule/events/${eventId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await response.json();
    if (!response.ok || !json?.ok) {
      setMessage(json?.message ?? "Unable to update event.");
      return;
    }
    setMessage(`Event updated: ${status}`);
    await loadEvents();
  }

  return (
    <TrainerShell title="Schedule" subtitle="Upcoming sessions and status.">
      <article className="card panel">
        <h2>Upcoming</h2>
        <ul className="list">
          {events.length === 0 ? (
            <li className="list-item"><span>No events available.</span></li>
          ) : (
            events.map((event) => (
              <li className="list-item" key={event.id}>
                <div>
                  <p className="item-title">{event.client_name} - {event.title ?? "Session"}</p>
                  <p className="item-sub">
                    {event.scheduled_date} {event.scheduled_time ? `, ${event.scheduled_time}` : ""}
                  </p>
                </div>
                <div className="quick-actions">
                  <span className="status-chip">{event.status ?? "scheduled"}</span>
                  <button className="ghost-button" type="button" onClick={() => setStatus(event.id, "done")}>
                    Mark done
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
        {message ? <p className="item-sub">{message}</p> : null}
      </article>
    </TrainerShell>
  );
}
