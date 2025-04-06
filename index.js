const { MongoClient } = require('mongodb');

// Step 1: Define the drivers array
const drivers = [
    {
        name: "lee",
        vehicleType: "Sedan",
        isAvailable: true,
        rating: 4.8
    },
    {
        name: "loo",
        vehicleType: "SUV",
        isAvailable: false,
        rating: 4.5
    },
    {
        name: "lai",
        vehicleType: "Hatchback",
        isAvailable: true,
        rating: 4.6
    }
];

async function main() {
    const uri = "mongodb://localhost:27017";
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Connected to MongoDB!");

        const db = client.db("testDB");
        const collection = db.collection("drivers");

        // Step 2: Insert multiple drivers
        const insertResult = await collection.insertMany(drivers);
        console.log(`${insertResult.insertedCount} drivers inserted.`);

        // Step 3: Query available drivers with rating ≥ 4.5
        const availableDrivers = await collection.find({
            isAvailable: true,
            rating: { $gte: 4.5 }
        }).toArray();
        console.log("Available high-rated drivers:", availableDrivers);

        // Step 4: Update John Doe's rating
        const updateResult = await collection.updateOne(
            { name: "lai" },
            { $inc: { rating: 0.3 } }
        );
        console.log("Updated lai's rating:", updateResult.modifiedCount);

        // Step 5: Delete unavailable drivers
        const deleteResult = await collection.deleteMany({ isAvailable: false });
        console.log("Deleted unavailable drivers:", deleteResult.deletedCount);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

main();
