const express = require('express');
const mongoose = require('mongoose');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();
const port = 3000;
const path = require('path');


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
                                                                      
const url = 'mongodb://localhost:27017';
const dbName = 'rideHailingDB';
const JWT_SECRET = 'your_jwt_secret_key'; // Change this in production

// Hardcoded admin credentials
const HARDCODED_ADMIN = {
  email: 'admin@gmail.com',
  password: 'admin123', // In production, store hashed password
  name: 'System Admin',
  role: 'admin'
};

let db, usersCollection, ridesCollection, driversCollection;
let completedRidesCollection;


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
// generate JWT token
function generateToken(user) {
  return jwt.sign(
    { 
      id: user._id || 'admin', // Admin has no _id
      email: user.email,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

//verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

//Registration Endpoint
app.post('/register', async (req, res) => {
  try {
    const { email, password, name, role,licenseNumber,       
      vehicleModel,      
      vehicleColor,       
      vehiclePlate     } = req.body;
    
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
    
    let result, token, responseData;

    if (role === 'driver') {

      // Create driver data
      // In the /register endpoint, modify the driverData object:
const driverData = {
  email,
  password: hashedPassword,
  name,
  role,
  licenseNumber,
  vehicleModel,
  vehicleColor,
  vehiclePlate,
  isApproved: false,
  isAvailable: true, // New drivers start as available
  averageRating: 0,  // Initialize rating
  totalEarnings: 0,  // Initialize earnings
  totalRides: 0,     // Initialize ride count
  createdAt: new Date()
};
      
      // Insert into drivers collection
      result = await driversCollection.insertOne(driverData);
      token = generateToken({
        _id: result.insertedId,
        email,
        name,
        role
      });
      
      responseData = {
        _id: result.insertedId,
        email,
        name,
        role,
        isApproved: false,
        token
      };
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
      token = generateToken({
        _id: result.insertedId,
        email,
        name,
        role
      });
      
      responseData = {
        _id: result.insertedId,
        email,
        name,
        role,
        isApproved: true,
        token
      };
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
    
    // First check if it's the hardcoded admin
    if (email === HARDCODED_ADMIN.email) {
      if (password === HARDCODED_ADMIN.password) {
        const token = generateToken(HARDCODED_ADMIN);
        return res.json({
          email: HARDCODED_ADMIN.email,
          name: HARDCODED_ADMIN.name,
          role: HARDCODED_ADMIN.role,
          token
        });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check regular users/drivers
    const user = await usersCollection.findOne({ email })||await driversCollection.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ error: 'User or Driver not found not found' });
    }
    
    // Check if driver is approved
    if (user.role === 'driver' && !user.isApproved) {
      return res.status(403).json({ error: 'Driver account pending approval' });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = generateToken(user);
    
    res.json({
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isApproved: user.isApproved,
      token
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
//update
app.patch('/update/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Authorization check
    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Unauthorized to update this profile' });
    }

    // Only allow name and password updates
    const { name, password } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Update in appropriate collection
    const collection = req.user.role === 'user' ? usersCollection : driversCollection;
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
//delete account
app.delete('/delete-account/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Authorization check
    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Unauthorized to delete this account' });
    }

    // Delete from appropriate collection
    const collection = req.user.role === 'user' ? usersCollection : driversCollection;
    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Assuming auth middleware sets `req.user`
    
    // Check if user exists in either collection
    const userAccount = await usersCollection.findOne({ _id: new ObjectId(userId) });
    const driverAccount = await driversCollection.findOne({ _id: new ObjectId(userId) });

    if (!userAccount && !driverAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Return whichever account exists (prioritize user if both exist)
    const account = userAccount || driverAccount;
    res.json(account);

  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
//######################################################################################################################
// user endpoint
// book ride
app.post('/user/get-ride', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Only users can book rides' });
    }

    const { pickupLocation, destination, fare } = req.body;
    
    const newRide = {
      userId: req.user.id,
      userName: req.user.name,
      driverId: null,
      driverName: null,
      fare: null,
      pickupLocation,
      destination,
      status: 'requested', // Initial status
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await ridesCollection.insertOne(newRide);
    
    res.status(201).json({
      message: 'Ride booked successfully',
      rideId: result.insertedId,
      status: 'requested'
    });
  } catch (error) {
    console.error('Error booking ride:', error);
    res.status(500).json({ error: 'Failed to book ride' });
  }
});

//check driver details
app.get('/user/driver-details/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Only users can view ride requests' });
    }
 
    const { id } = req.params;
  
    // Find the driver document (assuming 1:1 driverId to document)
    const driver = await driversCollection.findOne({
      _id: new ObjectId(id) // or just id if driverId is stored as string
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Return just the driver object (not array)
    res.json(driver);
    
  } catch (error) {
    console.error('Error fetching driver details:', error);
    res.status(500).json({ error: 'Failed to fetch driver details' });
  }
});



//check ongoing ride
app.get('/user/ongoing-ride', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Only users can view ride requests' });
    }

    const availableRides = await ridesCollection.findOne({
      status: 'accepted',
      userId: req.user.id // Ensure the ride belongs to the user
    });

    res.json(availableRides);
    
  } catch (error) {
    console.error('Error fetching available rides:', error);
    res.status(500).json({ error: 'Failed to fetch available rides' });
  }
});
//cancel ride
app.delete('/user/cancel-ride/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Only users can cancel rides' });
    }

    const { id } = req.params;
    
    // First find the ride to verify ownership
    const ride = await ridesCollection.findOne({ 
      _id: new ObjectId(id),
      userId: req.user.id 
    });

    if (!ride) {
      return res.status(404).json({ 
        error: 'Ride not found or you are not the owner of this ride' 
      });
    }

    // Only allow cancellation if ride is in requested or accepted state
    if (!['requested', 'accepted'].includes(ride.status)) {
      return res.status(400).json({ 
        error: 'Ride cannot be cancelled in its current state' 
      });
    }

    // Delete the ride
    const result = await ridesCollection.deleteOne({ 
      _id: new ObjectId(id),
      userId: req.user.id 
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    
    // If there was a driver assigned, make them available again
    if (ride.driverId) {
      await driversCollection.updateOne(
        { _id: new ObjectId(ride.driverId) },
        { $set: { isAvailable: true } }
      );
    }
    
    res.json({ message: 'Ride cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling ride:', error);
    res.status(400).json({ error: 'Invalid ride ID' });
  }
});

