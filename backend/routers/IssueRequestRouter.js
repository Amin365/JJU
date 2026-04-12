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
import { requirePermission } from "../middleware/role.js";
import { validateSchema } from "../middleware/validateSchema.js";
import { issueRequestSchemas } from "../schemas/securitySchemas.js";
import { apiLimiter } from "../utility/rateLimiter.js";

const issueRequestRouter = express.Router();

issueRequestRouter.post(["/issue-requests", "/"], apiLimiter, protect, validateSchema({ body: issueRequestSchemas.create }), createIssueRequest);
issueRequestRouter.get(["/issue-requests", "/"], apiLimiter, protect, getIssueRequests);
issueRequestRouter.patch(["/issue-requests/:id/approve", "/:id/approve"], apiLimiter, protect, validateSchema({ params: issueRequestSchemas.idParams, body: issueRequestSchemas.review }), requirePermission(["Manage Issues", "Manage Members"]), approveIssueRequest);
issueRequestRouter.patch(["/issue-requests/:id/reject", "/:id/reject"], apiLimiter, protect, validateSchema({ params: issueRequestSchemas.idParams, body: issueRequestSchemas.review }), requirePermission(["Manage Issues", "Manage Members"]), rejectIssueRequest);
issueRequestRouter.patch(["/issue-requests/:id/cancel", "/:id/cancel"], apiLimiter, protect, validateSchema({ params: issueRequestSchemas.idParams }), cancelIssueRequest);
issueRequestRouter.patch(["/issue-requests/:id/issue", "/:id/issue"], apiLimiter, protect, validateSchema({ params: issueRequestSchemas.idParams, body: issueRequestSchemas.convertToIssue }), requirePermission(["Manage Issues", "Manage Members"]), convertToIssue);

export default issueRequestRouter;
