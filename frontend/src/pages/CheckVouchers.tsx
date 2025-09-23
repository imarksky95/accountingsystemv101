import React, { useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';

import { tryFetchWithFallback } from '../apiBase';

const CheckVouchers: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    tryFetchWithFallback('/api/check-vouchers')
      .then(r => r.ok ? r.json().then(d => setItems(Array.isArray(d) ? d : [])) : setItems([]))
      .catch(() => setItems([]));
  }, []);

  return (
    <Box>
      <h3>Check Vouchers</h3>
      <Button onClick={() => window.location.reload()}>Refresh</Button>
      <ul>
        {items.map(cv => (
          <li key={cv.check_voucher_id}>{cv.check_voucher_control} — {cv.payee_name || (cv.payment_lines && cv.payment_lines[0] && (cv.payment_lines[0].payee_display || cv.payment_lines[0].payee_contact_id)) || ''} — {cv.amount_to_pay || (cv.payment_lines && cv.payment_lines.length ? cv.payment_lines.reduce((s:any,l:any)=>s + (Number(l.amount)||0),0) : 0)}</li>
        ))}
        {items.length === 0 && <li>No check vouchers found.</li>}
      </ul>
    </Box>
  );
};

export default CheckVouchers;
