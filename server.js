const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./utils/errorHandler');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS settings
const corsOptions = {
    origin: function (origin, callback) {
        const allowedList = ['http://localhost:5173', 'http://localhost', 'http://localhost:5174', 'http://localhost:5500', 'https://lms-blr.netlify.app'];
        if (!origin || allowedList.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes'
    }
});
app.use(limiter);

// Server Health Route
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is healthy',
        uptime: process.uptime(),
        timestamp: new Date(),
    });
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/batches', require('./routes/batches'));
app.use('/tests', require('./routes/tests'));
app.use('/questions', require('./routes/questions'));
app.use('/tags', require('./routes/tags'));
app.use('/testresults', require('./routes/testresults'));

// Error handling
app.use(errorHandler);

// Handle unhandled routes
app.all('*', (req, res, next) => {
    res.status(404).json({
        success: false,
        data: {
            message: `Can't find ${req.originalUrl} on this server`
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});
