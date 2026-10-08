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
// 15mb (antes 5mb): los servicios contratados ahora pueden llevar adjuntos
// (PDF/PNG/JPG) en base64 dentro del payload -- el limite por archivo y la
// cantidad maxima de adjuntos se validan aparte en el controller.
app.use(express.json({ limit: '15mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ ok: true, servicio: 'horas-servicio-backend' }));

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
