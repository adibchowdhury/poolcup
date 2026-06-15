import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("BUG_WEBHOOK_SECRET")!;

const FROM_EMAIL = "PoolCup <support@getpoolcup.com>";
const REPLY_TO = "support@getpoolcup.com";
const OWNER_EMAIL = "support@getpoolcup.com"; // where YOUR bug alerts go

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function escapeHtml(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function sendEmail(opts: { to: string; subject: string; html: string; replyTo?: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: opts.to,
      reply_to: opts.replyTo,
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) console.error("Resend failed:", res.status, await res.text());
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const record = payload.record;
  if (!record) return new Response("No record", { status: 200 });

  let reporterEmail: string | null = null;
  let reporterName = "Anonymous";
  if (record.user_id) {
    const { data: user } = await supabase
      .from("users")
      .select("email, display_name")
      .eq("id", record.user_id)
      .single();
    if (user?.email) reporterEmail = user.email;
    if (user?.display_name?.trim()) reporterName = user.display_name.trim();
  }

  const message = escapeHtml(record.message ?? "");
  const pageUrl = escapeHtml(record.page_url ?? "unknown");

  await sendEmail({
    to: OWNER_EMAIL,
    replyTo: reporterEmail ?? undefined,
    subject: `🐛 New PoolCup bug report from ${reporterName}`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;color:#1a1a1a;">
        <h2 style="margin:0 0 12px;">New bug report</h2>
        <p style="margin:4px 0;"><strong>From:</strong> ${escapeHtml(reporterName)}${reporterEmail ? ` (${escapeHtml(reporterEmail)})` : ""}</p>
        <p style="margin:4px 0;"><strong>Page:</strong> ${pageUrl}</p>
        <p style="padding:12px 16px;background:#f3f4f6;border-radius:8px;border-left:3px solid #2ee06d;margin:12px 0;">${message}</p>
        <p style="color:#6b7280;font-size:13px;">Report ID: ${escapeHtml(record.id ?? "")}</p>
      </div>`,
  });

  if (reporterEmail) {
    await sendEmail({
      to: reporterEmail,
      replyTo: REPLY_TO,
      subject: "We got your PoolCup report 🐛",
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;color:#1a1a1a;">
          <p>Hi ${escapeHtml(reporterName)},</p>
          <p>Thanks for flagging an issue on PoolCup, it came through and it's in my queue.</p>
          <p style="padding:12px 16px;background:#f3f4f6;border-radius:8px;border-left:3px solid #2ee06d;">
            <strong>What you told us:</strong><br>${message}
          </p>
          <p>I read every one of these personally and I'll follow up if I need more detail. Thanks for helping make PoolCup better.</p>
          <p>Adib<br><span style="color:#6b7280;">PoolCup</span></p>
        </div>`,
    });
  }

  return new Response("OK", { status: 200 });
});
