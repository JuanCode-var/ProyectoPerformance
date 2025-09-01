// server/database/mongo.ts
import mongoose from "mongoose";
import Audit from "./esquemaBD.js"; // NodeNext: deja .js en el specifier

// Conexión normal para el gateway
export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/BD_Diagnostico_Rendimiento"
    );
    // eslint-disable-next-line no-console
    console.log("✅ Conexión a MongoDB exitosa");
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("❌ Error de conexión a MongoDB:", error?.message || String(error));
    process.exit(1);
  }
}

// Backfill opcional: sólo corre si BACKFILL=1 (misma lógica que el JS)
export async function runBackfillIfRequested(): Promise<void> {
  if (process.env.BACKFILL !== "1") return;

  const cursor = Audit.find({}).cursor();
  for await (const d of cursor as any) {
    let perf = d.performance as number | undefined;

    if (typeof perf !== "number") {
      if (typeof d.audit?.pagespeed?.performance === "number") {
        perf = Math.round(d.audit.pagespeed.performance);
      } else {
        const score =
          d.audit?.pagespeed?.raw?.lighthouseResult?.categories?.performance?.score;
        if (typeof score === "number") perf = Math.round(score * 100);
      }
    }

    if (typeof perf === "number") {
      d.performance = perf;
      await d.save();
    }
  }
  // eslint-disable-next-line no-console
  console.log("Backfill listo");
}