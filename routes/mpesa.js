import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Matches typical M-Pesa statement lines, e.g.:
// SGH7XXXXXX  20/6/2026 14:32:10  Pay Bill to KPLC PREPAID ...  Completed  1,200.00  0.00  4,530.00
// Column order after details varies (Paid In / Withdrawn), so we capture both amount columns
// and infer direction from context (Received/Sent/Pay Bill/Buy Goods keywords).
const LINE_REGEX =
  /^([A-Z0-9]{8,12})\s+(\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?)\s+(.+?)\s+(Completed|Failed)\s+([\d,]+\.\d{2}|0\.00|-)\s+([\d,]+\.\d{2}|0\.00|-)\s+([\d,]+\.\d{2})\s*$/;

function parseAmount(str) {
  if (!str || str === "-" ) return 0;
  return parseFloat(str.replace(/,/g, ""));
}

// POST /api/mpesa/import  (multipart/form-data: file, account)
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "PDF file is required (field name: file)" });
    const { account } = req.body;
    if (!account) return res.status(400).json({ message: "account id is required" });

    const acct = await Account.findOne({ _id: account, user: req.user._id });
    if (!acct) return res.status(404).json({ message: "Account not found" });

    const parsed = await pdfParse(req.file.buffer);
    const lines = parsed.text.split("\n").map((l) => l.trim()).filter(Boolean);

    const importBatch = `mpesa_${Date.now()}`;
    const created = [];
    const skipped = [];

    for (const line of lines) {
      const match = line.match(LINE_REGEX);
      if (!match) {
        skipped.push(line);
        continue;
      }
      const [, receiptNo, dateStr, details, status, paidInStr, withdrawnStr, balanceStr] = match;
      if (status !== "Completed") continue;

      const paidIn = parseAmount(paidInStr);
      const withdrawn = parseAmount(withdrawnStr);
      if (paidIn === 0 && withdrawn === 0) continue;

      const type = paidIn > 0 ? "income" : "expense";
      const amount = paidIn > 0 ? paidIn : withdrawn;

      // Best-effort date parse (DD/MM/YYYY HH:MM)
      const [datePart, timePart] = dateStr.split(/\s+/);
      const [d, m, y] = datePart.split("/").map(Number);
      const year = y < 100 ? 2000 + y : y;
      const isoDate = new Date(year, m - 1, d, ...(timePart ? timePart.split(":").map(Number) : [0, 0]));

      const transaction = await Transaction.create({
        user: req.user._id,
        account,
        type,
        source: "personal",
        category: type === "income" ? "M-Pesa Received" : "M-Pesa Payment",
        amount,
        date: isoDate,
        note: `${details} (Receipt: ${receiptNo})`,
        imported: true,
        importBatch,
      });

      if (type === "income") acct.balance += amount;
      else acct.balance -= amount;

      created.push(transaction);
    }

    await acct.save();

    res.status(201).json({
      importBatch,
      importedCount: created.length,
      skippedLineCount: skipped.length,
      note:
        skipped.length > 0
          ? "Some lines could not be parsed automatically — M-Pesa statement formats vary. Review skipped lines and add those manually if needed."
          : undefined,
      transactions: created,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to import statement: " + err.message });
  }
});

export default router;
