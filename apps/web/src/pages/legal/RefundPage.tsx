import { Link } from 'react-router-dom';
import LegalLayout from './LegalLayout';

export default function RefundPage() {
  return (
    <LegalLayout
      title="Refund and Cancellation Policy"
      subtitle="How refunds and cancellations are handled on the VEZEOR Platform."
      lastUpdated="13 June 2026"
      current="/legal/refund"
    >
      <p>
        This Refund and Cancellation Policy (<strong>“Policy”</strong>) explains how refunds are handled across the
        VEZEOR Platform. It should be read together with the <Link to="/legal/terms">Terms of Service</Link>,{' '}
        <Link to="/legal/privacy">Privacy Policy</Link> and (for Outlets and Businesses) the{' '}
        <Link to="/legal/agreement">Merchant Agreement</Link>.
      </p>
      <p>
        VEZEOR is a technology facilitator. Refunds, replacements and goodwill credits for food and beverage orders
        are the <strong>prerogative of the Outlet</strong> that received the order. VEZEOR's role in any refund is
        limited to providing the tooling to record and execute it.
      </p>

      <h2>1. Scope</h2>
      <p>This Policy covers:</p>
      <ol>
        <li><strong>Failed customer payments</strong> for orders placed through the Platform;</li>
        <li><strong>Customer disputes</strong> about food, beverage, service or delivery;</li>
        <li><strong>Outlet Message Pool</strong> balances and other charges paid by Outlets to VEZEOR.</li>
      </ol>
      <p>
        It does <strong>not</strong> cover refunds you may be entitled to claim directly against a third-party
        payment gateway, telecom operator, messaging provider or other independent service provider.
      </p>

      <h2>2. Failed customer payments</h2>
      <p>
        If a customer attempts to pay for an order through the Platform and the payment fails, is interrupted, is
        dropped by the payment gateway, or is debited from the customer's bank account without a successful response
        reaching the Platform, the following rules apply.
      </p>

      <h3>2.1 Auto-reversal by the gateway</h3>
      <p>
        In most cases the bank or the payment gateway will auto-reverse a failed or unmatched debit to the
        customer's original payment instrument within <strong>5 to 10 working days</strong>. This auto-reversal is a
        function of the gateway and the customer's bank, not of VEZEOR or the Outlet.
      </p>

      <h3>2.2 Stuck or “Pending” payment status</h3>
      <p>
        Where the Platform records a payment as <span style={{ fontFamily: 'monospace' }}>PENDING</span> because the
        gateway has not confirmed it, the Outlet (and, where applicable, VEZEOR) will reconcile against the gateway
        settlement report. If the gateway confirms the payment, the order is treated as paid; if the gateway
        confirms failure, the order is treated as unpaid and any debit on the customer's side will be auto-reversed
        by the gateway as described in Section 2.1.
      </p>

      <h3>2.3 Successful payment for an order that was not delivered</h3>
      <p>
        If a customer was charged but the order was not prepared or handed over by the Outlet (for example, item
        out of stock realised after payment, kitchen unable to prepare, Outlet shut), the <strong>Outlet</strong>{' '}
        will initiate a full refund to the customer's original payment instrument through the Platform's refund
        workflow. Refunds are processed through the payment gateway and typically reach the customer's account
        within <strong>7 working days</strong> of initiation, depending on the customer's bank and card network.
      </p>

      <h3>2.4 Partial fulfilment</h3>
      <p>
        Where only part of an order can be fulfilled, the Outlet may, at its discretion, refund the unfulfilled
        portion, offer a substitution agreed with the customer, or issue a goodwill credit. Any partial refund is
        processed in the same manner as a full refund.
      </p>

      <h2>3. Customer disputes about food, beverage or service</h2>
      <p>
        Disputes about quality, quantity, taste, temperature, hygiene, allergens, packaging, parcel handling,
        delivery delay, billing accuracy and similar matters concern the contract between the customer and the
        Outlet. The Outlet has <strong>sole discretion</strong> to decide:
      </p>
      <ul>
        <li>whether to refund (full or partial),</li>
        <li>whether to replace the item,</li>
        <li>whether to issue a goodwill credit or coupon,</li>
        <li>whether to decline the complaint, with reasons.</li>
      </ul>
      <p>
        VEZEOR will not adjudicate or override the Outlet's decision. The Platform's dispute module is provided so
        that the Outlet can record the complaint, the action taken and the resolution, and so that the customer can
        see the status of their dispute.
      </p>
      <p>
        If the customer is dissatisfied with the Outlet's resolution, the customer may pursue remedies available to
        them under the Consumer Protection Act, 2019 or other applicable law against the Outlet directly. VEZEOR is
        not a necessary party to any such claim.
      </p>

      <h2>4. Order cancellation</h2>
      <ul>
        <li>
          <strong>Before the kitchen accepts the order</strong>, the customer may cancel through the Platform. If a
          payment has already been made, the Outlet will initiate a full refund as described in Section 2.3.
        </li>
        <li>
          <strong>After the kitchen accepts the order</strong>, cancellation is at the Outlet's discretion. Outlets
          that operate a “no-cancellation-after-acceptance” rule must make that rule visible to customers before
          they confirm checkout.
        </li>
        <li>
          <strong>Outlet-initiated cancellation</strong> (for example, unable to prepare) is treated as in Section
          2.3 — a full refund of any amount already paid.
        </li>
      </ul>

      <h2>5. Outlet charges paid to VEZEOR</h2>

      <h3>5.1 Use of the Platform is free</h3>
      <p>
        The core Platform is offered free of charge to Outlets. No refund is contemplated where no charge has been
        paid.
      </p>

      <h3>5.2 Message Pool</h3>
      <p>
        Where an Outlet has purchased a pre-paid Message Pool from VEZEOR, the Pool is consumed as messages are
        sent. Pool balances are:
      </p>
      <ul>
        <li>
          <strong>non-refundable</strong> once purchased, except where required by law or where an obvious billing
          error is shown;
        </li>
        <li><strong>non-transferable</strong> to another Outlet or Business unless agreed by VEZEOR in writing;</li>
        <li>usable only on the Platform and only against the messaging channels for which the Pool was sized.</li>
      </ul>
      <p>
        VEZEOR may forfeit balances that have been inactive for an extended period as described in the Outlet
        billing dashboard.
      </p>

      <h3>5.3 Post-paid messaging invoices</h3>
      <p>
        Where an Outlet is billed in arrears for messages already sent, invoices are payable per the credit terms
        agreed at the time of onboarding. Disputes about an invoice must be raised within <strong>15 days</strong>{' '}
        of the invoice date, failing which the invoice is deemed accepted. VEZEOR will not refund or credit charges
        for messages that were dispatched as per the Outlet's configured triggers, even if the underlying order was
        later cancelled or refunded — the messaging service was provided.
      </p>

      <h3>5.4 Failed message delivery</h3>
      <p>
        If a message could not be dispatched at all (for example, our messaging provider returned a hard delivery
        failure before sending), the Message Pool will not be debited and no post-paid charge will be raised for
        that message. If a message was dispatched and the operator or recipient device subsequently failed to
        deliver it, the charge stands.
      </p>

      <h2>6. Future paid features and rewards programmes</h2>
      <p>
        If, in the future, an Outlet opts into a paid feature or contributes to a customer rewards pool, the refund
        treatment for that specific feature or pool will be governed by the terms presented at the time of opt-in.
        In general, redeemable customer rewards, once issued to a customer, are not refundable to the Outlet that
        funded them.
      </p>

      <h2>7. How to request a refund</h2>
      <ul>
        <li>
          <strong>Customer (Diner)</strong> — contact the Outlet you ordered from. Customers can also raise a
          dispute from the order receipt screen on the Platform, which routes the request to the Outlet's service
          desk.
        </li>
        <li>
          <strong>Outlet / Business</strong> — write to <strong>hello@vezeor.com</strong> with the invoice
          reference, the Outlet ID and the reason. We will acknowledge within 3 working days and respond on
          substantive merit within 15 working days.
        </li>
      </ul>

      <h2>8. Chargebacks</h2>
      <p>
        Chargebacks filed by customers with their card network or bank are processed in line with that network's
        rules. The Outlet will support VEZEOR in providing documentation requested by the gateway to defend or
        honour a chargeback. The financial outcome of a chargeback (including chargeback fees) rests with the
        Outlet, since the customer-Outlet contract is for food and beverage supplied by the Outlet.
      </p>

      <h2>9. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. The revised Policy will be posted with an updated “Last
        updated” date. Material changes will be brought to your attention through the Platform or by email.
      </p>

      <hr />
      <p>Questions about a specific refund: <strong>hello@vezeor.com</strong>.</p>
    </LegalLayout>
  );
}