//check completed rides
app.get('/user/check-ride', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Only users can check rides' });
    }

    // Find all rides for the user
    const rides = await completedRidesCollection.find({ userId: req.user.id }).toArray();
    
    if (rides.length === 0) {
      return res.status(404).json({ message: 'No rides found for this user' });
    }
    
    res.json(rides);
  } catch (error) {
    console.error('Error fetching rides:', error);
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

//######################################################################################################################
//driver endpoint
//check available rides
app.get('/driver/avail-ride', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ error: 'Only drivers can view ride requests' });
    }

    

    // Only show rides that are "requested" 
    const availableRides = await ridesCollection.find({
      status: 'requested'
    }).toArray();
    
    res.json(availableRides);

  } catch (error) {
    console.error('Error fetching available rides:', error);
    res.status(500).json({ error: 'Failed to fetch available rides' });
  }
});

//check accepted ride
app.get('/driver/current-ride/:id', authenticateToken, async (req, res) => {
  try {
    
    const acceptedride = await ridesCollection.findOne({ 
      driverId: req.user.id,
      status: 'accepted' 
     
    });
    
   
    res.json(acceptedride);
  } catch (error) {
    console.error('Error fetching available rides:', error);
    res.status(500).json({ error: 'Failed to fetch available rides' });
  }
});
//accept job
app.post('/driver/accept-job/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ error: 'Only drivers can accept jobs' });
    }
    const driver = await driversCollection.findOne({ 
      _id: new ObjectId(req.user.id),
      isAvailable: true 
    });

    if (!driver) {
      return res.status(403).json({ 
        error: 'You must mark yourself as available to see ride requests' 
      });
    }
    const { id } = req.params;

    // 1. Find the ride
    const ride = await ridesCollection.findOne({ _id: new ObjectId(id) });

    if (!ride || ride.status !== 'requested') {
      return res.status(400).json({ error: 'Ride not found or already accepted' });
    }

    // 2. Update ride with driver info
    await ridesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          driverId: req.user.id,
          driverName: req.user.name,
          status: 'accepted',
          updatedAt: new Date()
        }
      }
    );

    // 3. Mark driver as not available
    await driversCollection.updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: { isAvailable: false } }
    );

    res.json({ message: 'Ride accepted successfully' });
  } catch (error) {
    console.error('Error accepting ride:', error);
    res.status(500).json({ error: 'Failed to accept ride' });
  }
});

