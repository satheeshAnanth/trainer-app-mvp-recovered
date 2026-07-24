export const metadata = {
  title: "Privacy Policy | Cadence",
  description: "How Cadence collects, uses, and protects trainer and client data.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <p className="legal-eyebrow">Cadence · in.trainer.fitness</p>
        <h1>Privacy Policy</h1>
        <p className="legal-meta">Last updated: 21 July 2026</p>

        <p>
          Cadence (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a fitness practice tool for personal trainers and
          their clients in India. This policy explains what information we collect, why we collect it,
          and how you can control it.
        </p>

        <h2>1. Who this applies to</h2>
        <ul>
          <li>
            <strong>Trainers</strong> who create an account to manage clients, sessions, schedules, and
            practice records.
          </li>
          <li>
            <strong>Clients</strong> invited by a trainer who use the client portal to view sessions,
            progress, schedule, and related information.
          </li>
        </ul>

        <h2>2. Information we collect</h2>
        <h3>Account and identity</h3>
        <ul>
          <li>Mobile phone number (used for OTP login)</li>
          <li>Name and basic profile details you provide</li>
          <li>Role (trainer or client) and trainer–client relationship</li>
        </ul>

        <h3>Fitness and practice data</h3>
        <ul>
          <li>Session logs (exercises, sets, reps, load, effort, notes, completion status)</li>
          <li>Goal templates, health profile fields, and progress metrics you or your trainer enter</li>
          <li>Schedule / appointment details and confirmation status</li>
          <li>Optional payment tracking notes (record-keeping only; we do not process card payments)</li>
          <li>Optional push notification device tokens if notifications are enabled</li>
        </ul>

        <h3>Technical data</h3>
        <ul>
          <li>Session cookies needed to keep you signed in</li>
          <li>Basic device / app environment information needed to operate the Android app and web app</li>
          <li>Server logs used for security, abuse prevention, and reliability</li>
        </ul>

        <h2>3. How we use information</h2>
        <ul>
          <li>Authenticate users with OTP and maintain secure sessions</li>
          <li>Provide trainer and client product features (logging, scheduling, messaging/notes, progress)</li>
          <li>Send optional reminders or product notifications you enable</li>
          <li>Improve reliability, diagnose issues, and prevent fraud or misuse</li>
          <li>Comply with legal obligations when required</li>
        </ul>
        <p>We do not sell personal information.</p>

        <h2>4. Sharing</h2>
        <ul>
          <li>
            <strong>Within the product:</strong> a client&apos;s training data is shared with that
            client&apos;s assigned trainer (and vice versa for trainer notes meant for the client).
          </li>
          <li>
            <strong>Service providers:</strong> infrastructure providers that host the app, send OTP SMS,
            or deliver push notifications, only as needed to operate the service.
          </li>
          <li>
            <strong>Legal:</strong> if required by law, regulation, or valid legal process.
          </li>
        </ul>

        <h2>5. Data retention</h2>
        <p>
          We retain account and training records while the account is active and for a reasonable period
          afterward so trainers and clients can access history, resolve disputes, or meet legal needs.
          You may request deletion of your account data as described below.
        </p>

        <h2>6. Security</h2>
        <p>
          We use OTP-based login (no passwords stored by Cadence), access controls that scope client
          data to the owning trainer relationship, and standard hosting protections. No method of
          transmission or storage is 100% secure.
        </p>

        <h2>7. Children</h2>
        <p>
          Cadence is intended for adults managing fitness practices and adult clients. It is not
          directed at children under 13. If you believe a child has provided personal data, contact us
          and we will delete it.
        </p>

        <h2>8. Your choices</h2>
        <ul>
          <li>Update profile and training information inside the app</li>
          <li>Disable push notifications in device settings</li>
          <li>
            Request access, correction, or deletion of your account data by emailing{" "}
            <a href="mailto:getsatxray@gmail.com">getsatxray@gmail.com</a>
          </li>
        </ul>

        <h2>9. International users</h2>
        <p>
          Cadence is primarily offered in India. If you access the service from another country, your
          information may be processed in India or in countries where our hosting providers operate.
        </p>

        <h2>10. Changes</h2>
        <p>
          We may update this policy from time to time. The &quot;Last updated&quot; date above will change when
          we do. Continued use of Cadence after an update means you accept the revised policy.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about privacy:{" "}
          <a href="mailto:getsatxray@gmail.com">getsatxray@gmail.com</a>
          <br />
          Developer / publisher contact for Play Store: getsatxray@gmail.com
        </p>

        <p className="legal-footer">
          <a href="/terms">Terms of Use</a>
          {" · "}
          <a href="/login">Back to login</a>
        </p>
      </article>
    </main>
  );
}
