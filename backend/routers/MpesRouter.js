

import express from "express";
// import { generateAccessToken } from "../controllers/mpesaAuth.controller.js";
import {generateAccessToken} from "../controller/mpesaAuthcontroller.js"
import { accountBalance, mpesaResult, mpesaTimeout } from "../controller/accountBalance.js";
const Mpesarouter = express.Router();

Mpesarouter.get("/token", generateAccessToken);
Mpesarouter.post("/mpesa/account-balance", accountBalance);
Mpesarouter.post("/mpesa/result", mpesaResult);
Mpesarouter.post("/mpesa/timeout", mpesaTimeout);

export default Mpesarouter;