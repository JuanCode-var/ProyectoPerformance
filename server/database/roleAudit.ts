// server/database/roleAudit.ts
import mongoose from 'mongoose';

export interface RoleAuditDoc extends mongoose.Document {
  ts: Date;
  targetUserId: mongoose.Types.ObjectId;
  targetUserName?: string | null;
  previousRole: string | null;
  newRole: string;
  changedById: mongoose.Types.ObjectId;
  changedByName?: string | null;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const RoleAuditSchema = new mongoose.Schema<RoleAuditDoc>({
  ts: { type: Date, default: () => new Date(), index: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetUserName: { type: String },
  previousRole: { type: String },
  newRole: { type: String, required: true, index: true },
  changedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  changedByName: { type: String },
  note: { type: String }
}, { timestamps: true, collection: 'role_audit' });

// TTL opcional configurable
const ttlDays = Number(process.env.ROLE_AUDIT_TTL_DAYS || 365);
if (Number.isFinite(ttlDays) && ttlDays > 0) {
  RoleAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: ttlDays * 24 * 60 * 60 });
}

RoleAuditSchema.index({ targetUserId: 1, ts: -1 });
RoleAuditSchema.index({ changedById: 1, ts: -1 });
RoleAuditSchema.index({ newRole: 1, ts: -1 });

const RoleAudit = mongoose.model<RoleAuditDoc>('RoleAudit', RoleAuditSchema);
export default RoleAudit;
