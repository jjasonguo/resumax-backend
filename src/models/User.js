import mongoose from "mongoose";

// Project sub-schema
const projectSubSchema = new mongoose.Schema({
  projectName: {
    type: String,
    required: true,
    trim: true
  },
  skills: [{
    type: String,
    trim: true
  }],
  sampleBullets: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Work experience sub-schema
const workExperienceSubSchema = new mongoose.Schema({
  company: {
    type: String,
    required: true,
    trim: true
  },
  position: {
    type: String,
    trim: true
  },
  startDate: Date,
  endDate: Date,
  skills: [{
    type: String,
    trim: true
  }],
  sampleBullets: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Main user schema
const userSchema = new mongoose.Schema({
  clerkUserId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  university: {
    type: String,
    trim: true
  },
  major: {
    type: String,
    trim: true
  },
  gpa: {
    type: Number,
    min: 0.0,
    max: 4.0
  },
  phone: {
    type: String,
    trim: true
  },
  linkedinUrl: {
    type: String,
    trim: true
  },
  githubUrl: {
    type: String,
    trim: true
  },
  websiteUrl: {
    type: String,
    trim: true
  },
  resumePdf: {
    filename: String,
    originalName: String,
    uploadDate: Date
  },
  parsedResumeData: {
    rawText: String,
    extractedSkills: [String],
    extractedEducation: [String],
    extractedExperience: [String]
  },
  projects: [projectSubSchema],
  workExperiences: [workExperienceSubSchema]
}, {
  timestamps: true
});

// Create indexes for better performance
userSchema.index({ "projects.skills": 1 });
userSchema.index({ "workExperiences.skills": 1 });
userSchema.index({ "workExperiences.company": 1 });

const User = mongoose.model("User", userSchema);

export default User;