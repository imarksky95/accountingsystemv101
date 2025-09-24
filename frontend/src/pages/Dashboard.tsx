import React, { useEffect, useState } from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import axios from 'axios';

const PlaceholderCard: React.FC<{ title: string, children?: React.ReactNode }> = ({ title, children }) => (
  <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
    <Typography variant="h6" gutterBottom>{title}</Typography>
    <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children || <Typography color="textSecondary">Coming soon</Typography>}
    </Box>
  </Paper>
);

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get('/api/dashboard/summary');
        if (!mounted) return;
        setSummary(res.data);
      } catch (e) {
        // ignore for now
        setSummary({ error: true });
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <PlaceholderCard title="Cash Flow Chart">
            {summary && summary.points ? (
              <Typography color="textSecondary">{summary.points.length} data points</Typography>
            ) : <Typography color="textSecondary">Loading...</Typography>}
          </PlaceholderCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <PlaceholderCard title="Cash In Bank">
            {summary ? <Typography variant="h5">{typeof summary.cashInBank === 'number' ? summary.cashInBank.toLocaleString() : '—'}</Typography> : <Typography>Loading...</Typography>}
          </PlaceholderCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <PlaceholderCard title="Top Expenses">
            <Typography color="textSecondary">Coming soon</Typography>
          </PlaceholderCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <PlaceholderCard title="Company Highlights">
            {summary ? (
              <Box>
                <Typography>Open PVs: {summary.highlights?.openPaymentVouchers ?? '—'}</Typography>
                <Typography>Vendors: {summary.highlights?.vendorsCount ?? '—'}</Typography>
              </Box>
            ) : <Typography>Loading...</Typography>}
          </PlaceholderCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
