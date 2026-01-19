import nodemailer from "nodemailer";
import dotenv from "dotenv";
import Member from "../models/Members.js";

dotenv.config();

// Destructure environment variables
const { GMAIL_USER, GMAIL_PASS, EMAIL_FROM_NAME, APP_NAME } = process.env;

if (!GMAIL_USER || !GMAIL_PASS) {
  console.warn("⚠️ Missing GMAIL_USER or GMAIL_PASS in environment");
}

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587, // TLS port
  secure: false, // false for TLS
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS, // App password
  },
  tls: { rejectUnauthorized: false }, // optional for dev
});

// Verify connection
transporter.verify()
  .then(() => console.log("✅ Gmail SMTP is ready"))
  .catch((err) => console.warn("⚠️ Gmail SMTP verify failed:", err.message));

/**
 * sendMail utility
 */
export async function sendMail({ to, subject, text, html }) {
  if (!to) throw new Error("Missing 'to' address");

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
 * Express controller
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

    const finalSubject = subject || `Message from ${APP_NAME || "the team"}`;
    const finalText =
      text ||
      `Hello ${member.first_name ?? ""},\n\nThis message was sent by ${
        APP_NAME || "the team"
      }.\n\nRegards,\n${EMAIL_FROM_NAME || APP_NAME || "Team"}`;

    const finalHtml =
      html ||
      `<p>Hello ${member.first_name ?? ""},</p>
       <p>This message was sent by <strong>${
         APP_NAME || "the team"
       }</strong>.</p>
       <p>Regards,<br/>${EMAIL_FROM_NAME || APP_NAME || "Team"}</p>`;

    // ✅ Send email immediately and wait for completion
    const info = await sendMail({
      to: recipient,
      subject: finalSubject,
      text: finalText,
      html: finalHtml,
    });

    // Respond after email is sent
    return res.status(200).json({
      message: "Email sent successfully",
      messageId: info.messageId,
    });

  } catch (err) {
    console.error("❌ sendMemberEmail error:", err);
    return res.status(500).json({
      message: err.message || "Failed to send email",
    });
  }
};



export default { sendMemberEmail, sendMail };
