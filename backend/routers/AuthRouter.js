
import express from 'express'
import { loginLimiter, loginUser, registerUser,GetProfile } from '../controller/Authcontroller.js'
import { protect } from '../middleware/auth.js'
import { createUserFromMember,getUserById,getUsers } from '../controller/UserController.js'
const AuthRouter=express.Router()


AuthRouter.post('/auth/register',registerUser)
AuthRouter.post('/auth/login',loginLimiter,loginUser)
AuthRouter.get("/auth/me", protect, GetProfile);
AuthRouter.post('/users',createUserFromMember)
AuthRouter.get("/users/:id", getUserById);
AuthRouter.get("/users", getUsers);


export default AuthRouter;