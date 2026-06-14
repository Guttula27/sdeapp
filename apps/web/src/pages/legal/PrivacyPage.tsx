import LegalLayout from './LegalLayout';

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How VEZEOR collects, uses, shares and protects personal data."
      lastUpdated="13 June 2026"
      current="/legal/privacy"
    >
      <p>
        This Privacy Policy explains how VEZEOR (<strong>“VEZEOR”</strong>, <strong>“we”</strong>,
        <strong> “us”</strong>, <strong>“our”</strong>) collects, uses, shares and protects personal data when you
        use the VEZEOR platform, mobile and web applications, APIs and related services (the
        <strong> “Platform”</strong>). It is published in accordance with the Information Technology Act, 2000, the
        Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or
        Information) Rules, 2011 and, to the extent in force, the Digital Personal Data Protection Act, 2023
        (<strong>“DPDP Act”</strong>).
      </p>
      <p>
        By using the Platform you consent to the practices described in this Policy. If you do not agree, do not use
        the Platform.
      </p>

      <h2>1. Who this Policy applies to</h2>
      <p>This Policy applies to three categories of Users:</p>
      <ol>
        <li>
          <strong>Customers</strong> (<strong>“Diners”</strong>) — who scan a QR code at an Outlet, place an order or
          make a payment;
        </li>
        <li>
          <strong>Outlet and Business staff</strong> — who log in to operate kitchens, service desks, parcel desks,
          menus, billing and reports;
        </li>
        <li><strong>Visitors</strong> to our marketing website.</li>
      </ol>
      <p>
        Where you submit personal data of a third party (for example, an Outlet adding a staff member's phone number),
        you confirm that you have the authority to do so.
      </p>

      <h2>2. Roles under the DPDP Act</h2>
      <ul>
        <li>
          For Diner data captured through an Outlet's QR ordering flow, the <strong>Outlet is the Data Fiduciary</strong>{' '}
          for the purpose of providing the meal, after-sale service and dispute resolution;
          <strong> VEZEOR acts as a Data Processor</strong> on the Outlet's behalf.
        </li>
        <li>
          For Business and Outlet staff data captured during platform use,
          <strong> VEZEOR is the Data Fiduciary</strong>.
        </li>
        <li>
          For marketing-website data and the broader Platform telemetry,
          <strong> VEZEOR is the Data Fiduciary</strong>.
        </li>
      </ul>
      <p>
        Diners may exercise their data-principal rights either through the Outlet or directly with VEZEOR using the
        contact details in Section 12.
      </p>

      <h2>3. Data we collect</h2>

      <h3>3.1 Diner data</h3>
      <ul>
        <li><strong>Contact details</strong> — phone number (mandatory for OTP login), name, email (optional).</li>
        <li>
          <strong>Order details</strong> — items ordered, quantity, table or pickup identifier, modifiers, dine-in /
          parcel choice, special instructions, the QR / table / outlet you scanned.
        </li>
        <li>
          <strong>Payment metadata</strong> — payment status, gateway reference IDs. We <strong>do not</strong> receive
          or store card numbers, CVV, UPI PIN or net-banking credentials. Those are entered directly into the payment
          gateway.
        </li>
        <li>
          <strong>Device / technical data</strong> — IP address, device type, browser, app version, language, time-zone,
          approximate geolocation derived from IP.
        </li>
        <li>
          <strong>Communications</strong> — opt-in for promotional messages (separate from transactional messages),
          messaging preferences, feedback you submit.
        </li>
      </ul>

      <h3>3.2 Outlet / Business staff data</h3>
      <ul>
        <li>name, phone number, email, profile photograph (optional);</li>
        <li>role, responsibilities, business / outlet assignment;</li>
        <li>login credentials (passwords are stored as bcrypt hashes; we never see your password in clear text);</li>
        <li>audit-log information — what you did inside the Platform, from which IP, at what time;</li>
        <li>
          KYC / business information you submit during onboarding (GSTIN, FSSAI, PAN, address, bank account, Razorpay
          Linked Account ID).
        </li>
      </ul>

      <h3>3.3 Website visitor data</h3>
      <ul>
        <li>IP address, browser, pages viewed, referrer, basic analytics events;</li>
        <li>any details you submit through contact or demo-request forms.</li>
      </ul>

      <h2>4. How we use the data</h2>
      <p>We use personal data to:</p>
      <ul>
        <li>run the QR ordering, kitchen routing, parcel desk, billing and printing flows;</li>
        <li>authenticate Users (OTP for Diners, phone-and-password for staff, JWT-based sessions);</li>
        <li>
          send <strong>transactional and lifecycle messages</strong> to Diners on the Outlet's behalf (order received,
          order ready, payment received, feedback request);
        </li>
        <li>send promotional messages, but <strong>only</strong> where the Diner has separately opted in;</li>
        <li>process and reconcile payments with the payment gateway;</li>
        <li>generate reports, analytics and forecasts for the Outlet and Business;</li>
        <li>maintain audit logs for security, fraud detection and statutory compliance;</li>
        <li>improve, secure, monitor and develop the Platform;</li>
        <li>
          comply with law, respond to lawful requests from authorities, and enforce our Terms of Service.
        </li>
      </ul>
      <p>
        We do not use Diner data for cross-Outlet profiling or to train third-party advertising models.
      </p>

      <h2>5. Lawful basis</h2>
      <p>
        We rely on one or more of the following grounds: (a) your consent (for example, when you submit your phone
        for OTP login or opt in to promotional messages); (b) performance of a contract you have entered into (for
        example, fulfilling your order or providing the Platform to your Outlet); (c) compliance with a legal
        obligation (for example, retaining tax invoices); (d) our legitimate interests in running, securing and
        improving the Platform, provided those interests are not overridden by your rights and freedoms.
      </p>

      <h2>6. Sharing of data</h2>
      <p>We share personal data only as set out below.</p>
      <ul>
        <li>
          <strong>With the Outlet.</strong> Diner order, contact and feedback data is shared with the Outlet that
          received the order, so that the Outlet can prepare the order, contact the Diner if needed and handle any
          complaint or refund.
        </li>
        <li>
          <strong>With payment gateways.</strong> Minimum data needed to initiate, verify or refund a payment is
          shared with the gateway (currently Razorpay) under its own privacy terms.
        </li>
        <li>
          <strong>With messaging providers.</strong> Phone number, email and the message body are shared with the
          SMS, WhatsApp and email providers we use to deliver transactional and (where opted in) promotional messages.
        </li>
        <li>
          <strong>With cloud and infrastructure providers.</strong> Data is hosted on Indian-region cloud
          infrastructure and is processed by the database, queue and logging services we rely on.
        </li>
        <li><strong>With professional advisors and auditors</strong> under confidentiality obligations.</li>
        <li>
          <strong>With authorities</strong> where disclosure is required by law, court order, or to prevent fraud or
          imminent harm.
        </li>
        <li>
          <strong>In a corporate transaction.</strong> If VEZEOR is involved in a merger, acquisition or sale of
          assets, personal data may be transferred to the successor entity, subject to this Policy.
        </li>
      </ul>
      <p>We <strong>do not sell</strong> personal data.</p>

      <h2>7. Cookies and similar technologies</h2>
      <p>
        The Platform uses cookies and local-storage entries to keep you signed in, remember the QR / table you
        scanned, remember your language preference, queue requests when you are offline (the in-app outbox) and
        measure aggregate usage. You can clear cookies and local storage from your browser at any time; doing so
        will log you out and clear queued offline orders.
      </p>

      <h2>8. Data retention</h2>
      <p>
        We retain personal data only as long as we need it for the purposes set out in Section 4, or as required by
        law, whichever is longer. As an indicative guide:
      </p>
      <ul>
        <li>
          Transactional order data — at least 8 years from the end of the relevant financial year, to comply with
          GST and tax-audit requirements;
        </li>
        <li>
          Diner contact details — for as long as the account is active and 12 months after the last interaction
          with the Outlet;
        </li>
        <li>Audit logs — at least 12 months;</li>
        <li>Marketing opt-ins — until you withdraw consent.</li>
      </ul>
      <p>
        On valid deletion request we will delete or anonymise personal data, except where retention is required to
        comply with law, defend a legal claim, or complete a transaction in progress.
      </p>

      <h2>9. Security</h2>
      <p>We follow reasonable security practices and procedures appropriate to the sensitivity of the data, including:</p>
      <ul>
        <li><strong>encryption in transit</strong> (TLS) and <strong>encryption at rest</strong> for sensitive fields and backups;</li>
        <li>
          <strong>HMAC-indexed phone lookup</strong> — phone numbers are searchable by hash, so the database cannot
          be brute-forced to reverse a number from its index;
        </li>
        <li><strong>bcrypt</strong> with a high cost factor for staff passwords;</li>
        <li><strong>JWT-based session tokens</strong> with session revocation on password reset and explicit logout;</li>
        <li><strong>role and responsibility-based access control</strong> so staff see only what their assignment allows;</li>
        <li><strong>rate limiting</strong> and <strong>idempotency keys</strong> on write endpoints;</li>
        <li><strong>audit logs</strong> of significant actions;</li>
        <li>vendor due-diligence on payment and messaging providers.</li>
      </ul>
      <p>
        No method of transmission or storage is 100% secure. While we strive to protect your data, we cannot
        guarantee absolute security.
      </p>

      <h2>10. Your rights</h2>
      <p>Subject to applicable law you may, by writing to <strong>hello@vezeor.com</strong>:</p>
      <ul>
        <li><strong>Access</strong> the personal data we hold about you;</li>
        <li><strong>Correct</strong> inaccurate or incomplete data;</li>
        <li><strong>Withdraw consent</strong> previously given (for example, to promotional messages);</li>
        <li><strong>Request erasure</strong> of data we no longer need to retain;</li>
        <li><strong>Object</strong> to specific processing on grounds relating to your situation;</li>
        <li>
          <strong>Nominate</strong> an individual to exercise your rights in case of your death or incapacity (where
          the DPDP Act applies);
        </li>
        <li>
          <strong>Complain</strong> to the Data Protection Board of India once it is operational, or to any other
          competent authority.
        </li>
      </ul>
      <p>
        We may need to verify your identity before acting on a request. We will respond within the period required
        by applicable law.
      </p>

      <h2>11. Children</h2>
      <p>
        The Platform is not directed at children below 18 years of age. We do not knowingly collect personal data
        from children. If you believe a child has provided us personal data, please contact us so that we can delete
        it.
      </p>

      <h2>12. Contact and Grievance Officer</h2>
      <p>For any privacy question, request, complaint or grievance, contact:</p>
      <ul>
        <li><strong>Email:</strong> hello@vezeor.com</li>
        <li><strong>Subject line:</strong> <span style={{ fontFamily: 'monospace' }}>Privacy — &lt;your concern&gt;</span></li>
        <li><strong>Postal:</strong> VEZEOR, Bengaluru, Karnataka, India</li>
      </ul>
      <p>
        The Grievance Officer designated under Rule 5(9) of the IT Rules, 2011 and the corresponding officer under
        the DPDP Act will acknowledge the complaint within 48 hours and seek to resolve it within the timeline
        required by applicable law.
      </p>

      <h2>13. Changes to this Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be brought to your attention
        through an in-app notice or email. The “Last updated” date at the top of this Policy reflects the most
        recent revision.
      </p>

      <hr />
      <p>By continuing to use the Platform after a change is published, you agree to the revised Policy.</p>
    </LegalLayout>
  );
}
