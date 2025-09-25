import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  TextField,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  Grid,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Typography,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

import { tryFetchWithFallback } from '../apiBase';

type PaymentLine = { payee?: string; amount?: number | ''; payee_contact_id?: number | null };
type CheckLine = { check_date?: string; check_no?: string; payee?: string; amount?: number | ''; check_subpayee?: number | null };

const emptyPaymentLine = (): PaymentLine => ({ payee: '', amount: '' });
const emptyCheckLine = (): CheckLine => ({ check_date: '', check_no: '', payee: '', amount: '' });

const CheckVouchers: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [coas, setCoas] = useState<any[]>([]);

  // Form state
  const [type, setType] = useState<'single' | 'multi'>('single');
  const [cvDate, setCvDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [payee, setPayee] = useState('');
  const [checkNo, setCheckNo] = useState('');
  const [checkAmount, setCheckAmount] = useState<number | ''>('');
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([emptyPaymentLine()]);
  const [checkLines, setCheckLines] = useState<CheckLine[]>([emptyCheckLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchList = async () => {
    try {
      const r = await tryFetchWithFallback('/api/check-vouchers');
      if (r.ok) setItems(await r.json());
      else setItems([]);
    } catch (_) {
      setItems([]);
    }
  };

  useEffect(() => { fetchList(); }, []);
  useEffect(() => {
    tryFetchWithFallback('/api/contacts').then(r => r.ok ? r.json().then(d => setContacts(Array.isArray(d) ? d : [])) : setContacts([])).catch(()=>setContacts([]));
    tryFetchWithFallback('/api/coa').then(r => r.ok ? r.json().then(d => setCoas(Array.isArray(d) ? d : [])) : setCoas([])).catch(()=>setCoas([]));
  }, []);

  const validate = () => {
    const e: Record<string,string> = {};
    if (!cvDate) e.cvDate = 'Check date is required';
    if (type === 'single') {
      if (!checkNo) e.checkNo = 'Check number is required';
      if (!payee) e.payee = 'Payee is required';
      if (!checkAmount || Number(checkAmount) <= 0) e.checkAmount = 'Check amount must be > 0';
      // payment lines required
      const sum = paymentLines.reduce((s, l) => s + (Number(l.amount)||0), 0);
      if (sum !== Number(checkAmount)) e.paymentLines = 'Payment lines total must equal check amount';
    } else {
      // multi
      if (!checkLines.length) e.checkLines = 'At least one check line is required';
      checkLines.forEach((cl, idx) => {
        if (!cl.check_no) e[`check_no_${idx}`] = 'Check number required';
        if (!cl.payee) e[`check_payee_${idx}`] = 'Payee required';
        if (!cl.amount || Number(cl.amount) <= 0) e[`check_amount_${idx}`] = 'Amount must be > 0';
      });
      const jSum = checkLines.reduce((s, l) => s + (Number(l.amount)||0), 0);
      const jTotal = paymentLines.reduce((s, l) => s + (Number(l.amount)||0), 0);
      if (jSum !== jTotal) e.checkLinesTotal = 'Sum of check lines must equal sum of payment/journal lines';
    }
    if (!paymentLines.length) e.paymentLines = 'At least one journal/payment line is required';
    paymentLines.forEach((pl, idx) => {
      if (!pl.payee) e[`pl_payee_${idx}`] = 'Payee required';
      if (!pl.amount || Number(pl.amount) <= 0) e[`pl_amount_${idx}`] = 'Amount must be > 0';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resetForm = () => {
    setType('single'); setCvDate(''); setPurpose(''); setPayee(''); setCheckNo(''); setCheckAmount(''); setPaymentLines([emptyPaymentLine()]); setCheckLines([emptyCheckLine()]); setErrors({});
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload: any = {
        cvoucher_date: cvDate,
        purpose,
        check_payee: payee,
        check_no: checkNo,
        check_amount: type === 'single' ? Number(checkAmount) : null,
        cvoucher_status: 'created',
        multiple_checks: type === 'multi',
        check_fr: type === 'multi' && checkLines.length ? checkLines[0].check_no : null,
        check_to: type === 'multi' && checkLines.length ? checkLines[checkLines.length-1].check_no : null,
        coa_id: null,
      };
      // Include payment_lines and check_lines as JSON payload if API supports; backend currently stores top-level columns only — include them to help later migration
      payload.payment_lines = paymentLines;
      payload.check_lines = checkLines;

      const r = await tryFetchWithFallback('/api/check-vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        await fetchList();
        resetForm();
      } else {
        const data = await r.json().catch(() => ({}));
        setErrors({ submit: data.error || 'Failed to create check voucher' });
      }
    } catch (err: any) {
      setErrors({ submit: err.message || 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Check Vouchers</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Create Check Voucher</Typography>
            <Divider sx={{ my: 1 }} />

            <Box sx={{ my: 1 }}>
              <RadioGroup row value={type} onChange={(e) => setType(e.target.value as any)}>
                <FormControlLabel value="single" control={<Radio />} label="Single Check Voucher" />
                <FormControlLabel value="multi" control={<Radio />} label="Multi-Check Voucher" />
              </RadioGroup>
            </Box>

            <TextField fullWidth label="Check Date" type="date" value={cvDate} onChange={(e)=>setCvDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ my: 1 }} error={!!errors.cvDate} helperText={errors.cvDate} />
            <TextField fullWidth label="Purpose" value={purpose} onChange={(e)=>setPurpose(e.target.value)} sx={{ my: 1 }} />

            {type === 'single' && (
              <>
                <TextField fullWidth label="Check Number" value={checkNo} onChange={(e)=>setCheckNo(e.target.value)} sx={{ my: 1 }} error={!!errors.checkNo} helperText={errors.checkNo} />
                <TextField fullWidth label="Payee" value={payee} onChange={(e)=>setPayee(e.target.value)} sx={{ my: 1 }} error={!!errors.payee} helperText={errors.payee} />
                <TextField fullWidth label="Check Amount" type="number" value={checkAmount as any} onChange={(e)=>setCheckAmount(e.target.value === '' ? '' : Number(e.target.value))} sx={{ my: 1 }} error={!!errors.checkAmount} helperText={errors.checkAmount} />
              </>
            )}

            {type === 'multi' && (
              <Box sx={{ my: 1 }}>
                <Typography variant="subtitle1">Check Lines</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Check Date</TableCell>
                      <TableCell>Check No</TableCell>
                      <TableCell>Payee</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {checkLines.map((cl, idx) => (
                      <TableRow key={idx}>
                        <TableCell><TextField type="date" value={cl.check_date} onChange={(e)=>{
                          const copy=[...checkLines]; copy[idx].check_date = e.target.value; setCheckLines(copy);
                        }} InputLabelProps={{ shrink: true }} /></TableCell>
                        <TableCell><TextField value={cl.check_no} onChange={(e)=>{ const copy=[...checkLines]; copy[idx].check_no = e.target.value; setCheckLines(copy); }} error={!!errors[`check_no_${idx}`]} helperText={errors[`check_no_${idx}`]} /></TableCell>
                        <TableCell>
                          <TextField
                            select
                            value={(cl.check_subpayee as any) || ''}
                            onChange={(e)=>{ const copy=[...checkLines]; copy[idx].check_subpayee = e.target.value ? Number(e.target.value) : null; setCheckLines(copy); }}
                            helperText={errors[`check_payee_${idx}`]}
                          >
                            <MenuItem value="">(Select contact)</MenuItem>
                            {contacts.map(c => <MenuItem key={c.contact_id} value={c.contact_id}>{c.display_name}</MenuItem>)}
                          </TextField>
                        </TableCell>
                        <TableCell align="right"><TextField type="number" value={cl.amount as any} onChange={(e)=>{ const copy=[...checkLines]; copy[idx].amount = e.target.value === '' ? '' : Number(e.target.value); setCheckLines(copy); }} error={!!errors[`check_amount_${idx}`]} helperText={errors[`check_amount_${idx}`]} /></TableCell>
                        <TableCell><IconButton onClick={()=>{ setCheckLines(checkLines.filter((_,i)=>i!==idx)); }}><DeleteIcon /></IconButton></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button onClick={()=>setCheckLines([...checkLines, emptyCheckLine()])} sx={{ mt: 1 }}>Add Check Line</Button>
                {errors.checkLines && <Typography color="error">{errors.checkLines}</Typography>}
                {errors.checkLinesTotal && <Typography color="error">{errors.checkLinesTotal}</Typography>}
              </Box>
            )}

            <Box sx={{ my: 2 }}>
              <Typography variant="subtitle1">Payment / Journal Lines</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Payee</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paymentLines.map((pl, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <TextField
                          select
                          value={(pl.payee_contact_id as any) || ''}
                          onChange={(e)=>{ const copy=[...paymentLines]; copy[idx].payee_contact_id = e.target.value ? Number(e.target.value) : null; copy[idx].payee = contacts.find(c=>c.contact_id===Number(e.target.value))?.display_name || ''; setPaymentLines(copy); }}
                          helperText={errors[`pl_payee_${idx}`]}
                        >
                          <MenuItem value="">(Select contact)</MenuItem>
                          {contacts.map(c => <MenuItem key={c.contact_id} value={c.contact_id}>{c.display_name}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell align="right"><TextField type="number" value={pl.amount as any} onChange={(e)=>{ const copy=[...paymentLines]; copy[idx].amount = e.target.value === '' ? '' : Number(e.target.value); setPaymentLines(copy); }} error={!!errors[`pl_amount_${idx}`]} helperText={errors[`pl_amount_${idx}`]} /></TableCell>
                      <TableCell><IconButton onClick={()=>{ setPaymentLines(paymentLines.filter((_,i)=>i!==idx)); }}><DeleteIcon /></IconButton></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button onClick={()=>setPaymentLines([...paymentLines, emptyPaymentLine()])} sx={{ mt: 1 }}>Add Line</Button>
              {errors.paymentLines && <Typography color="error">{errors.paymentLines}</Typography>}
            </Box>

            {errors.submit && <Typography color="error">{errors.submit}</Typography>}

            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button variant="contained" onClick={handleSave} disabled={loading}>Save</Button>
              <Button onClick={resetForm} disabled={loading}>Reset</Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Existing Check Vouchers</Typography>
            <Divider sx={{ my: 1 }} />
            <Box>
              <Button onClick={fetchList}>Refresh</Button>
              <ul>
                {items.map(cv => (
                  <li key={cv.check_voucher_id}>{cv.check_voucher_control} — {cv.check_payee || (cv.payment_lines && cv.payment_lines[0] && (cv.payment_lines[0].payee)) || ''} — {cv.check_amount || (cv.payment_lines && cv.payment_lines.length ? cv.payment_lines.reduce((s:any,l:any)=>s + (Number(l.amount)||0),0) : 0)}</li>
                ))}
                {items.length === 0 && <li>No check vouchers found.</li>}
              </ul>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CheckVouchers;
