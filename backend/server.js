require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json());

// Database connection
const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("MongoDB connection failed:", err));

// Book schema
const bookSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    title: String,
    url: String,
    cloudinaryId: String, 
    uploadDate: { type: Date, default: Date.now }
});
const Book = mongoose.model('Book', bookSchema);

// Schedule schema
const scheduleSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    title: { type: String, required: true },
    time: { type: String, required: true },
    tag: { type: String, default: "1-week" },
    dateString: { type: String, required: true }, 
    deadlineString: { type: String, required: true }, 
    completed: { type: Boolean, default: false }
});
const Schedule = mongoose.model('Schedule', scheduleSchema);

// Note schema
const noteSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Note = mongoose.model('Note', noteSchema);

// Cloudinary config
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_NAME, 
    api_key: process.env.CLOUDINARY_KEY, 
    api_secret: process.env.CLOUDINARY_SECRET 
});

const upload = multer({ dest: 'uploads/' });

// Upload book 
app.post('/api/upload', upload.single('file'), async (req, res) => {
    const filePath = req.file ? req.file.path : null;
    try {
        if (!req.file) return res.status(400).json({ error: "No file was selected" });
        if (!req.body.userId) return res.status(400).json({ error: "User ID is required" });

        const result = await cloudinary.uploader.upload(filePath, { 
            resource_type: "auto",
            folder: "study_room_materials"
        });

        const newBook = new Book({
            userId: req.body.userId,
            title: req.file.originalname,
            url: result.secure_url,
            cloudinaryId: result.public_id 
        });

        await newBook.save();
        return res.status(201).json(newBook);
    } catch (err) {
        return res.status(500).json({ error: "Failed to upload file", details: err.message });
    } finally {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
});

// Get books by user
app.get('/api/books/:userId', async (req, res) => {
    try {
        const books = await Book.find({ userId: req.params.userId }).sort({ uploadDate: -1 });
        return res.status(200).json(books); 
    } catch (error) {
        return res.status(500).json({ error: "Failed to retrieve materials" });
    }
});

// Delete book
app.delete('/api/books/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Material not found" });

        if (book.cloudinaryId) {
            await cloudinary.uploader.destroy(book.cloudinaryId).catch(err => 
                console.error("Gagal hapus file di Cloudinary:", err.message)
            );
        }

        await Book.findByIdAndDelete(req.params.id);
        return res.status(200).json({ message: "Material deleted successfully from cloud storage and DB" });
    } catch (error) { 
        return res.status(500).json({ error: error.message }); 
    }
});

// Get schedules by user
app.get('/api/schedules/:userId', async (req, res) => {
    try {
        const schedules = await Schedule.find({ userId: req.params.userId });
        return res.status(200).json(schedules);
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch schedules" });
    }
});

// Create schedule
app.post('/api/schedules', async (req, res) => {
    try {
        const { userId, title, time, dateString, deadlineString } = req.body;
        if (!userId || !title || !time || !dateString || !deadlineString) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const newSchedule = new Schedule(req.body);
        await newSchedule.save();
        return res.status(201).json(newSchedule);
    } catch (err) {
        return res.status(500).json({ error: "Failed to create schedule" });
    }
});

// Update schedule
app.put('/api/schedules/:id', async (req, res) => {
    try {
        const updated = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ error: "Schedule not found" });
        return res.status(200).json(updated);
    } catch (err) {
        return res.status(500).json({ error: "Failed to update schedule" });
    }
});

// Delete schedule
app.delete('/api/schedules/:id', async (req, res) => {
    try {
        const deleted = await Schedule.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: "Schedule not found" });
        return res.status(200).json({ message: "Schedule deleted successfully" });
    } catch (err) {
        return res.status(500).json({ error: "Failed to delete schedule" });
    }
});

// Create note
app.post('/api/notes', async (req, res) => {
    try {
        const { userId, title, content } = req.body;
        if (!userId || !title || !content) return res.status(400).json({ error: "Missing fields" });
        const newNote = new Note({ userId, title, content });
        await newNote.save();
        return res.status(201).json(newNote);
    } catch (err) {
        return res.status(500).json({ error: "Failed to save note" });
    }
});

// Get notes by user
app.get('/api/notes/:userId', async (req, res) => {
    try {
        const notes = await Note.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        return res.status(200).json(notes);
    } catch (err) {
        return res.status(500).json({ error: "Failed to load notes" });
    }
});

// Update note
app.put('/api/notes/:id', async (req, res) => {
    try {
        const updatedNote = await Note.findByIdAndUpdate(req.params.id, { title: req.body.title, content: req.body.content }, { new: true });
        if (!updatedNote) return res.status(404).json({ error: "Note not found" });
        return res.status(200).json(updatedNote);
    } catch (err) {
        return res.status(500).json({ error: "Failed to update note" });
    }
});

// Delete note
app.delete('/api/notes/:id', async (req, res) => {
    try {
        const deletedNote = await Note.findByIdAndDelete(req.params.id);
        if (!deletedNote) return res.status(404).json({ error: "Note not found" });
        return res.status(200).json({ message: "Note deleted successfully" });
    } catch (err) {
        return res.status(500).json({ error: "Failed to delete note" });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));