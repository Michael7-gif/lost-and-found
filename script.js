const EMOJI = {
  electronics: '📱',
  clothing: '👕',
  bag: '🎒',
  keys: '🔑',
  jewelry: '💍',
  documents: '📄',
  pets: '🐾',
  other: '📦'
};

let items = [];
let currentUser = null;
let currentFilter = 'all';
let currentType = 'lost';
let authMode = 'login';
let isSubmitting = false;

window.addEventListener('load', async () => {
  checkAuth();
  await loadItems();
  renderCards();
});

function checkAuth() {
  const token = localStorage.getItem('authToken');
  const user = localStorage.getItem('currentUser');

  if (token && user) {
    currentUser = JSON.parse(user);
    showUserUI();
  } else {
    showAuthUI();
  }
}

function showAuthUI() {
  document.getElementById('userInfo').style.display = 'none';
  document.getElementById('authButtons').style.display = 'flex';
  document.getElementById('reportLostBtn').style.display = 'none';
  document.getElementById('reportFoundBtn').style.display = 'none';
}

function showUserUI() {
  document.getElementById('userInfo').style.display = 'flex';
  document.getElementById('authButtons').style.display = 'none';
  document.getElementById('reportLostBtn').style.display = 'block';
  document.getElementById('reportFoundBtn').style.display = 'block';
  document.getElementById('userName').textContent = `Welcome, ${currentUser?.name || ''}`;
}

function openAuthModal(mode) {
  authMode = mode;
  const isLogin = mode === 'login';
  
  document.getElementById('authTitle').textContent = isLogin ? 'Login' : 'Sign Up';
  document.getElementById('authSubmitBtn').textContent = isLogin ? 'Login' : 'Create Account';
  document.getElementById('nameGroup').style.display = isLogin ? 'none' : 'block';
  document.getElementById('authToggleText').innerHTML = isLogin
    ? "Don't have an account? <a href='#' onclick='toggleAuthMode(event)'>Sign up</a>"
    : "Already have an account? <a href='#' onclick='toggleAuthMode(event)'>Login</a>";

  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
  document.getElementById('authName').value = '';
  
  document.getElementById('authModal').classList.add('open');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('open');
}

function toggleAuthMode(e) {
  if (e) e.preventDefault();
  authMode = authMode === 'login' ? 'signup' : 'login';
  const isLogin = authMode === 'login';

  document.getElementById('authTitle').textContent = isLogin ? 'Login' : 'Sign Up';
  document.getElementById('authSubmitBtn').textContent = isLogin ? 'Login' : 'Create Account';
  document.getElementById('nameGroup').style.display = isLogin ? 'none' : 'block';
  document.getElementById('authToggleText').innerHTML = isLogin
    ? "Don't have an account? <a href='#' onclick='toggleAuthMode(event)'>Sign up</a>"
    : "Already have an account? <a href='#' onclick='toggleAuthMode(event)'>Login</a>";
}

