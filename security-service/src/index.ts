import 'dotenv/config';
import express from 'express';
import analyzeRouter from './routes.ts';

const app = express();
app.use(express.json());

app.use('/api/analyze', analyzeRouter);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Security service running on port ${PORT}`);
});
