import PushSubscription from "../models/ushSubscription.js";

// Save push subscription
export const subscribePush = async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = req.body;

    if (!subscription?.endpoint) {
      return res.status(400).json({ message: "Invalid subscription" });
    }

    // Prevent duplicate subscriptions
    const existingForUser = await PushSubscription.findAll({ where: { user_id: userId } });
    const existing = existingForUser.find(
      (item) => item.subscription?.endpoint === subscription.endpoint
    );

    if (existing) {
      await existing.update({ subscription });
    } else {
      await PushSubscription.create({ user_id: userId, subscription });
    }

    return res.status(201).json({ message: "Push subscription saved" });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return res.status(500).json({ message: "Failed to save subscription" });
  }
};
