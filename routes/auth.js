import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

const genToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "30d" });

// @route POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already registered" });

    const user = await User.create({ name, email, password });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: genToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      hasPin: !!user.pinHash,
      token: genToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route POST /api/auth/set-pin
router.post("/set-pin", protect, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || pin.length < 4) return res.status(400).json({ message: "PIN must be at least 4 digits" });
    const user = await User.findById(req.user._id);
    await user.setPin(pin);
    await user.save();
    res.json({ message: "PIN set successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route POST /api/auth/verify-pin
router.post("/verify-pin", protect, async (req, res) => {
  try {
    const { pin } = req.body;
    const user = await User.findById(req.user._id);
    const match = await user.matchPin(pin);
    if (!match) return res.status(401).json({ message: "Incorrect PIN" });
    res.json({ message: "PIN verified" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
