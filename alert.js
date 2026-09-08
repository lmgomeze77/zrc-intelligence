// alert.js
// Sends a failure alert to the operator when the daily briefing does not go out.
//
// The 4-6 September outage is why this exists: the pipeline detected the failure
// correctly and refused to publish, six runs were marked failed, and three days
// passed before anyone noticed. Detection without delivery is not an alarm.
//
// Runs from the workflow's `if: failure()` step. It never fails the job itself —
// a broken alarm must not also break the thing it is watching.

const fs = require("fs");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL = (process.env.ALERT_EMAIL || "").trim();
const RUN_URL = process.env.RUN_URL || "";
const PLATFORM_URL = "https://zenith-news-room.netlify.app";

function readReason() {
  // Written by generate-briefing.js when it aborts.
  try {
    const reason = fs.readFileSync("failure-reason.txt", "utf8").trim();
    if (reason) return reason;
  } catch (e) {}
  try {
    const degraded = JSON.parse(fs.readFileSync("data.degraded.json", "utf8"));
    if (degraded.failureReason) return String(degraded.failureReason);
  } catch (e) {}
  return "";
}

// The failures seen so far are all account-level, not code-level, so the alert
// says what to actually do rather than just quoting the error.
function diagnose(reason) {
  const r = reason.toLowerCase();
  if (r.includes("credit balance")) {
    return {
      headline: "The Anthropic API has run out of credit.",
      action: "Top up at console.anthropic.com → Plans & Billing, then re-run the workflow. Consider enabling auto-reload so this stops recurring."
    };
  }
  if (r.includes("rate limit") || r.includes("429")) {
    return {
      headline: "The Anthropic API rate-limited the briefing.",
      action: "Usually transient — re-run the workflow. If it repeats daily, the account's rate limits need raising."
    };
  }
  if (r.includes("authentication") || r.includes("401") || r.includes("api key")) {
    return {
      headline: "The Anthropic API key was rejected.",
      action: "Check the ANTHROPIC_API_KEY secret in the repository settings — it may have been rotated or revoked."
    };
  }
  if (r.includes("overloaded") || r.includes("529")) {
    return {
      headline: "The Anthropic API was overloaded.",
      action: "Transient — the backup slot will retry automatically later today."
    };
  }
  if (!reason) {
    return {
      headline: "The briefing failed before it could record a reason.",
      action: "Open the run log to see which step failed."
    };
  }
  return {
    headline: "The briefing did not go out.",
    action: "Open the run log for the full trace."
  };
}

function lastPublished() {
  try {
    const b = JSON.parse(fs.readFileSync("data.json", "utf8"));
    return b.date || "unknown";
  } catch (e) {
    return "unknown";
  }
}

async function main() {
  if (!RESEND_API_KEY) {
    console.log("⚠ RESEND_API_KEY not set — cannot send the failure alert.");
    return;
  }
  if (!ALERT_EMAIL) {
    console.log("⚠ ALERT_EMAIL secret not set — no alert recipient configured.");
    console.log("  Add a repository secret named ALERT_EMAIL to receive these alerts.");
    return;
  }

  const reason = readReason();
  const { headline, action } = diagnose(reason);
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F1F5F9;">
    <tr><td align="center" style="padding:24px 12px;">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:560px;background:#FFFFFF;border:1px solid #E2E8F0;">
        <tr><td style="background:#7F1D1D;padding:16px 22px;">
          <div style="font-size:9px;font-weight:800;color:#FCA5A5;letter-spacing:2px;text-transform:uppercase;">ZRC Intelligence · Pipeline alert</div>
          <div style="font-size:19px;font-weight:800;color:#FFFFFF;margin-top:5px;">No briefing today</div>
          <div style="font-size:12px;color:#FCA5A5;margin-top:3px;">${esc(today)}</div>
        </td></tr>
        <tr><td style="padding:22px;">
          <div style="font-size:15px;font-weight:700;color:#0F172A;line-height:1.45;">${esc(headline)}</div>
          <div style="font-size:13px;color:#475569;line-height:1.65;margin-top:10px;">${esc(action)}</div>

          <div style="margin-top:18px;padding:12px 14px;background:#F8FAFC;border:1px solid #E2E8F0;">
            <div style="font-size:9px;font-weight:800;color:#64748B;letter-spacing:1.2px;text-transform:uppercase;">What the pipeline did</div>
            <div style="font-size:13px;color:#334155;line-height:1.6;margin-top:6px;">
              Nothing was published and no email went to subscribers. The previous briefing
              (${esc(lastPublished())}) still stands on the platform, and remains the continuity
              baseline, so tomorrow's analysis is not measured against a briefing that judged nothing.
            </div>
          </div>

          ${reason ? `
          <div style="margin-top:14px;">
            <div style="font-size:9px;font-weight:800;color:#64748B;letter-spacing:1.2px;text-transform:uppercase;">Reported error</div>
            <div style="font-size:12px;color:#334155;line-height:1.55;margin-top:6px;font-family:monospace;word-break:break-word;">${esc(reason)}</div>
          </div>` : ""}

          ${RUN_URL ? `
          <div style="margin-top:20px;">
            <a href="${esc(RUN_URL)}" style="font-size:11px;font-weight:800;color:#FFFFFF;background:#0F172A;text-decoration:none;padding:10px 18px;letter-spacing:0.8px;display:inline-block;">OPEN THE RUN LOG →</a>
          </div>` : ""}

          <div style="font-size:11px;color:#94A3B8;line-height:1.6;margin-top:20px;border-top:1px solid #E2E8F0;padding-top:12px;">
            The backup slot retries automatically later today. If that also fails, this alert repeats.
            Platform: <a href="${PLATFORM_URL}" style="color:#64748B;">${PLATFORM_URL.replace("https://", "")}</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "ZRC Intelligence <intelligence@zenithrisecapital.com>",
        to: ALERT_EMAIL,
        subject: `⚠ ZRC briefing did not go out — ${headline}`,
        html
      })
    });
    const result = await res.json();
    if (res.ok) {
      console.log(`✅ Failure alert sent to ${ALERT_EMAIL} (id ${result.id || "n/a"})`);
    } else {
      console.error(`❌ Could not send the alert: ${JSON.stringify(result)}`);
    }
  } catch (err) {
    console.error(`❌ Could not send the alert: ${err.message}`);
  }
}

// Always exit 0: the job is already failing, and an alerting problem must not
// mask the original failure in the run summary.
main().then(() => process.exit(0)).catch(err => {
  console.error("Alert error:", err);
  process.exit(0);
});
