import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";

import authRoutes from "./routes/auth.js";
import accountRoutes from "./routes/accounts.js";
import debtRoutes from "./routes/debts.js";
import transactionRoutes from "./routes/transactions.js";
import dashboardRoutes from "./routes/dashboard.js";
import priceItemRoutes from "./routes/priceitems.js";
import businessRoutes from "./routes/business.js";
import mpesaRoutes from "./routes/mpesa.js";
import reportRoutes from "./routes/reports.js";

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.json({ message: "MaliTrack API running" }));

app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/debts", debtRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/price-items", priceItemRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/mpesa", mpesaRoutes);
app.use("/api/reports", reportRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`MaliTrack API listening on port ${PORT}`));
