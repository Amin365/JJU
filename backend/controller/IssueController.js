import Issue from "../models/Issue.js";
import Books from '../models/Books.js';

export const IssueCreate=async(req,res,next)=>{
    try {
        const {book,member,issueDate,returnDate}=req.body;
        const issue=new Issue({
            book,
            member,
            issueDate,
            returnDate
        });

        const savedIssue=await issue.save();
        const bookToUpdate = await Books.findById(book);
        if (bookToUpdate) {
            bookToUpdate.status = 'borrowed';
            await bookToUpdate.save();
        }
        res.status(201).json(savedIssue);
        
    } catch (error) {
        next(error)
    }
}
// getIssue,

export const GetIssue=async(req,res,next)=>{
    try {
        const issues=await Issue.find().populate('book').populate('member').exec();
        res.status(200).json(issues);
        
    } catch (error) {
        next(error)
    }
}