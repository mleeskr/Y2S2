
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const app = express();
const port = 3000;
const path = require('path');
const cors = require('cors');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const url = 'mongodb://localhost:27017';
const dbName = 'rideHailingDB';


let db, usersCollection,driversCollection;


// Initialize database connection
async function initializeDatabase() {
  try {
    const client = await MongoClient.connect(url);
    console.log('✅ Connected successfully to MongoDB');
    
    db = client.db(dbName);
    completedRidesCollection = db.collection('completedRides');
    usersCollection = db.collection('users');
    ridesCollection = db.collection('rides');
    driversCollection = db.collection('drivers');
    
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    console.log(`✅ Database '${dbName}' and collections initialized`);
    
    return client;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1); 
  }
}
// Start the server
async function startServer() {
  const client = await initializeDatabase();
  
  process.on('SIGINT', async () => {
    await client.close();
    console.log('🛑 MongoDB connection closed');
    process.exit(0);
  });
  
  app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
  });
}

startServer().catch(console.error);
//Registration Endpoint
app.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    
    // Validate role
    if (!['user', 'driver'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "user" or "driver"' });
    }
    
    // Check if email exists in either collection
    const existingUser = await usersCollection.findOne({ email });
    const existingDriver = await driversCollection.findOne({ email });
    if (existingUser || existingDriver) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    let result, responseData;

    if (role === 'driver') {
      // Create driver data
      // In the /register endpoint, modify the driverData object:
const driverData = {
  email,
  password: hashedPassword,
  name,
  role,
  vehicleInfo: req.body.vehicleInfo || {},
  licenseNumber: req.body.licenseNumber || '',
  isAvailable: true, // New drivers start as available
  averageRating: 0,  // Initialize rating
  totalEarnings: 0,  // Initialize earnings
  totalRides: 0,     // Initialize ride count
  createdAt: new Date()
};
      
      // Insert into drivers collection
      result = await driversCollection.insertOne(driverData);
     
    } else {
      // Create user data
      const userData = {
        email,
        password: hashedPassword,
        name,
        role,
        isApproved: true, // Users are auto-approved
        createdAt: new Date()
      };
      
      // Insert into users collection
      result = await usersCollection.insertOne(userData);
      
    }

    res.status(201).json(responseData);
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


//Login Endpoint
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check regular users/drivers
    const user = await usersCollection.findOne({ email })||await driversCollection.findOne({ email });
    
    if (!user || !driver) {
      return res.status(404).json({ error: 'User or Driver not found not found' });
    }
    
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
   
    res.json(
      "login success"
    );
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




