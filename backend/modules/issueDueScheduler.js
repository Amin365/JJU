import Issue from "../models/Issue.js";
import User from "../models/user.js";
import Notification from "../models/Notification.js";
import PushSubscription from "../models/ushSubscription.js";
import { sendPushToUser } from "../utility/push.js";
import { sendMail } from "../controller/EmailController.js";

/**
 * Calculate whole-day difference (UTC-safe)
 */
function daysBetweenDates(due, now) {
  const d1 = new Date(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const d2 = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
}

/**
 * Email builder
 */
function buildEmail(kind, memberName, bookTitle) {
  const base = {
    from: process.env.APP_NAME || "Reading Club",
  };

  if (kind === "overdue") {
    return {
      ...base,
      subject: "📕 Book Overdue",
      text: `Dear ${memberName}, your book "${bookTitle}" is overdue.`,
      html: `
        <p>Dear <strong>${memberName}</strong>,</p>
        <p>Your borrowed book <strong>"${bookTitle}"</strong> is overdue.</p>
        <p>Please return it as soon as possible.</p>
      `,
    };
  }

  if (kind === "due-soon") {
    return {
      ...base,
      subject: "📘 Book Due Tomorrow",
      text: `Dear ${memberName}, your book "${bookTitle}" is due tomorrow.`,
      html: `
        <p>Dear <strong>${memberName}</strong>,</p>
        <p>Your borrowed book <strong>"${bookTitle}"</strong> is due tomorrow.</p>
        <p>Please return it on time.</p>
      `,
    };
  }

  throw new Error("Invalid email type");
}

/**
 * Scheduler
 */
export function startIssueDueScheduler(intervalMs = 60 * 60 * 1000) {
  const run = async () => {
    const now = new Date();

    try {
      const issues = await Issue.find({ status: "Issued" })
        .populate("book", "title")
        .lean();

      for (const issue of issues) {
        try {
          const dueDate = new Date(issue.returnDate);
          const diff = daysBetweenDates(dueDate, now);

          let kind = null;
          if (diff === 1) kind = "due-soon";
          if (diff <= 0) kind = "overdue";
          if (!kind) continue;

          // ✅ Get MEMBER user only (not admin)
          const memberUser = await User.findOne({
            member: issue.member,
            role: "member",
          })
            .select("_id email first_name last_name")
            .lean();

          if (!memberUser) continue;

          // ❌ Prevent duplicate notification
          const alreadySent = await Notification.exists({
            user: memberUser._id,
            "meta.issue": issue._id,
            "meta.kind": kind,
          });

          if (alreadySent) continue;

          const memberName = `${memberUser.first_name || "Member"} ${memberUser.last_name || ""}`.trim();
          const bookTitle = issue.book?.title || "your book";

          // ✅ Save notification
          await Notification.create({
            user: memberUser._id,
            title: kind === "overdue" ? "Book overdue" : "Book due soon",
            message:
              kind === "overdue"
                ? `Your borrowed book "${bookTitle}" is overdue.`
                : `Your borrowed book "${bookTitle}" is due tomorrow.`,
            type: kind === "overdue" ? "error" : "warning",
            meta: { issue: issue._id, kind, sentAt: now },
          });

          // 🔔 PUSH (only if member has subscription)
          const hasPush = await PushSubscription.exists({
            user: memberUser._id,
          });

          if (hasPush) {
            await sendPushToUser(memberUser._id, {
              title: kind === "overdue" ? "Book overdue" : "Book due soon",
              body:
                kind === "overdue"
                  ? `Your borrowed book "${bookTitle}" is overdue.`
                  : `Your borrowed book "${bookTitle}" is due tomorrow.`,
            });
          }

          // 📧 EMAIL
          if (memberUser.email) {
            const email = buildEmail(kind, memberName, bookTitle);
            await sendMail({
              to: memberUser.email,
              subject: email.subject,
              text: email.text,
              html: email.html,
            });
          }
        } catch (err) {
          console.error("Issue processing error:", err.message);
        }
      }
    } catch (err) {
      console.error("Scheduler error:", err.message);
    }
  };

  run();
  return setInterval(run, intervalMs);
}
