const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();
const port = 3000;
const path = require('path');
const cors = require('cors');
app.use(cors()); 
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const url = 'mongodb://localhost:27017';
const dbName = 'GrabDB'; // Database name (case-sensitive)
let db, ridesCollection, usersCollection;

// Initialize database connection
async function initializeDatabase() {
  try {
    const client = await MongoClient.connect(url);
    console.log('✅ Connected successfully to MongoDB');
    
    db = client.db(dbName);
    
    // Initialize collections (will create them if they don't exist)
    ridesCollection = db.collection('rides');
    usersCollection = db.collection('users');
    
    // Create indexes if needed
    await ridesCollection.createIndex({ location: 1 });
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    
    console.log(✅ Database '${dbName}' and collections initialized);
    
    return client;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
}

// Rides endpoints
app.get('/rides', async (req, res) => {
  try {
    const rides = await ridesCollection.find().toArray();
    res.json(rides);
  } catch (error) {
    console.error('Error fetching rides:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/rides', async (req, res) => {
  try {
    const rideData = {
      ...req.body,
      createdAt: new Date(),
      available: true
    };
    const result = await ridesCollection.insertOne(rideData);
    res.status(201).json({ _id: result.insertedId, ...rideData });
  } catch (error) {
    console.error('Error creating ride:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/rides/:id', async (req, res) => {
  try {
    const ride = await ridesCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    res.json(ride);
  } catch (error) {
    console.error('Error fetching ride:', error);
    res.status(400).json({ error: 'Invalid ride ID' });
  }
});

app.patch('/rides/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const result = await ridesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    
    res.json({ message: 'Ride updated successfully' });
  } catch (error) {
    console.error('Error updating ride:', error);
    res.status(400).json({ error: 'Invalid ride ID or data' });
  }
});

app.delete('/rides/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ridesCollection.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    
    res.json({ message: 'Ride deleted successfully' });
  } catch (error) {
    console.error('Error deleting ride:', error);
    res.status(400).json({ error: 'Invalid ride ID' });
  }
});

// Users endpoints
app.get('/users', async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/users', async (req, res) => {
  try {
    const userData = {
      ...req.body,
      createdAt: new Date(),
      active: true
    };
    const result = await usersCollection.insertOne(userData);
    res.status(201).json({ _id: result.insertedId, ...userData });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(400).json({ error: 'Invalid user ID' });
  }
});

app.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(400).json({ error: 'Invalid user ID or data' });
  }
});

app.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(400).json({ error: 'Invalid user ID' });
  }
});


// Documentation endpoint
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'api-docs.html'));
});

// Start the server
async function startServer() {
  const client = await initializeDatabase();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    await client.close();
    console.log('🛑 MongoDB connection closed');
    process.exit(0);
  });
  
  app.listen(port, () => {
    console.log(🚀 Server running at http://localhost:${port});
  });
}

startServer().catch(console.error);