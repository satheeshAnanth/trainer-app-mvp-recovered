const clients = [
  {
    id: "c1",
    name: "Ananya Rao",
    phone: "+91-9876543210",
    goal: "Lose 5kg in 12 weeks",
    plan: "High-protein vegetarian",
    notes: "Prefers evening sessions.",
    priorCondition: "",
    tips: ["Hydrate before workouts", "Prioritize sleep"],
  },
  {
    id: "c2",
    name: "Rohit Sharma",
    phone: "+91-9988776655",
    goal: "Improve mobility and back health",
    plan: "Low impact + mobility",
    notes: "Works night shifts.",
    priorCondition: "Lower back pain when bending; avoid heavy spinal loading.",
    tips: ["Daily mobility flow", "Track lower-back discomfort"],
  },
];

const sessions = [
  {
    id: "s1",
    clientId: "c1",
    title: "Strength Session",
    status: "scheduled",
    date: "2026-05-02",
    notes: "Focus on form checks.",
    amount: 1200,
    paid: false,
    sharedNotes: false,
  },
  {
    id: "s2",
    clientId: "c2",
    title: "Mobility Session",
    status: "completed",
    date: "2026-04-28",
    notes: "Good hip hinge progress.",
    amount: 1000,
    paid: true,
    sharedNotes: true,
  },
];

const scheduleEvents = [
  {
    id: "e1",
    trainer_phone: "+910000000000",
    client_id: "c1",
    client_name: "Ananya Rao",
    scheduled_date: "2026-05-02",
    scheduled_time: "18:00",
    status: "accepted",
    notes: "Bring resistance bands.",
    created_by_role: "trainer",
    created_by_name: "Coach Sat",
  },
  {
    id: "e2",
    trainer_phone: "+910000000000",
    client_id: "c2",
    client_name: "Rohit Sharma",
    scheduled_date: "2026-04-28",
    scheduled_time: "08:00",
    status: "completed",
    notes: "Added thoracic opener drills.",
    created_by_role: "trainer",
    created_by_name: "Coach Sat",
  },
  {
    id: "e3",
    trainer_phone: null,
    client_id: "c1",
    client_name: "Ananya Rao",
    scheduled_date: "2026-05-04",
    scheduled_time: "07:30",
    status: "pending",
    notes: "Need to move the session earlier if possible.",
    created_by_role: "client",
    created_by_name: "Ananya Rao",
  },
];

const invitationTokens = [
  { token: "INVITE-ANANYA", clientId: "c1", valid: true },
  { token: "INVITE-ROHIT", clientId: "c2", valid: true },
];

const pricing = {
  oneToOne: 1200,
  monthly: 9000,
  online: 800,
};

const auditEvents = [
  {
    id: "a1",
    entityType: "system",
    entityId: "bootstrap",
    action: "recovery_bootstrap",
    actor: "system",
    createdAt: "2026-05-04T07:00:00.000Z",
    payload: { source: "mock", note: "Recovered baseline started" },
  },
  {
    id: "a2",
    entityType: "client",
    entityId: "c1",
    action: "client_created",
    actor: "Coach Sat",
    createdAt: "2026-05-04T07:02:00.000Z",
    payload: { clientName: "Ananya Rao" },
  },
  {
    id: "a3",
    entityType: "session",
    entityId: "s2",
    action: "session_completed",
    actor: "Coach Sat",
    createdAt: "2026-04-28T09:30:00.000Z",
    payload: { sessionTitle: "Mobility Session" },
  },
  {
    id: "a4",
    entityType: "payment",
    entityId: "s2",
    action: "payment_marked_paid",
    actor: "Coach Sat",
    createdAt: "2026-04-28T09:45:00.000Z",
    payload: { amount: 1000, currency: "INR" },
  },
];

const trainerProfile = {
  id: "t1",
  name: "Coach Sat",
  specialty: "Strength and mobility",
  bio: "Trainer dashboard recovery baseline profile.",
};

export const mockData = {
  clients,
  sessions,
  scheduleEvents,
  invitationTokens,
  pricing,
  trainerProfile,
  auditEvents,
};
