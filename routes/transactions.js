import express from "express";
import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";
import Debt from "../models/Debt.js";
import PriceItem from "../models/PriceItem.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

// GET transactions (optional query filters: category, type, source, from, to)
router.get("/", async (req, res) => {
  const { category, type, source, from, to } = req.query;
  const filter = { user: req.user._id };
  if (category) filter.category = category;
  if (type) filter.type = type;
  if (source) filter.source = source;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const transactions = await Transaction.find(filter).sort({ date: -1 }).populate("account", "name type");
  res.json(transactions);
});

// CREATE transaction
// type "in_kind" records produce (chicken, maize, vegetables) without touching account balance.
// If amount is omitted for in_kind, it's auto-calculated from the PriceItem table (item x quantity).
router.post("/", async (req, res) => {
  try {
    const { account, type, category, amount, date, note, relatedDebt, source, item, quantity, unit } = req.body;

    if (type === "in_kind") {
      if (!item || !quantity) {
        return res.status(400).json({ message: "item and quantity are required for in-kind entries" });
      }
      let value = amount;
      let resolvedUnit = unit;
      if (value == null) {
        const priceItem = await PriceItem.findOne({ user: req.user._id, name: item });
        if (!priceItem) {
          return res.status(400).json({
            message: `No price set for "${item}". Add it to your price list first, or provide a value manually.`,
          });
        }
        value = priceItem.unitValue * Number(quantity);
        resolvedUnit = resolvedUnit || priceItem.unit;
      }

      const transaction = await Transaction.create({
        user: req.user._id,
        account: account || undefined,
        type: "in_kind",
        source: source || "business",
        category: category || "Farm Produce",
        amount: value,
        date: date || Date.now(),
        note,
        item,
        quantity,
        unit: resolvedUnit,
      });
      return res.status(201).json(transaction);
    }

    // Standard cash transaction types
    if (!account || !type || !category || !amount) {
      return res.status(400).json({ message: "account, type, category, and amount are required" });
    }

    const acct = await Account.findOne({ _id: account, user: req.user._id });
    if (!acct) return res.status(404).json({ message: "Account not found" });

    const transaction = await Transaction.create({
      user: req.user._id,
      account,
      type,
      source: source || "personal",
      category,
      amount,
      date: date || Date.now(),
      note,
      relatedDebt: relatedDebt || null,
    });

    if (type === "income") acct.balance += amount;
    if (type === "expense" || type === "debt_payment") acct.balance -= amount;
    await acct.save();

    if (type === "debt_payment" && relatedDebt) {
      const debt = await Debt.findOne({ _id: relatedDebt, user: req.user._id });
      if (debt) {
        debt.paymentsLog.push({ amount, note, date: date || Date.now() });
        debt.balance = Math.max(0, debt.balance - amount);
        if (debt.balance === 0) debt.status = "paid_off";
        await debt.save();
      }
    }

    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CONVERT an in-kind entry to an actual cash sale (e.g. sold the chickens/vegetables)
// Creates a linked cash income transaction and marks both records as linked.
router.post("/:id/convert-to-sale", async (req, res) => {
  try {
    const { account, amount, date, note } = req.body;
    if (!account || !amount) return res.status(400).json({ message: "account and amount are required" });

    const inKind = await Transaction.findOne({ _id: req.params.id, user: req.user._id, type: "in_kind" });
    if (!inKind) return res.status(404).json({ message: "In-kind entry not found" });
    if (inKind.convertedToTransaction) return res.status(400).json({ message: "Already converted to a sale" });

    const acct = await Account.findOne({ _id: account, user: req.user._id });
    if (!acct) return res.status(404).json({ message: "Account not found" });

    const saleTransaction = await Transaction.create({
      user: req.user._id,
      account,
      type: "income",
      source: "business",
      category: `Sale: ${inKind.item}`,
      amount,
      date: date || Date.now(),
      note: note || `Sale of ${inKind.quantity} ${inKind.unit || ""} ${inKind.item}`.trim(),
      convertedFromTransaction: inKind._id,
    });

    acct.balance += amount;
    await acct.save();

    inKind.convertedToTransaction = saleTransaction._id;
    await inKind.save();

    res.status(201).json({ inKind, saleTransaction });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE transaction
router.delete("/:id", async (req, res) => {
  const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!transaction) return res.status(404).json({ message: "Transaction not found" });
  res.json({ message: "Transaction deleted" });
});

export default router;
