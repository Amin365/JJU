import express from "express";
import { protect } from "../middleware/auth.js";
import { listNotifications, markAllRead, markOneRead } from "../controller/NotificationController.js";

const NotificationRouter = express.Router();

NotificationRouter.get("/notifications", protect, listNotifications);
NotificationRouter.patch("/notifications/read-all", protect, markAllRead);
NotificationRouter.patch("/notifications/:id/read", protect, markOneRead);

export default NotificationRouter;
