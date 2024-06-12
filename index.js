const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SK);
const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://opinex-32b89.firebaseapp.com",
      "https://opinex-32b89.web.app",
    ],
  })
);
app.use(express.json());

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .send({ message: "Access token is missing or invalid" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(403).send({ message: "Invalid or expired token" });
    }
    req.user = user; // Add the user data to the request object
    next(); // Proceed to the next middleware or route handler
  });
};

app.get("/", (req, res) => {
  res.send("OPINEX server is running so fast...");
});

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.ek5qasv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const user_collection = client.db("Opinex").collection("users");
    const survey_collection = client.db("Opinex").collection("surveys");
    //post request api endpoints
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10h",
      });
      res.status(200).send({ token: token });
    });
    //routes for inserting user data on db
    app.post("/user", async (req, res) => {
      const user = req.body;
      const result = await user_collection.insertOne(user);
      res.status(200).send(result);
    });
    //routes for getting all user
    app.get("/get_user", async (req, res) => {
      const result = await user_collection.find().toArray();
      res.send(result);
    });
    //routes for checking is user exist or not in the db
    app.post("/is_user_exist", async (req, res) => {
      const user = req.body;
      const result = await user_collection.findOne(user);
      if (!result) {
        res.send({ userExist: false });
        return;
      }
      if (result.email) {
        res.send({ result, userExist: true });
      }
    });
    //routes to insert a survey in db
    app.post("/create_survey", async (req, res) => {
      const {
        title,
        category,
        description,
        deadline,
        questionTitle,
        questionDescription,
        surveyorEmail,
      } = req.body;
      const createdAt = new Date();

      const survey = {
        surveyorEmail,
        title,
        description,
        category,
        deadline,
        createdAt,
        questionTitle,
        questionDescription,
        status: "publish",
        yesCount: 0,
        noCount: 0,
        voter: [],
      };

      const result = await survey_collection.insertOne(survey);
      res.status(200).send(result);
    });
    //routes for getting a specific surveyor all survey
    app.get("/surveys/:email", async (req, res) => {
      const email = req.params.email;
      const result = await survey_collection
        .find({ surveyorEmail: email })
        .toArray();
      res.send(result);
    });
    //routes for update exiting survey
    app.put("/updateDocument/:id", async (req, res) => {
      const document = req.body;
      const { id } = req.params;
      const result = await survey_collection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: document,
        }
      );
      res.send(result);
    });
    //routes for getting single survey by id
    app.get("/survey/:id", async (req, res) => {
      const id = req.params.id;
      const result = await survey_collection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    //routes for getting all the surveys
    app.get("/all_surveys", verifyToken, async (req, res) => {
      const surveys = await survey_collection
        .find({ status: "publish" })
        .toArray();
      res.send(surveys);
    });
    //routes for getting a single survey
    app.get("/get_updated_survey/:id", async (req, res) => {
      const id = req.params;
      const result = await survey_collection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    //routes for count vote and save voter information
    app.put("/vote/:id", verifyToken, async (req, res) => {
      const { vote, comment, userName, userEmail } = req.body;
      const UserComment = { comment: comment, userEmail: userEmail };
      const { id } = req.params;
      const voterInfo = {
        vote,
        userName,
        userEmail,
      };
      await survey_collection.updateOne(
        { _id: new ObjectId(id) },
        {
          $push: { comment: UserComment },
        }
      );
      if (vote === "yes") {
        const result = await survey_collection.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: { yesCount: 1 },
            $push: { voter: voterInfo },
          }
        );
        res.send(result);
      }
      if (vote === "no") {
        const result = await survey_collection.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: { noCount: 1 },
            $push: { voter: voterInfo },
          }
        );
        res.send(result);
      }
    });
    //routes for updating user role
    app.post("/update_role", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await user_collection.updateOne(
        { _id: new ObjectId(data.id) },
        {
          $set: { role: data.role },
        }
      );
      res.send(result);
    });
    //routes for update survey status
    app.post("/update_survey_status", verifyToken, async (req, res) => {
      const { id, status, feedbackMessage } = req.body;
      const result = await survey_collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: status, feedback: feedbackMessage } }
      );
      res.send(result);
    });
    //routes for getting all the participated survey of a user
    app.post("/get_participated_survey", verifyToken, async (req, res) => {
      const userInfo = req.body;
      const result = await survey_collection
        .find({
          voter: {
            $elemMatch: userInfo,
          },
        })
        .toArray();
      res.send(result);
    });
    //routes for update report on the post
    app.put("/report_survey/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const userInfo = req.body;
      const result = survey_collection.updateOne(
        { _id: new ObjectId(id) },
        {
          $push: {
            reportedBy: userInfo,
          },
        }
      );
      res.send(result);
    });
    //routes for get reported post by user
    app.post("/reported_by", verifyToken, async (req, res) => {
      const userInfo = req.body;
      const result = await survey_collection
        .find({
          reportedBy: {
            $elemMatch: userInfo,
          },
        })
        .toArray();
      res.send(result);
    });
    //routes for getting surveys commented by user
    app.post("/get_commented_surveys", verifyToken, async (req, res) => {
      const userInfo = req.body;
      const result = await survey_collection
        .find({
          comment: {
            $elemMatch: userInfo,
          },
        })
        .toArray();
      res.send(result);
    });
    //routes for getting 6 most voted surveys
    app.get("/get_features_surveys", async (req, res) => {
      try {
        const result = await survey_collection
          .aggregate([
            {
              $match: {
                status: "publish",
              },
            },
            {
              $addFields: {
                totalVotes: { $add: ["$yesCount", "$noCount"] },
              },
            },
            {
              $sort: { totalVotes: -1 },
            },
            {
              $limit: 6,
            },
          ])
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching surveys:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //routes for getting 6 latest surveys
    app.get("/get_latest_survey", async (req, res) => {
      const result = await survey_collection
        .find({ status: "publish" })
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    //route for update user role
    app.post("/update_role/:email", verifyToken, async (req, res) => {
      const role = req.body.role;
      const email = req.params.email;
      const result = await user_collection.updateOne(
        { email: email },
        {
          $set: { role: role },
        }
      );
      res.send(result);
    });
    //route for payment using stripe
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { items } = req.body;

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 1600,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