//complete job
app.patch('/driver/complete-job/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ error: 'Only drivers can complete rides' });
    }
   
    const { id } = req.params;
    const { fare } = req.body;
    
    const ride = await ridesCollection.findOne({ 
      _id: new ObjectId(id),
      driverId: req.user.id 
    });

    if (!ride) {
      console.log('Ride not found or not assigned to driver');
      return res.status(404).json({ error: 'Ride not found or not assigned to you' });
    }

    const finalFare = fare || ride.fare;
    if (!fare || isNaN(finalFare)) {
      return res.status(400).json({ error: 'Fare must be a number' });
    }

    const completedRide = {
      ...ride,
      status: 'completed',
      completedAt: new Date(),
      fare: finalFare,
      userReview: null
    };

    await completedRidesCollection.insertOne(completedRide);

    await ridesCollection.deleteOne({ _id: ride._id });

    await driversCollection.updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: { isAvailable: true } }
    );
    
    res.json({ message: 'Ride completed successfully' });

  } catch (error) {
    console.error('❌ Error completing ride:', error);
    res.status(500).json({ error: error.message || 'Failed to complete ride' });
  }
});

// Driver gets earnings and completed rides
app.get('/driver/stats', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'driver') {
            return res.status(403).json({ error: 'Only drivers can view stats' });
        }

        // Get completed rides
        const completedRides = await completedRidesCollection.find({
            driverId: req.user.id
        }).sort({ completedAt: -1 }).toArray();


        // Calculate total earnings
        const totalEarnings = completedRides.reduce((sum, ride) => {
            const fare = typeof ride.fare === 'number' ? ride.fare : Number(ride.fare);
            return sum + fare;
        }, 0);
       

        // Get driver details
        const driver = await driversCollection.findOne({ 
            _id: new ObjectId(req.user.id) 
        });
        
        

        res.json({
            totalCompletedRides: completedRides.length,
            totalEarnings,
            averageRating: driver.averageRating || 0,
            recentRides: completedRides.slice(0, 5) // Last 5 rides
        });
    } catch (error) {
        console.error('Error fetching driver stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});
//#####################################################################################################################

//admin endpoints
//check drivers
app.get('/admin/drivers', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  try {
    const drivers = await driversCollection.find({ role: 'driver' }).toArray();
    res.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//approve driver
app.patch('/admin/drivers/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  try {
    const { id } = req.params;
    const result = await driversCollection.updateOne(
      { _id: new ObjectId(id), role: 'driver' },
      { $set: { isApproved: true } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    
    res.json({ message: 'Driver approved successfully' });
  } catch (error) {
    console.error('Error approving driver:', error);
    res.status(400).json({ error: 'Invalid driver ID' });
  }
});

//check users
app.get('/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  try {
    const users = await usersCollection.find({ role: 'user' }).toArray();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//check rides
app.get('/admin/rides', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  try {
    const rides = await ridesCollection.find().toArray();
    res.json(rides);
  } catch (error) {
    console.error('Error fetching rides:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//delete users,drivers or users!!
app.delete('/admin/delete/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    const { id } = req.params;
    let result;

    // Try to delete from users
    result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount > 0) {
      return res.json({ message: 'User deleted successfully' });
    }
    
    // Try to delete from drivers
    result = await driversCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount > 0) {
      return res.json({ message: 'Driver deleted successfully' });
    }
    
    // Try to delete from rides
    result = await ridesCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount > 0) {
      return res.json({ message: 'Ride deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting :', error);
    res.status(400).json({ error: 'Invalid ID' });
  }
});