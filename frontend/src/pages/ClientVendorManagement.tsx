import React from 'react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { TextField, Button, List, ListItem, ListItemText, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

const ClientVendorManagement: React.FC = () => {
	const [vendors, setVendors] = useState<any[]>([]);
	const [name, setName] = useState('');
	const [contact, setContact] = useState('');
	const [loading, setLoading] = useState(false);

	const fetchVendors = async () => {
		setLoading(true);
		try {
			const res = await axios.get('/api/vendors');
			setVendors(res.data);
		} catch (e) {
			console.error(e);
		} finally { setLoading(false); }
	};

	useEffect(() => { fetchVendors(); }, []);

	const createVendor = async () => {
		if (!name) return alert('Name required');
		try {
			const res = await axios.post('/api/vendors', { name, contact_info: contact });
			setVendors(prev => [res.data, ...prev]);
			setName(''); setContact('');
		} catch (e:any) {
			alert(e.response?.data?.error || e.message || 'Create failed');
		}
	};

	const deleteVendor = async (id: number) => {
		if (!confirm('Delete this vendor?')) return;
		try {
			await axios.delete(`/api/vendors/${id}`);
			setVendors(prev => prev.filter(v => v.vendor_id !== id));
		} catch (e:any) {
			alert(e.response?.data?.error || e.message || 'Delete failed');
		}
	};

	return (
		<div>
			<h2>Client & Vendor Management</h2>
			<div style={{display:'flex',gap: '1rem', marginBottom: '1rem'}}>
				<TextField label="Vendor name" value={name} onChange={e => setName(e.target.value)} />
				<TextField label="Contact info" value={contact} onChange={e => setContact(e.target.value)} />
				<Button variant="contained" onClick={createVendor}>Create</Button>
			</div>
			<div>
				<Button onClick={fetchVendors} disabled={loading}>Refresh</Button>
				<List>
					{vendors.map(v => (
						<ListItem key={v.vendor_id} secondaryAction={
							<IconButton edge="end" aria-label="delete" onClick={() => deleteVendor(v.vendor_id)}>
								<DeleteIcon />
							</IconButton>
						}>
							<ListItemText primary={v.name} secondary={v.contact_info} />
						</ListItem>
					))}
				</List>
			</div>
		</div>
	);
};

export default ClientVendorManagement;
