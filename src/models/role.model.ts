import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const roleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 2,
      maxlength: 50
    },
    clearanceLevel: {
      type: Number,
      required: true,
      min: 0,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

const Role = model('Role', roleSchema);

export default Role;
