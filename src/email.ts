export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
}

/**
 * Email seam. Default transport logs to stdout so notification content is
 * visible in development without credentials. To send for real, set
 * EMAIL_TRANSPORT_URL (e.g. an HTTP webhook that accepts {to,subject,body})
 * and the message is POSTed there instead.
 */
export async function sendEmail(email: OutboundEmail): Promise<void> {
  const webhook = process.env.EMAIL_TRANSPORT_URL;
  if (!webhook) {
    console.log(`[email] to=${email.to} subject=${email.subject}`);
    return;
  }
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(email),
  });
  if (!res.ok) {
    console.warn(`[email] webhook failed (${res.status}) for ${email.to}`);
  }
}

export function fireAndForget(promise: Promise<void>): void {
  promise.catch((err) => console.warn("[email] failed:", err));
}
