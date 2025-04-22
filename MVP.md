# Learning Management System (LMS) - MVP Documentation

## Overview
A comprehensive Learning Management System focusing on test creation, management, and result processing with robust scoring mechanisms.

## Core Features

### 1. User Management
- **User Types**:
  - Admin (Teachers/Instructors)
  - Students
- **Authentication**:
  - JWT-based authentication
  - Role-based access control

### 2. Batch Management
- Create and manage student batches
- Assign tests to batches
- Track batch progress and performance
- View batch-specific test results

### 3. Test Management
#### Test Creation
- **Test Properties**:
  - Test name
  - Duration (in minutes)
  - Positive scoring
  - Optional negative scoring
  - Cut-off percentage (default 35%)
  - Maximum score (auto-calculated)
  - Total questions count

#### Question Types
- Text-based questions
- Image-based questions
- Multiple choice options
- Correct answer marking
- Optional reasoning/explanation

### 4. Test Taking System
#### Student Features
- View assigned tests
- Start test session
- Question navigation
- Answer submission
- Mark questions for:
  - Review
  - Later attempt
  - Final submission

#### Test Controls
- Timer management
- Auto-submission on time expiry
- Progress tracking
- Answer state management

### 5. Scoring System
#### Score Calculation
- Positive marks for correct answers
- Optional negative marking for incorrect answers
- No negative marking for unanswered questions
- Zero as minimum score

#### Result Processing
- Total score calculation
- Pass/Fail determination
- Percentage calculation
- Performance analytics

## Technical Architecture

### 1. Backend (Node.js + Express)
#### Models
- User
- Batch
- Test
- Question
- TestResult

#### Key Routes
- Authentication routes
- Batch management routes
- Test management routes
- Test result routes

### 2. Database (MongoDB)
#### Collections
- users
- batches
- tests
- questions
- testresults

### 3. Security Features
- JWT Authentication
- Role-based access
- Input validation
- Secure test submission
- Data encryption

## API Endpoints

### Authentication
- POST /api/auth/login
- POST /api/auth/register

### Batch Management
- POST /api/batches/create
- GET /api/batches/all
- GET /api/batches/:id
- PUT /api/batches/:id

### Test Management
- POST /api/tests/create
- GET /api/tests/all
- GET /api/tests/:id
- PUT /api/tests/:id
- DELETE /api/tests/:id

### Test Results
- POST /api/testresults/create
- PUT /api/testresults/update/:id
- PUT /api/testresults/submit/:id
- GET /api/testresults/test/:testId

## Data Models

### Test Model
```javascript
{
  test_name: String,
  batch_id: ObjectId,
  questions: [ObjectId],
  timing: Number,
  positive_scoring: Number,
  negative_scoring: Number,
  max_score: Number,
  total_questions: Number,
  cut_off: Number,
  hasHistory: Boolean
}
```

### Test Result Model
```javascript
{
  test_id: ObjectId,
  user_id: ObjectId,
  batch_id: ObjectId,
  answers: [{
    question_id: ObjectId,
    selected_option: ObjectId,
    is_correct: Boolean,
    state: Enum['answered', 'unanswered', 'review', 'marked']
  }],
  total_score: Number,
  max_score: Number,
  start_time: Date,
  submission_time: Date,
  test_result: Boolean
}
```

## Future Enhancements

### 1. Advanced Features
- Real-time test monitoring
- Advanced analytics dashboard
- Performance trends
- Question bank management
- Custom scoring algorithms

### 2. Technical Improvements
- Comprehensive test suite
- Advanced logging mechanisms
- Performance optimization
- Caching implementation
- Real-time updates

### 3. User Experience
- Rich text editor for questions
- Bulk question import
- Result export functionality
- Interactive analytics
- Mobile responsiveness

## Development Guidelines

### 1. Code Standards
- ES6+ JavaScript
- Async/Await patterns
- Error handling
- Input validation
- Response formatting

### 2. Security Practices
- JWT token management
- Input sanitization
- Role verification
- Data encryption
- Secure file handling

### 3. Performance
- Efficient database queries
- Proper indexing
- Batch operations
- Caching strategies
- Load testing

## Deployment Requirements

### 1. Environment
- Node.js runtime
- MongoDB database
- Environment variables
- SSL certificates
- Storage solution

### 2. Configuration
- Database connection
- JWT secret
- CORS settings
- Rate limiting
- File upload limits

### 3. Monitoring
- Error logging
- Performance metrics
- User activity
- System health
- Security alerts
