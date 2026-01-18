
import webpush from "web-push";
import PushSubscription from "../models/ushSubscription.js";
import dotenv from "dotenv"

webpush.setVapidDetails(
  "mailto:admin@yourapp.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function sendPushToUser(userId, payload) {
  const subs = await PushSubscription.find({ user: userId }).lean();

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        s.subscription,
        JSON.stringify(payload)
      );
    } catch (err) {
      // remove invalid subscriptions
      await PushSubscription.deleteOne({ _id: s._id });
    }
  }
}
