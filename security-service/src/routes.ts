import { Router } from 'express';
import { analyzeUrl } from './controllers/analyzeController.ts';

const router = Router();

router.post('/', analyzeUrl);
router.post('/headers', (req, res) => {
  // Future expansion for headers analysis
  res.send('Headers analysis not yet implemented');
});

export default router;
