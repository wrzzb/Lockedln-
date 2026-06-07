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

// ==================== LOGIKA INTEGRASI NOTES ====================
const NOTE_API_URL = 'http://localhost:3000/api/notes';

const menuNotesBtn = document.getElementById('menu-notes');
const menuStudyBtn = document.getElementById('menu-study');
const studyCenterMain = document.querySelector('.study-center'); // Menargetkan tag <main class="study-center">
const notesPageArea = document.getElementById('notes-page');

const btnSaveNote = document.getElementById('btn-save-note');
const noteTitleInput = document.getElementById('note-title');
const noteContentInput = document.getElementById('note-content');
const notesListContainer = document.getElementById('notes-list-container');

// 1. Logika Pindah Halaman: Klik Menu Notes
if (menuNotesBtn) {
    menuNotesBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Atur status active pada sidebar
        if (menuStudyBtn) menuStudyBtn.classList.remove('active');
        menuNotesBtn.classList.add('active');

        // Sembunyikan panel study-center utama, tampilkan notes-page
        if (studyCenterMain) studyCenterMain.style.display = 'none';
        if (notesPageArea) {
            notesPageArea.style.display = 'block';
            notesPageArea.style.flex = '1'; // Agar layout fleksibel memenuhi layar tengah
        }
        
        // Ambil data catatan lama dari database MongoDB
        loadNotes();
    });
}

// 2. Logika Pindah Halaman Kembali: Klik Menu Study Room
if (menuStudyBtn) {
    menuStudyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        if (menuNotesBtn) menuNotesBtn.classList.remove('active');
        menuStudyBtn.classList.add('active');

        // Tampilkan kembali study room, sembunyikan notes
        if (studyCenterMain) studyCenterMain.style.display = 'flex';
        if (notesPageArea) notesPageArea.style.display = 'none';
    });
}

// 3. Fungsi Kirim Data Catatan Baru ke Backend (MongoDB)
if (btnSaveNote) {
    btnSaveNote.addEventListener('click', async () => {
        const title = noteTitleInput.value.trim();
        const content = noteContentInput.value.trim();

        if (!title || !content) {
            alert('Judul dan isi catatan tidak boleh kosong!');
            return;
        }

        try {
            const response = await fetch(NOTE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });

            if (response.ok) {
                const newNote = await response.json();
                // Render catatan baru ke layar di posisi paling atas
                renderNoteCard(newNote.title, newNote.content);
                
                // Reset form input
                noteTitleInput.value = '';
                noteContentInput.value = '';
            } else {
                alert('Gagal menyimpan catatan ke server.');
            }
        } catch (error) {
            console.error('Error saat menyimpan note:', error);
        }
    });
}

// 4. Fungsi Ambil (Fetch) Semua Catatan dari Backend
async function loadNotes() {
    try {
        const response = await fetch(NOTE_API_URL);
        if (!response.ok) throw new Error('Gagal mengambil data');
        
        const notes = await response.json();
        notesListContainer.innerHTML = ''; // Bersihkan container lama
        
        notes.forEach(note => {
            renderNoteCard(note.title, note.content);
        });
    } catch (error) {
        console.error('Error saat memuat notes:', error);
    }
}

// 5. Fungsi Pembantu Pembuat Elemen Card Catatan (Memakai Class CSS note-card-item milikmu)
function renderNoteCard(title, content) {
    const card = document.createElement('div');
    card.className = 'note-card-item'; // Mengandalkan style penuh dari style.css
    card.style.marginBottom = '12px';
    card.innerHTML = `
        <h4>${title}</h4>
        <p>${content}</p>
    `;
    notesListContainer.prepend(card);
}
// ================================================================