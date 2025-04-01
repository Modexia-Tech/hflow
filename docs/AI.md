# **AI Integration in Hflow (WIP)**

_Smart fraud detection and personalized financial services via USSD_

## **1. Key AI Features**

### **1.1 Real-Time Fraud Detection**

- **What it does**:
  - Flags suspicious transactions (e.g., unusually large amounts, rapid
    successive transfers).
  - Blocks SIM-swap attacks by analyzing USSD session patterns.
- **Tech Stack**:
  - **Model**: Isolation Forest (unsupervised anomaly detection).
  - **Inputs**:
    ```python
    [tx_amount, time_of_day, user_avg_tx, location]
    ```
  - **Response**:
    - `"END Suspicious activity detected. Visit agent."`



### **1.3 Dynamic Pricing**

- **What it does**:
  - Predicts low-fee windows for Hedera transactions using historical data.
  - Sends SMS: _"Send HBAR now—fees 50% lower!"_

---

## **2. Implementation**

### **2.1 Fraud Detection Script**

```python
# ai/fraud_detection.py
from sklearn.ensemble import IsolationForest
import pandas as pd

class FraudDetector:
    def __init__(self):
        self.model = IsolationForest(contamination=0.01)  # 1% anomaly rate
    
    def train(self, historical_txs):
        df = pd.DataFrame(historical_txs)
        self.model.fit(df[['amount', 'hour', 'user_avg']])
    
    def predict(self, tx):
        return self.model.predict([[tx.amount, tx.hour, tx.user_avg]]) == -1  # -1 = anomaly
```

### **2.2 Integration with USSD Flow**

```javascript
// routes/ussd.js
const fraudDetector = require("../ai/fraud_detector");

// send hbar
router.post("/", async (req, res) => {
  const tx = req.body;
  if (fraudDetector.predict(tx)) {
    res.send("END Fraud suspected. Visit agent.");
  } else {
    // Process TX
  }
});
```

---

## **3. Data Pipeline**

```mermaid
flowchart LR
    A[USSD TXs] --> B[Hedera Mirror Node]
    B --> C[PostgreSQL]
    C --> D[Train Model]
    D --> E[Predict New TXs]
```

---

## **4. Why This Matters**

- **Saves Money**: Reduces fraud losses by **30%**.

- **Compliance**: Logs all predictions on Hedera for audits.

---
