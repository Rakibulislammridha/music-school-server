const express = require('express');
const app = express();
const morgan = require('morgan')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.port || 3000;

// Middleware
const corsOptions = {
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
  }
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"))

// JWT Verification
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
    // await client.connect();

    const subjectCollection = client.db("music-school").collection("subjects");
    const usersCollection = client.db("music-school").collection("users");
    const studentsSubjectsCollection = client.db("music-school").collection("selectedSubjects");
    const paymentCollection = client.db("music-school").collection("payments");
    

    app.post("/jwt", (req, res)=>{
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h"}); 
        res.send({token});
    })

    const verifyAdmin = async (req, res, next) =>{
        const email = req.decoded.email;
        const query = {email: email};
        const user = await usersCollection.findOne(query);
        if(user?.role !== "admin"){
            return res.status(403).send({error: true, message: "forbidden access"})
        }
        next();
    }

    const verifyInstructor = async (req, res, next) => {
        const email = req.decoded.email;
        const query = {email: email};
        const user = await usersCollection.findOne(query);
        if(user?.role !== "instructor"){
            return res.status(403).send({error: true, message: "forbidden access"})
        }
        next();
    }

    // Users Collection (save users email, and set role)

    app.get("/users", verifyJWT, async (req, res)=>{
        const result = await usersCollection.find().toArray();
        res.send(result);
    })

    app.get("/users/instructors", async (req, res) => {
        const result = await  usersCollection.find({role: "instructor"}).toArray();
        res.send(result);
    })

    app.get("/users/popularInstructors", async (req, res) => {
        const result = await usersCollection.find({role: "instructor"}).limit(6).toArray()
        res.send(result)
    })


    app.get("/users/:email", verifyJWT, async(req, res)=>{
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

    // verify user
    app.get("/users/admin/:email", verifyJWT, async (req, res) =>{
        const email = req.params.email;
        const query = {email: email}
        const user = await usersCollection.findOne(query);
        const result = {admin: user?.role === "admin"}
        res.send(result);
    })

    app.get("/users/instructor/:email", verifyJWT, async (req, res)=>{
        const email = req.params.email;
        const query = {email: email};
        const user = await usersCollection.findOne(query);
        const result = {instructor: user?.role === "instructor"}
        res.send(result);
    })

    app.patch("/users/admin/:id", verifyJWT, async(req, res) =>{
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const updatedDoc = {
            $set: {
                role: "admin"
            },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    app.patch("/users/instructor/:id",verifyJWT, async(req, res)=>{
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

    app.get("/popularSubjects", async (req, res) =>{
        const query = {status: "approved"}
        const result = await subjectCollection.find(query).sort({enrolled: -1}).limit(6).toArray();
        res.send(result);
    })

    app.post("/subjects", async(req, res)=>{
        const subject = req.body;
        const result = await subjectCollection.insertOne({...subject, status: "pending"});
        res.send(result)
    })

    app.post("/subjects/reject/:id", async (req, res) =>{
        const id = req.params.id;
        const {feedback} = req.body;
        const filter = {_id: new ObjectId(id)}
        const updatedDoc = {
            $set:{
                feedback: feedback,
            }
        }
        const result = await subjectCollection.updateOne(filter, updatedDoc);
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

    app.delete("/subjects/:id", async (req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await subjectCollection.deleteOne(query);
        res.send(result);
    })

    // Student Selected subject collections
    app.get("/selectedSubjects", verifyJWT, async( req, res)=>{
        const email = req.query.email;
        if(!email){
            res.send([])
        }
        const decodedEmail = req.decoded.email;
        if(email !== decodedEmail){
            return res.status(403).send({error: true, message: "forbidden access"})
        }
        const query = {email : email};
        const result = await studentsSubjectsCollection.find(query).toArray();
        res.send(result);
    })

    app.get("/selectedSubjects/:id", async (req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await studentsSubjectsCollection.findOne(query)
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

    //  Create Payment 
    app.post("/create-payment-intent", verifyJWT, async(req, res) =>{
        const {price} = req.body;
        const amount = price*100;
        const paymentIntent = await stripe.paymentIntents.create({ // if error remove s (paymentIntent)
            amount: amount,
            currency: "usd",
            payment_method_types: ["card"]
        })

        res.send({
            clientSecret: paymentIntent.client_secret
        })
    })

    // Payments Api
    app.post("/payments", verifyJWT, async (req, res) =>{
        const payment = req.body;

        // delete selected course
        await studentsSubjectsCollection.deleteOne({_id: new ObjectId(payment.selectedClassId)});


        const filter = {_id: new ObjectId(payment.subjectId)};
        const updatedDoc = {
            $set: {
                availableSits: payment.availableSits,
                enrolledStudents: payment.enrolledStudents,
            },
        };
        await subjectCollection.updateOne(filter, updatedDoc);



        const result = await paymentCollection.insertOne(payment);
        res.send({result});
    })

    app.get("/payments/:email", async (req, res) =>{
        const email = req.params.email;
        let sort = {}
        if(req.query.sort){
            sort = { date: -1 };
        }
        const query = {email: email};
        const result = await paymentCollection.find(query).sort(sort).toArray();
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