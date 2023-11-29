
const express = require('express');
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const app = express()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
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
    // SINGLE  USER INFORMATION GET ROUTE
    app.get('/api/v1/user',  async (req, res) => {
     const userEmail = req.query.email;
     console.log(userEmail)
      const result = await userCollection.find({email: userEmail}).toArray();
      res.send(result)
    })

    // ALL USER INFORMATION GET ROUTE
    app.get('/api/v1/allUser', async(req,res) => {
      const page = parseInt(req.query.page)
      const size = parseInt(req.query.size)
      
      const result = await userCollection.find()
      .skip(page * size)
      .limit(size)
      .toArray();
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

    // ALL MEAL FOR ADMIN ROUTE
    app.get('/api/v1/allmeal', async(req, res) => {
      const page = parseInt(req.query.page)
      const size = parseInt(req.query.size)
     
      const result = await mealCollection.find()
      .skip(page * size)
      .limit(size)
      .toArray();
      res.send(result)
    })
 
    // ALL REVIEW FOR ADMIN ROUTE
    app.get('/api/v1/allreview', async(req, res) => {
      const page = parseInt(req.query.page)
      const size = parseInt(req.query.size)
      const result = await reviewCollection.find().skip(page * size)
      .limit(size)
      .toArray();
      res.send(result)
    }) 

    // REQUEST MEAL FOR ADMIN GET ROUTE
    app.get('/api/v1/serveMeal', async(req, res) => {
      const page = parseInt(req.query.page)
      const size = parseInt(req.query.size)
      const result = await requestMealCollection.find().skip(page * size)
      .limit(size)
      .toArray();
      res.send(result)
    })

    // UPCOMING MEAL GET ROUTE FOR ADMIN
    app.get('/api/v1/upcomingmeal', async (req, res) => {
      const page = parseInt(req.query.page)
      const size = parseInt(req.query.size)
      const result = await upcomingMealCollection.find().skip(page * size)
      .limit(size)
      .toArray();
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
      const userEmail = req.query.userEmail;
      console.log(req.query.userEmail)
      console.log(userEmail)
      const query = {userEmail: userEmail}
      const result = await requestMealCollection.find(query).toArray()
      console.log(result)
      res.send(result)
    })

    // INDIVIDUAL USER REVIEW ROUTE
    app.get('/api/v1/userreview/:id', async(req, res) => {
      const id = req.params.id;
      const query = {reviewerId:id}
      const result = await reviewCollection.find(query).toArray();
      res.send(result)
  })

    // ADMIN MEAL POST COUNT ROUTE
      app.get('/api/v1/adminprofile/:id', async(req, res) => {
        const id = req.params.id;
        const query = {adminId:id}
        const result = await mealCollection.find(query).toArray()
        const result2 = await upcomingMealCollection.find(query).toArray()
        const result3 = result.concat(result2)
        res.send(result3)
      })

// MEAL EDIT ROUTE FOR ADMIN
      app.get('/api/v1/editmeal/:id', async(req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await mealCollection.findOne(query)
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

    // UPCOMING MEAL PUBLISH ROUTE
    app.post('/api/v1/mealpublish/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await upcomingMealCollection.findOne(query)
      const newMeal = await mealCollection.insertOne(result)
      if(newMeal.insertedId){
        const deleteItem = await upcomingMealCollection.deleteOne(query)
        res.send(deleteItem)
      }else{
        res.send({message:'Could not Publish'})
      }
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

    app.patch('/api/v1/updateMealLikes/:id', async(req, res) => {
      try{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const updatedLikes = req.body;
        const likeValue = parseInt(updatedLikes.likesData)
        const updateDoc = {
          $set: {
            likes: likeValue,
          }
        }
        const result = await upcomingMealCollection.updateOne(query, updateDoc)
        res.send(result)
      } catch (error){
        console.log(error)
      }
    })

    // ADMIN ROLE CHANGE ROUTE
    app.patch('/api/v1/makeadmin/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const updateStatus = {
        $set:{
          role: 'admin',
        }
      }
      const result = await userCollection.updateOne(query, updateStatus)
      res.send(result)
    })

    // SERVE MEAL STATUS CHANGE ROUTE
    app.patch('/api/v1/servestatus/:id', async(req, res) => {
      const id = req.params.id;
      console.log('api hit by', id)
      const updateStatus = {
        $set:{
          status:'delivered',
        }
      }
      const result = await requestMealCollection.updateOne({_id: new ObjectId(id)}, updateStatus)
      res.send(result)
    })

    // USER REVIEW UPDATE 
    app.patch('/api/v1/updatereview/:id', async(req, res) => {
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const updateReview = req.body;
      const updateDoc ={
        $set:{
          reviewText: updateReview.reviewText,
        }
      }
      const result = await reviewCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    // EDIT MEAL PUT ROUTE
    app.patch('/api/v1/editMeal/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const updateMeal = req.body;
      const updateDoc = {
        $set: {
          mealTitle:updateMeal.mealTitle ,
  mealCategory:updateMeal.mealCategory ,
  mealImage:updateMeal.mealImage ,
  ingredients:updateMeal.ingredients ,
  description:updateMeal.description ,
  price:updateMeal.price ,
  rating:updateMeal.rating ,
  postTime:updateMeal.postTime ,
  likes:updateMeal.likes ,
  reviews:updateMeal.reviews ,
  distributorName:updateMeal.distributorName ,
  distributorEmail:updateMeal.distributorEmail ,
  adminId:updateMeal.adminId ,
        }
      }
     const result = await mealCollection.updateOne(query, updateDoc)
     res.send(result)
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
        user.badge = membershipPackage.badge
      }else{
        user.package = membershipPackage.package;
        user.badge = membershipPackage.badge
      }
      const result = await userCollection.updateOne(query, {
        $set:{
          package: user.package,
          badge : user.badge,
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

    // USER REVIEW DELETE ROUTE
    app.delete('/api/v1/userreview/:id', async(req,res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await reviewCollection.deleteOne(query)
      res.send(result)
    })

    // MEAL DELETE ROUTE
    app.delete('/api/v1/meal/:id', async(req,res) => {
      id = req.params.id;
      const query = {_id: new ObjectId(id)}
      console.log(query)
      const result = await mealCollection.deleteOne(query)
      await reviewCollection.deleteMany({mealId:id})
      res.send(result)
    })

    // ADMIN REVIEW DELETE ROUTE
    app.delete('/api/v1/review/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await reviewCollection.deleteOne(query)
      res.send(result)
    })



    // STRIPE ROUTE
    // PAYMENT INTENT
    app.post('/api/v1/create-payment-intent', async(req,res) => {
      const {price} = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types:['card']
      },
      {
        apiKey: process.env.STRIPE_SECRET_KEY
      }
      )

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })




    // PAGINATION ROUTE
    // ALL MEALS PAGINATION
    app.get('/api/v1/allmealCount', async(req, res) => {
      const count = await mealCollection.estimatedDocumentCount();
      res.send({count})
    })

    // ALL USER PAGINATION
    app.get('/api/v1/allUserCount', async(req, res) => {
      const count = await userCollection.estimatedDocumentCount();
      res.send({count})
    })

    // ALL REVIEW PAGINATION
    app.get('/api/v1/allReviewCount', async(req, res) => {
          const count = await reviewCollection.estimatedDocumentCount();
      res.send({count})
    })

    // SERVE MEAL PAGINATION
    app.get('/api/v1/allServeMealCount', async(req, res) => {
      const count = await requestMealCollection.estimatedDocumentCount();
  res.send({count})
})


    // UPCOMING MEAL PAGINATION
    app.get('/api/v1/upcomingMealCount', async(req, res) => {
      const count = await upcomingMealCollection.estimatedDocumentCount();
  res.send({count})
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