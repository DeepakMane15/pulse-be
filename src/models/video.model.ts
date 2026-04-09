import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const videoSchema = new Schema(
  {
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
    s3Url: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    processingStatus: {
      type: String,
      enum: ['uploaded', 'processing', 'completed', 'failed'],
      default: 'uploaded',
      index: true
    },
    sensitivityStatus: {
      type: String,
      enum: ['pending', 'safe', 'flagged'],
      default: 'pending',
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

videoSchema.index({ tenantId: 1, createdAt: -1 });
videoSchema.index({ tenantId: 1, processingStatus: 1 });
videoSchema.index({ tenantId: 1, sensitivityStatus: 1 });

const Video = model('Video', videoSchema);

export default Video;
