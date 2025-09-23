// server/database/adminVisit.ts
import mongoose from 'mongoose';

export interface AdminVisitDoc extends mongoose.Document {
  ts: Date;
  route: string;
  userId?: string | null;
  role?: string | null;
  event?: 'route_view' | 'route_leave' | 'client_event' | 'server_visit' | (string & {});
  durationMs?: number | null;
  sessionId?: string | null;
  meta?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const AdminVisitSchema = new mongoose.Schema<AdminVisitDoc>({
  ts: { type: Date, default: () => new Date(), index: true },
  route: { type: String, required: true, index: true },
  userId: { type: String, default: null, index: true },
  role: { type: String, default: null, index: true },
  event: { type: String, default: 'route_view', index: true },
  durationMs: { type: Number, default: null },
  sessionId: { type: String, default: null, index: true },
  meta: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true, collection: 'admin_visits' });

// Helpful compound index for analytics
AdminVisitSchema.index({ route: 1, event: 1, ts: -1 });
AdminVisitSchema.index({ role: 1, ts: -1 });

// Auto-expire visits after 60 days (configurable via env)
const days = Number(process.env.VISIT_TTL_DAYS || 60);
if (Number.isFinite(days) && days > 0) {
  AdminVisitSchema.index({ createdAt: 1 }, { expireAfterSeconds: days * 24 * 60 * 60 });
}

const AdminVisit = mongoose.model<AdminVisitDoc>('AdminVisit', AdminVisitSchema);
export default AdminVisit;
