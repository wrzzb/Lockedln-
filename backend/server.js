const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs'); // Tambahkan ini untuk menghapus file sampah di lokal
const app = express();

app.use(cors());
app.use(express.json());

// 1. Koneksi MongoDB
mongoose.connect('mongodb+srv://Admin:12345@workspace.1hn74vf.mongodb.net/?appName=Workspace')
    .then(() => console.log("Terhubung ke MongoDB"))
    .catch(err => console.error("Gagal koneksi MongoDB:", err));

// 2. Schema Data
const bookSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    title: String,
    url: String,
    uploadDate: { type: Date, default: Date.now }
});

const Book = mongoose.model('Book', bookSchema);

// Schema Data untuk Notes
const noteSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Note = mongoose.model('Note', noteSchema);

// 3. Konfigurasi Cloudinary
cloudinary.config({ 
    cloud_name: 'dcky4itki', 
    api_key: '287732471984783', 
    api_secret: 'Mq-zO5x2z4cg3w4iyuDL9SHJ8m4' 
});

// 4. Konfigurasi Multer (Penyimpanan sementara sebelum ke Cloudinary)
const upload = multer({ dest: 'uploads/' });

// --- ENDPOINT UPLOAD ---
app.post('/api/upload', upload.single('file'), async (req, res) => {
    // Pastikan path file ada sebelum diproses
    const filePath = req.file ? req.file.path : null;

    try {
        if (!req.file) {
            return res.status(400).json({ error: "Tidak ada file yang dipilih" });
        }

        if (!req.body.userId) {
            // Jika userId kosong, hapus file sampah yang masuk lalu beri error
            if (filePath) fs.unlinkSync(filePath);
            return res.status(400).json({ error: "User ID wajib diisi" });
        }

        // 1. Upload ke Cloudinary
        const result = await cloudinary.uploader.upload(filePath, { 
            resource_type: "auto",
            folder: "study_room_materials"
        });
        
        // 2. Simpan info ke MongoDB
        const newBook = new Book({
            userId: req.body.userId,
            title: req.file.originalname,
            url: result.secure_url 
        });

        await newBook.save();

        // 3. Hapus file sementara di lokal
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // 4. KIRIM RESPON SUKSES (Sangat penting agar frontend tidak alert 'Server tidak merespons')
        return res.status(200).json(newBook);

    } catch (err) {
        console.error("Upload Error:", err);
        
        // Bersihkan file lokal jika terjadi error saat upload ke Cloudinary/DB
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Kirim respon error yang jelas
        return res.status(500).json({ 
            error: "Gagal memproses unggahan", 
            details: err.message 
        });
    }
});

// --- ENDPOINT AMBIL DATA ---
app.get('/api/books/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId || userId === "undefined") {
            return res.status(400).json({ error: "User ID tidak valid" });
        }

        const books = await Book.find({ userId: userId }).sort({ uploadDate: -1 });
        
        // Kirim array kosong jika tidak ada buku, bukan error
        return res.status(200).json(books); 

    } catch (error) {
        console.error("Fetch Books Error:", error);
        return res.status(500).json({ error: "Gagal mengambil data materi" });
    }
});

// --- ENDPOINT HAPUS MATERI ---
app.delete('/api/books/:id', async (req, res) => {
    try {
        const result = await Book.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({ error: "Item tidak ditemukan" });
        }
        res.json({ message: "Materi berhasil dihapus" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ENDPOINT UNTUK NOTES ---

// 1. POST: Menyimpan catatan baru ke MongoDB
app.post('/api/notes', async (req, res) => {
    try {
        const { title, content } = req.body;
        const newNote = new Note({ title, content });
        await newNote.save();
        return res.status(201).json(newNote);
    } catch (error) {
        return res.status(500).json({ error: "Gagal menyimpan catatan" });
    }
});

// 2. GET: Mengambil semua catatan dari MongoDB
app.get('/api/notes', async (req, res) => {
    try {
        const notes = await Note.find().sort({ createdAt: -1 }); // Urutkan dari yang terbaru
        return res.json(notes);
    } catch (error) {
        return res.status(500).json({ error: "Gagal mengambil data catatan" });
    }
});

// Jalankan Server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));