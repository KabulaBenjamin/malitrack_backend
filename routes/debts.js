import express from "express";
import Debt from "../models/Debt.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

// GET all debts
router.get("/", async (req, res) => {
  const debts = await Debt.find({ user: req.user._id }).sort({ createdAt: 1 });
  res.json(debts);
});

// CREATE debt
router.post("/", async (req, res) => {
  try {
    const {
      lender,
      debtType,
      principal,
      balance,
      interestRate,
      minimumPayment,
      scheduleFrequency,
      dueDate,
    } = req.body;

    if (!lender || principal == null) {
      return res.status(400).json({ message: "Lender and principal are required" });
    }

    const debt = await Debt.create({
      user: req.user._id,
      lender,
      debtType: debtType || "standard",
      principal,
      balance: balance != null ? balance : principal,
      interestRate: interestRate || 0,
      minimumPayment: minimumPayment || 0,
      scheduleFrequency: scheduleFrequency || (debtType === "paygo" ? "irregular" : "monthly"),
      dueDate,
    });
    res.status(201).json(debt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE debt (edit terms)
router.put("/:id", async (req, res) => {
  const debt = await Debt.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    req.body,
    { new: true }
  );
  if (!debt) return res.status(404).json({ message: "Debt not found" });
  res.json(debt);
});

// LOG a payment or PAYGO token top-up against a debt -> reduces balance
router.post("/:id/payments", async (req, res) => {
  try {
    const { amount, note, date } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: "Valid amount required" });

    const debt = await Debt.findOne({ _id: req.params.id, user: req.user._id });
    if (!debt) return res.status(404).json({ message: "Debt not found" });

    debt.paymentsLog.push({ amount, note, date: date || Date.now() });
    debt.balance = Math.max(0, debt.balance - amount);
    if (debt.balance === 0) debt.status = "paid_off";

    await debt.save();
    res.json(debt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE debt
router.delete("/:id", async (req, res) => {
  const debt = await Debt.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!debt) return res.status(404).json({ message: "Debt not found" });
  res.json({ message: "Debt deleted" });
});

// GET payoff plan (snowball or avalanche) - only applies to standard debts.
// PAYGO debts are excluded from the ordered payoff plan since they have no fixed schedule,
// but their current balance/trend is still returned separately.
router.get("/payoff-plan/:strategy", async (req, res) => {
  try {
    const strategy = req.params.strategy; // "snowball" or "avalanche"
    const allDebts = await Debt.find({ user: req.user._id, status: "active" });

    const standardDebts = allDebts.filter((d) => d.debtType === "standard");
    const paygoDebts = allDebts.filter((d) => d.debtType === "paygo");

    let ordered;
    if (strategy === "avalanche") {
      ordered = [...standardDebts].sort((a, b) => b.interestRate - a.interestRate);
    } else {
      // default: snowball - smallest balance first
      ordered = [...standardDebts].sort((a, b) => a.balance - b.balance);
    }

    const plan = ordered.map((d, i) => ({
      lender: d.lender,
      balance: d.balance,
      minimumPayment: d.minimumPayment,
      interestRate: d.interestRate,
      priorityOrder: i + 1,
    }));

    const totalStandardBalance = standardDebts.reduce((sum, d) => sum + d.balance, 0);
    const totalPaygoBalance = paygoDebts.reduce((sum, d) => sum + d.balance, 0);

    res.json({
      strategy,
      plan,
      totalStandardBalance,
      paygoDebts: paygoDebts.map((d) => ({
        lender: d.lender,
        balance: d.balance,
        note: "PAYGO/solar loan - pay as tokens are needed, not part of fixed payoff order",
      })),
      totalPaygoBalance,
      grandTotalDebt: totalStandardBalance + totalPaygoBalance,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
