/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
        console.error('Error:', err);
    }

    // Handle specific error types
    if (err.name === 'ValidationError') {
        err.statusCode = 400;
        err.message = Object.values(err.errors)
            .map(e => e.message)
            .join(', ');
    } else if (err.code === 11000) {
        err.statusCode = 400;
        err.message = `Duplicate field value: ${Object.keys(err.keyValue)}`;
    } else if (err.name === 'CastError') {
        err.statusCode = 400;
        err.message = `Invalid ${err.path}: ${err.value}`;
    }

    res.status(err.statusCode).json({
        success: false,
        data: {
            status: err.status,
            message: err.message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
};

/**
 * Async error handler wrapper
 */
const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    AppError,
    errorHandler,
    catchAsync
};
