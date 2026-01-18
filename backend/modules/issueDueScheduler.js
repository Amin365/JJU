import Issue from "../models/Issue.js";
import User from "../models/user.js";
import Notification from "../models/Notification.js";
import {sendPushToUser} from '../utility/push.js';
function daysBetweenUTC(a, b) {
  const ms = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) -
            Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function startIssueDueScheduler(intervalMs = 60 * 60 * 1000) { // hourly
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
        const diff = daysBetweenUTC(due, now); // positive when due in future

        let kind = null;
        if (diff === 1) kind = "due-soon"; // due tomorrow
        if (diff <= 0) kind = "overdue";   // due today or earlier
        if (!kind) continue;

        const memberUser = await User.findOne({ member: iss.member }).select("_id").lean();
        if (!memberUser?._id) continue;

        const exists = await Notification.exists({ user: memberUser._id, "meta.issue": iss._id, "meta.kind": kind });
        if (exists) continue;

        // await Notification.create({
        //   user: memberUser._id,
        //   title: kind === "overdue" ? "Book overdue" : "Book due soon",
        //   message:
        //     kind === "overdue"
        //       ? `Your borrowed book "${iss.book?.title || "(unknown title)"}" is overdue.`
        //       : `Your borrowed book "${iss.book?.title || "(unknown title)"}" is due tomorrow.`,
        //   type: kind === "overdue" ? "error" : "warning",
        //   meta: { issue: iss._id, kind },
        // });
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

// 🔔 SEND PUSH (ONLINE OR OFFLINE)
await sendPushToUser(memberUser._id, {
  title: notif.title,
  body: notif.message,
});
      }
    } catch (e) {
      // swallow errors to avoid crashing the app
    }
  };

  // run immediately and then on interval
  run();
  return setInterval(run, intervalMs);
}
