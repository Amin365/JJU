import express from 'express'
import { getIssues,IssueCreate,markIssueReturned,getMyIssues ,ReminderEmail} from '../controller/IssueController.js'
import { protect } from '../middleware/auth.js'
import { requirePermission } from '../middleware/role.js'

const issueRouter= express.Router()

issueRouter.post('/issue', protect, requirePermission(["Manage Issues"]), IssueCreate)
issueRouter.get('/issue', protect, requirePermission(["Manage Issues", "View Members"]), getIssues)
issueRouter.patch("/issue/:id/return", protect, requirePermission(["Manage Issues"]), markIssueReturned);
issueRouter.get("/issues/my", protect, getMyIssues);
issueRouter.post("/issue/:id/send-reminder", protect, requirePermission(["Manage Issues"]), ReminderEmail);

export default issueRouter;