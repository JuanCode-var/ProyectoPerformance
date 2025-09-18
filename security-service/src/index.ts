import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import analyzeRouter from './routes.ts';

const app = express();
app.use(express.json());

// Logging HTTP básico
app.use(morgan('combined'));

app.use('/api/analyze', analyzeRouter);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Security service running on port ${PORT}`);
});
