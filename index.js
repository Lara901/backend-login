import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { google } from 'googleapis';
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

// ------------------ CONEXIÓN MYSQL ------------------
const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// ------------------ CONEXIÓN GOOGLE SHEETS ------------------
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = '1Ai06pOnxSwDWR_skjF4BL05V1jM-aXXeoi6Zl2QsQ8Q'; // Cambia por tu ID real

// ------------------ LOGIN MYSQL ------------------
app.post('/login', async (req, res) => {
  const { usuario, clave } = req.body;
  if (!usuario || !clave) return res.status(400).json({ error: 'Faltan campos' });

  try {
    const [rows] = await db.execute(
      'SELECT * FROM usuarios WHERE usuario = ? AND clave = ?',
      [usuario, clave]
    );

    if (rows.length > 0) {
      res.json({ success: true, usuario: rows[0] });
    } else {
      res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
  } catch (error) {
    console.error('Error en /login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ------------------ GET: Obtener todos los registros ------------------
app.get('/hoja/:nombre', async (req, res) => {
  const sheetName = req.params.nombre;

  try {
    const range = `${sheetName}!A1:Z`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const [headers, ...rows] = response.data.values || [];

    const data = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] || '';
      });
      return obj;
    });

    res.json(data);
  } catch (error) {
    console.error('Error al leer hoja:', error);
    res.status(500).json({ error: 'Error al leer datos' });
  }
});

// ------------------ POST: Crear nuevo registro (con generación automática de ID) ------------------
app.post('/hoja/:nombre', async (req, res) => {
  const sheetName = req.params.nombre;
  const newData = req.body;

  try {
    // Obtener encabezados
    const headerRange = `${sheetName}!A1:Z1`;
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: headerRange,
    });

    const headers = headerResponse.data.values[0];

    // Obtener filas actuales
    const allRange = `${sheetName}!A2:A`;
    const idResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: allRange,
    });

    const idColumn = idResponse.data.values || [];

    let nuevoID = 1;

    if (!newData.ID) {
      const numericIDs = idColumn
        .map(row => parseInt(row[0]))
        .filter(num => !isNaN(num));

      const maxID = numericIDs.length ? Math.max(...numericIDs) : 0;
      nuevoID = maxID + 1;
      newData.ID = nuevoID.toString(); // Asegurar que sea string
    }

    // Crear la nueva fila con todos los encabezados
    const newRow = headers.map(header => newData[header] || '');

    const appendRange = `${sheetName}!A:Z`;

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: appendRange,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [newRow],
      },
    });

    res.json({ message: 'Fila insertada correctamente', id: newData.ID });
  } catch (error) {
    console.error('Error al insertar:', error);
    res.status(500).json({ error: 'Error al insertar la fila' });
  }
});
// ------------------ PUT: Editar por ID ------------------
app.put('/hoja/:nombre/:id', async (req, res) => {
  const sheetName = req.params.nombre;
  const id = req.params.id;
  const updateData = req.body;

  try {
    const range = `${sheetName}!A1:Z`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const [headers, ...rows] = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === id);
    if (rowIndex === -1) return res.status(404).json({ error: 'ID no encontrado' });

    const updatedRow = headers.map(header => updateData[header] || '');
    const updateRange = `${sheetName}!A${rowIndex + 2}:Z${rowIndex + 2}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: updateRange,
      valueInputOption: 'RAW',
      requestBody: { values: [updatedRow] },
    });

    res.json({ message: 'Fila actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar:', error);
    res.status(500).json({ error: 'Error al actualizar la fila' });
  }
});

// ------------------ DELETE: Eliminar por ID ------------------
app.delete('/hoja/:nombre/:id', async (req, res) => {
  const sheetName = req.params.nombre;
  const id = req.params.id;

  try {
    const range = `${sheetName}!A1:Z`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const [headers, ...rows] = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === id);
    if (rowIndex === -1) return res.status(404).json({ error: 'ID no encontrado' });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0, // Por defecto. Para otras hojas, reemplazar con su ID real
                dimension: 'ROWS',
                startIndex: rowIndex + 1,
                endIndex: rowIndex + 2,
              },
            },
          },
        ],
      },
    });

    res.json({ message: 'Fila eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar fila:', error);
    res.status(500).json({ error: 'Error al eliminar la fila' });
  }
});

// ------------------ INICIAR SERVIDOR ------------------
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
// Obtener un solo registro por ID
app.get('/hoja/:sheetName/:id', async (req, res) => {
  const { sheetName, id } = req.params;

  try {
    const range = `${sheetName}!A1:Z`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const [headers, ...rows] = response.data.values || [];
    const row = rows.find((row) => row[0] === id);
    if (!row) return res.status(404).json({ error: 'ID no encontrado' });

    const rowData = {};
    headers.forEach((header, index) => {
      rowData[header] = row[index] || '';
    });

    res.json(rowData);
  } catch (error) {
    console.error('Error al buscar ID en hoja:', sheetName, error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});