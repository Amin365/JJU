
import { Router } from "express";
import {
  createBlogPost,
  getBlogPosts,
  getBlogPostById,
  updateBlogPost,
  deleteBlogPost,
  blogMetaPage
} from "../controller/BlogPostController.js";
// import { requireAuth } from "../middleware/requireAuth.js";
import { protect } from '../middleware/auth.js'
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from '../utility/cloudinary.js'
    const Blogrouter = Router();
    const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Blog", // folder in cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
    public_id: (req, file) => Date.now() + "-" + file.originalname.split(".")[0],
  },
});

const upload = multer({ storage });

// Public read endpoints
Blogrouter.get("/blogposts", getBlogPosts);
Blogrouter.get("/blogposts/:id", getBlogPostById);

// Protected write endpoints
Blogrouter.post("/blogposts", protect, upload.single("image"), createBlogPost);
Blogrouter.put("/blogposts/:id", protect, upload.single("image"), updateBlogPost);
Blogrouter.delete("/blogposts/:id", protect, deleteBlogPost);
Blogrouter.get("/share/blog/:id", blogMetaPage);

export default Blogrouter;