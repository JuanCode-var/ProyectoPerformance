// server/database/rolePermissions.ts
import mongoose from 'mongoose';

export interface RolePermissionsDoc extends mongoose.Document {
  role: string; // admin | tecnico | operario | cliente | otros futuros
  permissions: string[];
  updatedAt: Date;
  updatedBy?: mongoose.Types.ObjectId | null;
  version: number; // simple versioning incremental
}

const RolePermissionsSchema = new mongoose.Schema<RolePermissionsDoc>({
  role: { type: String, required: true, unique: true, index: true }, // unique ya crea índice; index:true opcional
  permissions: { type: [String], required: true, default: [] },
  updatedAt: { type: Date, default: () => new Date(), index: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  version: { type: Number, default: 1 }
}, { collection: 'role_permissions' });

const RolePermissions = mongoose.model<RolePermissionsDoc>('RolePermissions', RolePermissionsSchema);
export default RolePermissions;
