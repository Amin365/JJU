import Issue from "../models/Issue.js";
import User from "../models/user.js";
import Notification from "../models/Notification.js";
import { sendPushToUser } from "../utility/push.js";
import { sendMail } from "../controller/EmailController.js";

/**
 * Calculate number of days between two dates (ignoring hours)
 */
function daysBetweenDates(a, b) {
  // Use local year/month/date only to ignore hours
  const da = new Date(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const db = new Date(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  const diffMs = da - db;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)); // floor ensures diff in full days
}

/**
 * Build email content based on kind
 */
function buildEmail(kind, bookTitle) {
  if (kind === "overdue") {
    return {
      subject: "📕 Book Overdue",
      text: `Your borrowed book "${bookTitle}" is overdue. Please return it immediately.`,
      html: `
        <h3>Book Overdue</h3>
        <p>Your borrowed book <strong>"${bookTitle}"</strong> is overdue.</p>
        <p>Please return it immediately.</p>
      `,
    };
  }

  if (kind === "due-soon") {
    return {
      subject: "📘 Book Due Tomorrow",
      text: `Your borrowed book "${bookTitle}" is due tomorrow.`,
      html: `
        <h3>Book Due Tomorrow</h3>
        <p>Your borrowed book <strong>"${bookTitle}"</strong> is due tomorrow.</p>
        <p>Please make sure to return it on time.</p>
      `,
    };
  }

  throw new Error("Invalid email kind: " + kind);
}

/**
 * Start the scheduler for due/overdue issues
 */
export function startIssueDueScheduler(intervalMs = 60 * 60 * 1000) {
  const run = async () => {
    try {
      const now = new Date();

      const activeIssues = await Issue.find({ status: "Issued" })
        .select("_id member returnDate book")
        .populate("book", "title")
        .lean()
        .exec();

      for (const iss of activeIssues) {
        const due = new Date(iss.returnDate);
        const diff = daysBetweenDates(due, now);

        let kind = null;
        if (diff === 1) kind = "due-soon";      // due tomorrow
        if (diff <= 0) kind = "overdue";        // overdue
        if (!kind) continue;

        const memberUser = await User.findOne({ member: iss.member })
          .select("_id email")
          .lean();

        if (!memberUser?._id) continue;

        // Prevent duplicate notification/email
        const exists = await Notification.exists({
          user: memberUser._id,
          "meta.issue": iss._id,
          "meta.kind": kind,
        });
        if (exists) continue;

        // Create notification
        const notif = await Notification.create({
          user: memberUser._id,
          title: kind === "overdue" ? "Book overdue" : "Book due soon",
          message:
            kind === "overdue"
              ? `Your borrowed book "${iss.book?.title}" is overdue.`
              : `Your borrowed book "${iss.book?.title}" is due tomorrow.`,
          type: kind === "overdue" ? "error" : "warning",
          meta: { issue: iss._id, kind },
        });

        // Send push notification
        try {
          await sendPushToUser(memberUser._id, {
            title: notif.title,
            body: notif.message,
          });
        } catch (pushErr) {
          console.error("Push send failed:", pushErr.message);
        }

        // Send Gmail email
        if (memberUser.email) {
          try {
            const email = buildEmail(kind, iss.book?.title);
            await sendMail({
              to: memberUser.email,
              subject: email.subject,
              text: email.text,
              html: email.html,
            });
            console.log(`✅ Email sent to ${memberUser.email} for "${iss.book?.title}" (${kind})`);
          } catch (mailErr) {
            console.error("Email send failed:", mailErr.message);
          }
        }
      }
    } catch (e) {
      console.error("Scheduler error:", e);
    }
  };

  // Run immediately and then repeat every intervalMs
  run();
  return setInterval(run, intervalMs);
}
