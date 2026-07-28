/* ================================================================
   ROTAS DE DOCUMENTOS E UPLOAD
   ================================================================ */

var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var uuidv4 = require('uuid').v4;
var db = require('../database');

var uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

var storage = multer.diskStorage({
    destination: function(req, file, cb) { cb(null, uploadsDir); },
    filename: function(req, file, cb) { cb(null, uuidv4() + path.extname(file.originalname)); }
});

var upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: function(req, file, cb) {
        var permitidos = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        var ok = permitidos.indexOf(file.mimetype) !== -1;
        cb(ok ? null : new Error('Tipo nao permitido'), ok);
    }
});

router.post('/upload/:pacienteId', upload.single('documento'), function(req, res) {
    try {
        if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
        var paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get([req.params.pacienteId]);
        if (!paciente) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ erro: 'Paciente nao encontrado' });
        }
        db.prepare('INSERT INTO documentos (paciente_id, nome_original, nome_arquivo, tipo_mime, tamanho_bytes) VALUES (?, ?, ?, ?, ?)')
            .run([req.params.pacienteId, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size]);
        res.status(201).json({ sucesso: true, arquivo: req.file.filename, nome: req.file.originalname });
    } catch (err) {
        console.error('[ERRO] Upload documento:', err);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ erro: 'Erro ao fazer upload do documento' });
    }
});

router.get('/download/:filename', function(req, res) {
    var filePath = path.join(uploadsDir, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ erro: 'Arquivo nao encontrado' });
    res.sendFile(filePath);
});

router.delete('/:id', function(req, res) {
    try {
        var doc = db.prepare('SELECT * FROM documentos WHERE id = ?').get([req.params.id]);
        if (!doc) return res.status(404).json({ erro: 'Documento nao encontrado' });
        var filePath = path.join(uploadsDir, doc.nome_arquivo);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        db.prepare('DELETE FROM documentos WHERE id = ?').run([req.params.id]);
        res.json({ sucesso: true });
    } catch (err) {
        console.error('[ERRO] Remover documento:', err);
        res.status(500).json({ erro: 'Erro ao remover documento' });
    }
});

module.exports = router;