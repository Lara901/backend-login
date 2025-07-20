const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')
const dotenv = require('dotenv')


dotenv.config()
const app  = express()
const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(express.json());

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: true
    }

})

db.connect(err=>{
    if (err){
        console.error('Error de conexión a MySQL:', err);
    } else{
        console.log('Conexión a MySQL exitosa!');
    }
})

app.get('/', (req, res) => {
res.send('Servidor y base de datos funcionando');
});


app.post('/login', (req, res) => {
    const{ usuario, clave } = req.body;

    const sql = 'SELECT * FROM usuarios WHERE usuario = ? AND clave = ?';
    db.query(sql,[usuario, clave], (err, resultados) => {
        if (err)   console.error('Error en la consulta:', err);
        return res.status(500).json({mensaje: 'Error en el servidor'});
        if (resultados.length > 0){
            res.status(200).json({ mensaje: 'Acceso permitido', acceso: true});
        } else {
            res.status(401).json({ mensaje: 'Credenciales Inválidas'});
        }
    })
})


app.listen(PORT, ()=>{
    console.log('Servidor corriendo en el puerto ${PORT}');
});