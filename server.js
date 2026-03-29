const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Base de datos con better-sqlite3
const db = new Database(path.join(__dirname, 'taxi-test.db'));

// Crear tablas
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT,
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct_answer TEXT,
    category TEXT,
    explanation TEXT
  );

  CREATE TABLE IF NOT EXISTS exam_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_questions INTEGER,
    correct_answers INTEGER,
    percentage REAL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

console.log('Base de datos lista');

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email }, 'secreto', { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  try {
    const hashed = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)');
    const result = stmt.run(email, hashed, name);
    
    const token = jwt.sign({ id: result.lastInsertRowid, email }, 'secreto', { expiresIn: '7d' });
    res.json({ token, user: { id: result.lastInsertRowid, email, name } });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Endpoint para preguntar a la IA
app.post('/api/ask-ai', async (req, res) => {
  const { question, context } = req.body;
  
  if (!question) {
    return res.status(400).json({ error: 'La pregunta es obligatoria' });
  }

  if (!context || context.length === 0) {
    return res.status(400).json({ error: 'No hay contexto disponible para esta página' });
  }

  try {
    const articleMatch = question.match(/art[ií]culo\s*(\d+)/i);
    const articleNumber = articleMatch ? articleMatch[1] : null;
    
    let relevantContext = '';
    let found = false;
    
    if (articleNumber) {
      const lines = context.split('\n');
      let startLine = -1;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const regex = new RegExp(`ART[IÍ]CULO\\s+${articleNumber}[\\.\\s]`, 'i');
        if (regex.test(line)) {
          startLine = i;
          found = true;
          break;
        }
      }
      
      if (found && startLine !== -1) {
        for (let j = startLine; j < Math.min(startLine + 40, lines.length); j++) {
          relevantContext += lines[j] + '\n';
        }
      } else {
        return res.json({ answer: `No encontré el artículo ${articleNumber} en el documento.` });
      }
    } else {
      relevantContext = context.substring(0, 8000);
    }

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Eres un asistente experto en la normativa del taxi en Madrid. Responde la pregunta basándote ÚNICAMENTE en el contexto proporcionado."
        },
        {
          role: "user",
          content: `Contexto:\n\n${relevantContext}\n\nPregunta: ${question}\n\nResponde basándote en el contexto.`
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 800,
    });

    res.json({ answer: completion.choices[0].message.content });
  } catch (error) {
    console.error('Error en Groq:', error);
    res.status(500).json({ error: 'Error procesando la pregunta' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
