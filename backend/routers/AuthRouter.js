
import express from 'express'
import { loginLimiter, loginUser,refreshToken,logout, registerUser,GetProfile } from '../controller/Authcontroller.js'
import { protect } from '../middleware/auth.js'
import { createUserFromMember, getUserById, getUsers, getAvailableMembersForUserCreation } from '../controller/UserController.js'
const AuthRouter=express.Router()




AuthRouter.post('/auth/register',registerUser)
AuthRouter.post('/auth/login',loginLimiter,loginUser)

AuthRouter.post("/auth/refresh", refreshToken);
AuthRouter.post("/auth/logout", logout);


AuthRouter.get("/auth/me", protect, GetProfile);
AuthRouter.post('/users',createUserFromMember)
AuthRouter.get("/users/:id", getUserById);
AuthRouter.get("/users", getUsers);
AuthRouter.get("/users/available-members", protect, getAvailableMembersForUserCreation);


export default AuthRouter;