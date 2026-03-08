import express from "express";
import {
  createIssueRequest,
  getIssueRequests,
  approveIssueRequest,
  rejectIssueRequest,
  cancelIssueRequest,
  convertToIssue,
} from "../controller/IssueRequestController.js";
import { protect } from "../middleware/auth.js";

const issueRequestRouter = express.Router();

issueRequestRouter.post("/issue-requests", protect, createIssueRequest);
issueRequestRouter.get("/issue-requests", protect, getIssueRequests);
issueRequestRouter.patch("/issue-requests/:id/approve", protect, approveIssueRequest);
issueRequestRouter.patch("/issue-requests/:id/reject", protect, rejectIssueRequest);
issueRequestRouter.patch("/issue-requests/:id/cancel", protect, cancelIssueRequest);
issueRequestRouter.patch("/issue-requests/:id/issue", protect, convertToIssue);

export default issueRequestRouter;
