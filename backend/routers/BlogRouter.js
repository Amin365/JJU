
import { Router } from "express";
import {
  createBlogPost,
  getBlogPosts,
  getBlogPostById,
  updateBlogPost,
  deleteBlogPost,
} from "../controller/BlogPostController.js";
// import { requireAuth } from "../middleware/requireAuth.js";
import { protect } from '../middleware/auth.js'

    const Blogrouter = Router();

Blogrouter.post("/blogposts", protect, createBlogPost);
Blogrouter.get("/blogposts", protect, getBlogPosts);
Blogrouter.get("/blogposts/:id", getBlogPostById);
Blogrouter.put("/blogposts/:id", protect, updateBlogPost);
Blogrouter.delete("/blogposts/:id", protect, deleteBlogPost);

export default Blogrouter;