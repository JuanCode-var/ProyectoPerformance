// server/routes/diagnostic.routes.ts
import { Router } from "express";
import { getProcessedByUrl } from "../controllers/diagnostic.controller.js"; // NodeNext: .js

const router = Router();

// GET /api/diagnostics/:encodedUrl/processed
router.get("/:encodedUrl/processed", getProcessedByUrl);

export default router;