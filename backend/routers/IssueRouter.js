import express from 'express'
import { getIssues,IssueCreate,markIssueReturned } from '../controller/IssueController.js'
const issueRouter= express.Router()

issueRouter.post('/issue',IssueCreate)
issueRouter.get('/issue',getIssues)
issueRouter.patch("/issue/:id/return", markIssueReturned);



export default issueRouter;