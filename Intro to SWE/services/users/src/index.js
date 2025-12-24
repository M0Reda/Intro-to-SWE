const express = require('express');
const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/users/:id', (req, res) => res.json({ id: req.params.id, name: 'Demo User' }));
app.listen(3003, () => console.log('users running on 3003'));