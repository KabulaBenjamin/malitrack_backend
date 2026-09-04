import express from "express";
import Account from "../models/Account.js";
import Debt from "../models/Debt.js";
import Transaction from "../models/Transaction.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

router.get("/summary", async (req, res) => {
  try {
    const userId = req.user._id;

    const accounts = await Account.find({ user: userId });
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

    const debts = await Debt.find({ user: userId, status: "active" });
    const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);

    const netWorth = totalBalance - totalDebt;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthTransactions = await Transaction.find({
      user: userId,
      date: { $gte: startOfMonth },
    });

    const monthIncome = monthTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const monthExpense = monthTransactions
      .filter((t) => t.type === "expense" || t.type === "debt_payment")
      .reduce((sum, t) => sum + t.amount, 0);

    res.json({
      totalBalance,
      totalDebt,
      netWorth,
      monthIncome,
      monthExpense,
      monthCashFlow: monthIncome - monthExpense,
      accountsCount: accounts.length,
      activeDebtsCount: debts.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
