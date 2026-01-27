import mongoose from "mongoose";
import DailyReport from "../models/DailyReport.js";
import User from "../models/user.js";
import Member from "../models/Member.js"; // if you have a Member model
import Notification from "../models/Notification.js";
import { sendPushToUser } from "../utility/push.js";

// UTILS

function toUTCDateOnly(d) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

function daysBetweenUTC(a, b) {
  return Math.floor((toUTCDateOnly(a) - toUTCDateOnly(b)) / (24 * 60 * 60 * 1000));
}

export async function notifyUsersMissingDailyReport() {
  const today = toUTCDateOnly(new Date());
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);

  // All members that have an active user account
  const members = await User.distinct("member", { member: { $ne: null } });

  // For each member, check if **any** of their users submitted report for today or yesterday
  // (i.e., don't notify if any user covered their member for this day)
  for (const memberId of members) {
    // Collect all users of this member
    const users = await User.find({ member: memberId }).select("_id first_name last_name username email").lean();

    if (!users.length) continue;

    // Any submitted reading report for these users for today or yesterday?
    const hasRecentReport = await DailyReport.exists({
      createdBy: { $in: users.map((u) => u._id) },
      readingDate: { $in: [today, yesterday] },
    });

    if (hasRecentReport) continue; // member is okay, at least one user submitted

    // Otherwise, notify ALL users of this member
    // (or, if you only want to notify primary user, adjust accordingly)
    for (const user of users) {
      // Prevent duplicate notification for today
      const alreadyNotified = await Notification.exists({
        user: user._id,
        "meta.kind": "missed-daily-report",
        "meta.forDate": today,
      });
      if (alreadyNotified) continue;

      // Compose notification
      const message = `Don't break your reading streak! You haven't submitted your daily reading report for today or yesterday.`;
      await Notification.create({
        user: user._id,
        title: "Don't break your streak!",
        message,
        type: "warning",
        meta: {
          kind: "missed-daily-report",
          forDate: today,
          member: memberId,
        },
      });

      // Optional: send push
      try {
        await sendPushToUser(user._id, {
          title: "Don't break your reading streak!",
          body: message,
        });
      } catch (pushErr) {
        console.error("Push failed", pushErr);
      }
    }
  }
}

// SCHEDULER
export function startDailyReportMissingScheduler(intervalMs = 60 * 60 * 1000) {
  // Run immediately
  notifyUsersMissingDailyReport().catch((err) => console.error("Scheduler error", err));
  // Then run every interval
  return setInterval(() => notifyUsersMissingDailyReport().catch(console.error), intervalMs);
}