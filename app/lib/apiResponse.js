import { mockData } from "./mockData";
import { hasDatabaseUrl, query } from "./db";

async function safeQuery(text, params = []) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  try {
    return await query(text, params);
  } catch (_error) {
    return null;
  }
}

async function getRecoveryMeta() {
  if (!hasDatabaseUrl()) {
    return { source: "mock", reason: "DATABASE_URL is not configured" };
  }

  const tables = await safeQuery(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
  );

  if (!tables) {
    return { source: "mock", reason: "database query failed" };
  }

  return {
    source: "database",
    tableCount: tables.length,
    tables: tables.map((row) => row.table_name),
  };
}

export async function buildRecoveredPayload(route, params = {}) {
  const { id } = params;
  const meta = await getRecoveryMeta();

  switch (route) {
    case "api/bootstrap":
      return {
        appName: "trainer-app-mvp",
        recoveryPhase: 3,
        routesRecovered: true,
        dataSource: meta,
      };

    case "api/clients": {
      const rows = await safeQuery(
        `
          SELECT
            id,
            name,
            goal,
            mobile,
            age,
            weight_kg,
            height_cm,
            gender,
            activity_level,
            created_by_trainer,
            created_at,
            updated_at
          FROM clients
          ORDER BY created_at DESC
          LIMIT 200
        `
      );
      return rows
        ? { clients: rows, source: "database", table: "clients" }
        : { clients: mockData.clients, source: "mock", table: null };
    }

    case "api/clients/[id]": {
      const rows = await safeQuery(
        `
          SELECT
            id,
            name,
            goal,
            mobile,
            age,
            weight_kg,
            height_cm,
            gender,
            activity_level,
            created_by_trainer,
            created_at,
            updated_at
          FROM clients
          WHERE id = $1
          LIMIT 1
        `,
        [id]
      );
      const fallback = mockData.clients.find((item) => item.id === id) ?? null;
      return {
        client: rows?.[0] ?? fallback,
        source: rows ? "database" : "mock",
        table: rows ? "clients" : null,
      };
    }

    case "api/clients/[id]/profile": {
      const rows = await safeQuery(
        `
          SELECT
            c.id,
            c.name,
            c.goal,
            c.mobile,
            c.age,
            c.weight_kg,
            c.height_cm,
            c.gender,
            c.activity_level,
            c.created_by_trainer,
            c.created_at,
            c.updated_at,
            cu.email AS user_email,
            cu.is_active AS user_active
          FROM clients c
          LEFT JOIN client_users cu ON cu.client_id = c.id
          WHERE c.id = $1
          LIMIT 1
        `,
        [id]
      );
      const fallback = mockData.clients.find((item) => item.id === id) ?? null;
      return {
        profile: rows?.[0] ?? fallback,
        source: rows ? "database" : "mock",
        table: rows ? "clients" : null,
      };
    }

    case "api/clients/[id]/goal-template": {
      const rows = await safeQuery(
        `
          SELECT id, name, goal
          FROM clients
          WHERE id = $1
          LIMIT 1
        `,
        [id]
      );
      const fallback = mockData.clients.find((item) => item.id === id) ?? null;
      const row = rows?.[0] ?? null;
      const base = row ?? fallback;
      if (!base) {
        return { goalTemplate: null, source: rows ? "database" : "mock", table: rows ? "clients" : null };
      }
      return {
        goalTemplate: {
          clientId: base.id,
          name: base.name,
          goal: base.goal ?? null,
          /** Placeholder field defs until a dedicated goal_template table exists */
          sessionFields: [
            { key: "bodyweight_kg", label: "Bodyweight (kg)", required: true, input: "number", step: "0.1" },
            { key: "energy_score", label: "Energy score (1-10)", required: true, input: "number", min: 1, max: 10 },
            { key: "pain_note", label: "Pain / discomfort note", required: true, input: "text" },
            { key: "trainer_assessment", label: "Trainer progress assessment", required: true, input: "textarea" },
          ],
        },
        source: row ? "database" : "mock",
        table: row ? "clients" : null,
      };
    }

    case "api/clients/[id]/tips": {
      const client = mockData.clients.find((item) => item.id === id) ?? null;
      return { tips: client?.tips ?? [], source: "mock" };
    }

    case "api/sessions": {
      const rows = await safeQuery(
        `
          SELECT
            id,
            client_id,
            client_name_snapshot,
            session_date,
            session_title,
            summary,
            status,
            estimated_calories,
            duration_minutes,
            LEFT(COALESCE(raw_notes, ''), 200) AS raw_notes_preview,
            created_at,
            updated_at
          FROM sessions
          WHERE archived_at IS NULL
          ORDER BY session_date DESC NULLS LAST, created_at DESC
          LIMIT 200
        `
      );
      return rows
        ? { sessions: rows, source: "database", table: "sessions" }
        : { sessions: mockData.sessions, source: "mock", table: null };
    }

    case "api/sessions/[id]": {
      const rows = await safeQuery(
        `
          SELECT
            id,
            client_id,
            client_name_snapshot,
            session_date,
            session_title,
            raw_notes,
            summary,
            status,
            payload_json,
            estimated_calories,
            duration_minutes,
            created_at,
            updated_at
          FROM sessions
          WHERE id = $1
          LIMIT 1
        `,
        [id]
      );
      const fallback = mockData.sessions.find((item) => item.id === id) ?? null;
      return {
        session: rows?.[0] ?? fallback,
        source: rows ? "database" : "mock",
        table: rows ? "sessions" : null,
      };
    }

    case "api/schedule/events": {
      const rows = await safeQuery(
        `
          SELECT
            id,
            trainer_phone,
            client_id,
            client_name,
            scheduled_date,
            scheduled_time,
            notes,
            status,
            created_by_role,
            created_by_name,
            created_at,
            updated_at
          FROM calendar_events
          ORDER BY scheduled_date DESC, scheduled_time DESC
          LIMIT 200
        `
      );
      return rows
        ? { events: rows, source: "database", table: "calendar_events" }
        : { events: mockData.scheduleEvents, source: "mock", table: null };
    }

    case "api/schedule/events/[id]":
    case "api/schedule/events/[id]/notes":
    case "api/schedule/events/[id]/status": {
      const eventRows = await safeQuery(
        `
          SELECT
            id,
            trainer_phone,
            client_id,
            client_name,
            scheduled_date,
            scheduled_time,
            notes,
            status,
            created_by_role,
            created_by_name,
            created_at,
            updated_at
          FROM calendar_events
          WHERE id = $1
          LIMIT 1
        `,
        [id]
      );

      if (!eventRows) {
        const fallback = mockData.scheduleEvents.find((item) => item.id === id) ?? null;
        return { event: fallback, source: "mock", table: null };
      }

      const noteRows = await safeQuery(
        `
          SELECT
            id,
            event_id,
            author_role,
            author_name,
            message,
            created_at
          FROM calendar_event_notes
          WHERE event_id = $1
          ORDER BY created_at DESC
          LIMIT 200
        `,
        [id]
      );

      return {
        event: {
          ...eventRows[0],
          notes_feed: noteRows ?? [],
        },
        source: "database",
        table: "calendar_events",
      };
    }

    case "api/profile/trainer": {
      const rows = await safeQuery(
        `
          SELECT
            id,
            phone,
            name,
            gym_name,
            specialization,
            years_experience,
            location,
            pricing_tier,
            billing_status,
            trial_ends_at,
            max_clients,
            is_active,
            created_at,
            updated_at
          FROM trainer_phones
          ORDER BY updated_at DESC
          LIMIT 1
        `
      );
      return rows
        ? { trainer: rows[0] ?? null, source: "database", table: "trainer_phones" }
        : { trainer: mockData.trainerProfile, source: "mock", table: null };
    }

    case "api/admin/metrics": {
      const rows = await safeQuery(
        `
          SELECT
            (SELECT COUNT(*)::int FROM clients) AS clients,
            (SELECT COUNT(*)::int FROM sessions WHERE archived_at IS NULL) AS sessions,
            (SELECT COUNT(*)::int FROM calendar_events) AS events,
            (SELECT COUNT(*)::int FROM invitations WHERE used_at IS NULL) AS pending_invitations
        `
      );
      if (rows) {
        return { ...rows[0], source: "database" };
      }

      return {
        clients: mockData.clients.length,
        sessions: mockData.sessions.length,
        events: mockData.scheduleEvents.length,
        pending_invitations: mockData.invitationTokens.length,
        source: "mock",
      };
    }

    case "api/admin/health":
      return {
        healthy: true,
        mode: hasDatabaseUrl() ? "database-enabled" : "recovery",
        dataSource: meta,
      };

    case "api/runtime":
    case "api/admin/runtime":
      return {
        nodeEnv: process.env.NODE_ENV ?? "development",
        platform: "nextjs-app-router",
        databaseConfigured: hasDatabaseUrl(),
      };

    case "api/sessions/[id]/status":
    case "api/sessions/[id]/complete": {
      const rows = await safeQuery(`SELECT id, status FROM sessions WHERE id = $1 LIMIT 1`, [id]);
      if (rows) {
        return { id, status: rows[0]?.status ?? "unknown", source: "database", table: "sessions" };
      }
      const session = mockData.sessions.find((item) => item.id === id) ?? null;
      return { id, status: session?.status ?? "unknown", source: "mock", table: null };
    }

    case "api/sessions/[id]/payment": {
      const sessionRows = await safeQuery(
        `
          SELECT
            s.id,
            s.client_id,
            c.created_by_trainer AS trainer_phone
          FROM sessions s
          LEFT JOIN clients c ON c.id = s.client_id
          WHERE s.id = $1
          LIMIT 1
        `,
        [id]
      );

      if (sessionRows?.[0]?.trainer_phone) {
        const monthYear = new Date().toISOString().slice(0, 7);
        const billingRows = await safeQuery(
          `
            SELECT amount_inr, status, paid_at
            FROM billing_records
            WHERE trainer_phone = $1 AND month_year = $2
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [sessionRows[0].trainer_phone, monthYear]
        );

        return {
          id,
          trainer_phone: sessionRows[0].trainer_phone,
          billing: billingRows?.[0] ?? null,
          source: "database",
          table: "billing_records",
        };
      }

      const session = mockData.sessions.find((item) => item.id === id) ?? null;
      return { id, amount: session?.amount ?? 0, paid: session?.paid ?? false, source: "mock", table: null };
    }

    case "api/sessions/[id]/shared-notes":
    case "api/sessions/[id]/share": {
      const rows = await safeQuery(
        `
          SELECT
            id,
            session_id,
            client_id,
            shared_by_trainer,
            shared_at,
            viewed_at
          FROM session_shares
          WHERE session_id = $1
          ORDER BY shared_at DESC NULLS LAST
          LIMIT 50
        `,
        [id]
      );
      if (rows) {
        return { id, shares: rows, sharedNotes: rows.length > 0, source: "database", table: "session_shares" };
      }
      const session = mockData.sessions.find((item) => item.id === id) ?? null;
      return { id, sharedNotes: session?.sharedNotes ?? false, source: "mock", table: null };
    }

    case "api/sessions/[id]/comments":
    case "api/sessions/[id]/discussion/close":
      return {
        id,
        comments: [{ id: "cm1", text: "Discussion comments table not yet mapped." }],
        source: "mock",
        table: null,
      };

    case "api/schedule/context":
      return {
        timezone: "Asia/Kolkata",
        weekStartsOn: "monday",
      };

    case "api/invitations":
      {
        const rows = await safeQuery(
          `
            SELECT
              id,
              email,
              client_id,
              token,
              expires_at,
              used_at,
              created_by_trainer,
              created_at
            FROM invitations
            ORDER BY created_at DESC
            LIMIT 200
          `
        );
        return rows
          ? { invitations: rows, source: "database", table: "invitations" }
          : { invitations: mockData.invitationTokens, source: "mock", table: null };
      }

    case "api/invitations/validate":
      {
        const rows = await safeQuery(
          `
            SELECT
              id,
              token,
              client_id,
              expires_at,
              used_at
            FROM invitations
            WHERE token = $1
            LIMIT 1
          `,
          [params?.token ?? ""]
        );
        if (!rows?.[0]) {
          return { valid: false, source: "database", table: "invitations" };
        }
        const row = rows[0];
        const expired = row.expires_at ? new Date(row.expires_at).getTime() < Date.now() : false;
        const used = Boolean(row.used_at);
        return { valid: !expired && !used, invitation: row, source: "database", table: "invitations" };
      }

    case "api/client/profile":
      {
        const rows = await safeQuery(
          `
            SELECT
              cu.id,
              cu.email,
              cu.name,
              cu.client_id,
              cu.is_active,
              c.goal,
              c.mobile,
              c.age,
              c.weight_kg,
              c.height_cm,
              c.gender,
              c.activity_level
            FROM client_users cu
            LEFT JOIN clients c ON c.id = cu.client_id
            ORDER BY cu.updated_at DESC
            LIMIT 1
          `
        );
        return rows
          ? { profile: rows[0] ?? null, source: "database", table: "client_users" }
          : { profile: mockData.clients[0], source: "mock", table: null };
      }

    case "api/client/sessions":
      {
        const rows = await safeQuery(
          `
            SELECT
              s.id,
              s.client_id,
              s.client_name_snapshot,
              s.session_date,
              s.session_title,
              s.summary,
              s.status,
              s.duration_minutes,
              s.estimated_calories,
              s.created_at
            FROM sessions s
            ORDER BY s.session_date DESC NULLS LAST, s.created_at DESC
            LIMIT 200
          `
        );
        return rows
          ? { sessions: rows, source: "database", table: "sessions" }
          : {
              sessions: mockData.sessions.filter((item) => item.clientId === mockData.clients[0]?.id),
              source: "mock",
              table: null,
            };
      }

    case "api/client/tips":
      return { tips: mockData.clients[0]?.tips ?? [], source: "mock" };

    case "api/exercises/master/search":
      return { items: ["Goblet Squat", "Dead Bug", "Plank"], source: "mock" };

    case "api/exercises/learned":
      return { items: ["Hip Hinge", "Bodyweight Squat"], source: "mock" };

    case "api/exercises/feedback":
      return { accepted: true, source: "mock" };

    case "api/auth/check-phone":
      {
        const phone = params?.phone ?? "";
        const rows = await safeQuery(`SELECT id, phone, name FROM trainer_phones WHERE phone = $1 LIMIT 1`, [phone]);
        if (rows) {
          return { exists: rows.length > 0, next: "otp", trainer: rows[0] ?? null, source: "database", table: "trainer_phones" };
        }
        return { exists: true, next: "otp", source: "mock", table: null };
      }

    case "api/auth/otp/send":
    case "api/auth/otp/resend":
      {
        const phone = params?.phone ?? "";
        const rows = await safeQuery(
          `
            SELECT id, phone, expires_at, created_at
            FROM otp_codes
            WHERE phone = $1
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [phone]
        );
        if (rows) {
          return { sent: true, channel: "sms", otp: rows[0] ?? null, source: "database", table: "otp_codes" };
        }
        return { sent: true, channel: "sms", source: "mock", table: null };
      }

    case "api/auth/otp/verify":
      {
        const phone = params?.phone ?? "";
        const code = params?.code ?? "";
        const rows = await safeQuery(
          `
            SELECT id, phone, code, expires_at, verified_at
            FROM otp_codes
            WHERE phone = $1
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [phone]
        );
        if (rows?.[0]) {
          const latest = rows[0];
          const notExpired = latest.expires_at ? new Date(latest.expires_at).getTime() >= Date.now() : true;
          const verified = latest.code === code && notExpired;
          return { verified, token: verified ? "recovered-session-token" : null, source: "database", table: "otp_codes" };
        }
        return { verified: true, token: "recovered-session-token", source: "mock", table: null };
      }

    case "api/auth/session":
    case "api/client-auth/session":
      return {
        authenticated: true,
        user: {
          role: route.includes("client") ? "client" : "trainer",
        },
        source: hasDatabaseUrl() ? "database" : "mock",
      };

    case "api/client-auth/register":
      return { registered: true, source: hasDatabaseUrl() ? "database" : "mock" };

    case "api/auth/logout":
      return { loggedOut: true, source: "mock" };

    case "api/auth/pricing":
      return { pricing: mockData.pricing, source: "mock" };

    case "api/admin/ready":
      return { ready: true, source: "mock" };

    case "api/admin/backup":
      return { backupTriggered: false, reason: "disabled in recovery mode", source: "mock" };

    case "api/admin/restore":
      return { restoreTriggered: false, reason: "manual process required", source: "mock" };

    case "api/admin/register-trainer":
      return { created: false, reason: "pending auth integration", source: "mock" };

    case "api/audit":
      return {
        records: [
          {
            id: "a1",
            action: "recovery_bootstrap",
            by: "system",
          },
        ],
        source: "mock",
      };

    default:
      return {
        recovered: true,
        route,
        message: "Route recovered with fallback payload.",
        source: "mock",
      };
  }
}
