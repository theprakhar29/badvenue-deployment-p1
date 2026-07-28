import nodemailer from "nodemailer";
import twilio from "twilio";

/**
 * ============================================================================
 *  EMAIL (Nodemailer/SMTP) & SMS — WHERE TO SWAP IN REAL CREDENTIALS
 * ============================================================================
 *  This file is the ONLY place that sends email or SMS. All credentials come
 *  from environment variables (server/.env) — never hardcoded.
 *
 *  EMAIL: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM_EMAIL,
 *         MAIL_FROM_NAME
 *    Any SMTP provider works (Gmail SMTP, SendGrid, AWS SES, Mailgun...).
 *
 *  SMS: set SMS_PROVIDER to "msg91" or "twilio", then fill in that
 *       provider's variables below. Only one provider is active at a time.
 *
 *    SMS_PROVIDER=msg91  →  MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_ROUTE
 *      Recommended for Indian numbers — console.msg91.com → API → Auth Key;
 *      Sender ID needs DLT registration for production (MSG91's dashboard
 *      walks you through this; their free trial credits work without full
 *      DLT setup for initial testing). NOTE: this integration is built
 *      against MSG91's documented v2 Send SMS API but hasn't been tested
 *      against a live account — if a real send doesn't behave as expected,
 *      check MSG91's current API docs against sendViaMsg91() below, since
 *      SMS-gateway APIs in India change more often than most.
 *
 *    SMS_PROVIDER=twilio →  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *                            TWILIO_FROM_NUMBER
 *      console.twilio.com → dashboard homepage for SID/token. Note: Twilio
 *      numbers with Indian (+91) sending capability are hard to get without
 *      business verification — this is a regulatory restriction (India's
 *      TRAI/DLT rules), not specific to Twilio. MSG91 is the more common
 *      choice for Indian SMS specifically for this reason.
 *
 *  If EITHER channel's env vars are left completely empty, that channel
 *  falls back to a console.log mock — so you can test one without the
 *  other configured yet.
 * ============================================================================
 */

function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function getSmsProvider() {
  return (process.env.SMS_PROVIDER || "").toLowerCase();
}

function isSmsConfigured() {
  const provider = getSmsProvider();
  if (provider === "msg91") {
    return Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_SENDER_ID);
  }
  if (provider === "twilio") {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
    );
  }
  return false;
}

let mailTransporter = null;
function getMailTransporter() {
  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return mailTransporter;
}

let twilioClient = null;
function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

/** Normalizes a phone number to the bare "91XXXXXXXXXX" shape MSG91 expects. */
function toMsg91Mobile(phone) {
  const digitsOnly = phone.replace(/[^\d]/g, "").replace(/^0+/, "");
  return digitsOnly.startsWith("91") ? digitsOnly : `91${digitsOnly}`;
}

async function sendViaTwilio(to, body) {
  await getTwilioClient().messages.create({ to, from: process.env.TWILIO_FROM_NUMBER, body });
}

