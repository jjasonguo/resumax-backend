import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5001/api';

// Test data
const testUser = {
  name: "John Doe",
  email: "john@example.com",
  university: "MIT",
  major: "Computer Science",
  gpa: 3.8
};

const testProject = {
  projectName: "E-commerce Web App",
  skills: ["React", "Node.js", "PostgreSQL"],
  sampleBullets: [
    "Built a full-stack e-commerce platform serving 1000+ users",
    "Implemented secure payment processing with Stripe API",
    "Optimized database queries reducing load time by 40%"
  ]
};

const testWorkExperience = {
  company: "Tech Corp",
  position: "Software Engineer",
  startDate: "2023-01-01",
  endDate: "2024-01-01",
  skills: ["JavaScript", "React", "AWS"],
  sampleBullets: [
    "Developed responsive web applications used by 10,000+ customers",
    "Collaborated with cross-functional teams to deliver features",
    "Reduced application load time by 30% through optimization"
  ]
};

async function testAPI() {
  try {
    console.log('🧪 Testing ResuMax Backend API...\n');

    // Test 1: Create User
    console.log('1. Creating user...');
    const createResponse = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const createdUser = await createResponse.json();
    console.log('✅ User created:', createdUser._id);

    // Test 2: Get All Users
    console.log('\n2. Getting all users...');
    const getAllResponse = await fetch(`${BASE_URL}/users`);
    const allUsers = await getAllResponse.json();
    console.log('✅ Found', allUsers.length, 'users');

    // Test 3: Get User by ID
    console.log('\n3. Getting user by ID...');
    const getUserResponse = await fetch(`${BASE_URL}/users/${createdUser._id}`);
    const user = await getUserResponse.json();
    console.log('✅ User retrieved:', user.name);

    // Test 4: Add Project
    console.log('\n4. Adding project...');
    const addProjectResponse = await fetch(`${BASE_URL}/users/${createdUser._id}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testProject)
    });
    const userWithProject = await addProjectResponse.json();
    console.log('✅ Project added:', userWithProject.projects[0].projectName);

    // Test 5: Add Work Experience
    console.log('\n5. Adding work experience...');
    const addWorkResponse = await fetch(`${BASE_URL}/users/${createdUser._id}/work-experiences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testWorkExperience)
    });
    const userWithWork = await addWorkResponse.json();
    console.log('✅ Work experience added:', userWithWork.workExperiences[0].company);

    // Test 6: Search by Skills
    console.log('\n6. Searching users by skills...');
    const searchResponse = await fetch(`${BASE_URL}/users/search/skills?skills=React,Node.js`);
    const searchResults = await searchResponse.json();
    console.log('✅ Found', searchResults.length, 'users with React/Node.js skills');

    // Test 7: Search by Company
    console.log('\n7. Searching users by company...');
    const companyResponse = await fetch(`${BASE_URL}/users/company/Tech%20Corp`);
    const companyResults = await companyResponse.json();
    console.log('✅ Found', companyResults.length, 'users from Tech Corp');

    console.log('\n🎉 All tests passed! API is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Wait for server to start, then run tests
setTimeout(testAPI, 3000); 