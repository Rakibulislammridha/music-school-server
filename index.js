const express = require('express');
const app = express();
const morgan = require('morgan')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.port || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"))

const verifyJWT = (req, res, next)=>{
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error: true, message: "unauthorized access"})
  }
  const token = authorization.split(" ")[1]

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
    if(err){
        return res.status(401).send({error: true, message: "unauthorized access"})
    }
    req.decoded = decoded;
    next()
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3ztqljx.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const classesCollection = client.db("music-school").collection("classes")
    const subjectCollection = client.db("music-school").collection("subjects");
    const usersCollection = client.db("music-school").collection("users");
    const studentsSubjectsCollection = client.db("music-school").collection("selectedSubjects");

    app.post("/jwt", (req, res)=>{
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h"}); 
        res.send({token});
    })

    // Users Collection (save users email, and set role)

    app.get("/users", async (req, res)=>{
        const result = await usersCollection.find().toArray();
        res.send(result);
    })

    app.get("/users/:email", async(req, res)=>{
        const email = req.params.email;
        const query = {email: email};
        const result = await usersCollection.findOne(query);
        res.send(result);
    })

    app.put("/users/:email", async(req, res)=>{
        const email = req.params.email;
        const user = req.body;
        const query = {email: email};
        const options = {upsert: true};
        const updatedDoc = {
            $set: user,
        }
        const result = await usersCollection.updateOne(query, updatedDoc, options)
        res.send(result);
    })

    app.patch("/users/admin/:id", async(req, res) =>{
        const id = req.params.id;
        console.log(id);
        const filter = {_id: new ObjectId(id)};
        const updatedDoc = {
            $set: {
                role: "admin"
            },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    app.patch("/users/instructor/:id", async(req, res)=>{
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const updatedDoc = {
            $set: {
                role: "instructor"
            },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    app.patch("/users/user/:id", async (req, res) =>{
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const updatedDoc = {
            $set: {
                role: "user"
            },
        }
        const result = await usersCollection.updateOne(filter, updatedDoc)
        res.send(result)
    })

    // Classes section 
    app.get("/subjects", async(req, res)=>{
        const result = await subjectCollection.find().toArray();
        res.send(result);
    })

    app.get("/subjects/:email", async (req, res) =>{
        const email = req.params.email;
        const query = {"instructor.email": email};
        const result = await subjectCollection.find(query).toArray();
        res.send(result);
    })

    app.post("/subjects", async(req, res)=>{
        const subject = req.body;
        const result = await subjectCollection.insertOne({...subject, status: "pending"});
        res.send(result)
    })
    
    app.patch("/subjects/approved/:id", async( req, res)=>{
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const updatedDoc = {
            $set:{
                status: "approved"
            }
        }
        const result = await subjectCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    // Student Selected subject collections
    app.get("/selectedSubjects", async( req, res)=>{
        const email = req.query.email;
        if(!email){
            res.send([])
        }
        const query = {email : email};
        const result = await studentsSubjectsCollection.find(query).toArray();
        res.send(result);
    })

    app.post("/selectedSubjects", async(req, res)=>{
        const subject = req.body;
        const result = await studentsSubjectsCollection.insertOne(subject);
        res.send(result);
    })

    app.delete("/selectedSubjects/:id", async (req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await studentsSubjectsCollection.deleteOne(query);
        res.send(result);
    })


    app.get("/classes", async(req, res)=>{
        const result = await classesCollection.find().toArray();
        res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get("/", (req, res)=>{
    res.send("School is coming")
})

app.listen(port, ()=>{
    console.log(`School is running on port ${port}`);
})