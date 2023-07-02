import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import "dotenv/config";
import Joi from "joi";
import dayjs from 'dayjs';

// Criação do app
const app = express();

// Configurações
app.use(cors());
app.use(express.json());

// Conexão com o Banco
const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
	await mongoClient.connect() // top level await
	console.log("MongoDB conectado!");
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
      time: dayjs().format('HH:mm:ss')
    };
    await db.collection("messages").insertOne(successMessage);

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

// Rota POST /messages
app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const from = req.body.from || req.headers.user;

  const schemaMessage = Joi.object({
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().valid('message', 'private_message').required()
  });

  const participant = await db.collection("participants").findOne({ name: from });

  if (!participant) return res.status(422).send("Remetente não existe!");

  const validation = schemaMessage.validate({ to, text, type }, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map(detail => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const newMessage = {
      from,
      to,
      text,
      type,
      time: dayjs().format('HH:mm:ss')
    };

    await db.collection("messages").insertOne(newMessage);
    return res.status(201).json(newMessage);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Rota GET /messages
app.get('/messages', async (req, res) => {
  const user = req.headers.user;
  const { limit } = req.query;

  try {
    let query = {
      $or: [
        { type: 'message' },
        { to: user },
        { to: 'Todos' },
        { from: user }
        
      ]
    };

    let messages = await db.collection('messages').find(query).toArray();

    if (limit) {
      const limitFilter = parseInt(limit);
      if (isNaN(limitFilter) || limitFilter <= 0) {
        return res.status(422).send("Limite inválido");
      }
      messages = messages.slice(-limitFilter);
    }

    res.send(messages);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Rota POST /status
app.post('/status', async (req, res) => {
  const user = req.headers.user;

  const participant = await db.collection('participants').findOne({ name: user });
    
  if (!participant) return res.status(404).send('Participante não existe');

  try {
    await db.collection('participants')
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } })
      .then(() => res.sendStatus(200));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Função para remover participantes inativos
const removeInactiveParticipants = async () => {
  const timeLimit = dayjs().subtract(10, 'second').valueOf();

  try {
    const removedParticipants = await db.collection('participants').find({
      lastStatus: { $lt: timeLimit }
    }).toArray();

    await db.collection('participants').deleteMany({
      lastStatus: { $lt: timeLimit }
    });

    console.log('Participantes inativos removidos');

    for (const participant of removedParticipants) {
      const newMessage = {
        from: participant.name,
        to: 'Todos',
        text: 'sai da sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss')
      };

      await db.collection('messages').insertOne(newMessage);

      console.log(`Mensagem de saída registrada para o participante ${participant.name}`);
    }
  } catch (err) {
    console.error('Erro ao remover participantes inativos:', err);
  }
};

//Server
removeInactiveParticipants();

setInterval(removeInactiveParticipants, 15000);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});