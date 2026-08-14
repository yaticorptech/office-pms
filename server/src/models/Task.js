import mongoose from 'mongoose';
import { TASK_PRIORITIES, TASK_PRIORITY, TASK_STATUS, TASK_STATUSES } from '../config/constants.js';

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: 160,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Task must belong to a project'],
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Task must be assigned to an employee'],
      index: true,
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: TASK_PRIORITY.MEDIUM,
      index: true,
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: TASK_STATUS.TODO,
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
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

// Supports the dashboard's "my overdue tasks" and per-employee task lists.
taskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
taskSchema.index({ project: 1, status: 1 });

/** Business rule #13: overdue means past due and not yet completed. */
taskSchema.virtual('isOverdue').get(function isOverdue() {
  if (!this.dueDate || this.status === TASK_STATUS.COMPLETED) return false;
  return this.dueDate.getTime() < Date.now();
});

// Keeps completedAt in step with status without callers having to remember it.
taskSchema.pre('save', function syncCompletedAt(next) {
  if (this.isModified('status')) {
    this.completedAt = this.status === TASK_STATUS.COMPLETED ? new Date() : null;
  }
  next();
});

export const Task = mongoose.model('Task', taskSchema);
