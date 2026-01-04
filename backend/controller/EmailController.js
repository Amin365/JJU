import nodemailer from "nodemailer";
import dotenv from "dotenv";
import Member from "../models/Members.js";


dotenv.config();



// Validate config early
const { GMAIL_USER, GMAIL_PASS, EMAIL_FROM_NAME, APP_NAME } = process.env;
if (!GMAIL_USER || !GMAIL_PASS) {

  console.warn("⚠️ Missing GMAIL_USER or GMAIL_PASS in environment - email sending will fail until configured.");
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

transporter.verify().then(
  () => {
    console.log("✅ SMTP server is ready to send emails");
  },
  (err) => {
    console.warn("⚠️ SMTP verify failed:", err?.message ?? err);
  }
);

/**
 * sendMail utility
 * - to: recipient
 * - subject: string
 * - text: string (plain)
 * - html: optional html string
 */
export async function sendMail({ to, subject, text, html }) {
  if (!to) throw new Error("Missing 'to' address for sendMail");
  const fromName = EMAIL_FROM_NAME || APP_NAME || "No Reply";
  const from = `"${fromName}" <${GMAIL_USER}>`;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return info;
}

/**
 * Express controller: sendMemberEmail
 * POST /members/:id/send-email
 * Body (optional): { subject, text, html, to } - `to` overrides member.email
 */
export const sendMemberEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { subject, text, html, to: overrideTo } = req.body ?? {};

    if (!id) return res.status(400).json({ message: "Missing member id" });

    // Load member
    const member = await Member.findById(id).lean().exec();
    if (!member) return res.status(404).json({ message: "Member not found" });

    const recipient = overrideTo || member.email;
    if (!recipient) return res.status(400).json({ message: "Member has no email on record" });

    const finalSubject =
      subject || `Message from ${APP_NAME || "the team"}`;
    const finalText =
      text ||
      `Hello ${member.first_name ?? ""},

This message was sent by ${APP_NAME || "the team"}.

Regards,
${EMAIL_FROM_NAME || APP_NAME || "Team"}`;

    const finalHtml =
      html ||
      `<p>Hello ${member.first_name ?? ""},</p>
     <p>This message was sent by <strong>${APP_NAME || "the team"}</strong>.</p>
        <p>Regards,<br/>${EMAIL_FROM_NAME || APP_NAME || "Team"}</p>`;

    const info = await sendMail({
      to: recipient,
      subject: finalSubject,
      text: finalText,
      html: finalHtml,
    });

    return res.status(200).json({ message: "Email sent", messageId: info.messageId });
  } catch (err) {
    // log and forward to error handler
    console.error("Error in sendMemberEmail:", err);
    // If you prefer to send a JSON error response directly:
    if (res.headersSent) return next(err);
    const status = err?.status || 500;
    return res.status(status).json({ message: err?.message || "Failed to send email" });
  }
};

export default { sendMemberEmail, sendMail };