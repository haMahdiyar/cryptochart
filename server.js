// server.js
require('dotenv').config();

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('FATAL ERROR: MONGODB_URI environment variable is not set');
    process.exit(1);
}

console.log('Attempting to connect to MongoDB...');

// Improved MongoDB connection handling
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(MONGODB_URI, {
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 60000,
            connectTimeoutMS: 30000,
            retryWrites: true,
            w: 'majority'
        });
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return true;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        return false;
    }
};

// Handle MongoDB connection errors
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected. Attempting to reconnect...');
    setTimeout(connectDB, 5000);
});

mongoose.connection.on('connected', () => {
    console.log('MongoDB connected successfully');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message
    });
});

// Chart Schema
const chartSchema = new mongoose.Schema({
    title: { type: String, required: true },
    state: { type: mongoose.Schema.Types.Mixed, required: true },
    savedAt: { type: Date, default: Date.now }
});

const Chart = mongoose.model('Chart', chartSchema);

// Add Mark Schema
const markSchema = new mongoose.Schema({
    symbol: { type: String, required: true },
    timestamp: { type: Number, required: true },
    date: { type: String, required: true },
    price: Number, // Add price field
    createdAt: { type: Date, default: Date.now }
});

// Add compound index for faster queries and unique marks
markSchema.index({ symbol: 1, timestamp: 1 }, { unique: true });

const Mark = mongoose.model('Mark', markSchema);

// Add saveMarkWithRetry helper function
const saveMarkWithRetry = async (markData, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const existingMark = await Mark.findOne({ 
                symbol: markData.symbol, 
                timestamp: markData.timestamp 
            });
            
            if (existingMark) {
                return { success: true, message: 'Mark already exists' };
            }

            const mark = new Mark(markData);
            await mark.save();
            return { success: true, message: 'Mark created successfully' };
        } catch (error) {
            console.log(`Retry attempt ${i + 1} failed:`, error.message);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
};

// Helper function to check DB connection
const ensureDbConnected = (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        console.error('Database not connected. Current state:', mongoose.connection.readyState);
        return res.status(500).json({
            success: false,
            error: 'Database connection is not ready. Please try again in a few moments.'
        });
    }
    next();
};

// Apply DB connection check middleware to all API routes
app.use('/api', ensureDbConnected);

// ذخیره نسخه جدید
// app.post('/api/save-chart', async (req, res) => {
//     try {
//         const { title, chartState } = req.body;
        
//         if (!title) {
//             return res.status(400).json({ 
//                 success: false, 
//                 error: 'Title is required' 
//             });
//         }

//         const chart = new Chart({
//             title,
//             state: chartState,
//             savedAt: new Date()
//         });
        
//         await chart.save();
//         res.json({ 
//             success: true, 
//             message: 'Version saved successfully', 
//             versionId: chart._id 
//         });
//     } catch (error) {
//         console.error('Error saving chart:', error);
//         res.status(500).json({ 
//             success: false, 
//             error: error.message || 'Failed to save chart'
//         });
//     }
// });

// دریافت لیست نمودارها
app.get('/api/charts', async (req, res) => {
    try {
        const charts = await Chart.find({})
            .select('title savedAt')
            .sort('-savedAt')
            .lean()
            .exec();
        
        const formattedCharts = charts.reduce((acc, chart) => {
            acc[chart._id] = {
                title: chart.title,
                savedAt: chart.savedAt
            };
            return acc;
        }, {});
        
        res.json({ 
            success: true, 
            charts: formattedCharts 
        });
    } catch (error) {
        console.error('Error fetching charts:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to fetch charts'
        });
    }
});

// دریافت یک نمودار
app.get('/api/charts/:id', async (req, res) => {
    try {
        const chart = await Chart.findById(req.params.id).lean().exec();
        if (!chart) {
            return res.status(404).json({ 
                success: false, 
                error: 'Chart not found' 
            });
        }
        res.json({ 
            success: true, 
            chart: chart.state 
        });
    } catch (error) {
        console.error('Error fetching chart:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to fetch chart'
        });
    }
});

// // Update the mark-date endpoint old of app.post
// app.post('/api/mark-date', async (req, res) => {
//     try {
//         const { symbol, timestamp, date } = req.body;
        
//         if (!symbol || !timestamp || !date) {
//             return res.status(400).json({ 
//                 success: false, 
//                 error: 'Missing required fields' 
//             });
//         }

//         // Validate timestamp
//         if (isNaN(timestamp)) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Invalid timestamp'
//             });
//         }

//         const mark = new Mark({
//             symbol,
//             timestamp,
//             date,
//             price: 0, // We're not using price anymore
//             createdAt: new Date()
//         });
        
//         await mark.save();
//         res.json({ 
//             success: true,
//             message: 'Mark created successfully'
//         });
//     } catch (error) {
//         console.error('Error saving mark:', error);
//         res.status(500).json({ 
//             success: false, 
//             error: error.message || 'Failed to save mark'
//         });
//     }
// });

app.post('/api/mark-date', async (req, res) => {
    try {
        const { symbol, timestamp, date } = req.body;
        
        if (!symbol || !timestamp || !date) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        const result = await saveMarkWithRetry({
            symbol,
            timestamp,
            date,
            createdAt: new Date()
        });
        
        res.json(result);
    } catch (error) {
        console.error('Error saving mark:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to save mark'
        });
    }
});

// GET /api/marks/:symbol
app.get('/api/marks/:symbol', async (req, res) => {
    try {
        const marks = await Mark.find({ symbol: req.params.symbol })
            .sort('timestamp')
            .lean()
            .exec();
            
        res.json({ 
            success: true, 
            marks: marks 
        });
    } catch (error) {
        console.error('Error fetching marks:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to fetch marks'
        });
    }
});

app.delete('/api/marks/delete/:symbol/:timestamp', async (req, res) => {
    try {
        const { symbol, timestamp } = req.params;
        const parsedTimestamp = parseInt(timestamp);
        
        if (isNaN(parsedTimestamp)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid timestamp'
            });
        }

        const result = await Mark.deleteOne({ 
            symbol, 
            timestamp: parsedTimestamp 
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Mark not found'
            });
        }
        
        res.json({ 
            success: true,
            message: 'Mark deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting mark:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to delete mark'
        });
    }
});

app.delete('/api/marks/clear-all', async (req, res) => {
    try {
        const { symbol } = req.body;
        
        // Deletes ALL marks for a given symbol
        const result = await Mark.deleteMany({ symbol });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'No marks found to delete'
            });
        }
        
        res.json({ 
            success: true,
            deletedCount: result.deletedCount,
            message: 'All marks deleted successfully'
        });
    } catch (error) {
        console.error('Error clearing marks:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to clear marks'
        });
    }
});

// Initialize server
const startServer = async () => {
    // First connect to MongoDB
    const isConnected = await connectDB();
    
    if (!isConnected) {
        console.error('Failed to establish initial MongoDB connection');
        process.exit(1);
    }

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
};

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});