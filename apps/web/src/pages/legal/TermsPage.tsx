import { Link } from 'react-router-dom';
import LegalLayout from './LegalLayout';

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="The contract between you and VEZEOR for use of the Platform."
      lastUpdated="13 June 2026"
      current="/legal/terms"
    >
      <p>
        These Terms of Service (<strong>“Terms”</strong>) govern the access to and use of the VEZEOR platform,
        mobile and web applications, APIs and any related services (collectively, the <strong>“Platform”</strong>)
        operated by VEZEOR (<strong>“VEZEOR”</strong>, <strong>“we”</strong>, <strong>“us”</strong>, <strong>“our”</strong>).
        By accessing the Platform or by creating, claiming or operating a business or outlet account, or by placing
        an order through a VEZEOR-powered QR code, you (<strong>“you”</strong>, <strong>“User”</strong>) agree to
        be bound by these Terms. If you do not agree, do not use the Platform.
      </p>
      <p>
        These Terms are an electronic record under the Information Technology Act, 2000 and the rules made
        thereunder. They do not require any physical or digital signature.
      </p>

      <h2>1. About the Platform</h2>
      <p>
        VEZEOR provides software-as-a-service tools to restaurants, cafés, cloud kitchens, food courts and similar
        food-and-beverage outlets (<strong>“Outlets”</strong>) and to the businesses that operate them
        (<strong>“Businesses”</strong>). The Platform enables:
      </p>
      <ul>
        <li>QR-code ordering by customers at the table or for takeaway;</li>
        <li>Kitchen display, station routing and order lifecycle management for Outlet staff;</li>
        <li>Acceptance of customer payments through third-party payment gateways;</li>
        <li>Sending of transactional and lifecycle messages to customers over SMS, WhatsApp, email or push;</li>
        <li>Reporting, analytics, menu management, promotion management and similar back-of-house tools.</li>
      </ul>
      <p>
        VEZEOR is <strong>only a technology facilitator</strong>. Food, beverages, menu prices, taxes, GST treatment,
        hygiene, food safety, FSSAI compliance, packaging, parcel handling, delivery (if any) and after-sale service
        are the <strong>sole responsibility of the Outlet</strong>. VEZEOR does not own, prepare, store, sell or
        deliver any food or beverage.
      </p>

      <h2>2. Who can use the Platform</h2>
      <p>
        You may use the Platform only if you can form a legally binding contract under the Indian Contract Act, 1872,
        and are not barred from doing so under any applicable law. By creating an account or signing in, you confirm
        that the above is true and that the information you provide is accurate, current and complete.
      </p>
      <p>
        For Business and Outlet accounts, the individual creating or operating the account warrants that they are
        duly authorised to bind the Business / Outlet entity.
      </p>

      <h2>3. Accounts and access</h2>
      <ul>
        <li>
          <strong>Staff accounts.</strong> Each Business / Outlet user logs in with a phone number and password. You
          are responsible for every action taken under your account. Keep your credentials confidential. Notify us
          immediately at hello@vezeor.com if you suspect unauthorised access.
        </li>
        <li>
          <strong>Customer accounts.</strong> Customers sign in via a one-time-password (OTP) sent to their phone. By
          signing in, customers consent to receiving order-related messages on that channel.
        </li>
        <li>
          <strong>Suspension.</strong> We may suspend or terminate access where we reasonably believe the Platform is
          being misused, where statutory or regulatory action requires it, where charges are unpaid past their due
          date, or where continued use materially risks the Platform, its Users or third parties.
        </li>
      </ul>

      <h2>4. Service pricing model</h2>

      <h3>4.1 Free use of the Platform</h3>
      <p>
        Use of the core Platform is offered <strong>free of charge</strong> to Outlets. There is no monthly licence
        fee, per-seat fee, or onboarding fee for the standard feature set.
      </p>

      <h3>4.2 Messaging charges</h3>
      <p>
        Where the Platform sends a message to a customer on behalf of an Outlet (for example, order confirmation,
        ready-for-pickup alert, payment receipt, feedback request), the Outlet is charged for each such message at the
        rates published in the Outlet's billing dashboard. Charges may be paid:
      </p>
      <ul>
        <li><strong>Post-payment</strong>, against periodic invoices raised by VEZEOR; or</li>
        <li>
          <strong>Pre-paid</strong>, from a pool of messages purchased upfront by the Outlet through the Platform
          (<strong>“Message Pool”</strong>).
        </li>
      </ul>
      <p>
        The Message Pool is consumed message-by-message as messages are sent. Unused balance in the Message Pool is
        <strong> non-refundable</strong> except as expressly stated in our{' '}
        <Link to="/legal/refund">Refund Policy</Link>. Rate cards, channel mix (SMS / WhatsApp / email / push) and
        overage handling are described inside the Outlet billing dashboard and may change on prospective notice.
      </p>

      <h3>4.3 Customer payments</h3>
      <p>
        Payments by customers to the Outlet are processed through a third-party payment gateway and settled to the
        Outlet's nominated bank account. Settlement timelines, gateway charges, GST on gateway charges and chargeback
        handling are governed by the gateway's terms. VEZEOR is <strong>not a party</strong> to the customer-to-Outlet
        sale; it merely facilitates the order capture and payment flow.
      </p>

      <h3>4.4 Future paid features and reward programmes</h3>
      <p>
        VEZEOR may, in the future, introduce additional paid features, advanced analytics, or platform-wide customer
        reward or loyalty programmes. Where the Outlet chooses to fund customer rewards, the Outlet contributions
        form part of a pooled rewards balance that may be redeemed by customers across participating Outlets in line
        with the then-current rewards rules. Participation in any such programme is opt-in and governed by the
        specific programme terms presented at the time of opt-in.
      </p>

      <h3>4.5 Taxes</h3>
      <p>
        All charges payable to VEZEOR are <strong>exclusive of GST and other applicable taxes</strong>, which will be
        charged additionally and reflected on tax invoices issued by VEZEOR.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree that you will not, directly or indirectly:</p>
      <ul>
        <li>use the Platform for any unlawful, fraudulent, deceptive, defamatory, obscene or harmful purpose;</li>
        <li>list items the sale of which is prohibited or restricted by law in the jurisdiction of operation;</li>
        <li>misrepresent menu items, prices, taxes, allergens or fulfilment timelines;</li>
        <li>harvest, scrape or copy customer data or other Users' data without authorisation;</li>
        <li>bypass, disable or interfere with security, rate limits, authentication or audit logs;</li>
        <li>introduce malware, viruses or any code intended to disrupt the Platform;</li>
        <li>use the Platform to send unsolicited promotional messages in breach of telecom or anti-spam regulations;</li>
        <li>impersonate any person or misrepresent your affiliation with any person or entity.</li>
      </ul>
      <p>
        We may remove content, disable features, suspend or terminate accounts that violate this section, with or
        without notice.
      </p>

      <h2>6. Customer orders and Outlet responsibility</h2>
      <p>
        Each order placed by a customer on the Platform is a contract for the supply of food or beverage between the
        <strong> customer and the Outlet</strong>. The Outlet is responsible for:
      </p>
      <ul>
        <li>accuracy of menu, pricing, taxes, allergen information and item availability;</li>
        <li>
          preparing, packaging and fulfilling the order in accordance with applicable food-safety law and the
          Outlet's own service standards;
        </li>
        <li>
          handling all customer-facing service issues, complaints, disputes, refund requests, replacements, FSSAI
          compliance and statutory invoices.
        </li>
      </ul>
      <p>
        VEZEOR will make reasonable best efforts to surface the right tools and the right information to the Outlet,
        but VEZEOR does not adjudicate disputes about food quality, quantity, hygiene or service. See the{' '}
        <Link to="/legal/refund">Refund Policy</Link> for the specific allocation of responsibility.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        The Platform, including all software, designs, text, graphics, logos, trade names, trade marks and
        arrangement thereof, is owned by VEZEOR or its licensors and is protected by Indian and international
        intellectual property law. We grant you a limited, non-exclusive, non-transferable, revocable licence to
        access and use the Platform during the term of your account, solely for the permitted purposes set out in
        these Terms.
      </p>
      <p>
        You retain ownership of the menu content, branding, prices, photographs and other materials you upload
        (<strong>“Outlet Content”</strong>). You grant VEZEOR a non-exclusive, royalty-free, worldwide licence to
        host, store, copy, transmit, display and otherwise process Outlet Content as necessary to operate the
        Platform and to provide the service to you and your customers.
      </p>

      <h2>8. Third-party services</h2>
      <p>
        The Platform integrates with third-party services such as payment gateways, SMS / WhatsApp / email
        providers, cloud infrastructure and analytics tools. Your use of those third-party services is subject to
        the third party's own terms and privacy notices. VEZEOR is not responsible for the acts or omissions of any
        third party.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        Except as expressly stated in these Terms, the Platform is provided on an “as is” and “as available” basis
        without warranties of any kind, express or implied, including warranties of merchantability, fitness for a
        particular purpose, non-infringement, uninterrupted availability, accuracy or freedom from errors. VEZEOR
        does not warrant that messages will be delivered through any specific channel within any specific time or at
        all, as message delivery depends on telecom operators, customer device state and third-party providers.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>To the maximum extent permitted by law:</p>
      <ul>
        <li>
          VEZEOR's aggregate liability to a User arising out of or in connection with the Platform in any twelve-month
          period will not exceed the total amount of charges paid by that User to VEZEOR during the immediately
          preceding twelve months;
        </li>
        <li>
          VEZEOR will not be liable for indirect, incidental, consequential, exemplary, punitive or special damages,
          loss of profit, loss of business, loss of goodwill or loss of data, even if VEZEOR has been advised of the
          possibility of such damages.
        </li>
      </ul>
      <p>Nothing in these Terms excludes liability that cannot be excluded under applicable law.</p>

      <h2>11. Indemnity</h2>
      <p>
        You will indemnify and hold VEZEOR, its affiliates, officers, directors, employees and agents harmless from
        any claim, demand, loss, liability, cost or expense (including reasonable legal fees) arising out of (a) your
        breach of these Terms or any applicable law, (b) your Outlet Content or your menu, (c) any sale or fulfilment
        of an order by you, or (d) your infringement of any third-party right.
      </p>

      <h2>12. Term and termination</h2>
      <p>
        These Terms remain in force while you have an account. You may stop using the Platform at any time. VEZEOR
        may suspend or terminate your access on notice if (a) you materially breach these Terms, (b) any amount
        payable to VEZEOR is overdue, (c) your account is dormant, or (d) continued provision of the Platform to you
        is no longer commercially or legally viable. Sections 6, 7, 9, 10, 11, 13, 14 and 16 survive termination.
      </p>

      <h2>13. Governing law and jurisdiction</h2>
      <p>
        These Terms are governed by the laws of India. Subject to Section 14, the courts at Bengaluru, Karnataka have
        exclusive jurisdiction over any dispute arising out of or in connection with these Terms.
      </p>

      <h2>14. Dispute resolution</h2>
      <p>
        Before commencing any litigation, the disputing parties will attempt in good faith to resolve the dispute by
        negotiation between authorised representatives. If unresolved within 30 days, the dispute will be referred to
        arbitration by a sole arbitrator under the Arbitration and Conciliation Act, 1996. The seat and venue of
        arbitration will be Bengaluru, and the language will be English. The award will be final and binding on the
        parties.
      </p>

      <h2>15. Changes to these Terms</h2>
      <p>
        We may amend these Terms from time to time. The revised Terms will be posted on the Platform with an updated
        “Last updated” date. Material changes will be brought to your attention by an in-app notice or by email.
        Continued use of the Platform after the effective date constitutes acceptance.
      </p>

      <h2>16. Miscellaneous</h2>
      <ul>
        <li>
          <strong>Notices.</strong> Notices to VEZEOR may be sent to hello@vezeor.com. Notices to you may be sent to
          the email or phone number on your account or by in-app notice.
        </li>
        <li>
          <strong>Assignment.</strong> You may not assign these Terms without our prior written consent. We may
          assign these Terms in connection with a corporate reorganisation, merger or sale of the business.
        </li>
        <li>
          <strong>Severability.</strong> If any provision of these Terms is held invalid or unenforceable, the
          remaining provisions will continue in full force and effect.
        </li>
        <li>
          <strong>Entire agreement.</strong> These Terms, together with the{' '}
          <Link to="/legal/privacy">Privacy Policy</Link>, <Link to="/legal/refund">Refund Policy</Link> and (where
          applicable) the <Link to="/legal/agreement">Merchant Agreement</Link>, constitute the entire agreement
          between you and VEZEOR with respect to the Platform.
        </li>
      </ul>

      <hr />
      <p>
        For any question about these Terms, write to <strong>hello@vezeor.com</strong>.
      </p>
    </LegalLayout>
  );
}
