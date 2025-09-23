// server/database/adminLog.ts
import mongoose from 'mongoose';

export interface AdminLogDoc extends mongoose.Document {
  ts: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const AdminLogSchema = new mongoose.Schema<AdminLogDoc>({
  ts: { type: Date, default: () => new Date(), index: true },
  level: { type: String, enum: ['info','warn','error'], index: true, required: true },
  message: { type: String, required: true },
  context: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true, collection: 'admin_logs' });

// Auto-expire logs after 30 days (configurable via env)
const days = Number(process.env.LOG_TTL_DAYS || 30);
if (Number.isFinite(days) && days > 0) {
  AdminLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: days * 24 * 60 * 60 });
}

const AdminLog = mongoose.model<AdminLogDoc>('AdminLog', AdminLogSchema);
export default AdminLog;
