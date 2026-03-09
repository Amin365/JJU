
import express from 'express'
import { loginLimiter, loginUser,refreshToken,logout, registerUser,GetProfile, validateInviteToken, setupPasswordFromInvite, resendInvite } from '../controller/Authcontroller.js'
import { protect } from '../middleware/auth.js'
import { createUserFromMember, getUserById, getUsers, getAvailableMembersForUserCreation } from '../controller/UserController.js'
const AuthRouter=express.Router()




AuthRouter.post('/auth/register',registerUser)
AuthRouter.post('/auth/login',loginLimiter,loginUser)

AuthRouter.post("/auth/refresh", refreshToken);
AuthRouter.post("/auth/logout", logout);

// Phase 8 - Invite-based password setup routes
AuthRouter.get("/auth/validate-invite/:token", validateInviteToken);
AuthRouter.post("/auth/setup-password", setupPasswordFromInvite);
AuthRouter.post("/auth/resend-invite", resendInvite);

AuthRouter.get("/auth/me", protect, GetProfile);

AuthRouter.post('/users',createUserFromMember)
AuthRouter.get("/users/:id", getUserById);
AuthRouter.get("/users", getUsers);
AuthRouter.get("/users/available-members", protect, getAvailableMembersForUserCreation);


export default AuthRouter;