import mongoose from 'mongoose';
import { PROJECT_STATUS, PROJECT_STATUSES, PROJECT_TYPES } from '../config/constants.js';

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: 120,
      index: true,
    },
    // Optional: a project may be created before anyone decides how to categorise it.
    // `null` means "no type" and is excluded from every type filter.
    type: {
      type: String,
      enum: {
        values: [...PROJECT_TYPES, null],
        message: 'Select a valid project type',
      },
      default: null,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Project owner is required'],
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: PROJECT_STATUS.PLANNING,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

projectSchema.virtual('isArchived').get(function isArchived() {
  return this.status === PROJECT_STATUS.ARCHIVED;
});

export const Project = mongoose.model('Project', projectSchema);
