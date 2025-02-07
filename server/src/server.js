const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const knex = require('./knex');
const multer = require('multer');
const { uploadFile, generatePublicUrl } = require('./app');

const app = express();

// ---------- Middleware (START) ---------- */
const upload = multer({ dest: 'uploads/' });

if (!process.env.NODE_ENV) {
  app.use(
    cors({
      origin: 'http://localhost:5173',
      credentials: true,
    })
  );
} else {
  app.use('/', express.static(path.join(__dirname, '../../client/dist')));
}

app.use(express.json());

app.use(
  session({
    store: new pgSession({
      conString:
        process.env.DATABASE_URL ||
        `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // What does this do, might cause deployment issues
    cookie: { secure: false },
  })
);
// ----------- Middleware (END) ----------- */

// "get" endpoint (get all users)
app.get('/api/user', async (req, res) => {
  try {
    const users = await knex.select('*').from('users').limit(100);
    res.json(users);
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// "get" endpoint (get all project information)
app.get('/api/project', async (req, res) => {
  try {
    const projects = await knex.select('*').from('projects').limit(100);
    res.json(projects);
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// "get" endpoint (get user by id)
app.get('/api/user/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const user = await knex.select('*').from('users').where('id', id).first();
    res.json(user);
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// "get" endpoint (get project by id)
app.get('/api/project/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const project = await knex
      .select('*')
      .from('projects')
      .where('id', id)
      .first();
    res.json(project);
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// "delete" endpoint (delete user by id)
app.delete('/api/user/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await knex('users').where('id', id).del();
    res.json({ message: 'Delete route is working correctly.' });
  } catch (error) {
    console.error('Database connection error.', error);
    res.status(500).json({ error: error.message });
  }
});

// "put" testing endpoint (update)
app.put('/test/', async (req, res) => {
  try {
    res.json({ message: 'Put route is working correctly.' });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- Authentication (START) ---------- */
// POST /api/auth/register
// it (should allow a new user to register)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, city, country } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await knex('users')
      .insert({
        username,
        password: hashedPassword,
        city,
        country,
      })
      .returning(['id', 'username', 'city', 'country']);

    res
      .status(201)
      .json({ message: 'User registered successfully', user: newUser });
  } catch (error) {
    console.error('Database connection error.', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login
// it (should allow an existing user to login)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await knex('users').where({ username }).first();

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ message: 'Login succesful' });
  } catch (error) {
    console.error('Database connection error.', error);
    res.status(500).json({ error: error.message });
  }
});

// Checks if a user is logged in
// it (should fetch logged in users profile from database using the userId stored in the session)
app.get('/api/auth/user', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  knex('users')
    .where({ id: req.session.userId })
    .first()
    .then((user) => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    })
    .catch((error) => {
      console.error('Database connection error.', error);
      res.status(500).json({ error: error.message });
    });
});

// GET /api/auth/logout
// it (should log the user out)
app.get('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ message: 'Logout  successful' });
  });
});
// ----------- Authentication (END) ----------- */

// file handle api
app.post('/api/user/upload', upload.single('file'), async (req, res) => {
  try {
    const { file } = req;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Upload the file to Google Drive
    const uploadedFile = await uploadFile(file.path, file.originalname);

    // Generate a public URL for the uploaded file
    const publicUrl = await generatePublicUrl(uploadedFile.id);

    // Store the file ID and URL in the stems table
    const [newStem] = await knex('stems')
      .insert({
        stem_name: file.originalname,
        url: publicUrl.webViewLink,
      })
      .returning(['id', 'stem_name', 'url']);

    res
      .status(201)
      .json({ message: 'File uploaded successfully', stem: newStem });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`We can hear you over on port ${port} 👂`);
});
