# FIX PLAN - TDS Content Factory

## Critical Issues (Must Fix Before Deployment)

### 1. REMOVE ALL FAKE DATA
**File:** `client/index.html` (Lines 298-314)

**Current:**
```javascript
const sampleVideos = [
    { id: 1, title: "Morning Routine Hacks", caption: "...", duration: "0:45", status: "ready", thumbnail: "https://images.unsplash.com/..." },
    // 5 more fake videos with Unsplash images
];
```

**Fix:** Replace with API call
```javascript
const API_BASE = '/api';
let videos = [];

async function loadVideos() {
    const response = await fetch(`${API_BASE}/videos`);
    videos = await response.json();
    renderVideos();
}
```

**Calendar Data (Line 340):**
```javascript
const calendarData = [
    { day: 12, count: 3, active: false }, // FAKE
    // ...
];
```

**Fix:** Fetch from API
```javascript
async function loadCalendar() {
    const response = await fetch(`${API_BASE}/calendar`);
    const data = await response.json();
    renderCalendar(data);
}
```

---

### 2. WIRE BUTTONS TO REAL API
**File:** `client/index.html`

**generateNewBatch() (Lines 425-431):**
```javascript
function generateNewBatch() {
    document.getElementById('loadingOverlay').classList.add('active');
    setTimeout(() => { // FAKE
        document.getElementById('loadingOverlay').classList.remove('active');
        showToast('New batch generated successfully!', 'success');
        const videosReady = document.getElementById('videosReady');
        videosReady.textContent = parseInt(videosReady.textContent) + 3; // FAKE
    }, 2000);
}
```

**Fix:**
```javascript
async function generateNewBatch() {
    document.getElementById('loadingOverlay').classList.add('active');
    try {
        const response = await fetch(`${API_BASE}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count: 3 })
        });
        const data = await response.json();
        await loadVideos(); // Refresh from API
        showToast(`Generated ${data.videos.length} videos!`, 'success');
    } catch (err) {
        showToast('Failed to generate: ' + err.message, 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}
```

**downloadItem() (Lines 463-472):**
```javascript
function downloadItem(videoId) {
    const video = sampleVideos.find(v => v.id === videoId); // FAKE
    showToast(`Downloading "${video.title}"...`, 'success'); // FAKE
    setTimeout(() => {
        showToast('Download complete!', 'success'); // FAKE
    }, 1500);
}
```

**Fix:**
```javascript
async function downloadItem(videoId) {
    try {
        const response = await fetch(`${API_BASE}/videos/${videoId}/download`);
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `video-${videoId}.mp4`;
        a.click();
        showToast('Download complete!', 'success');
    } catch (err) {
        showToast('Download failed: ' + err.message, 'error');
    }
}
```

---

### 3. ADD SETTINGS PAGE
**File:** Create `client/settings.html` or add settings modal to index.html

**Required Settings:**
- API endpoint configuration
- Generation count (default videos per batch)
- Music selection preferences
- Content category toggles
- Avatar animation settings

**Implementation:**
```javascript
// Add to header navigation
<button onclick="openSettings()">Settings</button>

// Settings modal
function openSettings() {
    // Show modal with form
    // Load current settings from localStorage or API
    // Save on change
}
```

---

### 4. FIX ROUTING
**File:** `client/index.html`

**Current:** Root has redirect to `/client/`

**Fix:** Proper SPA routing
```javascript
// Add router
const routes = {
    '/': showDashboard,
    '/videos': showVideos,
    '/calendar': showCalendar,
    '/settings': showSettings
};

function navigate(path) {
    history.pushState({}, '', path);
    routes[path]();
}
```

---

### 5. INTEGRATE VIDEO PIPELINE
**Files:** `client/js/video-renderer.js`, `client/js/avatar-engine.js`, `client/js/audio-mixer.js`

**Current:** Files exist but not imported/used in index.html

**Fix:**
```html
<script src="js/avatar-engine.js"></script>
<script src="js/audio-mixer.js"></script>
<script src="js/video-renderer.js"></script>
```

**Connect to generate button:**
```javascript
async function generateVideo(caption, music) {
    const composer = new VideoComposer();
    const videoBlob = await composer.compose({
        caption: caption,
        music: music,
        avatar: new KiarosXAvatar(canvas)
    });
    return videoBlob;
}
```

---

### 6. ADD REAL DATABASE (Supabase)
**File:** `client/index.html` and `server/server.js`

**Add to HTML:**
```html
<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
```

**Initialize:**
```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function saveVideo(videoData) {
    const { data, error } = await supabase
        .from('videos')
        .insert([videoData]);
    return { data, error };
}
```

---

### 7. COMPLETE BACKEND ENDPOINTS
**File:** `server/server.js`

**Add missing endpoints:**
```javascript
// Get videos
app.get('/api/videos', async (req, res) => {
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error });
    res.json(data);
});

// Generate video
app.post('/api/generate', async (req, res) => {
    const { caption, music } = req.body;
    // Actually generate video using VideoComposer
    const videoBlob = await generateVideo(caption, music);
    // Save to storage
    const { data, error } = await supabase.storage
        .from('videos')
        .upload(`${Date.now()}.mp4`, videoBlob);
    if (error) return res.status(500).json({ error });
    res.json({ video: data });
});

// Download video
app.get('/api/videos/:id/download', async (req, res) => {
    const { data, error } = await supabase.storage
        .from('videos')
        .download(req.params.id);
    if (error) return res.status(404).json({ error });
    res.send(data);
});
```

---

## Testing Checklist

- [ ] All buttons trigger real API calls
- [ ] No hardcoded sample data visible
- [ ] Videos actually generate (not fake toast)
- [ ] Downloads return real MP4 files
- [ ] Settings save and persist
- [ ] Calendar shows real data from API
- [ ] Errors handled gracefully
- [ ] Works without page refresh

## Files to Modify

1. `client/index.html` - Remove fake data, wire APIs
2. `server/server.js` - Complete endpoints
3. `client/js/video-renderer.js` - Export properly
4. `client/js/avatar-engine.js` - Export properly  
5. `client/js/audio-mixer.js` - Export properly
6. Create `client/settings.html` or add modal

## Deployment Blocker

**DO NOT DEPLOY** until all Critical Issues are fixed and Testing Checklist passes.
