const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const spreadsheetId = '1Ai06pOnxSwDWR_skjF4BL05V1jM-aXXeoi6Zl2QsQ8Q'; // Tu ID de hoja de cálculo
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getClient() {
  return await auth.getClient();
}

// Obtener datos de una hoja específica
app.get('/:hoja', async (req, res) => {
  const hoja = req.params.hoja;
  try {
    const client = await getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const range = `${hoja}!A1:Z1000`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    res.json(response.data.values);
  } catch (err) {
    console.error('Error GET:', err);
    res.status(500).json({ error: 'Error al obtener los datos' });
  }
});

// Agregar fila a una hoja específica
app.post('/:hoja', async (req, res) => {
  const hoja = req.params.hoja;
  const valores = Object.values(req.body);
  try {
    const client = await getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${hoja}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [valores],
      },
    });

    res.json({ mensaje: 'Fila agregada con éxito' });
  } catch (err) {
    console.error('Error POST:', err);
    res.status(500).json({ error: 'Error al agregar la fila' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});