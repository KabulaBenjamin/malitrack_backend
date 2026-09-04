import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    type: {
      type: String,
      enum: ["income", "expense", "transfer", "debt_payment", "in_kind"],
      required: true,
    },
    source: { type: String, enum: ["personal", "business"], default: "personal" },
    category: { type: String, required: true, trim: true }, // e.g. "Food", "Farm Sales", "Loan Repayment"
    amount: { type: Number, required: true }, // for in_kind: estimated KES value at record time
    date: { type: Date, default: Date.now },
    note: { type: String, trim: true },
    relatedDebt: { type: mongoose.Schema.Types.ObjectId, ref: "Debt", default: null },

    // Phase 2: in-kind income fields (e.g. chicken, maize, vegetables harvested/produced)
    item: { type: String, trim: true, default: null },
    quantity: { type: Number, default: null },
    unit: { type: String, trim: true, default: null },
    convertedToTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    convertedFromTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },

    // Phase 3: M-Pesa import tracking
    imported: { type: Boolean, default: false },
    importBatch: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", transactionSchema);
