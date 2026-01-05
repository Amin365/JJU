import express from 'express'
import { getRoles } from '../controller/Rolecontroller.js'

const RoleRouter= express.Router();

RoleRouter.get('/roles',getRoles);

export default RoleRouter;

