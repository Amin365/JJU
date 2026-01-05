import express from 'express'
import { GetIssue,IssueCreate } from '../controller/IssueController.js'
const issueRouter= express.Router()

issueRouter.post('/issue',IssueCreate)
issueRouter.get('/issue',GetIssue)


export default issueRouter;