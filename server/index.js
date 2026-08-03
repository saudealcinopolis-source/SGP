/* ================================================================
   SERVIDOR PRINCIPAL DO SGP
   ================================================================ */

var express = require('express');
var cors = require('cors');
var path = require('path');
var database = require('./database');

var app = express();
var PORT = process.env.PORT || 3300;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

async function iniciarServidor() {
    try {
        await database.init();

        app.use('/api/pacientes', require('./routes/pacientes'));
        app.use('/api/retornos', require('./routes/retornos'));
        app.use('/api/documentos', require('./routes/documentos'));
        app.use('/api/extras', require('./routes/extras'));
        app.use('/api/backup', require('./routes/backup'));

        app.get('*', function(req, res) {
            res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
        });

        app.use(function(err, req, res, next) {
            console.error('[ERRO GLOBAL]', err);
            res.status(500).json({ erro: 'Erro interno do servidor' });
        });

        app.listen(PORT, function() {
            console.log('');
            console.log('============================================');
            console.log('  SGP - Sistema de Gerenciamento de Pacientes');
            console.log('============================================');
            console.log('  URL: http://localhost:' + PORT);
            console.log('  Pressione Ctrl+C para parar');
            console.log('============================================');
            console.log('');
        });
    } catch (err) {
        console.error('[FATAL] Erro ao iniciar:', err);
        process.exit(1);
    }
}

iniciarServidor();