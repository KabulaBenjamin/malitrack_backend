import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

const getJwtSecret = () => process.env.JWT_SECRET || "fallback_default_jwt_secret_key_12345";

const genToken = (id) =>
  jwt.sign({ id }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });

// @route POST /api/auth/register
router.post("/register", async (req, res, next) => {
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
    console.error("❌ Register Route Error:", err.message);
    next(err);
  }
});

// @route POST /api/auth/login
router.post("/login", async (req, res, next) => {
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
    console.error("❌ Login Route Error:", err.message);
    next(err);
  }
});

// @route PUT /api/auth/change-password
// @desc Change password while logged in
router.put("/change-password", protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both current and new password are required" });
    }

    const user = await User.findById(req.user._id);
    if (!user || !(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: "Incorrect current password" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
});

// @route POST /api/auth/forgot-password
// @desc Request reset token for forgotten password
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "No account found with that email address" });
    }

    // Generate a temporary reset token valid for 15 minutes
    const resetToken = jwt.sign({ id: user._id }, getJwtSecret(), { expiresIn: "15m" });

    res.json({
      message: "Reset token generated successfully",
      resetToken, // Use this token to hit /reset-password
    });
  } catch (err) {
    next(err);
  }
});

// @route POST /api/auth/reset-password
// @desc Reset password using token
router.post("/reset-password", async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: "Reset token and new password are required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, getJwtSecret());
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired reset token" });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password has been reset successfully. You can now log in." });
  } catch (err) {
    next(err);
  }
});

// @route POST /api/auth/set-pin
router.post("/set-pin", protect, async (req, res, next) => {
  try {
    const { pin } = req.body;
    if (!pin || pin.length < 4) return res.status(400).json({ message: "PIN must be at least 4 digits" });
    const user = await User.findById(req.user._id);
    await user.setPin(pin);
    await user.save();
    res.json({ message: "PIN set successfully" });
  } catch (err) {
    next(err);
  }
});

// @route POST /api/auth/verify-pin
router.post("/verify-pin", protect, async (req, res, next) => {
  try {
    const { pin } = req.body;
    const user = await User.findById(req.user._id);
    const match = await user.matchPin(pin);
    if (!match) return res.status(401).json({ message: "Incorrect PIN" });
    res.json({ message: "PIN verified" });
  } catch (err) {
    next(err);
  }
});

export default router;