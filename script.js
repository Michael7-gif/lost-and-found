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
  setupImagePreview();
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
  toggleAuthMode();
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

  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
  document.getElementById('authName').value = '';
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

  itemGrid.innerHTML = filtered.length
    ? filtered.map(item => `
      <div class="card">
        <div class="card-img">
          ${
            item.image
              ? `<img src="${item.image}" alt="${item.name}" class="item-image">`
              : (EMOJI[item.category?.toLowerCase()] || '📦')
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
  if (!confirm('Are you sure?')) return;

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
    showToast('Deleted successfully', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}



function closeModal() {
  document.getElementById('reportModal')?.classList.remove('open');
}

function openModal(type) {
  if (!currentUser) return showToast('Login required', 'error');

  currentType = type;

  const dateEl = document.getElementById('itemDate');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

  ['itemName','itemLocation','itemDesc','itemContact'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('itemImage').value = '';
  document.getElementById('imagePreview').style.display = 'none';

  document.getElementById('reportModal').classList.add('open');
}



function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;

  t.textContent = msg;
  t.className = 'toast show ' + type;

  setTimeout(() => (t.className = 'toast'), 3000);
}



function setupImagePreview() {}
function updateStats() {}
function submitAuth() {}
function submitItem() {}
