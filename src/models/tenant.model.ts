import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const tenantSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'archived'],
      default: 'active',
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

tenantSchema.pre('validate', function setSlug() {
  const name = typeof this.name === 'string' ? this.name : '';
  const raw = this.slug;
  const slugStr = typeof raw === 'string' ? raw.trim() : '';
  const missing = !slugStr;
  if (name && missing) {
    this.slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
});

tenantSchema.index({ name: 1 });
tenantSchema.index({ createdAt: -1 });

const Tenant = model('Tenant', tenantSchema);

export default Tenant;
