import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
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

// Ensure .env is read from the backend root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

connectDB();

const app = express();

// Allowed origins for Web, Local Development, and Capacitor Android/iOS builds
const allowedOrigins = [
  "http://localhost:5000",
  "http://localhost:3000",
  "http://localhost:5173", // Default Vite dev port
  "http://localhost",
  "https://localhost",
  "capacitor://localhost"
];

// Configure CORS for Mobile and Web clients
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or native curls)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive setting for deployment testing
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

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
app.use((req, res) => {
  console.log(`\n❌ [404 NOT FOUND] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: "Route not found" });
});

// Detailed Central Error Handler
app.use((err, req, res, next) => {
  console.error("\n================ SERVER ERROR LOG ================");
  console.error(`📅 Timestamp: ${new Date().toISOString()}`);
  console.error(`📍 Route:     ${req.method} ${req.originalUrl}`);
  console.error(`⚠️ Message:   ${err.message}`);
  console.error("---------------- STACK TRACE ----------------");
  console.error(err.stack);
  console.error("============================================\n");

  res.status(500).json({ 
    message: err.message || "Server error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`MaliTrack API listening on port ${PORT}`));