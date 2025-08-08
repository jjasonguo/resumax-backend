# ResuMax Backend API Documentation

## Base URL
```
http://localhost:5001/api
```

## User Management

### Create User
**POST** `/users`
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "university": "MIT",
  "major": "Computer Science",
  "gpa": 3.8
}
```

### Get All Users
**GET** `/users`

### Get User by ID
**GET** `/users/:id`

### Get User by Email
**GET** `/users/email/:email`

### Update User
**PUT** `/users/:id`
```json
{
  "name": "John Doe Updated",
  "university": "Stanford",
  "major": "Computer Engineering",
  "gpa": 3.9
}
```

### Delete User
**DELETE** `/users/:id`

## Project Management

### Add Project to User
**POST** `/users/:id/projects`
```json
{
  "projectName": "E-commerce Web App",
  "skills": ["React", "Node.js", "PostgreSQL"],
  "sampleBullets": [
    "Built a full-stack e-commerce platform serving 1000+ users",
    "Implemented secure payment processing with Stripe API",
    "Optimized database queries reducing load time by 40%"
  ]
}
```

### Update Project
**PUT** `/users/:id/projects/:projectId`
```json
{
  "projectName": "Updated E-commerce Web App",
  "skills": ["React", "Node.js", "PostgreSQL", "Docker"],
  "sampleBullets": [
    "Built a full-stack e-commerce platform serving 2000+ users",
    "Implemented secure payment processing with Stripe API",
    "Optimized database queries reducing load time by 50%"
  ]
}
```

### Delete Project
**DELETE** `/users/:id/projects/:projectId`

## Work Experience Management

### Add Work Experience
**POST** `/users/:id/work-experiences`
```json
{
  "company": "Tech Corp",
  "position": "Software Engineer",
  "startDate": "2023-01-01",
  "endDate": "2024-01-01",
  "skills": ["JavaScript", "React", "AWS"],
  "sampleBullets": [
    "Developed responsive web applications used by 10,000+ customers",
    "Collaborated with cross-functional teams to deliver features",
    "Reduced application load time by 30% through optimization"
  ]
}
```

### Update Work Experience
**PUT** `/users/:id/work-experiences/:experienceId`
```json
{
  "company": "Updated Tech Corp",
  "position": "Senior Software Engineer",
  "startDate": "2023-01-01",
  "endDate": "2024-06-01",
  "skills": ["JavaScript", "React", "AWS", "TypeScript"],
  "sampleBullets": [
    "Developed responsive web applications used by 15,000+ customers",
    "Led cross-functional teams to deliver features",
    "Reduced application load time by 40% through optimization"
  ]
}
```

### Delete Work Experience
**DELETE** `/users/:id/work-experiences/:experienceId`

## Search and Analytics

### Search Users by Skills
**GET** `/users/search/skills?skills=React,Node.js,PostgreSQL`

### Get Users by Company
**GET** `/users/company/:company`

## Example Usage with cURL

### Create a new user
```bash
curl -X POST http://localhost:5001/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "university": "MIT",
    "major": "Computer Science",
    "gpa": 3.8
  }'
```

### Add a project to user
```bash
curl -X POST http://localhost:5001/api/users/USER_ID/projects \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "E-commerce Web App",
    "skills": ["React", "Node.js", "PostgreSQL"],
    "sampleBullets": [
      "Built a full-stack e-commerce platform serving 1000+ users",
      "Implemented secure payment processing with Stripe API"
    ]
  }'
```

### Search users by skills
```bash
curl "http://localhost:5001/api/users/search/skills?skills=React,Node.js"
```

## Response Format

### Success Response
```json
{
  "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
  "name": "John Doe",
  "email": "john@example.com",
  "university": "MIT",
  "major": "Computer Science",
  "gpa": 3.8,
  "projects": [...],
  "workExperiences": [...],
  "createdAt": "2023-09-06T21:00:00.000Z",
  "updatedAt": "2023-09-06T21:00:00.000Z"
}
```

### Error Response
```json
{
  "message": "Error message here"
}
```

## Database Schema

### User Document
```javascript
{
  _id: ObjectId,
  name: String (required),
  email: String (required, unique),
  university: String,
  major: String,
  gpa: Number (0.0-4.0),
  projects: [ProjectSchema],
  workExperiences: [WorkExperienceSchema],
  createdAt: Date,
  updatedAt: Date
}
```

### Project Schema
```javascript
{
  _id: ObjectId,
  projectName: String (required),
  skills: [String],
  sampleBullets: [String],
  createdAt: Date,
  updatedAt: Date
}
```

### Work Experience Schema
```javascript
{
  _id: ObjectId,
  company: String (required),
  position: String,
  startDate: Date,
  endDate: Date,
  skills: [String],
  sampleBullets: [String],
  createdAt: Date,
  updatedAt: Date
}
```

## Indexes
- `email: 1` - For fast email lookups
- `"projects.skills": 1` - For skill-based project searches
- `"workExperiences.skills": 1` - For skill-based work experience searches
- `"workExperiences.company": 1` - For company-based searches 