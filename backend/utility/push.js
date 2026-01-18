import webpush from "web-push";
import PushSubscription from "../models/ushSubscription.js";

webpush.setVapidDetails(
  "mailto:admin@yourapp.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Send push to user
export async function sendPushToUser(userId, payload) {
  const subs = await PushSubscription.find({ user: userId }).lean();
  if (!subs.length) return console.log("No push subscriptions for user", userId);

  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify(payload));
      console.log("Push sent to subscription", s._id);
    } catch (err) {
      console.error("Push failed, deleting subscription", s._id, err.message);
      await PushSubscription.deleteOne({ _id: s._id });
    }
  }
}
