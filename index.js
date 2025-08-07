import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import credentials from './credenciales.json' assert { type: "json" };

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

// --------------------- CONEXIÓN MYSQL (RAILWAY) ---------------------
const db = await mysql.createConnection({
  host: process.env.DB_HOST,     // De Railway
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// --------------------- CONEXIÓN GOOGLE SHEETS ---------------------
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = '1Ai06pOnxSwDWR_skjF4BL05V1jM-aXXeoi6Zl2QsQ8Q';

// --------------------- LOGIN MYSQL ---------------------
app.post('/login', async (req, res) => {
  const { usuario, clave } = req.body;
  if (!usuario || !clave)
    return res.status(400).json({ error: 'Faltan campos' });

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

// --------------------- CRUD DE GOOGLE SHEETS ---------------------
app.get('/usuarios', async (req, res) => {
  try {
    const sheetName = 'usuarios';
    const range = `${sheetName}!A1:Z`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const [headers, ...rows] = response.data.values || [];

    const data = rows.map((row) => {
      const rowObject = {};
      headers.forEach((header, index) => {
        rowObject[header] = row[index] || '';
      });
      return rowObject;
    });

    res.json(data);
  } catch (error) {
    console.error('Error al obtener datos:', error);
    res.status(500).json({ error: 'Error al obtener los datos' });
  }
});

app.put('/usuarios/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;
    const sheetName = 'usuarios';
    const range = `${sheetName}!A1:Z`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const [headers, ...rows] = response.data.values || [];

    const rowIndex = rows.findIndex((row) => row[0] === id);
    if (rowIndex === -1) return res.status(404).json({ error: 'ID no encontrado' });

    // Actualizar valores en esa fila
    const updatedRow = headers.map((header) => updateData[header] || '');
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

app.delete('/usuarios/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const sheetName = 'usuarios';
    const range = `${sheetName}!A1:Z`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const [headers, ...rows] = response.data.values || [];

    const rowIndex = rows.findIndex((row) => row[0] === id);
    if (rowIndex === -1) return res.status(404).json({ error: 'ID no encontrado' });

    // Borrar la fila (shift)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0, // ⚠️ ID de la hoja, no del documento. Necesitamos verificarlo.
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
    console.error('Error al eliminar:', error);
    res.status(500).json({ error: 'Error al eliminar la fila' });
  }
});

// --------------------- LEVANTAR SERVIDOR ---------------------
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});