
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
  const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    if(!token){
      return res.status(401).send({message: 'UNAUTHORIZED ACCESS'})
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if(err){
        return res.status(401).send({message: 'UNAUTHORIZED ACCESS'})
      }
      req.user = decoded;
      next()
    })
  }



async function run() {
  try {
    await client.connect();

    // COLLECTIONS
    const userCollection = client.db("DormDine").collection("users")
    const mealCollection = client.db("DormDine").collection("meals")
    const upcomingMealCollection = client.db("DormDine").collection("upcomingMeals")
    const requestMealCollection = client.db("DormDine").collection("requestMeals")
    const reviewCollection = client.db("DormDine").collection("reviews")

    // AUTH RELATED API
    app.post('/api/v1/jwt', async(req, res) => {
      const user = req.body;
      // console.log('user for token2', user)
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
    // USER INFORMATION GET ROUTE
    app.get('/api/v1/user',  async (req, res) => {
     const userEmail = req.query.email;
     console.log(userEmail)
      const result = await userCollection.find({email: userEmail}).toArray();
      res.send(result)
    })

    // ADMIN ROLE GET ROUTE
    app.get('/api/v1/user/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if(email !== req.user.email){
        return res.status(403).send({meassage: 'FORBIDDEN ACCESS'})
      }
      const query = {email:email};
      const user = await userCollection.findOne(query)
      let admin = false;
      if(user){
        admin = user?.role === 'admin';
      }
      res.send({admin})
    })

    // MEALS FOR TAB GET ROUTE
    app.get('/api/v1/meals', async(req, res) => {
      const {mealCategory} = req.query;
      let query = {}
      if(mealCategory && mealCategory !== "All"){
        query.mealCategory = mealCategory

      }
      const result = await mealCollection.find(query).toArray();
      res.send(result)
    })

    // MEAL DETAILS GET ROUTE

    app.get('/api/v1/meals/:id', async(req, res) => {
      const id = req.params.id;
      try{
        const query = {_id: new ObjectId(id)}

        const mealResult = await mealCollection.findOne(query)

        if(mealResult){
          const reviews = await reviewCollection.find({mealId:id}).toArray()
          mealResult.userReview = reviews;
          res.send(mealResult)
        }
      }
      catch(error){
        console.log(error)
      }
    })

    // INDIVIDUAL USER REQUEST MEAL 

    app.get('/api/v1/requestmeal', async (req, res) => {
      const {userId} = req.query.userId;
      const result = await requestMealCollection.find(userId).toArray()
      res.send(result)
    })


    // POST ROUTE --------------
    // USER INFO POST ROUTE

    app.post('/api/v1/user', async(req, res) => {
      const user  = req.body;
      console.log('hit by', user.email)
      const existingUser = await userCollection.findOne({email: user.email})
      if (existingUser) {
        console.log('existing user hit')
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

    // ADD MEAL POST ROUTE
    app.post('/api/v1/addMeal', verifyToken, async(req, res) =>{
      const meal = req.body;
      const result = await mealCollection.insertOne(meal)
      res.send(result)
    })
    // UPCOMING MEAL POST ROUTE
    app.post('/api/v1/upcomingMeal', verifyToken, async(req, res) =>{
      const upcomingMeal = req.body;
      const result = await upcomingMealCollection.insertOne(upcomingMeal)
      res.send(result)
    })

    // REQUEST MEAL POST ROUTE 
    app.post('/api/v1/mealrequest', async(req, res) => {
      try{
        const mealRequest = req.body;
      const result = await requestMealCollection.insertOne(mealRequest)
      res.send(result)
      } catch (error){
        console.log(error)
        res.send(error)
      }
    })

    // REVIEW MEAL POST ROUTE
    app.post('/api/v1/review', async(req,res) =>{
      try{
        const review = req.body;
        console.log(review)
        const result = await reviewCollection.insertOne(review)
        await mealCollection.updateOne({'_id': new ObjectId(review.mealId)},
        {
          $set: {'reviews': review.reviews}
        }
        )
        res.send(result)
      }catch(error){
        console.log('error in review post', error)
        res.send(error)
      }
    })


    // PATCH ROUTE
    // LIKE UPDATE IN MEALS
    app.patch('/api/v1/likes/:id', async(req, res) => {
      try{
        const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const updatedLikes = req.body;
      const likeValue = parseInt(updatedLikes.likesData)
      const updateDoc = {
        $set:{
          likes: likeValue,
        }
      }
      const result = await mealCollection.updateOne(query, updateDoc)
      res.send(result)
      } catch(error){
        console.log(error)
      }
    })


    // PUT ROUTE
    // USER MEMBERSHIP PACKAGE PUT ROUTE

    app.put('/api/v1/checkout/:id', async(req,res) => {
      const id = req.params.id
      const membershipPackage = req.body;
      const query = {_id: new ObjectId (id)}
      const user = await userCollection.findOne(query)
      if(!user.package){
        user.package = membershipPackage.package;
      }else{
        user.package = membershipPackage.package;
      }
      const result = await userCollection.updateOne(query, {
        $set:{
          package: user.package
        }
      })
      res.send(result)
    })



    // DELETE ROUTE
    // INDIVIDUAL USER REQUEST MEAL DELETE ROUTE

    app.delete('/api/v1/requestmeal/:id', async(req, res) => {
      const id = req.params.id;
      console.log(id)
      const query = {_id: id}
      console.log(query)
        const result = await requestMealCollection.deleteOne(query)
        res.send(result)
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