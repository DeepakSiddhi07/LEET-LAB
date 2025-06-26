import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { executeCode } from '../controllers/executeCode.controller.js';

const executionRoutes = express.Router();


executionRoutes.post('/',authMiddleware,executeCode)





export default executionRoutes;