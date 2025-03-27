const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

// API Configuration
const COINGECKO_API = "https://api.coingecko.com/api/v3";
const FOREX_API = "https://api.exchangerate-api.com/v4/latest/USD"; // Free tier alternative

/**
 * Convert HBAR to KES
 * @param {number} hbarAmount - Amount in HBAR
 * @returns {Promise<number>} - Equivalent KES (rounded to 2 decimals)
 */
async function hbarToKes(hbarAmount) {
  try {
    // Step 1: Get HBAR/USD rate
    const { data: hbarData } = await axios.get(
      `${COINGECKO_API}/simple/price?ids=hedera-hashgraph&vs_currencies=usd`
    );
    const hbarToUsd = hbarData["hedera-hashgraph"].usd;

    // Step 2: Get USD/KES rate (fallback to fixed rate if API fails)
    let usdToKes;
    try {
      const { data: forexData } = await axios.get(FOREX_API);
      usdToKes = forexData.rates.KES || 150; // Fallback: 1 USD = 150 KES
    } catch {
      usdToKes = 150; // Hardcoded fallback
    }

    // Step 3: Calculate KES
    const kesValue = hbarAmount * hbarToUsd * usdToKes;
    return parseFloat(kesValue.toFixed(2)); // Round to 2 decimals
  } catch (err) {
    console.error("Conversion error (HBAR→KES):", err.message);
    throw new Error("Failed to fetch exchange rates");
  }
}

/**
 * Convert KES to HBAR
 * @param {number} kesAmount - Amount in KES
 * @returns {Promise<number>} - Equivalent HBAR (rounded to 8 decimals)
 */
async function kesToHbar(kesAmount) {
  try {
    // Step 1: Get USD/KES rate
    let usdToKes;
    try {
      const { data: forexData } = await axios.get(FOREX_API);
      usdToKes = forexData.rates.KES || 150;
    } catch {
      usdToKes = 150;
    }

    // Step 2: Get HBAR/USD rate
    const { data: hbarData } = await axios.get(
      `${COINGECKO_API}/simple/price?ids=hedera-hashgraph&vs_currencies=usd`
    );
    const hbarToUsd = hbarData["hedera-hashgraph"].usd;

    // Step 3: Calculate HBAR
    const hbarValue = kesAmount / usdToKes / hbarToUsd;
    return parseFloat(hbarValue.toFixed(8)); // Round to 8 decimals (Hedera's precision)
  } catch (err) {
    console.error("Conversion error (KES→HBAR):", err.message);
    throw new Error("Failed to fetch exchange rates");
  }
}

module.exports = { hbarToKes, kesToHbar };
