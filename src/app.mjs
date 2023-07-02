import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import "dotenv/config";
import Joi from "joi";

// Criação do app
const app = express();

// Configurações
app.use(cors());
app.use(express.json());

// Conexão com o Banco
const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
	await mongoClient.connect() // top level await
	console.log("MongoDB conectado!")
  app.listen(5000, () => {
    console.log('Servidor rodando na porta 5000');
  });
} catch (err) {
	(err) => console.log(err.message)
}

const db = mongoClient.db()

// Rota POST /participants
app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const schemaParticipant = Joi.object({
    name: Joi.string().required()
  });

  const validation = schemaParticipant.validate(req.body, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map(detail => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const participant = await db.collection("participants").findOne({ name: name });
    if (participant) return res.status(409).send("Nome já está sendo usado!");

    const newParticipant = {
      name,
      lastStatus: Date.now()
    };

    await db.collection("participants").insertOne(newParticipant);
    const successMessage = {
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    };
    return res.status(201).json(successMessage);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Rota GET /participants
app.get("/participants", async (_, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    return res.status(201).json(participants);
  } catch (err) {
    res.status(500).send(err.message);
  }
});