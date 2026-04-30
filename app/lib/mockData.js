const clients = [
  {
    id: "c1",
    name: "Ananya Rao",
    phone: "+91-9876543210",
    goal: "Lose 5kg in 12 weeks",
    plan: "High-protein vegetarian",
    notes: "Prefers evening sessions.",
    tips: ["Hydrate before workouts", "Prioritize sleep"],
  },
  {
    id: "c2",
    name: "Rohit Sharma",
    phone: "+91-9988776655",
    goal: "Improve mobility and back health",
    plan: "Low impact + mobility",
    notes: "Works night shifts.",
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
    sessionId: "s1",
    title: "Ananya - Strength",
    start: "2026-05-02T18:00:00+05:30",
    status: "scheduled",
    notes: "Bring resistance bands.",
  },
  {
    id: "e2",
    sessionId: "s2",
    title: "Rohit - Mobility",
    start: "2026-04-28T08:00:00+05:30",
    status: "done",
    notes: "Added thoracic opener drills.",
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
};
