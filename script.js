const EMOJI = { electronics:'📱', clothing:'👕', bag:'🎒', keys:'🔑', jewelry:'💍', documents:'📄', pets:'🐾', other:'📦' };
let items = [];
let currentUser = null;
let currentFilter = 'all';
let currentType = 'lost';
let authMode = 'login';


window.addEventListener('load', () => {
  checkAuth();
  loadItems();
  setupImagePreview();
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
  document.getElementById('userName').textContent = `Welcome, ${currentUser.name}`;
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

async function submitAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  
  if (!email || !password) {
    showToast('Please fill all required fields.', 'error');
    return;
  }

  if (authMode === 'signup') {
    const name = document.getElementById('authName').value.trim();
    if (!name) {
      showToast('Please enter your name.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Signup failed.', 'error');
        return;
      }
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      currentUser = data.user;
      closeAuthModal();
      showUserUI();
      loadItems();
      showToast('✅ Account created successfully!', 'success');
    } catch (err) {
      showToast('Signup error: ' + err.message, 'error');
    }
  } else {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Login failed.', 'error');
        return;
      }
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      currentUser = data.user;
      closeAuthModal();
      showUserUI();
      loadItems();
      showToast('✅ Logged in successfully!', 'success');
    } catch (err) {
      showToast('Login error: ' + err.message, 'error');
    }
  }
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  currentUser = null;
  items = [];
  showAuthUI();
  renderCards();
  showToast('✅ Logged out successfully!', 'success');
}


function setupImagePreview() {
  const imageInput = document.getElementById('itemImage');
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('previewImg').src = event.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      document.getElementById('imagePreview').style.display = 'none';
    }
  });
}


function updateImageLabel() {
  const label = document.getElementById('imageLabel');
  const isFound = currentType === 'found';
  label.textContent = isFound ? 'Upload Image (Required)' : 'Upload Image (Optional)';
  document.getElementById('itemImage').required = isFound;
}

async function loadItems() {
  if (!currentUser) {
    items = [];
    updateStats();
    renderCards();
    return;
  }

  try {
    const token = localStorage.getItem('authToken');
    const res = await fetch('/api/items', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      items = await res.json();
    }
  } catch (err) {
    console.error('Error loading items:', err);
  }
  updateStats();
  renderCards();
}

function updateStats() {
  document.getElementById('totalItems').textContent = items.length;
  document.getElementById('lostCount').textContent = items.filter(i=>i.type==='lost').length;
  document.getElementById('foundCount').textContent = items.filter(i=>i.type==='found').length;
  document.getElementById('resolvedCount').textContent = Math.floor(items.length * 0.18);
}

function setFilter(f) {
  currentFilter = f;
  ['all','lost','found'].forEach(t => { document.getElementById('tab-'+t).className = t===f ? 'tab active-'+t : 'tab'; });
  renderCards();
}

function renderCards() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const filtered = items.filter(i => 
    (currentFilter==='all'||i.type===currentFilter) && 
    (!q||i.name.toLowerCase().includes(q)||i.location.toLowerCase().includes(q)||i.desc.toLowerCase().includes(q))
  );
  document.getElementById('resultCount').textContent = `${filtered.length} item${filtered.length!==1?'s':''}`;
  
  document.getElementById('itemGrid').innerHTML = filtered.length ? filtered.map(item => `
    <div class="card">
      <div class="card-img">${EMOJI[item.category]||'📦'}${item.image ? ' 📸' : ''}</div>
      <div class="card-body">
        <span class="badge badge-${item.type}">${item.type==='lost'?'🔴 Lost':'🟢 Found'}</span>
        <h3>${item.name}</h3>
        <div class="card-meta">📍 ${item.location} &nbsp; 📅 ${item.date}</div>
        <p class="card-desc">${item.desc}</p>
        <div style="font-size:0.75rem;color:var(--muted);margin-top:0.5rem">Posted by: ${item.userName}</div>
      </div>
      <div class="card-footer">
        <button class="contact-btn" onclick="showContact(${item.id})">Contact →</button>
        ${currentUser && currentUser.id === item.userId ? 
          `<button class="delete-btn" onclick="deleteItem(${item.id})">🗑️ Delete</button>` 
          : ''}
      </div>
    </div>`).join('') : `<div class="empty"><div class="icon">🔍</div><p>No items match your search.</p></div>`;
}

