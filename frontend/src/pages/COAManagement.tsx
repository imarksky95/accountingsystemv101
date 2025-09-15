import React, { useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, MenuItem, Select, InputLabel, FormControl, SelectChangeEvent
} from '@mui/material';
import ListSubheader from '@mui/material/ListSubheader';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

// Predefined account types grouped by category
const ACCOUNT_TYPE_OPTIONS = [
  {
    label: 'Asset',
    options: [
      'Accounts Receivable',
      'Bank',
      'Cash',
      'Fixed Asset',
      'Input Tax',
      'Other Current Asset',
      'Stock',
    ],
  },
  {
    label: 'Equity',
    options: ['Equity'],
  },
  {
    label: 'Expense',
    options: [
      'Cost Of Goods Sold',
      'Expense',
      'Other Expense',
    ],
  },
  {
    label: 'Income',
    options: [
      'Income',
      'Other Income',
    ],
  },
  {
    label: 'Liability',
    options: [
      'Accounts Payable',
      'Other Current Liability',
      'Other Liability',
      'Output Tax',
    ],
  },
];

interface COAEntry {
  coa_id: number;
  control_number: string;
  account_number: string;
  account_name: string;
  account_type: string;
  parent_id?: number | null;
  parent_account_name?: string | null;
  created_at: string;
}

