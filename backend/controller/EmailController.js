import nodemailer from "nodemailer";
import dotenv from "dotenv";
import Member from "../models/Members.js";

dotenv.config();

// Validate config early
const {
  BREVO_EMAIL,
  BREVO_SMTP_KEY,
  EMAIL_FROM_NAME,
  APP_NAME
} = process.env;

if (!BREVO_EMAIL || !BREVO_SMTP_KEY) {
  console.warn("⚠️ Missing BREVO_EMAIL or BREVO_SMTP_KEY in environment");
}

console.log("SMTP KEY exists:", !!process.env.BREVO_SMTP_KEY);
console.log("SMTP KEY starts with xsmtpsib:", process.env.BREVO_SMTP_KEY?.startsWith("xsmtpsib-"));

//  Brevo SMTP transporter
const transporter = nodemailer.createTransport({
  host: "smtp-relay.sendinblue.com", // alternative
  port: 587,
  secure: false,
  auth: {
    user: "apikey",
    pass: process.env.BREVO_SMTP_KEY,
  },
  tls: { rejectUnauthorized: false },
});

// Verify connection
transporter.verify().then(
  () => console.log(" Brevo SMTP is ready"),
  (err) => console.warn("⚠️ Brevo SMTP verify failed:", err?.message)
);

/**
 * sendMail utility
 */
export async function sendMail({ to, subject, text, html }) {
  if (!to) throw new Error("Missing 'to' address");

  const fromName = EMAIL_FROM_NAME || APP_NAME || "No Reply";
  const from = `"${fromName}" <${BREVO_EMAIL}>`;

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
 * Express controller
 * POST /members/:id/send-email
 */
export const sendMemberEmail = async (req, res, next) => {
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

    return res.status(200).json({
      message: "Email sent successfully",
      messageId: info.messageId,
    });

  } catch (err) {
    console.error("❌ sendMemberEmail error:", err);
    if (res.headersSent) return next(err);
    return res.status(500).json({
      message: err.message || "Failed to send email",
    });
  }
};

export default { sendMemberEmail, sendMail };
