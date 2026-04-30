import RecoveredRoutePage from "app/_components/RecoveredRoutePage";

export default function Page() {
  return (
    <RecoveredRoutePage
      title="sessions / pending-notes"
      description="Recovered route now has a functional shell and can be wired to real DB/auth logic."
      routeKey="sessions/pending-notes"
    />
  );
}
