import Issue from "../models/Issue.js";
import User from "../models/user.js";
import Notification from "../models/Notification.js";
import { sendPushToUser } from "../utility/push.js";
import { sendMail } from "../controller/EmailController.js";

function daysBetweenUTC(a, b) {
  const ms =
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) -
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function buildEmail(kind, bookTitle) {
  if (kind === "overdue") {
    return {
      subject: "📕 Book Overdue",
      text: `Your borrowed book "${bookTitle}" is overdue. Please return it immediately.`,
      html: `
        <h3>Book Overdue</h3>
        <p>Your borrowed book <strong>"${bookTitle}"</strong> is overdue.</p>
        <p>Please return it immediately.</p>
      `
    };
  }

  return {
    subject: "📘 Book Due Tomorrow",
    text: `Your borrowed book "${bookTitle}" is due tomorrow.`,
    html: `
      <h3>Book Due Tomorrow</h3>
      <p>Your borrowed book <strong>"${bookTitle}"</strong> is due tomorrow.</p>
    `
  };
}

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
        const diff = daysBetweenUTC(due, now);

        let kind = null;
        if (diff === 1) kind = "due-soon";
        if (diff <= 0) kind = "overdue";
        if (!kind) continue;

        const memberUser = await User.findOne({ member: iss.member })
          .select("_id email")
          .lean();

        if (!memberUser?._id) continue;

        // 🚫 Prevent duplicate notification/email
        const exists = await Notification.exists({
          user: memberUser._id,
          "meta.issue": iss._id,
          "meta.kind": kind,
        });

        if (exists) continue;

        // 🔔 Create notification
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

        // 🔔 Push notification
        try {
          await sendPushToUser(memberUser._id, {
            title: notif.title,
            body: notif.message,
          });
        } catch (pushErr) {
          console.error("Push send failed:", pushErr.message);
        }

        // 📧 Email notification
        if (memberUser.email) {
          try {
            const email = buildEmail(kind, iss.book?.title);
            await sendMail({
              to: memberUser.email,
              subject: email.subject,
              text: email.text,
              html: email.html,
            });
          } catch (mailErr) {
            console.error("Email send failed:", mailErr.message);
          }
        }
      }
    } catch (e) {
      console.error("Scheduler error:", e);
    }
  };

  // Run immediately and then repeat
  run();
  return setInterval(run, intervalMs);
}
