import { notFound } from "next/navigation";
import { hasDatabaseUrl, query } from "app/lib/db";
import Link from "next/link";

async function getTrainer(handle) {
  if (!hasDatabaseUrl()) {
    return {
      name: "Demo Trainer",
      specialization: "Strength Training, General Fitness",
      gym_name: null,
      location: null,
      handle,
    };
  }
  try {
    const rows = await query(
      `SELECT name, specialization, gym_name, location, referral_code AS handle
       FROM trainer_phones
       WHERE UPPER(referral_code) = $1 AND COALESCE(is_active, 1) = 1
       LIMIT 1`,
      [handle.toUpperCase()]
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const trainer = await getTrainer(params.handle);
  if (!trainer) return { title: "Trainer Not Found — Trainer App" };
  return {
    title: `${trainer.name} — Trainer App`,
    description: trainer.specialization
      ? `${trainer.name} specialises in ${trainer.specialization}.`
      : `${trainer.name} is a certified fitness trainer.`,
  };
}

export default async function PublicTrainerProfile({ params }) {
  const trainer = await getTrainer(params.handle);
  if (!trainer) notFound();

  const specializations = String(trainer.specialization ?? "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <main style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "system-ui, sans-serif", padding: "0 0 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>

        {/* Header */}
        <header style={{ padding: "32px 0 24px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "linear-gradient(135deg, #2dd4bf, #0d9488)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 700, color: "#0f1117", flexShrink: 0,
            }}>
              {trainer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>{trainer.name}</h1>
              {trainer.gym_name ? (
                <p style={{ margin: "4px 0 0", fontSize: 14, color: "#94a3b8" }}>{trainer.gym_name}</p>
              ) : null}
              {trainer.location ? (
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>{trainer.location}</p>
              ) : null}
            </div>
          </div>
        </header>

        {/* Specializations */}
        {specializations.length > 0 ? (
          <section style={{ padding: "24px 0" }}>
            <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Specializations
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {specializations.map((s) => (
                <span key={s} style={{
                  padding: "6px 14px", borderRadius: 20,
                  border: "1px solid rgba(45,212,191,0.35)",
                  color: "#2dd4bf", fontSize: 13, background: "rgba(45,212,191,0.06)",
                }}>
                  {s}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {/* CTA */}
        <section style={{
          background: "linear-gradient(135deg, rgba(45,212,191,0.1), rgba(45,212,191,0.04))",
          border: "1px solid rgba(45,212,191,0.25)",
          borderRadius: 12, padding: "24px 20px", marginTop: 8,
        }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: "#f1f5f9" }}>
            Train with {trainer.name}
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>
            {trainer.name} uses Trainer App to track sessions, share workout notes, and keep clients on plan between sessions.
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block", padding: "12px 28px",
              background: "#2dd4bf", color: "#0f1117",
              borderRadius: 8, fontWeight: 700, fontSize: 15,
              textDecoration: "none",
            }}
          >
            Get started
          </Link>
        </section>

        {/* Footer */}
        <footer style={{ marginTop: 40, textAlign: "center" }}>
          <Link href="/login" style={{ fontSize: 12, color: "#475569", textDecoration: "none" }}>
            Powered by Trainer App
          </Link>
        </footer>
      </div>
    </main>
  );
}
