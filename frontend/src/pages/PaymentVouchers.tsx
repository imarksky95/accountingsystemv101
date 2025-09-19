import React, { useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://accountingsystemv101.onrender.com';

const PaymentVouchers: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/payment-vouchers`).then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : [])).catch(() => setItems([]));
  }, []);

  return (
    <Box>
      <h3>Payment Vouchers</h3>
      <Button onClick={() => window.location.reload()}>Refresh</Button>
      <ul>
        {items.map(pv => (
          <li key={pv.payment_voucher_id}>{pv.payment_voucher_control} — {pv.payee} — {pv.amount_to_pay}</li>
        ))}
        {items.length === 0 && <li>No payment vouchers found.</li>}
      </ul>
    </Box>
  );
};

export default PaymentVouchers;
