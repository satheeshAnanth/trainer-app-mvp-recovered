import assert from "node:assert/strict";

const baseUrl = process.env.SMOKE_BASE_URL ?? "https://trainer-app-mvp-recovered.vercel.app";
const trainerCookie = process.env.SMOKE_TRAINER_COOKIE ?? "trainer_session=+918754473434";
const mutateClients = process.env.SMOKE_MUTATE_CLIENTS === "true";
const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const createdClientName = `Smoke Client ${uniqueSuffix}`;
const createdClientMobile = `+9199${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

async function fetchText(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  return { response, text };
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const json = await response.json();
  return { response, json };
}

function expectRedirect(response, expectedPathFragment, label) {
  assert(
    [301, 302, 303, 307, 308].includes(response.status),
    `${label}: expected redirect, got ${response.status}`,
  );
  const location = response.headers.get("location") ?? "";
  assert(location.includes(expectedPathFragment), `${label}: expected redirect to include ${expectedPathFragment}, got ${location}`);
}

const loginPage = await fetchText("/login", { redirect: "manual" });
assert.equal(loginPage.response.status, 200, "/login should load successfully");
assert(loginPage.text.includes("Loading") || loginPage.text.includes("Sign In"), "login page should render a loading or sign-in state");

const portalRedirect = await fetchText("/portal", { redirect: "manual" });
expectRedirect(portalRedirect.response, "/login?next=%2Fportal", "/portal redirect");

const scheduleRedirect = await fetchText("/schedule", { redirect: "manual" });
expectRedirect(scheduleRedirect.response, "/login?next=%2Fschedule", "/schedule redirect");

const myPortalRedirect = await fetchText("/my-portal", { redirect: "manual" });
expectRedirect(myPortalRedirect.response, "/login?next=%2Fmy-portal&reason=login_required", "/my-portal redirect");

const authSession = await fetchJson("/api/auth/session", {
  headers: { Cookie: trainerCookie },
});
assert.equal(authSession.response.status, 200, "/api/auth/session should load");
assert.equal(Boolean(authSession.json?.data?.authenticated), true, "trainer session should authenticate");

const portalPage = await fetchText("/portal", {
  headers: { Cookie: trainerCookie },
  redirect: "manual",
});
assert.equal(portalPage.response.status, 200, "authenticated /portal should load");
assert(portalPage.text.includes("Trainer dashboard"), "portal page should render dashboard heading");
assert(!portalPage.text.includes(">Audit<"), "trainer nav should not render audit tab");
assert(!portalPage.text.includes(">Insights<"), "trainer nav should not render insights tab");

const auditPage = await fetchText("/audit", {
  headers: { Cookie: trainerCookie },
  redirect: "manual",
});
assert.equal(auditPage.response.status, 200, "authenticated /audit should load");
assert(auditPage.text.includes("Audit Trail"), "audit page should render audit heading");

const insightsPage = await fetchText("/insights", {
  headers: { Cookie: trainerCookie },
  redirect: "manual",
});
assert(
  [200, 307].includes(insightsPage.response.status),
  `authenticated /insights should load or redirect, got ${insightsPage.response.status}`,
);
if (insightsPage.response.status === 200) {
  assert(
    insightsPage.text.includes("Progress overview") || insightsPage.text.includes("Progress snapshot"),
    "authenticated /insights should render the profile workspace",
  );
}

const profilePage = await fetchText("/profile", {
  headers: { Cookie: trainerCookie },
  redirect: "manual",
});
assert.equal(profilePage.response.status, 200, "authenticated /profile should load");
assert(profilePage.text.includes("Progress overview"), "profile should render embedded insights overview");

const auditApi = await fetchJson("/api/audit?limit=25", {
  headers: { Cookie: trainerCookie },
});
assert.equal(auditApi.response.status, 200, "/api/audit should load");
assert(Array.isArray(auditApi.json?.data?.events), "/api/audit should return events");

const clientsBefore = await fetchJson("/api/clients", {
  headers: { Cookie: trainerCookie },
});
assert(Array.isArray(clientsBefore.json?.data?.clients), "/api/clients should return a client list");
const source = clientsBefore.json?.data?.source;
assert(source === "database" || source === "mock", `expected source to be database or mock, got ${source}`);

if (mutateClients) {
  const createResponse = await fetchJson("/api/clients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: trainerCookie,
    },
    body: JSON.stringify({
      name: createdClientName,
      mobile: createdClientMobile,
      goal: "Build consistency and strength",
      age: 29,
      heightCm: 175,
      weightKg: 72,
      activityLevel: "moderate",
      priorCondition: "none",
    }),
  });
  assert.equal(createResponse.response.status, 201, "client creation should succeed");
  assert.equal(Boolean(createResponse.json?.ok), true, "client creation should return ok=true");

  const clientsAfter = await fetchJson("/api/clients", {
    headers: { Cookie: trainerCookie },
  });
  const created = clientsAfter.json?.data?.clients?.find((client) => client?.name === createdClientName);
  assert(created, "created client should appear in the client list after POST");

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    source,
    createdClientName,
    totalClients: clientsAfter.json?.data?.clients?.length ?? null,
    mutated: true,
  }));
} else {
  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    source,
    mutated: false,
  }));
}

