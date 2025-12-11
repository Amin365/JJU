
import express from 'express'
import { loginLimiter, loginUser, registerUser,GetProfile } from '../controller/Authcontroller.js'
import { protect } from '../middleware/auth.js'
const AuthRouter=express.Router()


AuthRouter.post('/auth/register',registerUser)
AuthRouter.post('/auth/login',loginLimiter,loginUser)
AuthRouter.get("/auth/me", protect, GetProfile);


export default AuthRouter;