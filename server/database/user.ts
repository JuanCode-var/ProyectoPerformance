// server/database/user.ts
import mongoose from "mongoose";

export type UserRole = 'admin' | 'operario' | 'tecnico' | 'cliente';

export interface UserDoc extends mongoose.Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  title?: string;
  isActive: boolean;
  lastLogin?: Date | null;
  // Verification & recovery
  emailVerified?: boolean;
  verificationToken?: string | null;
  verificationTokenExpires?: Date | null;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  userOverrides?: { allow?: string[]; deny?: string[] };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new mongoose.Schema<UserDoc>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin','operario','tecnico','cliente'], default: 'cliente', index: true },
  title: { type: String },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date, default: null },
  // Verification & recovery
  emailVerified: { type: Boolean, default: false },
  verificationToken: { type: String, default: null, index: true },
  verificationTokenExpires: { type: Date, default: null },
  resetPasswordToken: { type: String, default: null, index: true },
  resetPasswordExpires: { type: Date, default: null },
  userOverrides: {
    allow: { type: [String], default: [] },
    deny: { type: [String], default: [] },
  } as any,
}, { timestamps: true, collection: 'users' });

const User = mongoose.model<UserDoc>('User', UserSchema);
export default User;
