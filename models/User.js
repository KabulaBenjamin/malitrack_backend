import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    pinHash: { type: String, default: null }, // optional PIN lock for app/mobile
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.setPin = async function (pin) {
  const salt = await bcrypt.genSalt(10);
  this.pinHash = await bcrypt.hash(pin, salt);
};

userSchema.methods.matchPin = function (enteredPin) {
  if (!this.pinHash) return false;
  return bcrypt.compare(enteredPin, this.pinHash);
};

export default mongoose.model("User", userSchema);
