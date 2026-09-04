import mongoose from "mongoose";

// A single logged payment or token top-up against a debt
const paymentEntrySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const debtSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lender: { type: String, required: true, trim: true }, // e.g. "PVStar", "Dlight", "Equity Bank"
    debtType: {
      type: String,
      enum: ["standard", "paygo"], // standard = fixed schedule loan, paygo = solar/token-based loan
      default: "standard",
    },
    principal: { type: Number, required: true }, // original amount owed
    balance: { type: Number, required: true }, // current outstanding balance
    interestRate: { type: Number, default: 0 }, // annual %, optional, mostly for standard loans

    // Standard loan fields
    minimumPayment: { type: Number, default: 0 },
    scheduleFrequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "irregular"],
      default: "monthly",
    },
    dueDate: { type: Date },

    // Shared payment/top-up history (for standard payments AND paygo token purchases)
    paymentsLog: [paymentEntrySchema],

    status: { type: String, enum: ["active", "paid_off"], default: "active" },
  },
  { timestamps: true }
);

export default mongoose.model("Debt", debtSchema);