async function submitAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  const name = document.getElementById('authName').value.trim();

  if (!email || !password) {
    showToast('Email and password required', 'error');
    return;
  }

  if (authMode === 'signup' && !name) {
    showToast('Name required for signup', 'error');
    return;
  }

  try {
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    const payload = authMode === 'login' 
      ? { email, password }
      : { email, password, name };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Auth failed', 'error');
      return;
    }

    localStorage.setItem('authToken', data.token);
    localStorage.setItem('currentUser', JSON.stringify(data.user));
    currentUser = data.user;
    
    closeAuthModal();
    showUserUI();
    await loadItems();
    showToast(`${authMode === 'login' ? 'Logged in' : 'Signed up'} successfully!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  currentUser = null;
  items = [];
  showAuthUI();
  renderCards();
  showToast('Logged out', 'success');
}

async function loadItems() {
  try {
    const token = localStorage.getItem('authToken');

    if (!token) {
      items = [];
      updateStats();
      renderCards();
      return;
    }

    const res = await fetch('/api/items', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Failed to load items');

    items = await res.json();
    currentFilter = 'all';

    document.getElementById('tab-all')?.classList.add('active-all');
    document.getElementById('tab-lost')?.classList.remove('active-lost');
    document.getElementById('tab-found')?.classList.remove('active-found');

    updateStats();
    renderCards();
  } catch (err) {
    console.error(err);
  }
}

function setFilter(filter) {
  currentFilter = filter;
  
  document.getElementById('tab-all')?.classList.remove('active-all');
  document.getElementById('tab-lost')?.classList.remove('active-lost');
  document.getElementById('tab-found')?.classList.remove('active-found');
  
  document.getElementById(`tab-${filter}`)?.classList.add(`active-${filter}`);
  
  renderCards();
}

function renderCards() {
  const searchInput = document.getElementById('searchInput');
  const q = searchInput ? searchInput.value.toLowerCase() : '';

  const filtered = items.filter(i =>
    (currentFilter === 'all' || i.type === currentFilter) &&
    (
      !q ||
      (i.name || '').toLowerCase().includes(q) ||
      (i.location || '').toLowerCase().includes(q) ||
      (i.desc || '').toLowerCase().includes(q)
    )
  );

  const itemGrid = document.getElementById('itemGrid');
  if (!itemGrid) return;

  const resultCount = document.getElementById('resultCount');
  if (resultCount) {
    resultCount.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;
  }

  itemGrid.innerHTML = filtered.length
    ? filtered.map(item => `
      <div class="card">
        <div class="card-img">
          ${
            item.image
              ? `<img src="${item.image}" alt="${item.name}" class="item-image">`
              : `<div style="font-size:3rem;display:flex;align-items:center;justify-content:center;height:100%">${EMOJI[item.category?.toLowerCase()] || '📦'}</div>`
          }
        </div>

        <div class="card-body">
          <span class="badge badge-${item.type}">
            ${item.type === 'lost' ? '🔴 Lost' : '🟢 Found'}
          </span>

          <h3>${item.name || ''}</h3>

          <div class="card-meta">
            📍 ${item.location || ''} &nbsp; 📅 ${item.date || ''}
          </div>

          <p class="card-desc">${item.desc || ''}</p>

          <div style="font-size:0.75rem;color:var(--muted);margin-top:0.5rem">
            Posted by: ${item.userName || ''}
          </div>
        </div>

        <div class="card-footer">
          <button class="contact-btn" onclick="showContact(${item.id})">
            Contact →
          </button>

          ${
            currentUser && currentUser.id === item.userId
              ? `<button class="delete-btn" onclick="deleteItem(${item.id})">🗑️ Delete</button>`
              : ''
          }
        </div>
      </div>
    `).join('')
    : `<div class="empty"><div class="icon">🔍</div><p>No items match your search.</p></div>`;
}

function updateStats() {
  const total = items.length;
  const lost = items.filter(i => i.type === 'lost').length;
  const found = items.filter(i => i.type === 'found').length;

  document.getElementById('totalItems').textContent = total;
  document.getElementById('lostCount').textContent = lost;
  document.getElementById('foundCount').textContent = found;
}

function showContact(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  document.getElementById('contactTitle').textContent = `Contact for: ${item.name || ''}`;

  document.getElementById('contactBody').innerHTML = `
    <p>📦 <strong>Item:</strong> ${item.name || ''}</p>
    <p>📍 <strong>Location:</strong> ${item.location || ''}</p>
    <p>📅 <strong>Date:</strong> ${item.date || ''}</p>
    <p>👤 <strong>Posted by:</strong> ${item.userName || ''}</p>
    <p style="margin-top:.75rem">✉️ <strong>Contact:</strong> ${item.contact || ''}</p>
  `;

  const imgWrap = document.getElementById('contactImage');
  if (item.image && imgWrap) {
    imgWrap.style.display = 'block';
    document.getElementById('contactImg').src = item.image;
  } else if (imgWrap) {
    imgWrap.style.display = 'none';
  }

  document.getElementById('contactModal')?.classList.add('open');
}

async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item?')) return;

  try {
    const token = localStorage.getItem('authToken');

    const res = await fetch(`/api/items/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Delete failed', 'error');
      return;
    }

    items = items.filter(i => i.id !== id);
    updateStats();
    renderCards();
    showToast('Item deleted successfully', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeModal() {
  document.getElementById('reportModal')?.classList.remove('open');
}

function setType(type) {
  currentType = type;
  
  document.getElementById('typeLost').classList.remove('sel-lost');
  document.getElementById('typeFound').classList.remove('sel-found');
  
  if (type === 'lost') {
    document.getElementById('typeLost').classList.add('sel-lost');
  } else {
    document.getElementById('typeFound').classList.add('sel-found');
  }
}

function openModal(type) {
  if (!currentUser) {
    showToast('Login required', 'error');
    return;
  }

  currentType = type;

  const dateEl = document.getElementById('itemDate');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

  ['itemName','itemLocation','itemDesc','itemContact'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('itemCategory').value = 'other';
  document.getElementById('itemImage').value = '';
  document.getElementById('imagePreview').style.display = 'none';

  document.getElementById('typeLost').classList.remove('sel-lost');
  document.getElementById('typeFound').classList.remove('sel-found');
  
  if (type === 'lost') {
    document.getElementById('typeLost').classList.add('sel-lost');
  } else {
    currentType = 'found';
    document.getElementById('typeFound').classList.add('sel-found');
  }

  document.getElementById('reportModal').classList.add('open');
}

function previewImage() {
  const input = document.getElementById('itemImage');
  const preview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');

  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    preview.style.display = 'none';
  }
}

async function submitItem() {
  if (isSubmitting) return;

  const name = document.getElementById('itemName').value.trim();
  const location = document.getElementById('itemLocation').value.trim();
  const contact = document.getElementById('itemContact').value.trim();

  if (!name || !location || !contact) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  try {
    isSubmitting = true;
    const token = localStorage.getItem('authToken');
    
    const formData = new FormData();
    formData.append('type', currentType);
    formData.append('name', name);
    formData.append('category', document.getElementById('itemCategory').value);
    formData.append('location', location);
    formData.append('date', document.getElementById('itemDate').value);
    formData.append('desc', document.getElementById('itemDesc').value);
    formData.append('contact', contact);

    const imageInput = document.getElementById('itemImage');
    if (imageInput.files && imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    }

    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Submission failed', 'error');
      return;
    }

    const newItem = await res.json();
    items.unshift(newItem);
    updateStats();
    renderCards();
    closeModal();
    showToast('Item reported successfully!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    isSubmitting = false;
  }
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;

  t.textContent = msg;
  t.className = 'toast show ' + type;

  setTimeout(() => (t.className = 'toast'), 3000);
}
