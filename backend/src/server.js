require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Necesario detras del proxy de Render para que req.ip sea la IP real del
// cliente (si no, siempre seria la IP interna del proxy) -- usado por la
// auditoria de sesiones para geolocalizar cada login.
app.set('trust proxy', true);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
// 8mb: un adjunto de servicio (PDF/PNG/JPG) viaja en su propio POST, con
// un tope de ~7MB de texto base64 validado en el controller -- 8mb le deja
// margen para el resto del JSON sin volver a acercarse al limite viejo de
// 15mb (que existia solo porque el formulario completo podia llevar varios
// adjuntos embebidos a la vez).
app.use(express.json({ limit: '8mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ ok: true, servicio: 'horas-servicio-backend' }));

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
