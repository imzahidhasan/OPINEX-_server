const express = require("express");
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
dotenv.config();
const app = express();
app.use(
  cors({
    origin: ["http://localhost:5173"],
  })
);
app.use(express.json());

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

    app.post("/user", async (req, res) => {
      const user = req.body;
      const result = await user_collection.insertOne(user);
      res.status(200).send(result);
    });
    //get request api endpoints
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
        status:'publish',
        yesCount: 0,
        noCount: 0,
        voter: [],
      };
      console.log(survey);

      const result = await survey_collection.insertOne(survey);
      res.status(200).send(result);
    });

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
      const {id}=req.params
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
    app.get("/all_surveys", async (req, res) => {
      const surveys = await survey_collection.find().toArray();
      res.send(surveys);
    });

    //routes for count vote and save voter information
    app.put("/vote/:id", async (req, res) => {
      const { vote, userName, userEmail } = req.body;
      const { id } = req.params;
      const voterInfo = {
        vote,userName,userEmail
      }
      if (vote === "yes") {
        const result = await survey_collection.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: { yesCount: 1 },
            $push: { voter: voterInfo },
          }
        );
        res.send(result)
      }
      if (vote === "no") {
        const result = await survey_collection.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: { noCount: 1 },
            $push:{voter:voterInfo}
          },
          );
        res.send(result);
      }
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
