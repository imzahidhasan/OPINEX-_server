const express = require("express");
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion } = require("mongodb");
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
    const survey_collection = client.db('Opinex').collection('surveys')
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

    app.post("/surveys", async (req, res) => {
      const { title,description,category, questions } = req.body;
      const survey = {
        title,
        description,
        category,
        questions: questions.map((q) => ({ ...q, yesCount: 0, noCount: 0 })),
      };
      const result = await survey_collection.insertOne(survey);
      res.send(result);
    });
    app.get("/all_surveys", async (req, res) => {
      const surveys = await survey_collection.find().toArray();
      res.send(surveys);
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
