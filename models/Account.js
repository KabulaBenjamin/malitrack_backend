import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true }, // e.g. "M-Pesa", "Cash", "Equity Bank"
    type: { type: String, enum: ["cash", "bank", "mpesa", "other"], default: "cash" },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Account", accountSchema);