function showContact(id) {
  const item = items.find(i=>i.id===id);
  document.getElementById('contactTitle').textContent = `Contact for: ${item.name}`;
  document.getElementById('contactBody').innerHTML = `
    <p>📦 <strong>Item:</strong> ${item.name}</p>
    <p>📍 <strong>Location:</strong> ${item.location}</p>
    <p>📅 <strong>Date:</strong> ${item.date}</p>
    <p>👤 <strong>Posted by:</strong> ${item.userName}</p>
    <p style="margin-top:.75rem">✉️ <strong>Contact:</strong> ${item.contact}</p>`;
  
  if (item.image) {
    document.getElementById('contactImage').style.display = 'block';
    document.getElementById('contactImg').src = item.image;
  } else {
    document.getElementById('contactImage').style.display = 'none';
  }
  document.getElementById('contactModal').classList.add('open');
}

async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item report?')) return;
  
  try {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`/api/items/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
      items = items.filter(i => i.id !== id);
      updateStats();
      renderCards();
      showToast('✅ Item deleted successfully!', 'success');
    } else {
      showToast('Failed to delete item.', 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function openModal(type) {
  if (!currentUser) {
    showToast('Please login first.', 'error');
    return;
  }
  currentType = type;
  setType(type);
  updateImageLabel();
  document.getElementById('itemDate').value = new Date().toISOString().split('T')[0];
  ['itemName','itemLocation','itemDesc','itemContact'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('itemImage').value = '';
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('reportModal').classList.add('open');
}

function closeModal() {
  document.getElementById('reportModal').classList.remove('open');
}

function setType(t) {
  currentType = t;
  updateImageLabel();
  document.getElementById('typeLost').className = 'type-btn'+(t==='lost'?' sel-lost':'');
  document.getElementById('typeFound').className = 'type-btn'+(t==='found'?' sel-found':'');
}

async function submitItem() {
  const name = document.getElementById('itemName').value.trim();
  const location = document.getElementById('itemLocation').value.trim();
  const contact = document.getElementById('itemContact').value.trim();
  const imageInput = document.getElementById('itemImage');
  
  if (!name||!location||!contact) {
    showToast('Please fill all required fields.', 'error');
    return;
  }

  if (currentType === 'found' && !imageInput.files[0]) {
    showToast('Please upload an image for found items.', 'error');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('type', currentType);
    formData.append('name', name);
    formData.append('category', document.getElementById('itemCategory').value);
    formData.append('location', location);
    formData.append('date', document.getElementById('itemDate').value);
    formData.append('desc', document.getElementById('itemDesc').value.trim() || 'No description');
    formData.append('contact', contact);
    
    if (imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    }

    const token = localStorage.getItem('authToken');
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!res.ok) {
      const error = await res.json();
      showToast(error.error || 'Failed to submit item.', 'error');
      return;
    }

    const newItem = await res.json();
    items.unshift(newItem);
    closeModal();
    updateStats();
    renderCards();
    showToast('✅ Item reported successfully!', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show '+type;
  setTimeout(()=>t.className='toast', 3000);
}


document.getElementById('reportModal')?.addEventListener('click', e=>{ if(e.target===e.currentTarget) closeModal(); });
document.getElementById('contactModal')?.addEventListener('click', e=>{ if(e.target===e.currentTarget) e.currentTarget.classList.remove('open'); });
document.getElementById('authModal')?.addEventListener('click', e=>{ if(e.target===e.currentTarget) closeAuthModal(); });