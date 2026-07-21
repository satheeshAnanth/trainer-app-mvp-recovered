export const metadata = {
  title: "Terms of Use | TrainerApp",
  description: "Terms governing use of TrainerApp by trainers and clients.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <p className="legal-eyebrow">TrainerApp · in.trainer.fitness</p>
        <h1>Terms of Use</h1>
        <p className="legal-meta">Last updated: 21 July 2026</p>

        <p>
          These Terms of Use (&quot;Terms&quot;) govern access to TrainerApp, the Android app and website
          operated for fitness trainers and their clients. By creating an account or using the service,
          you agree to these Terms.
        </p>

        <h2>1. The service</h2>
        <p>
          TrainerApp provides tools for session logging, client management, scheduling, goal tracking,
          and related practice workflows. Features may change as we improve the product.
        </p>

        <h2>2. Accounts</h2>
        <ul>
          <li>You must provide an accurate phone number you control for OTP login.</li>
          <li>You are responsible for activity on your account.</li>
          <li>Trainers are responsible for the accuracy of records they enter about clients.</li>
          <li>Clients may only access portals they have been invited to by their trainer.</li>
        </ul>

        <h2>3. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the service for unlawful, harmful, or abusive purposes</li>
          <li>Attempt to access another trainer&apos;s or client&apos;s data without authorization</li>
          <li>Reverse engineer, disrupt, or overload the service</li>
          <li>Upload content you do not have rights to share</li>
        </ul>

        <h2>4. Health disclaimer</h2>
        <p>
          TrainerApp is a practice management and logging tool. It is not a medical device and does not
          provide medical advice, diagnosis, or treatment. Trainers and clients remain responsible for
          training decisions and for seeking qualified professional advice when needed.
        </p>

        <h2>5. Payments</h2>
        <p>
          Any payment fields in the app are for record-keeping between trainer and client. TrainerApp
          does not currently process card payments or in-app purchases inside the Play Store billing
          system unless explicitly stated in a future update.
        </p>

        <h2>6. Intellectual property</h2>
        <p>
          The TrainerApp product, branding, and software remain our property. You retain rights to the
          content and records you enter, and grant us a limited license to host and display that content
          to operate the service for you and your linked trainer/client relationships.
        </p>

        <h2>7. Availability and changes</h2>
        <p>
          We aim for reliable availability but do not guarantee uninterrupted service. We may modify or
          discontinue features with reasonable notice when practical.
        </p>

        <h2>8. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, TrainerApp and its operators are not liable for
          indirect, incidental, or consequential damages arising from use of the service, including lost
          profits, lost data, or training outcomes. Our total liability for any claim is limited to the
          amount you paid us for the service in the three months before the claim (or zero if the
          service was free).
        </p>

        <h2>9. Termination</h2>
        <p>
          You may stop using the service at any time. We may suspend or terminate access for violations
          of these Terms, unpaid subscription status where applicable, or to protect the service and its
          users.
        </p>

        <h2>10. Governing law</h2>
        <p>
          These Terms are governed by the laws of India. Courts in India shall have exclusive
          jurisdiction, subject to applicable consumer protections.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions: <a href="mailto:getsatxray@gmail.com">getsatxray@gmail.com</a>
        </p>

        <p className="legal-footer">
          <a href="/privacy">Privacy Policy</a>
          {" · "}
          <a href="/login">Back to login</a>
        </p>
      </article>
    </main>
  );
}