async function sendViaMsg91(to, body) {
  const res = await fetch("https://api.msg91.com/api/v2/sendsms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: process.env.MSG91_AUTH_KEY,
    },
    body: JSON.stringify({
      sender: process.env.MSG91_SENDER_ID,
      route: process.env.MSG91_ROUTE || "4",
      country: "91",
      sms: [{ message: body, to: [toMsg91Mobile(to)] }],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.type === "error") {
    throw new Error(data?.message || `MSG91 request failed (HTTP ${res.status})`);
  }
  return data;
}

async function sendSms(to, body) {
  const provider = getSmsProvider();
  if (provider === "msg91") return sendViaMsg91(to, body);
  if (provider === "twilio") return sendViaTwilio(to, body);
  throw new Error(`Unknown SMS_PROVIDER: "${provider}"`);
}

function confirmationUrl(booking) {
  const origin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  return `${origin}/bookings/${booking._id}`;
}

// ---------------------------------------------------------------------------
// Ticket delivery (payment succeeded)
// ---------------------------------------------------------------------------

export async function sendTicketEmail(booking, tickets) {
  if (!booking.guestEmail) return null;

  if (!isEmailConfigured()) {
    console.log(
      `[mock email] To: ${booking.guestEmail} — "Your tickets for ${tickets.length} item(s), booking ${booking._id}"`
    );
    return { channel: "EMAIL", purpose: "TICKET_DELIVERY", to: booking.guestEmail, status: "SENT", sentAt: new Date() };
  }

  try {
    // Embed each QR as an inline attachment (cid) so it renders directly in
    // the email body, not just as a download.
    const attachments = tickets.map((ticket, i) => ({
      filename: `ticket-${i + 1}.png`,
      content: ticket.qrDataUrl.split(",")[1],
      encoding: "base64",
      cid: `ticket-qr-${i}`,
    }));

    const ticketsHtml = tickets
      .map(
        (ticket, i) => `
          <div style="margin-bottom:20px;padding:16px;border:1px solid #e5e5e5;border-radius:8px;">
            <p style="margin:0 0 10px;font-weight:600;color:#142238;">
              ${ticket.tierName} — Ticket ${i + 1} of ${tickets.length}
            </p>
            <img src="cid:ticket-qr-${i}" width="200" height="200" alt="QR code for ${ticket.tierName}" />
          </div>`
      )
      .join("");

    await getMailTransporter().sendMail({
      from: `"${process.env.MAIL_FROM_NAME || "Marquee"}" <${process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: booking.guestEmail,
      subject: `Your tickets are confirmed`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#142238;">You're in, ${booking.guestName.split(" ")[0]}!</h2>
          <p style="color:#444;">Your booking is confirmed. Show these QR codes at the door — each is valid for one entry.</p>
          ${ticketsHtml}
          <p style="color:#444;"><strong>Total paid:</strong> ₹${booking.totalAmount}</p>
          <p style="color:#888;font-size:13px;">
            You can also view and re-download your tickets anytime at
            <a href="${confirmationUrl(booking)}">${confirmationUrl(booking)}</a>
          </p>
        </div>`,
      attachments,
    });

    return { channel: "EMAIL", purpose: "TICKET_DELIVERY", to: booking.guestEmail, status: "SENT", sentAt: new Date() };
  } catch (err) {
    console.error("[email] failed to send ticket email:", err.message);
    return {
      channel: "EMAIL",
      purpose: "TICKET_DELIVERY",
      to: booking.guestEmail,
      status: "FAILED",
      error: err.message,
      sentAt: new Date(),
    };
  }
}

export async function sendTicketSMS(booking, tickets) {
  if (!booking.guestPhone) return null;

  const url = confirmationUrl(booking);

  if (!isSmsConfigured()) {
    console.log(`[mock sms] To: ${booking.guestPhone} — "Your ${tickets.length} ticket(s) are confirmed. ${url}"`);
    return { channel: "SMS", purpose: "TICKET_DELIVERY", to: booking.guestPhone, status: "SENT", sentAt: new Date() };
  }

  try {
    await sendSms(booking.guestPhone, `Your ${tickets.length} ticket(s) are confirmed! View & download: ${url}`);
    return { channel: "SMS", purpose: "TICKET_DELIVERY", to: booking.guestPhone, status: "SENT", sentAt: new Date() };
  } catch (err) {
    console.error("[sms] failed to send ticket sms:", err.message);
    return {
      channel: "SMS",
      purpose: "TICKET_DELIVERY",
      to: booking.guestPhone,
      status: "FAILED",
      error: err.message,
      sentAt: new Date(),
    };
  }
}

export async function deliverTickets(booking, tickets) {
  const results = await Promise.all([sendTicketEmail(booking, tickets), sendTicketSMS(booking, tickets)]);
  return results.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Payment failure notice
// ---------------------------------------------------------------------------

export async function sendPaymentFailedEmail(booking, reason) {
  if (!booking.guestEmail) return null;

  if (!isEmailConfigured()) {
    console.log(`[mock email] To: ${booking.guestEmail} — "Payment failed: ${reason}"`);
    return { channel: "EMAIL", purpose: "PAYMENT_FAILED", to: booking.guestEmail, status: "SENT", sentAt: new Date() };
  }

  try {
    await getMailTransporter().sendMail({
      from: `"${process.env.MAIL_FROM_NAME || "Marquee"}" <${process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: booking.guestEmail,
      subject: `Payment unsuccessful for your booking`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#142238;">Hi ${booking.guestName.split(" ")[0]},</h2>
          <p style="color:#444;">Your payment for this booking wasn't successful, so your tickets
          were not reserved.</p>
          <p style="color:#444;"><strong>Reason:</strong> ${reason}</p>
          <p style="color:#444;">No charge was made. Please try booking again if you'd still like to attend.</p>
        </div>`,
    });
    return { channel: "EMAIL", purpose: "PAYMENT_FAILED", to: booking.guestEmail, status: "SENT", sentAt: new Date() };
  } catch (err) {
    console.error("[email] failed to send payment-failed email:", err.message);
    return {
      channel: "EMAIL",
      purpose: "PAYMENT_FAILED",
      to: booking.guestEmail,
      status: "FAILED",
      error: err.message,
      sentAt: new Date(),
    };
  }
}

export async function sendPaymentFailedSMS(booking, reason) {
  if (!booking.guestPhone) return null;

  if (!isSmsConfigured()) {
    console.log(`[mock sms] To: ${booking.guestPhone} — "Payment failed: ${reason}"`);
    return { channel: "SMS", purpose: "PAYMENT_FAILED", to: booking.guestPhone, status: "SENT", sentAt: new Date() };
  }

  try {
    await sendSms(
      booking.guestPhone,
      `Your payment could not be processed (${reason}). No charge was made. Please try booking again.`
    );
    return { channel: "SMS", purpose: "PAYMENT_FAILED", to: booking.guestPhone, status: "SENT", sentAt: new Date() };
  } catch (err) {
    console.error("[sms] failed to send payment-failed sms:", err.message);
    return {
      channel: "SMS",
      purpose: "PAYMENT_FAILED",
      to: booking.guestPhone,
      status: "FAILED",
      error: err.message,
      sentAt: new Date(),
    };
  }
}

export async function deliverFailureNotice(booking, reason) {
  const results = await Promise.all([
    sendPaymentFailedEmail(booking, reason),
    sendPaymentFailedSMS(booking, reason),
  ]);
  return results.filter(Boolean);
}
