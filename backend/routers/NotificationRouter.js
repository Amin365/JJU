import express from "express";
import { protect } from "../middleware/auth.js";
import { listNotifications, markAllRead, markOneRead } from "../controller/NotificationController.js";
import { subscribePush } from "../controller/PushNotifactions.js";
const NotificationRouter = express.Router();

NotificationRouter.get("/notifications", protect, listNotifications);
NotificationRouter.patch("/notifications/read-all", protect, markAllRead);
NotificationRouter.patch("/notifications/:id/read", protect, markOneRead);
NotificationRouter.post("/push/subscribe", protect,subscribePush)
export default NotificationRouter;
