import express from "express";
import cors from "cors";
import { google } from "googleapis";
import bodyParser from "body-parser";
import fs from "fs";

// CONFIGURACIÓN
const app = express();
const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = "1Ai06pOnxSwDWR_skjF4BL05V1jM-aXXeoi6Zl2QsQ8Q"; // ← Reemplaza por tu ID real
const SHEETS = ["BD", "Control_pacientes", "Flujo_de_caja", "INICIO"];
const USUARIOS_SHEET = "Usuarios";

// MIDDLEWARES
app.use(cors());
app.use(bodyParser.json());

// AUTENTICACIÓN GOOGLE SHEETS
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: "v4", auth });

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const spreadsheetId = "1Ai06pOnxSwDWR_skjF4BL05V1jM-aXXeoi6Zl2QsQ8Q";
    const range = "Usuarios!A2:B"; // Ajusta si tus columnas son A:usuario, B:contraseña

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;

    const { usuario, contrasena } = req.body;

    const usuarioValido = rows.find(
      ([u, c]) => u === usuario && c === contrasena
    );

    if (usuarioValido) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Credenciales inválidas" });
    }
  } catch (error) {
    console.error("Error al conectar con Google Sheets:", error);
    res.status(500).json({ error: "Error al conectar con Google Sheets" });
  }
});

// OBTENER TODOS LOS DATOS DE UNA HOJA
app.get("/hoja/:nombre", async (req, res) => {
  const nombre = req.params.nombre;
  if (!SHEETS.includes(nombre)) {
    return res.status(400).json({ error: "Hoja no permitida" });
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${nombre}`,
    });

    const [headers, ...rows] = response.data.values || [];
    const datos = rows.map((row) => {
      const obj = {};
      headers.forEach((col, i) => {
        obj[col] = row[i] || "";
      });
      return obj;
    });

    res.json(datos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener datos" });
  }
});

// OBTENER FILA POR ID
app.get("/hoja/:nombre/:id", async (req, res) => {
  const { nombre, id } = req.params;
  if (!SHEETS.includes(nombre)) {
    return res.status(400).json({ error: "Hoja no permitida" });
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${nombre}`,
    });

    const [headers, ...rows] = response.data.values;
    const idIndex = headers.indexOf("ID");
    const fila = rows.find((row) => row[idIndex] === id);

    if (!fila) return res.status(404).json({ error: "ID no encontrado" });

    const obj = {};
    headers.forEach((col, i) => {
      obj[col] = fila[i] || "";
    });

    res.json(obj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al buscar por ID" });
  }
});

// AGREGAR NUEVA FILA
app.post("/hoja/:nombre", async (req, res) => {
  const { nombre } = req.params;
  const datos = req.body;

  if (!SHEETS.includes(nombre)) {
    return res.status(400).json({ error: "Hoja no permitida" });
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${nombre}`,
    });

    const [headers] = response.data.values;
    const nuevaFila = headers.map((col) => datos[col] || "");

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${nombre}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [nuevaFila],
      },
    });

    res.status(201).json({ mensaje: "Agregado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al agregar fila" });
  }
});

// EDITAR FILA POR ID
app.put("/hoja/:nombre/:id", async (req, res) => {
  const { nombre, id } = req.params;
  const nuevosDatos = req.body;

  if (!SHEETS.includes(nombre)) {
    return res.status(400).json({ error: "Hoja no permitida" });
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${nombre}`,
    });

    const [headers, ...rows] = response.data.values;
    const idIndex = headers.indexOf("ID");
    const filaIndex = rows.findIndex((row) => row[idIndex] === id);

    if (filaIndex === -1) {
      return res.status(404).json({ error: "ID no encontrado" });
    }

    const filaNumero = filaIndex + 2;
    const valoresActualizados = headers.map((col) => nuevosDatos[col] || "");

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${nombre}!A${filaNumero}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [valoresActualizados],
      },
    });

    res.json({ mensaje: "Actualizado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar" });
  }
});

// ELIMINAR FILA POR ID
app.delete("/hoja/:nombre/:id", async (req, res) => {
  const { nombre, id } = req.params;

  if (!SHEETS.includes(nombre)) {
    return res.status(400).json({ error: "Hoja no permitida" });
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${nombre}`,
    });

    const [headers, ...rows] = response.data.values;
    const idIndex = headers.indexOf("ID");
    const filaIndex = rows.findIndex((row) => row[idIndex] === id);

    if (filaIndex === -1) {
      return res.status(404).json({ error: "ID no encontrado" });
    }

    const filaNumero = filaIndex + 2;

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${nombre}!A${filaNumero}:Z${filaNumero}`,
    });

    res.json({ mensaje: "Eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar" });
  }
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});