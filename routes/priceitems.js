import express from "express";
import PriceItem from "../models/PriceItem.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

// GET all price items for user
router.get("/", async (req, res) => {
  const items = await PriceItem.find({ user: req.user._id }).sort({ name: 1 });
  res.json(items);
});

// CREATE or UPSERT price item
router.post("/", async (req, res) => {
  try {
    const { name, unit, unitValue } = req.body;
    if (!name || !unit || unitValue == null) {
      return res.status(400).json({ message: "name, unit, and unitValue are required" });
    }
    const item = await PriceItem.findOneAndUpdate(
      { user: req.user._id, name },
      { user: req.user._id, name, unit, unitValue },
      { new: true, upsert: true }
    );
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE price item (e.g. update the current price)
router.put("/:id", async (req, res) => {
  const item = await PriceItem.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    req.body,
    { new: true }
  );
  if (!item) return res.status(404).json({ message: "Price item not found" });
  res.json(item);
});

// DELETE price item
router.delete("/:id", async (req, res) => {
  const item = await PriceItem.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!item) return res.status(404).json({ message: "Price item not found" });
  res.json({ message: "Price item deleted" });
});

export default router;
