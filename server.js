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
 
// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
 
// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});
 
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOADS_DIR));
 
// Utility functions
function loadItems() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}
 
function saveItems(items) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2));
}
 
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}
 
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
 
function generateToken(userId) {
  return jwt.sign({ userId }, SECRET_KEY, { expiresIn: '30d' });
}
 
function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch (err) {
    return null;
  }
}
 
// Middleware to verify auth token
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization token provided.' });
  }
 
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
 
  req.userId = decoded.userId;
  next();
};
 
// Authentication Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
 
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }
 
    const users = loadUsers();
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already registered.' });
    }
 
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Date.now().toString();
    const newUser = {
      id: userId,
      email,
      password: hashedPassword,
      name,
      createdAt: new Date().toISOString()
    };
 
    users.push(newUser);
    saveUsers(users);
 
    const token = generateToken(userId);
    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        name
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed.' });
  }
});
 
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
 
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
 
    const users = loadUsers();
    const user = users.find(u => u.email === email);
 
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
 
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
 
    const token = generateToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});
 
// Items Routes
app.get('/api/items', authMiddleware, (req, res) => {
  try {
    const { type, q } = req.query;
    let items = loadItems();
 
    // ✅ FIX: Show ALL items to all users (both lost and found items)
    // Remove the restrictive filter - every user can see every other user's reports
 
    if (type && type !== 'all') {
      items = items.filter(i => i.type === type);
    }
 
    if (q) {
      const query = q.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(query) ||
        i.location.toLowerCase().includes(query) ||
        i.desc.toLowerCase().includes(query)
      );
    }
 
    res.json(items);
  } catch (err) {
    console.error('Get items error:', err);
    res.status(500).json({ error: 'Failed to fetch items.' });
  }
});
 
// POST new item with file upload
app.post('/api/items', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { type, name, category, location, date, desc, contact } = req.body;
    const items = loadItems();
    const users = loadUsers();
    const user = users.find(u => u.id === req.userId);
 
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
 
    if (!name || !location || !contact || !['lost', 'found'].includes(type)) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
 
    // Check if image is required for found items
    if (type === 'found' && !req.file) {
      return res.status(400).json({ error: 'Image is required for found items.' });
    }
 
    const newItem = {
      id: Date.now(),
      userId: req.userId,
      type,
      name,
      category: category || 'other',
      location,
      date: date || new Date().toISOString().split('T')[0],
      desc: desc || 'No description',
      contact,
      userName: user.name,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      createdAt: new Date().toISOString()
    };
 
    items.unshift(newItem);
    saveItems(items);
    res.status(201).json(newItem);
  } catch (err) {
    console.error('Post item error:', err);
    res.status(500).json({ error: err.message || 'Failed to create item.' });
  }
});
 

app.delete('/api/items/:id', authMiddleware, (req, res) => {
  try {
    let items = loadItems();
   const itemIndex = items.findIndex(
  i => String(i.id).trim() === String(req.params.id).trim()
);
 
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found.' });
    }
 
    const item = items[itemIndex];
 
  
    if (item.userId !== req.userId) {
      return res.status(403).json({ error: 'You can only delete your own items.' });
    }
 
    
   if (item.image) {
  const imagePath = path.join(__dirname, item.image.replace('/uploads/', 'uploads/'));

  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
}
      }
    }
 
    items.splice(itemIndex, 1);
    saveItems(items);
    res.json({ success: true, message: 'Item deleted successfully.' });
  } catch (err) {
    console.error('Delete item error:', err);
    res.status(500).json({ error: 'Failed to delete item.' });
  }
});
 

app.patch('/api/items/:id/resolve', authMiddleware, (req, res) => {
  try {
    const items = loadItems();
    const item = items.find(i => String(i.id) === req.params.id);
 
    if (!item) {
      return res.status(404).json({ error: 'Item not found.' });
    }
 
    if (item.userId !== req.userId) {
      return res.status(403).json({ error: 'You can only modify your own items.' });
    }
 
    item.resolved = true;
    saveItems(items);
    res.json(item);
  } catch (err) {
    console.error('Resolve item error:', err);
    res.status(500).json({ error: 'Failed to resolve item.' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return res.status(400).json({ error: 'File size too large. Maximum 5MB allowed.' });
    }
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});
 
app.listen(PORT, () => {
  console.log(`✅ FindIt server running at http://localhost:${PORT}`);
});
