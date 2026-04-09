import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const queueJobLogSchema = new Schema(
  {
    jobType: {
      type: String,
      enum: ['video_upload'],
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null
    },
    fileName: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    sizeBytes: {
      type: Number,
      required: true
    },
    errorMessage: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'queue_job_logs'
  }
);

queueJobLogSchema.index({ tenantId: 1, createdAt: -1 });

const QueueJobLog = model('QueueJobLog', queueJobLogSchema);

export default QueueJobLog;
