import { Link } from 'react-router-dom';
import LegalLayout from './LegalLayout';

export default function AgreementPage() {
  return (
    <LegalLayout
      title="Merchant Agreement"
      subtitle="The agreement between VEZEOR and the Business / Outlet that uses the Platform."
      lastUpdated="13 June 2026"
      current="/legal/agreement"
    >
      <p>
        This Merchant Agreement (<strong>“Agreement”</strong>) is entered into between VEZEOR (<strong>“VEZEOR”</strong>,
        <strong> “we”</strong>, <strong>“us”</strong>, <strong>“our”</strong>) and the business or outlet entity that
        creates, claims or operates an account on the Platform (<strong>“Merchant”</strong>, <strong>“you”</strong>,
        <strong> “your”</strong>). It is supplemental to and incorporates by reference the{' '}
        <Link to="/legal/terms">Terms of Service</Link>, <Link to="/legal/privacy">Privacy Policy</Link> and{' '}
        <Link to="/legal/refund">Refund Policy</Link>. In case of conflict between this Agreement and the Terms of
        Service on a Merchant-specific matter, this Agreement prevails.
      </p>
      <p>
        This Agreement is an electronic record under the Information Technology Act, 2000. By creating, claiming or
        operating a Business or Outlet account on the Platform, you accept this Agreement. No physical or digital
        signature is required.
      </p>

      <h2>1. Definitions</h2>
      <p>In this Agreement, the following terms have the meanings given below.</p>
      <ul>
        <li>
          <strong>Business</strong> — the legal entity that owns or operates one or more Outlets and that is set up
          at the Business tier on the Platform.
        </li>
        <li>
          <strong>Outlet</strong> — each physical or virtual point of sale (restaurant, café, kiosk, cloud kitchen,
          food court counter) operated by the Business.
        </li>
        <li>
          <strong>Customer</strong> or <strong>Diner</strong> — an end user who places an order through a QR code or
          other entry point powered by the Platform.
        </li>
        <li><strong>Platform</strong> — has the meaning given in the Terms of Service.</li>
        <li><strong>Charges</strong> — amounts payable by the Merchant to VEZEOR under Section 4.</li>
        <li>
          <strong>Message</strong> — any SMS, WhatsApp, email or push notification dispatched through the Platform on
          the Merchant's behalf to a Customer or staff member.
        </li>
        <li><strong>Message Pool</strong> — the prepaid balance of Messages purchased by the Merchant.</li>
        <li>
          <strong>Payment Gateway</strong> — the third-party payment processor (currently Razorpay) used to accept
          and settle Customer payments.
        </li>
        <li>
          <strong>Settlement Account</strong> — the bank account nominated by the Merchant for the receipt of
          Customer payments, configured through the Payment Gateway.
        </li>
      </ul>

      <h2>2. Grant of access</h2>
      <p>
        Subject to this Agreement, VEZEOR grants the Merchant a limited, non-exclusive, non-transferable,
        non-sublicensable, revocable right to access and use the Platform for the operation of the Merchant's
        Business and Outlets during the term of this Agreement. The Merchant may grant access to its staff in
        accordance with the role and responsibility framework provided by the Platform.
      </p>

      <h2>3. Onboarding and KYC</h2>
      <p>The Merchant will provide accurate, current and complete information during onboarding, including:</p>
      <ul>
        <li>legal name of the Business and each Outlet, registered address, contact details;</li>
        <li>GSTIN, FSSAI registration number, PAN (where applicable);</li>
        <li>
          bank account / UPI details required for Payment Gateway settlement and the Razorpay Linked Account ID
          configured on each Outlet's profile;
        </li>
        <li>KYC documents required by the Payment Gateway and by applicable anti-money-laundering rules.</li>
      </ul>
      <p>
        The Merchant will update its onboarding information promptly when any of it changes. VEZEOR may suspend
        access where required onboarding or KYC information is incomplete, inaccurate or has lapsed.
      </p>

      <h2>4. Commercials</h2>

      <h3>4.1 Platform fee — Nil</h3>
      <p>
        Use of the core Platform is offered <strong>free of charge</strong> to the Merchant. There is no licence
        fee, per-seat fee, per-Outlet fee or onboarding fee for the standard feature set.
      </p>

      <h3>4.2 Messaging charges</h3>
      <p>The Merchant is charged for each Message dispatched on its behalf. Charges may be settled:</p>
      <ul>
        <li><strong>Pre-paid</strong>, by purchasing a Message Pool through the Platform; or</li>
        <li><strong>Post-paid</strong>, against invoices raised by VEZEOR at the end of each billing cycle.</li>
      </ul>
      <p>
        Rate cards per channel (SMS / WhatsApp / email / push) are published in the Outlet's billing dashboard and
        may be revised by VEZEOR on prior written notice of at least 15 days. Pool balances are governed by the{' '}
        <Link to="/legal/refund">Refund Policy</Link>.
      </p>

      <h3>4.3 Payment Gateway charges</h3>
      <p>
        Payment Gateway charges, GST on them and settlement timelines are governed by the Payment Gateway's terms.
        VEZEOR does not collect or retain a share of the Customer's payment to the Merchant. Settlement is routed
        from the Payment Gateway to the Merchant's Settlement Account.
      </p>

      <h3>4.4 Future paid features</h3>
      <p>
        VEZEOR may, on prior notice, introduce additional paid features, advanced analytics, premium support tiers,
        customer-rewards funding contributions or other commercial offerings. Participation in any such offering is
        opt-in by the Merchant and governed by the specific terms presented at the point of opt-in.
      </p>

      <h3>4.5 Taxes and invoicing</h3>
      <p>
        All Charges payable by the Merchant to VEZEOR are exclusive of GST and other applicable taxes, which will
        be charged additionally. VEZEOR will issue tax invoices in the name of the Business with the GSTIN provided
        during onboarding. The Merchant is responsible for verifying invoice details and raising any dispute within
        15 days of the invoice date.
      </p>

      <h3>4.6 Late payment</h3>
      <p>
        Undisputed invoices unpaid past their due date may attract interest at the rate of 1.5% per month (or part
        thereof). VEZEOR may suspend Message dispatch or other paid features while payment is overdue.
      </p>

      <h2>5. Customer payments and settlement</h2>
      <p>
        5.1 The Platform records the order, presents it to the Customer for payment and routes the payment
        instruction to the Payment Gateway. The Payment Gateway settles the Customer payment to the Merchant's
        Settlement Account in accordance with its own settlement schedule.
      </p>
      <p>
        5.2 The Merchant acknowledges that VEZEOR is <strong>not</strong> a payment system operator, a payment
        aggregator or an authorised entity under the Payment and Settlement Systems Act, 2007. VEZEOR does not at
        any time take title to, hold, control or take possession of Customer monies on behalf of the Merchant.
      </p>
      <p>
        5.3 The Merchant is solely responsible for the issuance of tax invoices to Customers, for the calculation
        and remittance of GST on Customer sales, for the issuance of refunds where due, and for any reconciliation
        of gateway settlement reports with its own books.
      </p>

      <h2>6. Customer order fulfilment</h2>
      <p>
        6.1 Each Customer order placed on the Platform is a contract for supply of food or beverage{' '}
        <strong>between the Customer and the Merchant</strong>. VEZEOR is not a party to that contract.
      </p>
      <p>6.2 The Merchant warrants that it will:</p>
      <ul>
        <li>list only items it is legally entitled to sell at each Outlet;</li>
        <li>maintain accurate menu information including price, taxes, descriptions, allergens and item availability;</li>
        <li>
          prepare, package and fulfil orders in accordance with applicable food-safety law and the Merchant's own
          service standards;
        </li>
        <li>
          maintain valid and current FSSAI, GST, shop &amp; establishment and other licences required for its
          operations;
        </li>
        <li>print KOTs, manage stations and operate parcel handover in line with the workflows provided by the Platform;</li>
        <li>
          handle Customer complaints, refund requests, replacements and disputes promptly and in good faith, as per
          the <Link to="/legal/refund">Refund Policy</Link>.
        </li>
      </ul>
      <p>
        6.3 VEZEOR may temporarily mark an Outlet as offline on the Platform where the Outlet is non-responsive to
        incoming orders, where Customer complaints exceed a reasonable threshold or where statutory action affects
        the Outlet.
      </p>

      <h2>7. Messaging</h2>
      <p>7.1 Messages dispatched through the Platform fall into two categories:</p>
      <ul>
        <li>
          <strong>Transactional / lifecycle Messages</strong> — order confirmations, ready alerts, payment receipts,
          dispute updates and similar Messages tied to a Customer's specific order. These are dispatched as part of
          the Merchant's contract with the Customer.
        </li>
        <li>
          <strong>Promotional Messages</strong> — coupon broadcasts, festival offers, loyalty nudges. Promotional
          Messages may only be dispatched to Customers who have opted in to promotional communication from the
          Merchant.
        </li>
      </ul>
      <p>
        7.2 The Merchant is responsible for ensuring that its promotional Message content, frequency, send timing
        and recipient list comply with the Telecom Commercial Communications Customer Preference Regulations, 2018
        (TRAI DLT rules), the rules of WhatsApp Business and email anti-spam standards. VEZEOR may suspend dispatch
        of any campaign that, in its reasonable opinion, breaches these rules.
      </p>
      <p>
        7.3 The Merchant authorises VEZEOR and its messaging partners to dispatch Messages on its behalf and to use
        the Merchant's brand name and sender ID for that purpose.
      </p>

      <h2>8. Customer rewards (future)</h2>
      <p>
        If the Merchant elects to participate in a platform-wide Customer rewards or loyalty programme, the
        Merchant's funding contributions form part of a pooled rewards balance from which Customers may redeem
        rewards across participating Outlets. The specific economics — earn rate, redemption rate, settlement,
        attribution, expiry — are governed by the programme terms presented at the point of opt-in. Rewards already
        issued to a Customer are not refundable to the Merchant.
      </p>

      <h2>9. Data protection</h2>
      <p>
        9.1 For Customer personal data captured through the Merchant's QR ordering flow, the Merchant is the{' '}
        <strong>Data Fiduciary</strong> and VEZEOR is the <strong>Data Processor</strong> under the Digital Personal
        Data Protection Act, 2023.
      </p>
      <p>
        9.2 The Merchant will (a) use Customer data only for purposes consistent with the Privacy Policy and the
        Customer's expectations, (b) keep Customer data confidential, (c) not share Customer data with any third
        party without lawful basis, (d) maintain reasonable security around any export of Customer data from the
        Platform, and (e) cooperate with VEZEOR in responding to Customer data-principal requests within timelines
        required by law.
      </p>
      <p>
        9.3 VEZEOR will process Customer data on the Merchant's behalf in accordance with the Privacy Policy and
        applicable law. VEZEOR will notify the Merchant of any personal data breach affecting the Merchant's
        Customers without undue delay after becoming aware of it.
      </p>

      <h2>10. Intellectual property</h2>
      <p>10.1 The Platform, including all software, designs and trade marks, remains the exclusive property of VEZEOR and its licensors.</p>
      <p>
        10.2 The Merchant retains ownership of its menu, brand assets, photographs, recipes and other materials it
        uploads (<strong>“Merchant Content”</strong>) and grants VEZEOR a non-exclusive, royalty-free, worldwide
        licence to host, store, display and otherwise process Merchant Content as needed to operate the Platform
        and provide the service.
      </p>
      <p>
        10.3 VEZEOR may use the Merchant's brand name and logo to identify the Merchant as a Platform user in
        marketing collateral, the Platform's customer-facing app and case studies, in a manner consistent with the
        Merchant's brand guidelines. The Merchant may opt out by writing to hello@vezeor.com.
      </p>

      <h2>11. Representations and warranties</h2>
      <p>The Merchant represents and warrants that:</p>
      <ul>
        <li>it is duly constituted, validly existing and authorised to enter into this Agreement;</li>
        <li>the person creating or operating the account has authority to bind the Business;</li>
        <li>it holds all licences and registrations required to operate each Outlet;</li>
        <li>the Settlement Account belongs to it and is operated in compliance with applicable law;</li>
        <li>it will not use the Platform for any prohibited or restricted item under applicable law.</li>
      </ul>

      <h2>12. Indemnity</h2>
      <p>
        The Merchant will indemnify VEZEOR and its affiliates, officers, directors, employees and agents from any
        claim, demand, loss, liability, cost or expense (including reasonable legal fees) arising out of (a) the
        Merchant's breach of this Agreement, (b) any Merchant Content, menu, price or tax representation, (c) any
        claim by a Customer arising from the supply of food or beverage by the Merchant, (d) any breach of
        food-safety, hygiene, GST, FSSAI or other applicable law by the Merchant, or (e) any breach by the Merchant
        of its data-protection obligations under Section 9.
      </p>

      <h2>13. Limitation of liability</h2>
      <p>
        13.1 To the maximum extent permitted by law, VEZEOR's aggregate liability under this Agreement in any
        twelve-month period will not exceed the total Charges paid by the Merchant to VEZEOR in the immediately
        preceding twelve months.
      </p>
      <p>
        13.2 VEZEOR will not be liable for indirect, incidental, consequential, exemplary, punitive or special
        damages, including loss of profit, business, goodwill, data or contracts, even if advised of the possibility
        of such damages.
      </p>
      <p>
        13.3 Nothing in this Agreement excludes liability for fraud, wilful misconduct or any liability that cannot
        be excluded under applicable law.
      </p>

      <h2>14. Confidentiality</h2>
      <p>
        Each party will keep confidential and not disclose to any third party (other than its professional advisors
        under confidentiality obligations) any non-public information of the other party disclosed in connection
        with this Agreement. This obligation does not apply to information that is or becomes publicly available
        without breach, is independently developed or is required to be disclosed by law or court order.
      </p>

      <h2>15. Term and termination</h2>
      <p>
        15.1 This Agreement starts on the date the Merchant first creates or claims a Business or Outlet account on
        the Platform and continues until terminated as set out below.
      </p>
      <p>15.2 Either party may terminate this Agreement for convenience on <strong>30 days'</strong> prior written notice.</p>
      <p>
        15.3 VEZEOR may suspend or terminate the Merchant's access <strong>immediately</strong> on notice where (a)
        the Merchant materially breaches this Agreement and fails to cure within 15 days, (b) any Charge is overdue
        beyond 30 days, (c) the Merchant becomes insolvent, files for bankruptcy or is wound up, (d) the Merchant's
        KYC documentation is revoked, expired or shown to be false, or (e) continued provision of the Platform is
        required by law to be discontinued.
      </p>
      <p>
        15.4 On termination: (i) the Merchant's right to access the Platform ends; (ii) accrued Charges become
        immediately payable; (iii) each party returns or destroys the other party's confidential information except
        as required to be retained by law; (iv) Customer data already held by the Merchant outside the Platform
        remains the Merchant's responsibility under Section 9.
      </p>
      <p>15.5 Sections 4, 9, 10, 11, 12, 13, 14, 17 and 18 survive termination.</p>

      <h2>16. Suspension</h2>
      <p>
        VEZEOR may suspend specific features or all access on notice where it reasonably believes that suspension is
        necessary to (a) protect the Platform, its Users or third parties, (b) comply with law, (c) prevent fraud or
        abuse, or (d) protect Customer safety. Where reasonable, VEZEOR will lift the suspension once the cause is
        resolved.
      </p>

      <h2>17. Governing law and jurisdiction</h2>
      <p>
        This Agreement is governed by the laws of India. Subject to Section 18, the courts at Bengaluru, Karnataka
        have exclusive jurisdiction over any dispute arising out of or in connection with this Agreement.
      </p>

      <h2>18. Dispute resolution</h2>
      <p>
        Before commencing any litigation, the parties will attempt in good faith to resolve any dispute by
        negotiation between authorised representatives. If unresolved within 30 days, the dispute will be referred
        to arbitration by a sole arbitrator under the Arbitration and Conciliation Act, 1996. The seat and venue of
        arbitration will be Bengaluru, the language will be English, and the award will be final and binding.
      </p>

      <h2>19. General</h2>
      <ul>
        <li>
          <strong>Notices.</strong> Notices to VEZEOR may be sent to hello@vezeor.com. Notices to the Merchant may
          be sent to the email or phone on the Business / Outlet account or by in-app notice.
        </li>
        <li>
          <strong>Assignment.</strong> The Merchant may not assign this Agreement without VEZEOR's prior written
          consent. VEZEOR may assign this Agreement in connection with a corporate reorganisation, merger or sale
          of business.
        </li>
        <li>
          <strong>Independent contractors.</strong> Nothing in this Agreement creates a partnership, joint venture,
          agency or employment relationship between the parties.
        </li>
        <li>
          <strong>Severability.</strong> If any provision is held invalid or unenforceable, the remaining provisions
          will continue in full force and effect.
        </li>
        <li><strong>Force majeure.</strong> Neither party is liable for failure or delay caused by events beyond its reasonable control.</li>
        <li>
          <strong>Amendments.</strong> VEZEOR may amend this Agreement on <strong>15 days'</strong> prior notice.
          Continued use of the Platform after the effective date constitutes acceptance. Where the Merchant does not
          accept a material change, its sole remedy is to terminate this Agreement under Section 15.2.
        </li>
        <li>
          <strong>Entire agreement.</strong> This Agreement, the Terms of Service, the Privacy Policy and the Refund
          Policy constitute the entire agreement between the parties with respect to the Platform.
        </li>
      </ul>

      <hr />
      <p>For any question about this Agreement, write to <strong>hello@vezeor.com</strong>.</p>
    </LegalLayout>
  );
}
