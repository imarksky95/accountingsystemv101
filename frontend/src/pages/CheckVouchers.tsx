import React, { useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://accountingsystemv101-1.onrender.com';

const CheckVouchers: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/check-vouchers`).then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : [])).catch(() => setItems([]));
  }, []);

  return (
    <Box>
      <h3>Check Vouchers</h3>
      <Button onClick={() => window.location.reload()}>Refresh</Button>
      <ul>
        {items.map(cv => (
          <li key={cv.check_voucher_id}>{cv.check_voucher_control} — {cv.payee} — {cv.amount_to_pay}</li>
        ))}
        {items.length === 0 && <li>No check vouchers found.</li>}
      </ul>
    </Box>
  );
};

export default CheckVouchers;
