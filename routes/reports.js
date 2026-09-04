import express from "express";
import PDFDocument from "pdfkit";
import Transaction from "../models/Transaction.js";
import Debt from "../models/Debt.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

const fmt = (n) => `KES ${Number(n || 0).toLocaleString()}`;

function startDoc(res, filename) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);
  return doc;
}

function header(doc, title, userName) {
  doc.fontSize(20).text("MaliTrack", { align: "left" });
  doc.fontSize(14).text(title);
  doc.fontSize(10).fillColor("gray").text(`${userName} · Generated ${new Date().toLocaleString()}`);
  doc.moveDown();
  doc.fillColor("black");
}

// GET /api/reports/monthly-statement?month=8&year=2026
router.get("/monthly-statement", async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const transactions = await Transaction.find({
      user: req.user._id,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .populate("account", "name");

    const doc = startDoc(res, `malitrack-statement-${year}-${month}.pdf`);
    header(doc, `Monthly Statement — ${start.toLocaleString("default", { month: "long" })} ${year}`, req.user.name);

    let income = 0;
    let expense = 0;

    transactions.forEach((t) => {
      if (t.type === "income") income += t.amount;
      if (t.type === "expense" || t.type === "debt_payment") expense += t.amount;

      doc
        .fontSize(10)
        .text(
          `${new Date(t.date).toLocaleDateString()}  |  ${t.type.toUpperCase().padEnd(13)}  |  ${t.category.padEnd(20)}  |  ${fmt(t.amount)}${t.account ? "  |  " + t.account.name : ""}`
        );
    });

    doc.moveDown();
    doc.fontSize(12).text(`Total Income: ${fmt(income)}`);
    doc.text(`Total Expense: ${fmt(expense)}`);
    doc.text(`Net: ${fmt(income - expense)}`);

    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reports/debt-summary
router.get("/debt-summary", async (req, res) => {
  try {
    const debts = await Debt.find({ user: req.user._id }).sort({ createdAt: 1 });

    const doc = startDoc(res, "malitrack-debt-summary.pdf");
    header(doc, "Debt Summary", req.user.name);

    let totalBalance = 0;
    debts.forEach((d) => {
      totalBalance += d.balance;
      doc.fontSize(12).text(`${d.lender} (${d.debtType === "paygo" ? "PAYGO/Solar" : "Standard"})`, { continued: false });
      doc
        .fontSize(10)
        .fillColor("gray")
        .text(
          `Principal: ${fmt(d.principal)}  |  Balance: ${fmt(d.balance)}  |  Status: ${d.status}${
            d.debtType === "standard" ? `  |  Interest: ${d.interestRate}%  |  Min Payment: ${fmt(d.minimumPayment)}` : ""
          }`
        )
        .fillColor("black");
      if (d.paymentsLog.length > 0) {
        doc.fontSize(9).fillColor("gray").text(`  Payments logged: ${d.paymentsLog.length}, last on ${new Date(d.paymentsLog[d.paymentsLog.length - 1].date).toLocaleDateString()}`);
        doc.fillColor("black");
      }
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.fontSize(13).text(`Total Outstanding Debt: ${fmt(totalBalance)}`);

    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reports/business-pnl?from=&to=
router.get("/business-pnl", async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { user: req.user._id, source: "business" };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    const transactions = await Transaction.find(filter).sort({ date: 1 });

    const doc = startDoc(res, "malitrack-business-pnl.pdf");
    header(doc, "Business / Farm P&L Report", req.user.name);

    let cashIncome = 0;
    let cashExpense = 0;
    let inKindValue = 0;

    transactions.forEach((t) => {
      if (t.type === "income") cashIncome += t.amount;
      if (t.type === "expense") cashExpense += t.amount;
      if (t.type === "in_kind") inKindValue += t.amount;

      const label =
        t.type === "in_kind"
          ? `IN-KIND: ${t.quantity} ${t.unit || ""} ${t.item}${t.convertedToTransaction ? " (sold)" : " (unsold)"}`
          : `${t.type.toUpperCase()}: ${t.category}`;

      doc.fontSize(10).text(`${new Date(t.date).toLocaleDateString()}  |  ${label}  |  ${fmt(t.amount)}`);
    });

    doc.moveDown();
    doc.fontSize(12).text(`Cash Income: ${fmt(cashIncome)}`);
    doc.text(`Cash Expense: ${fmt(cashExpense)}`);
    doc.text(`Net Cash Profit: ${fmt(cashIncome - cashExpense)}`);
    doc.text(`Total In-Kind Value Produced: ${fmt(inKindValue)}`);

    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
