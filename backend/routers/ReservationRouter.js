import express from "express";
import {
  createReservation,
  getReservations,
  getBookQueue,
  cancelReservation,
  fulfillReservation,
} from "../controller/ReservationController.js";
import { protect } from "../middleware/auth.js";

const reservationRouter = express.Router();

reservationRouter.post("/reservations", protect, createReservation);
reservationRouter.get("/reservations", protect, getReservations);
reservationRouter.get("/reservations/book/:bookId", protect, getBookQueue);
reservationRouter.patch("/reservations/:id/cancel", protect, cancelReservation);
reservationRouter.patch("/reservations/:id/fulfill", protect, fulfillReservation);

export default reservationRouter;
