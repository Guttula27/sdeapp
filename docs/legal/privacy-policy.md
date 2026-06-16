# VEZEOR — Privacy Policy

**Last updated:** 13 June 2026

This Privacy Policy explains how VEZEOR ("**VEZEOR**", "**we**", "**us**", "**our**") collects, uses, shares and protects personal data when you use the VEZEOR platform, mobile and web applications, APIs and related services (the "**Platform**"). It is published in accordance with the Information Technology Act, 2000, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 and, to the extent in force, the Digital Personal Data Protection Act, 2023 ("**DPDP Act**").

By using the Platform you consent to the practices described in this Policy. If you do not agree, do not use the Platform.

---

## 1. Who this Policy applies to

This Policy applies to three categories of Users:

1. **Customers** ("**Diners**") — who scan a QR code at an Outlet, place an order or make a payment;
2. **Outlet and Business staff** — who log in to operate kitchens, service desks, parcel desks, menus, billing and reports;
3. **Visitors** to our marketing website.

Where you submit personal data of a third party (for example, an Outlet adding a staff member's phone number), you confirm that you have the authority to do so.

## 2. Roles under the DPDP Act

- For Diner data captured through an Outlet's QR ordering flow, the **Outlet is the Data Fiduciary** for the purpose of providing the meal, after-sale service and dispute resolution; **VEZEOR acts as a Data Processor** on the Outlet's behalf.
- For Business and Outlet staff data captured during platform use, **VEZEOR is the Data Fiduciary**.
- For marketing-website data and the broader Platform telemetry, **VEZEOR is the Data Fiduciary**.

Diners may exercise their data-principal rights either through the Outlet or directly with VEZEOR using the contact details in Section 12.

## 3. Data we collect

### 3.1 Diner data

- **Contact details** — phone number (mandatory for OTP login), name, email (optional).
- **Order details** — items ordered, quantity, table or pickup identifier, modifiers, dine-in / parcel choice, special instructions, the QR / table / outlet you scanned.
- **Payment metadata** — payment status, gateway reference IDs. We **do not** receive or store card numbers, CVV, UPI PIN or net-banking credentials. Those are entered directly into the payment gateway.
- **Device / technical data** — IP address, device type, browser, app version, language, time-zone, approximate geolocation derived from IP.
- **Communications** — opt-in for promotional messages (separate from transactional messages), messaging preferences, feedback you submit.

### 3.2 Outlet / Business staff data

- name, phone number, email, profile photograph (optional);
- role, responsibilities, business / outlet assignment;
- login credentials (passwords are stored as bcrypt hashes; we never see your password in clear text);
- audit-log information — what you did inside the Platform, from which IP, at what time;
- KYC / business information you submit during onboarding (GSTIN, FSSAI, PAN, address, bank account, Razorpay Linked Account ID).

### 3.3 Website visitor data

- IP address, browser, pages viewed, referrer, basic analytics events;
- any details you submit through contact or demo-request forms.

## 4. How we use the data

We use personal data to:

- run the QR ordering, kitchen routing, parcel desk, billing and printing flows;
- authenticate Users (OTP for Diners, phone-and-password for staff, JWT-based sessions);
- send **transactional and lifecycle messages** to Diners on the Outlet's behalf (order received, order ready, payment received, feedback request);
- send promotional messages, but **only** where the Diner has separately opted in;
- process and reconcile payments with the payment gateway;
- generate reports, analytics and forecasts for the Outlet and Business;
- maintain audit logs for security, fraud detection and statutory compliance;
- improve, secure, monitor and develop the Platform;
- comply with law, respond to lawful requests from authorities, and enforce our [Terms of Service](./terms-of-service.md).

We do not use Diner data for cross-Outlet profiling or to train third-party advertising models.

## 5. Lawful basis

We rely on one or more of the following grounds: (a) your consent (for example, when you submit your phone for OTP login or opt in to promotional messages); (b) performance of a contract you have entered into (for example, fulfilling your order or providing the Platform to your Outlet); (c) compliance with a legal obligation (for example, retaining tax invoices); (d) our legitimate interests in running, securing and improving the Platform, provided those interests are not overridden by your rights and freedoms.

## 6. Sharing of data

We share personal data only as set out below.

- **With the Outlet.** Diner order, contact and feedback data is shared with the Outlet that received the order, so that the Outlet can prepare the order, contact the Diner if needed and handle any complaint or refund.
- **With payment gateways.** Minimum data needed to initiate, verify or refund a payment is shared with the gateway (currently Razorpay) under its own privacy terms.
- **With messaging providers.** Phone number, email and the message body are shared with the SMS, WhatsApp and email providers we use to deliver transactional and (where opted in) promotional messages.
- **With cloud and infrastructure providers.** Data is hosted on Indian-region cloud infrastructure and is processed by the database, queue and logging services we rely on.
- **With professional advisors and auditors** under confidentiality obligations.
- **With authorities** where disclosure is required by law, court order, or to prevent fraud or imminent harm.
- **In a corporate transaction.** If VEZEOR is involved in a merger, acquisition or sale of assets, personal data may be transferred to the successor entity, subject to this Policy.

We **do not sell** personal data.

## 7. Cookies and similar technologies

The Platform uses cookies and local-storage entries to keep you signed in, remember the QR / table you scanned, remember your language preference, queue requests when you are offline (the in-app outbox) and measure aggregate usage. You can clear cookies and local storage from your browser at any time; doing so will log you out and clear queued offline orders.

## 8. Data retention

We retain personal data only as long as we need it for the purposes set out in Section 4, or as required by law, whichever is longer. As an indicative guide:

- Transactional order data — at least 8 years from the end of the relevant financial year, to comply with GST and tax-audit requirements;
- Diner contact details — for as long as the account is active and 12 months after the last interaction with the Outlet;
- Audit logs — at least 12 months;
- Marketing opt-ins — until you withdraw consent.

On valid deletion request we will delete or anonymise personal data, except where retention is required to comply with law, defend a legal claim, or complete a transaction in progress.

## 9. Security

We follow reasonable security practices and procedures appropriate to the sensitivity of the data, including:

- **encryption in transit** (TLS) and **encryption at rest** for sensitive fields and backups;
- **HMAC-indexed phone lookup** — phone numbers are searchable by hash, so the database cannot be brute-forced to reverse a number from its index;
- **bcrypt** with a high cost factor for staff passwords;
- **JWT-based session tokens** with session revocation on password reset and explicit logout;
- **role and responsibility-based access control** so staff see only what their assignment allows;
- **rate limiting** and **idempotency keys** on write endpoints;
- **audit logs** of significant actions;
- vendor due-diligence on payment and messaging providers.

No method of transmission or storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.

## 10. Your rights

Subject to applicable law you may, by writing to **hello@vezeor.com**:

- **Access** the personal data we hold about you;
- **Correct** inaccurate or incomplete data;
- **Withdraw consent** previously given (for example, to promotional messages);
- **Request erasure** of data we no longer need to retain;
- **Object** to specific processing on grounds relating to your situation;
- **Nominate** an individual to exercise your rights in case of your death or incapacity (where the DPDP Act applies);
- **Complain** to the Data Protection Board of India once it is operational, or to any other competent authority.

We may need to verify your identity before acting on a request. We will respond within the period required by applicable law.

## 11. Children

The Platform is not directed at children below 18 years of age. We do not knowingly collect personal data from children. If you believe a child has provided us personal data, please contact us so that we can delete it.

## 12. Contact and Grievance Officer

For any privacy question, request, complaint or grievance, contact:

- **Email:** hello@vezeor.com
- **Subject line:** `Privacy — <your concern>`
- **Postal:** VEZEOR, Bengaluru, Karnataka, India

The Grievance Officer designated under Rule 5(9) of the IT Rules, 2011 and the corresponding officer under the DPDP Act will acknowledge the complaint within 48 hours and seek to resolve it within the timeline required by applicable law.

## 13. Changes to this Policy

We may update this Privacy Policy from time to time. Material changes will be brought to your attention through an in-app notice or email. The "Last updated" date at the top of this Policy reflects the most recent revision.

---

By continuing to use the Platform after a change is published, you agree to the revised Policy.
