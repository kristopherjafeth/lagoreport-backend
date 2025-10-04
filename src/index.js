import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors'; // Importa CORS

import greenhousesRoutes from './routes/greenhouses.routes.js';
import authRoutes from './routes/auth.routes.js';
import plansRoutes from './routes/plans.routes.js';
import usersRoutes from './routes/users.routes.js';
import commandsRoutes from './routes/commands.routes.js';

const app = express();

app.use(express.json());

app.use(cors());


app.use('/api', greenhousesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/commands', commandsRoutes);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'build')));

// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'build', 'index.html'));
// });




const port = 5000;
app.listen(port, () => console.log('Server on port', port));
