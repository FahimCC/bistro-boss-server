const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
	const authorization = req.headers.authorization;

	if (!authorization) {
		return res
			.status(401)
			.send({ error: true, message: 'Unauthorized Access' });
	}
	const token = authorization.split(' ')[1];
	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
		if (err) {
			return res
				.status(401)
				.send({ error: true, message: 'Unauthorized Access' });
		}

		req.decoded = decoded;
		next();
	});
};

//create token
// require('crypto').randomBytes(64).toString('hex')

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ws55k5x.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		await client.connect();

		const menuCollection = client.db('bossRestaurant').collection('menu');
		const reviewCollection = client.db('bossRestaurant').collection('reviews');
		const cartCollection = client.db('bossRestaurant').collection('carts');
		const userCollection = client.db('bossRestaurant').collection('users');

		//verify Admin
		const verifyAdmin = async (req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await userCollection.findOne(query);

			if (user?.role !== 'admin') {
				return res
					.status(403)
					.send({ error: true, message: 'Forbidden access' });
			}
			next();
		};

		//jwt
		app.post('/jwt', (req, res) => {
			const user = req.body;
			const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
				expiresIn: '1h',
			});
			res.send({ token });
		});

		//menu collection
		app.get('/menu', async (req, res) => {
			const result = await menuCollection.find().toArray();
			res.send(result);
		});

		app.post('/menu', verifyJWT, verifyAdmin, async (req, res) => {
			const item = req.body;
			const result = await menuCollection.insertOne(item);
			res.send(result);
		});

		app.delete('/menu', verifyJWT, verifyAdmin, async (req, res) => {
			const id = req.params.id;
			const filter = { _id: new ObjectId(id) };
			const result = await menuCollection.deleteOne(filter);
			res.send(result);
		});

		//review collection
		app.get('/reviews', async (req, res) => {
			const result = await reviewCollection.find().toArray();
			res.send(result);
		});

		//user collection
		app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
			const result = await userCollection.find().toArray();
			res.send(result);
		});

		app.post('/users', async (req, res) => {
			const user = req.body;
			const query = { email: user.email };
			const isExists = await userCollection.findOne(query);
			if (isExists) {
				return res.send({ message: 'User Already Exists' });
			}
			const result = await userCollection.insertOne(user);
			res.send(result);
		});

		app.get('/users/admin/:email', verifyJWT, async (req, res) => {
			const email = req.params.email;

			if (email !== req.decoded.email) {
				res.send({ admin: false });
			}

			const query = { email: email };
			const user = await userCollection.findOne(query);
			const result = { admin: user?.role === 'admin' };
			res.send(result);
		});

		app.patch('/users/admin/:id', async (req, res) => {
			const id = req.params.id;
			const filter = { _id: new ObjectId(id) };
			const updateDoc = {
				$set: {
					role: 'admin',
				},
			};
			const result = await userCollection.updateOne(filter, updateDoc);
			res.send(result);
		});

		app.delete('/users/:id', async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await userCollection.deleteOne(query);
			res.send(result);
		});

		//cart collection
		app.get('/carts', verifyJWT, async (req, res) => {
			const email = req.query.email;

			if (!email) {
				res.send([]);
			}

			const decodedEmail = req.decoded.email;
			if (email !== decodedEmail) {
				res.status(403).send({ error: true, message: 'Forbidden access' });
			}
			const query = { email: email };
			const result = await cartCollection.find(query).toArray();
			res.send(result);
		});

		app.delete('/carts/:id', async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await cartCollection.deleteOne(query);
			res.send(result);
		});

		app.post('/carts', async (req, res) => {
			const item = req.body;
			const result = await cartCollection.insertOne(item);
			res.send(result);
		});

		// Send a ping to confirm a successful connection
		await client.db('admin').command({ ping: 1 });
		console.log(
			'Pinged your deployment. You successfully connected to MongoDB!'
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

app.get('/', (req, res) => {
	res.send('Boss is sitting.....');
});

app.listen(port, () => {
	console.log(`Boss is running on port :${port}`);
});
