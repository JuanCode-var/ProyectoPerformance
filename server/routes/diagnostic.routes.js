// server/routes/diagnostic.routes.js
import { Router } from "express";
import { getProcessedByUrl } from "../controllers/diagnostic.controller.js";

const router = Router();
router.get("/:encodedUrl/processed", getProcessedByUrl);
export default router;

