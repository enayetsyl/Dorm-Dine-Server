
const express = require('express');
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
require('dotenv').config()

app.use(cors({
  origin:[
    'http://localhost:5173',
  ],
  credentials: true
}));
app.use(express.json())
app.use(cookieParser())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ktgpsav.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// MIDDLEWARE




async function run() {
  try {
    await client.connect();

    // COLLECTIONS
    const userCollection = client.db("DormDine").collection("users")

    // AUTH RELATED API
    app.post('/api/v1/jwt', async(req, res) => {
      const user = req.body;
      console.log('user for token2', user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1hr'});

      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      })
      .send({success: true})
    })

    app.post('/api/v1/logout', async(req, res) => {
      const user = req.body;
      res.clearCookie('token', {maxAge: 0}).send({success: true})
    })

    // GET ROUTE -----------


    // POST ROUTE --------------
    // USER INFO POST ROUTE

    app.post('/api/v1/user', async(req, res) => {
      const user  = req.body;
      const existingUser = await userCollection.findOne({email: user.email})
      if (existingUser) {
        res.json({message: 'User already registered'})
      }
      else {
        const updatedUser = {
          ...user,
          role: 'resident',
          package: 'none',
          badge:'bronze',
        }
        const result = await userCollection.insertOne(updatedUser)
        console.log(result)
        res.send(result)
      }
    })


   


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Ecommerce server phase 1 is running')
})

app.listen(port, () => {
  console.log(`Server is running at PORT: ${port}`)
})