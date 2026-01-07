import express from 'express'
import { getIssues,IssueCreate,markIssueReturned,getMyIssues } from '../controller/IssueController.js'
import { protect } from '../middleware/auth.js'

const issueRouter= express.Router()

issueRouter.post('/issue',IssueCreate)
issueRouter.get('/issue',getIssues)
issueRouter.patch("/issue/:id/return", markIssueReturned);
issueRouter.get("/issues/my", protect, getMyIssues);


export default issueRouter;