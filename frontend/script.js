import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBiliBfdE0sDHI3weYESCMXV-vZppHR-Fc",
    authDomain: "workspace-76489.firebaseapp.com",
    projectId: "workspace-76489",
    storageBucket: "workspace-76489.firebasestorage.app",
    messagingSenderId: "958477046057",
    appId: "1:958477046057:web:f50af0fcbfaca6a087e738"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const provider = new GoogleAuthProvider();

// --- TIMER LOGIC ---
let timerInterval, timeLeft = 25 * 60, isRunning = false;

function updateDisplay() {
    const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
    document.getElementById('time-display').textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

document.getElementById('set-custom-btn').onclick = () => {
    const mins = parseInt(document.getElementById('custom-minutes').value);
    if (mins > 0) { clearInterval(timerInterval); isRunning = false; timeLeft = mins * 60; updateDisplay(); }
};

document.getElementById('start-btn').onclick = () => {
    if (isRunning) return; isRunning = true;
    timerInterval = setInterval(() => {
        if (timeLeft > 0) { timeLeft--; updateDisplay(); }
        else { clearInterval(timerInterval); isRunning = false; document.getElementById('alarm-sound').play(); alert("Sesi Selesai!"); }
    }, 1000);
};

document.getElementById('pause-btn').onclick = () => { clearInterval(timerInterval); isRunning = false; };
document.getElementById('reset-btn').onclick = () => {
    clearInterval(timerInterval); isRunning = false; timeLeft = 25 * 60; updateDisplay();
    const alarm = document.getElementById('alarm-sound'); alarm.pause(); alarm.currentTime = 0;
};

// --- AUTH & USER STATE ---
onAuthStateChanged(auth, (user) => {
    const loginBtn = document.getElementById('login-btn');
    const userProfile = document.getElementById('user-profile');
    if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (userProfile) userProfile.style.display = 'block';
        document.getElementById('user-name').textContent = user?.displayName || "User";
        loadUserMaterials(user.uid);
    } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (userProfile) userProfile.style.display = 'none';
        document.getElementById('bookshelf').innerHTML = "";
    }
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);

// --- MATERIALS LOGIC ---
async function loadUserMaterials(uid) {
    try {
        const res = await fetch(`http://localhost:3000/api/books/${uid}`);
        const books = await res.json();
        const shelf = document.getElementById('bookshelf');
        shelf.innerHTML = "";
        
        books.forEach(data => {
            const wrap = document.createElement('div');
            wrap.className = 'book-wrapper';
            const book = document.createElement('div');
            book.className = 'book-item';
            book.style.backgroundColor = `hsl(${Math.random() * 360}, 60%, 35%)`;
            book.innerHTML = data.title.substring(0,10) + "...";
            
            book.onclick = () => {
                document.getElementById('viewer-placeholder').style.display = "none";
                const v = document.getElementById('modal-viewer');
                v.style.display = "block"; v.src = data.url;
            };

            const del = document.createElement('button');
            del.className = 'delete-book-btn'; del.innerHTML = "×";
            del.onclick = (e) => { e.stopPropagation(); if(confirm("Hapus materi?")) deleteBook(data._id, uid); };

            wrap.append(book, del); shelf.append(wrap);
        });
    } catch (e) { console.error("Gagal memuat:", e); }
}

async function deleteBook(id, uid) {
    const res = await fetch(`http://localhost:3000/api/books/${id}`, { method: 'DELETE' });
    if (res.ok) loadUserMaterials(uid);
}

// --- UPLOAD MATERI ---
document.getElementById('file-upload').onchange = async (e) => {
    const user = auth.currentUser; if (!user) return alert("Login dulu!");
    const file = e.target.files[0]; if (!file) return;

    const label = document.querySelector('.btn-upload-header');
    const original = label.innerHTML;
    label.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading...`;

    const fd = new FormData(); fd.append('file', file); fd.append('userId', user.uid);

    try {
        const res = await fetch('http://localhost:3000/api/upload', { method: 'POST', body: fd });
        if (res.ok) loadUserMaterials(user.uid);
        else alert("Gagal mengunggah.");
    } catch (err) { alert("Server tidak merespons."); }
    finally { label.innerHTML = original; e.target.value = ""; }
};

// --- SPOTIFY PLAYER ---
document.getElementById('update-playlist-btn').onclick = () => {
    let url = document.getElementById('playlist-url').value.trim();
    if (url) {
        if (!url.startsWith('http')) url = 'https://' + url;
        if (url.includes('spotify.com') && !url.includes('/embed/')) {
            url = url.replace('spotify.com/', 'spotify.com/embed/');
        }
        document.getElementById('spotify-iframe').src = url;
        localStorage.setItem('savedPlaylist', url);
    }
};

window.onload = () => {
    const saved = localStorage.getItem('savedPlaylist');
    if (saved) document.getElementById('spotify-iframe').src = saved;
    updateDisplay();
};