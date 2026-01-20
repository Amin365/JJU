import { Resend } from "resend";
import dotenv from "dotenv";
import Member from "../models/Members.js";

dotenv.config();

// Destructure environment variables
const { RESEND_API_KEY, EMAIL_FROM_NAME, APP_NAME } = process.env;

if (!RESEND_API_KEY) {
  console.warn("⚠️ Missing RESEND_API_KEY in environment");
}

// Initialize Resend client
const resend = new Resend(RESEND_API_KEY);

/**
 * sendMail utility using Resend
 * Supports both HTML and plain text
 */
export async function sendMail({ to, subject, text, html }) {
  if (!to) throw new Error("Missing 'to' address");

  const fromName = EMAIL_FROM_NAME || APP_NAME || "No Reply";
  const from = `"${fromName}" <noreply@jjureadingclub.live>`; // Use verified domain

  // Resend requires HTML; fallback to plain text wrapped in <pre>
  const finalHtml = html || `<pre>${text || ""}</pre>`;

  const email = await resend.emails.send({
    from,
    to,
    subject,
    html: finalHtml,
  });

  return email;
}

/**
 * Express controller to send email to a member
 * POST /members/:id/send-email
 */
export const sendMemberEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, text, html, to: overrideTo } = req.body ?? {};

    if (!id) {
      return res.status(400).json({ message: "Missing member id" });
    }

    // Load member
    const member = await Member.findById(id).lean().exec();
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const recipient = overrideTo || member.email;
    if (!recipient) {
      return res.status(400).json({ message: "Member has no email" });
    }

    // Default subject
    const finalSubject = subject || `Message from ${APP_NAME || "the team"}`;

    // Default plain text
    const finalText =
      text ||
      `Hello ${member.first_name ?? ""} ${member.last_name ?? ""},

This message was sent by ${APP_NAME || "the team"}.

Regards,
${EMAIL_FROM_NAME || APP_NAME || "Team"}`;

    // Default HTML version
    const finalHtml =
      html ||
      `<p>Hello ${member.first_name ?? ""} ${member.last_name ?? ""},</p>
       <p>This message was sent by <strong>${APP_NAME || "the team"}</strong>.</p>
       <p>Regards,<br/>${EMAIL_FROM_NAME || APP_NAME || "Team"}</p>`;

    // Send email
    const info = await sendMail({
      to: recipient,
      subject: finalSubject,
      text: finalText,
      html: finalHtml,
    });

    return res.status(200).json({
      message: "Email sent successfully",
      messageId: info.id || info.messageId,
    });
  } catch (err) {
    console.error("❌ sendMemberEmail error:", err);
    return res.status(500).json({
      message: err.message || "Failed to send email",
    });
  }
};

export default { sendMemberEmail, sendMail };