const COAManagement: React.FC = () => {
  const [accounts, setAccounts] = useState<COAEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ account_number: '', account_name: '', account_type: '', parent_id: '' });
  const [parentOptions, setParentOptions] = useState<{ coa_id: number; account_name: string }[]>([]);

  const fetchAccounts = async () => {
    setLoading(true);
    const res = await fetch('/api/coa');
    let data;
    try {
      data = await res.json();
      console.log('COA API response:', data);
    } catch (e) {
      data = [];
      console.error('Failed to parse COA API response:', e);
    }
    setAccounts(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const fetchParentOptions = async () => {
    const res = await fetch('/api/coa/all/simple');
    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = [];
    }
    console.log('Parent options API response:', data);
    setParentOptions(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchAccounts();
    fetchParentOptions();
  }, []);

  const handleOpen = (entry?: COAEntry) => {
    if (entry) {
      setEditId(entry.coa_id);
      setForm({
        account_number: entry.account_number || '',
        account_name: entry.account_name,
        account_type: entry.account_type,
        parent_id: entry.parent_id ? String(entry.parent_id) : ''
      });
    } else {
      setEditId(null);
      setForm({ account_number: '', account_name: '', account_type: '', parent_id: '' });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditId(null);
  setForm({ account_number: '', account_name: '', account_type: '', parent_id: '' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name as string]: value });
  };

  const handleSubmit = async () => {
    const payload = {
      account_number: form.account_number,
      account_name: form.account_name,
      account_type: form.account_type,
      parent_id: form.parent_id ? Number(form.parent_id) : null
    };
    try {
      let response;
      if (editId) {
        response = await fetch(`/api/coa/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/coa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (!response.ok) {
        const errData = await response.json();
        if (errData && errData.error && errData.error.includes('Duplicate Account Number')) {
          alert('Duplicate Account Number');
          return;
        }
        throw new Error('Failed to save account.');
      }
      await fetchAccounts();
      await fetchParentOptions();
      handleClose();
    } catch (err) {
      alert('Failed to save account. Please try again.');
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/coa/${id}`, { method: 'DELETE' });
    await fetchAccounts();
    await fetchParentOptions(); // update parent dropdown immediately
  };

  // Helper: Build a tree from flat accounts list
  function buildTree(flat: COAEntry[]): any[] {
    const idMap: { [id: number]: any } = {};
    const roots: any[] = [];
    flat.forEach(acc => {
      idMap[acc.coa_id] = { ...acc, children: [] };
    });
    flat.forEach(acc => {
      if (acc.parent_id && idMap[acc.parent_id]) {
        idMap[acc.parent_id].children.push(idMap[acc.coa_id]);
      } else {
        roots.push(idMap[acc.coa_id]);
      }
    });
    return roots;
  }

  // Helper: Render tree rows with indentation
  function renderTreeRows(nodes: any[], level = 0, parentLast = true): JSX.Element[] {
    return nodes.flatMap((node, idx) => {
      const isLast = idx === nodes.length - 1;
      const branch = (
        <span style={{
          display: 'inline-block',
          position: 'relative',
          width: level * 24 + 16,
          height: 24,
          verticalAlign: 'middle',
        }}>
          {level > 0 && (
            <>
              {/* Vertical line for all but last child */}
              <span style={{
                position: 'absolute',
                left: (level - 1) * 24 + 7,
                top: 0,
                height: isLast ? 12 : 24,
                width: 2,
                background: '#bdbdbd',
                zIndex: 1,
                borderRadius: 1,
                opacity: 0.7,
              }} />
              {/* Horizontal connector */}
              <span style={{
                position: 'absolute',
                left: (level - 1) * 24 + 7,
                top: 10,
                width: 16,
                height: 2,
                background: '#bdbdbd',
                zIndex: 2,
                borderRadius: 1,
                opacity: 0.7,
              }} />
            </>
          )}
        </span>
      );
      return [
        <TableRow key={node.coa_id}>
          <TableCell>{node.account_number}</TableCell>
          <TableCell>
            {branch}
            <span style={{ fontWeight: level === 0 ? 500 : 400 }}>
              {node.account_name}
            </span>
          </TableCell>
          <TableCell>{node.account_type}</TableCell>
          <TableCell>{node.parent_account_name || '-'}</TableCell>
          <TableCell>{new Date(node.created_at).toLocaleString()}</TableCell>
          <TableCell align="right">
            <IconButton onClick={() => handleOpen(node)}><EditIcon /></IconButton>
            <IconButton color="error" onClick={() => handleDelete(node.coa_id)}><DeleteIcon /></IconButton>
          </TableCell>
        </TableRow>,
        ...(node.children && node.children.length > 0 ? renderTreeRows(node.children, level + 1, isLast) : [])
      ];
    });
  }

  const tree = buildTree(accounts);

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>Chart of Accounts</Typography>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} sx={{ mb: 2 }}>
        Add Account
      </Button>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Account Number</TableCell>
              <TableCell>Account Name</TableCell>
              <TableCell>Account Type</TableCell>
              <TableCell>Parent Account</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {renderTreeRows(tree)}
            {accounts.length === 0 && !loading && (
              <TableRow><TableCell colSpan={5} align="center">No accounts found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editId ? 'Edit Account' : 'Add Account'}</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Account Number"
            name="account_number"
            value={form.account_number}
            onChange={handleInputChange}
            fullWidth
            required
          />
          <TextField
            margin="dense"
            label="Account Name"
            name="account_name"
            value={form.account_name}
            onChange={handleInputChange}
            fullWidth
            required
          />
          <FormControl fullWidth margin="dense" required>
            <InputLabel id="account-type-label">Account Type</InputLabel>
            <Select
              labelId="account-type-label"
              name="account_type"
              value={form.account_type}
              label="Account Type"
              onChange={handleSelectChange}
              MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
            >
              {ACCOUNT_TYPE_OPTIONS.map(group => [
                <ListSubheader key={group.label}>{group.label}</ListSubheader>,
                group.options.map(opt => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))
              ])}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel id="parent-account-label">Parent Account</InputLabel>
            <Select
              labelId="parent-account-label"
              name="parent_id"
              value={form.parent_id}
              label="Parent Account"
              onChange={handleSelectChange}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {(() => {
                const filtered = (Array.isArray(parentOptions) ? parentOptions : [])
                  .filter(opt => !editId || opt.coa_id !== editId);
                if (filtered.length === 0) {
                  return <MenuItem disabled value=""><em>No available parent accounts</em></MenuItem>;
                }
                return filtered.map(opt => (
                  <MenuItem key={opt.coa_id} value={opt.coa_id}>{opt.account_name}</MenuItem>
                ));
              })()}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">{editId ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default COAManagement;
