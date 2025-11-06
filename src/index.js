import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors'; // Importa CORS

import authRoutes from './routes/auth.routes.js';
import plansRoutes from './routes/plans.routes.js';
import usersRoutes from './routes/users.routes.js';
import commandsRoutes from './routes/commands.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import captainsRoutes from './routes/captains.routes.js';
import customersRoutes from './routes/customers.routes.js';
import vesselsRoutes from './routes/vessels.routes.js';
import rolesRoutes from './routes/roles.routes.js';
import teamsRoutes from './routes/teams.routes.js';
import marinersRoutes from './routes/mariners.routes.js';
import brandingRoutes from './routes/branding.routes.js';
import servicesRoutes from './routes/services.routes.js';
import valuationsRoutes from './routes/valuations.routes.js';

const app = express();

app.use(express.json());

app.use(cors());


app.use('/api/auth', authRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/commands', commandsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/captains', captainsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/vessels', vesselsRoutes);
app.use('/api/mariners', marinersRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/valuations', valuationsRoutes);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use(express.static(path.join(__dirname, 'build')));

// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'build', 'index.html'));
// });




const port = process.env.PORT ? Number(process.env.PORT) : 5000;
app.listen(port, () => console.log('Server on port', port));
