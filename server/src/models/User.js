import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { DEPARTMENTS, ROLES, USER_ROLES, USER_STATUS, USER_STATUSES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    department: {
      type: String,
      enum: DEPARTMENTS,
      default: 'other',
      index: true,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: ROLES.EMPLOYEE,
      index: true,
    },
    profilePhoto: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: USER_STATUS.ACTIVE,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.virtual('initials').get(function initials() {
  return this.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
});

userSchema.statics.hashPassword = (plainPassword) => bcrypt.hash(plainPassword, env.bcryptRounds);

userSchema.methods.verifyPassword = function verifyPassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);
