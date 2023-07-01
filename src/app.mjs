import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import "dotenv/config";

// Criação do app
const app = express();

// Configurações
app.use(cors());
app.use(express.json());

// Conexão com o Banco
const mongoClient = new MongoClient(process.env.DB_URL);

try {
  await mongoClient.connect(); // top level await
  console.log("MongoDB conectado!");

  app.listen(5000, () => {
    console.log('Servidor rodando na porta 5000');
  });

} catch (err) {
  console.log(err.message);
}

const db = mongoClient.db();