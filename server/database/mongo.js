// server/database/mongo.js
import mongoose from 'mongoose';
import Audit from './esquemaBD.js';

// Conexión normal para el gateway
export async function connectDB() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || 'mongodb://localhost:27017/BD_Diagnostico_Rendimiento'
    );
        console.log('✅ Conexión a MongoDB exitosa');
  } catch (error) {
    console.error('❌ Error de conexión a MongoDB:', error.message);
    process.exit(1);
  }
}

// Backfill opcional: solo corre si lo pides explícitamente con BACKFILL=1
export async function runBackfillIfRequested() {
  if (process.env.BACKFILL !== '1') return;

  const cursor = Audit.find({}).cursor();
  for await (const d of cursor) {
    let perf = d.performance;
    if (typeof perf !== 'number') {
      if (typeof d.audit?.pagespeed?.performance === 'number') {
        perf = Math.round(d.audit.pagespeed.performance);
      } else {
        const score = d.audit?.pagespeed?.raw?.lighthouseResult?.categories?.performance?.score;
        if (typeof score === 'number') perf = Math.round(score * 100);
      }
    }
    if (typeof perf === 'number') {
      d.performance = perf;
      await d.save();
    }
  }
  console.log('Backfill listo');
}

