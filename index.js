const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
require('dotenv').config()
let cors = require('cors')
let jwt = require('jsonwebtoken');
let cookieParser = require('cookie-parser')
const app = express()
const port = process.env.PORT || 5000

// Middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oglq0ui.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Create Middleware
let logger = async (req, res, next) => {
  console.log('called: ', req.host, req.originalUrl);
  next();
}

const verifyToken = async (req, res, next) => {
  let token = req.cookies?.token;
  console.log('Value of token in middleware: ', token);
  if(!token){
    return res.status(401).send({message: 'Not Authorized'})
  }
  jwt.verify(token,process.env.ACEESS_TOKEN_SECRET,(err,decoded)=>{
    if(err){
      console.log(err);
      return res.status(401).send({message: 'UnAuthorized'})
    }
    console.log('value in the token', decoded);
    req.user = decoded;
    next();
  })
  
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    let serviceCollection = client.db('CarDoctorDB').collection('Services')
    let bookingCollection = client.db('CarDoctorDB').collection('Bookings');


    /*Auth Related Api */
    app.post('/jwt', logger, async (req, res) => {
      let user = req.body;
      console.log(user);
      let token = jwt.sign(user, process.env.ACEESS_TOKEN_SECRET, { expiresIn: '1h' })
      // .cookie('token',token,{
      //   httpOnly:true,
      //   secure: false,
      //   sameSite: 'none'
      // })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })


    /*Service Database */
    app.get('/services', logger, async (req, res) => {
      let cursor = serviceCollection.find();
      let result = await cursor.toArray();
      res.send(result);
    })
    app.get('/services/:id', async (req, res) => {
      let id = req.params.id;
      let query = { _id: new ObjectId(id) }

      let options = {
        projection: { title: 1, price: 1, service_id: 1, img: 1 }
      }
      let result = await serviceCollection.findOne(query, options);
      res.send(result);
    })

    /*Post Booking Database */
    app.post('/bookings', async (req, res) => {
      let bookings = req.body;
      let result = await bookingCollection.insertOne(bookings)
      res.send(result)
    })
    /*Get from Booking Database */
    app.get('/bookings', logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      if(req.query.email !== req.user.email){
        return res.status(403).send({message: 'Forbidded access'})
      }
      
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      let result = await bookingCollection.find(query).toArray()
      res.send(result)
    })

    /*Delete Booking Database */
    app.delete('/bookings/:id', async (req, res) => {
      let id = req.params.id;
      let query = { _id: new ObjectId(id) }
      let result = await bookingCollection.deleteOne(query)
      res.send(result)
    })
    /*Update Booking Database */
    app.patch('/bookings/:id', async (req, res) => {
      let updatedBooking = req.body;
      let id = req.params.id;
      let query = { _id: new ObjectId(id) }
      console.log(updatedBooking);
      let updateDoc = {
        $set: {
          status: updatedBooking.status
        },
      }
      let result = await bookingCollection.updateOne(query, updateDoc)
      res.send(result)
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


app.get('/', (req, res) => {
  res.send('Car-Doctor Server is Running!')
})

app.listen(port, () => {
  console.log(`Car-Doctor is listening on port ${port}`)
})