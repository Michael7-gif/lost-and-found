const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'items.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-change-in-production';

/* ================= INIT ================= */

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/* ================= MULTER ================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

/* ================= MIDDLEWARE ================= */

app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOADS_DIR));

/* ================= SAFE FILE HELPERS ================= */

function safeReadJSON(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf-8') || '[]');
  } catch {
    return fallback;
  }
}

function loadItems() {
  return safeReadJSON(DATA_FILE, []);
}

function saveItems(items) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2));
}

function loadUsers() {
  return safeReadJSON(USERS_FILE, []);
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

/* ================= AUTH HELPERS ================= */

function generateToken(userId) {
  return jwt.sign({ userId }, SECRET_KEY, { expiresIn: '30d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch {
    return null;
  }
}

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) return res.status(401).json({ error: 'Invalid token' });

  req.userId = decoded.userId;
  next();
};

/* ================= AUTH ROUTES ================= */

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const users = loadUsers();

    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      name,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    res.status(201).json({
      token: generateToken(newUser.id),
      user: {
        id: newUser.id,
        email,
        name
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const users = loadUsers();
    const user = users.find(u => u.email === email);

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);

    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({
      token: generateToken(user.id),
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

/* ================= ITEMS ROUTES ================= */

app.get('/api/items', authMiddleware, (req, res) => {
  try {
    let items = loadItems();

    const { type, q } = req.query;

    if (type && type !== 'all') {
      items = items.filter(i => i.type === type);
    }

    if (q) {
      const query = q.toLowerCase();
      items = items.filter(i =>
        (i.name || '').toLowerCase().includes(query) ||
        (i.location || '').toLowerCase().includes(query) ||
        (i.desc || '').toLowerCase().includes(query)
      );
    }

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

/* ================= CREATE ITEM ================= */

app.post('/api/items', authMiddleware, upload.single('image'), (req, res) => {
  try {
    const { type, name, category, location, date, desc, contact } = req.body;

    if (!type || !name || !location || !contact) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const users = loadUsers();
    const user = users.find(u => u.id === req.userId);

    if (!user) return res.status(404).json({ error: 'User not found' });

    const items = loadItems();

    const newItem = {
      id: Date.now().toString(),
      userId: req.userId,
      type,
      name,
      category: category || 'other',
      location,
      date: date || new Date().toISOString().split('T')[0],
      desc: desc || '',
      contact,
      userName: user.name,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      createdAt: new Date().toISOString()
    };

    items.unshift(newItem);
    saveItems(items);

    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= DELETE ITEM ================= */

app.delete('/api/items/:id', authMiddleware, (req, res) => {
  try {
    const items = loadItems();

    const index = items.findIndex(
      i => String(i.id) === String(req.params.id)
    );

    if (index === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = items[index];

    if (item.userId !== req.userId) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    if (item.image) {
      const imagePath = path.join(__dirname, item.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    items.splice(index, 1);
    saveItems(items);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

/* ================= ERROR HANDLING ================= */

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large (max 5MB)'
      });
    }
  }

  if (err) {
    return res.status(400).json({ error: err.message });
  }

  next();
});

/* ================= START SERVER ================= */

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
