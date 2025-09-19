import React from 'react';
import { Box, Tabs, Tab, Paper } from '@mui/material';
import PaymentVouchers from './PaymentVouchers';
import DisbursementReports from './DisbursementReports';
import CheckVouchers from './CheckVouchers';

function TabPanel({ children, value, index }: any) {
	return <div role="tabpanel" hidden={value !== index}>{value === index && <Box p={2}>{children}</Box>}</div>;
}

const APManagement: React.FC = () => {
	const [tab, setTab] = React.useState(0);
	return (
		<Box>
			<h2>AP Management Module</h2>
			<Paper>
				<Tabs value={tab} onChange={(e, v) => setTab(v)} indicatorColor="primary" textColor="primary">
					<Tab label="Payment Vouchers" />
					<Tab label="Disbursement Reports" />
					<Tab label="Check Vouchers" />
				</Tabs>
			</Paper>
			<TabPanel value={tab} index={0}><PaymentVouchers /></TabPanel>
			<TabPanel value={tab} index={1}><DisbursementReports /></TabPanel>
			<TabPanel value={tab} index={2}><CheckVouchers /></TabPanel>
		</Box>
	);
};

export default APManagement;
