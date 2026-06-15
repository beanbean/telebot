"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCreditCards = getCreditCards;
exports.addTransaction = addTransaction;
exports.updateBillingStatement = updateBillingStatement;
exports.getSpentAmountThisCycle = getSpentAmountThisCycle;
// @ts-ignore
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
dotenv.config({ override: true });
// Khởi tạo connection pool tới Local Postgres
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    // Ví dụ: postgresql://username:password@localhost:5432/brain2_finance
});
// Các hàm Helper tương tác DB
async function getCreditCards() {
    const result = await pool.query('SELECT * FROM credit_cards');
    return result.rows;
}
async function addTransaction(transaction) {
    // Chống trùng lặp: kiểm tra xem có giao dịch nào cùng thẻ, cùng số tiền, trong vòng 1 ngày không
    const checkQuery = `
    SELECT id FROM transactions 
    WHERE card_id = $1 AND amount = $2 
    AND transaction_date::date = $3::date
  `;
    const checkValues = [transaction.card_id, transaction.amount, transaction.transaction_date];
    const existing = await pool.query(checkQuery, checkValues);
    if (existing.rows.length > 0) {
        throw new Error("DUPLICATE_TRANSACTION");
    }
    const query = `
    INSERT INTO transactions (card_id, transaction_date, amount, description, cashback_earned, is_online)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `;
    const values = [
        transaction.card_id,
        transaction.transaction_date,
        transaction.amount,
        transaction.description,
        transaction.cashback_earned || 0,
        transaction.is_online !== undefined ? transaction.is_online : true
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
}
async function updateBillingStatement(statement) {
    const query = `
    INSERT INTO billing_statements (card_id, statement_month, total_debt, minimum_payment, is_paid)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (card_id, statement_month) 
    DO UPDATE SET total_debt = EXCLUDED.total_debt, minimum_payment = EXCLUDED.minimum_payment
    RETURNING *
  `;
    const values = [
        statement.card_id,
        statement.statement_month,
        statement.total_debt,
        statement.minimum_payment,
        statement.is_paid || false
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
}
async function getSpentAmountThisCycle(card_id, statement_date) {
    const now = new Date();
    const currentDay = now.getDate();
    let startDate;
    if (currentDay > statement_date) {
        startDate = new Date(now.getFullYear(), now.getMonth(), statement_date + 1);
    }
    else {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, statement_date + 1);
    }
    const query = `
    SELECT COALESCE(SUM(amount), 0) as total_spent
    FROM transactions
    WHERE card_id = $1 AND transaction_date >= $2 AND is_online = TRUE
  `;
    const result = await pool.query(query, [card_id, startDate.toISOString()]);
    return parseInt(result.rows[0].total_spent, 10);
}
