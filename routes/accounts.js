import express from "express";
import Account from "../models/Account.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

// GET all accounts for user
router.get("/", async (req, res) => {
  const accounts = await Account.find({ user: req.user._id }).sort({ createdAt: 1 });
  res.json(accounts);
});

// CREATE account
router.post("/", async (req, res) => {
  try {
    const { name, type, balance } = req.body;
    const account = await Account.create({
      user: req.user._id,
      name,
      type,
      balance: balance || 0,
    });
    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE account
router.put("/:id", async (req, res) => {
  const account = await Account.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    req.body,
    { new: true }
  );
  if (!account) return res.status(404).json({ message: "Account not found" });
  res.json(account);
});

// DELETE account
router.delete("/:id", async (req, res) => {
  const account = await Account.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!account) return res.status(404).json({ message: "Account not found" });
  res.json({ message: "Account deleted" });
});

export default router;
