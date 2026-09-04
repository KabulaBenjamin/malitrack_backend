import express from "express";
import Transaction from "../models/Transaction.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

// GET /api/business/ledger - all business-tagged transactions (cash + in-kind)
router.get("/ledger", async (req, res) => {
  const { from, to } = req.query;
  const filter = { user: req.user._id, source: "business" };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const transactions = await Transaction.find(filter).sort({ date: -1 }).populate("account", "name");
  res.json(transactions);
});

// GET /api/business/summary - simple P&L: cash income, cash expenses, in-kind value produced, sold vs unsold
router.get("/summary", async (req, res) => {
  const transactions = await Transaction.find({ user: req.user._id, source: "business" });

  const cashIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const cashExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const inKindEntries = transactions.filter((t) => t.type === "in_kind");
  const inKindTotalValue = inKindEntries.reduce((sum, t) => sum + t.amount, 0);
  const inKindSold = inKindEntries.filter((t) => t.convertedToTransaction);
  const inKindUnsold = inKindEntries.filter((t) => !t.convertedToTransaction);

  res.json({
    cashIncome,
    cashExpense,
    netCashProfit: cashIncome - cashExpense,
    inKindTotalValue,
    inKindSoldCount: inKindSold.length,
    inKindUnsoldCount: inKindUnsold.length,
    inKindUnsoldValue: inKindUnsold.reduce((sum, t) => sum + t.amount, 0),
  });
});

export default router;
