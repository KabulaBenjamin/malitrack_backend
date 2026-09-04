import mongoose from "mongoose";

const priceItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true }, // e.g. "Chicken (kienyeji, mature)", "Maize", "Sukuma Wiki"
    unit: { type: String, required: true, trim: true }, // e.g. "bird", "kg", "bunch", "sack"
    unitValue: { type: Number, required: true }, // current KES value per unit
  },
  { timestamps: true }
);

priceItemSchema.index({ user: 1, name: 1 }, { unique: true });

export default mongoose.model("PriceItem", priceItemSchema);
