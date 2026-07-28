/* ================================================================
   ROTAS DE BACKUP (.db) E IMPORTACAO (JSON)
   ================================================================ */

var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var multer = require('multer');
var db = require('../database');

var BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

router.get('/criar', function(req, res) {
    try {
        var DB_PATH = path.join(__dirname, '..', '..', 'dados', 'sgp.db');
        if (!fs.existsSync(DB_PATH)) return res.status(404).json({ erro: 'Banco nao encontrado' });
        var timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        var nomeArquivo = 'sgp_backup_' + timestamp + '.db';
        var destino = path.join(BACKUP_DIR, nomeArquivo);
        fs.copyFileSync(DB_PATH, destino);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="' + nomeArquivo + '"');
        res.sendFile(destino);
    } catch (err) {
        console.error('[ERRO] Backup:', err);
        res.status(500).json({ erro: 'Erro ao criar backup: ' + err.message });
    }
});

router.get('/listar', function(req, res) {
    try {
        var arquivos = fs.readdirSync(BACKUP_DIR)
            .filter(function(f) { return f.startsWith('sgp_backup_') && f.endsWith('.db'); })
            .sort().reverse()
            .map(function(f) {
                var stats = fs.statSync(path.join(BACKUP_DIR, f));
                return { nome: f, tamanho: (stats.size / 1024).toFixed(1) + ' KB', data: stats.mtime.toISOString() };
            });
        res.json(arquivos);
    } catch (err) { res.json([]); }
});

router.get('/baixar/:nome', function(req, res) {
    try {
        var nome = req.params.nome;
        if (nome.indexOf('..') !== -1 || nome.indexOf('/') !== -1 || nome.indexOf('\\') !== -1) {
            return res.status(400).json({ erro: 'Nome invalido' });
        }
        var caminho = path.join(BACKUP_DIR, nome);
        if (!fs.existsSync(caminho)) return res.status(404).json({ erro: 'Backup nao encontrado' });
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="' + nome + '"');
        res.sendFile(caminho);
    } catch (err) { res.status(500).json({ erro: 'Erro ao baixar backup' }); }
});

router.post('/restaurar', function(req, res) {
    var uploadHandler = multer({ dest: BACKUP_DIR }).single('backup');
    uploadHandler(req, res, function(err) {
        if (err) return res.status(500).json({ erro: 'Erro ao receber arquivo: ' + err.message });
        if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
        try {
            var DB_PATH = path.join(__dirname, '..', '..', 'dados', 'sgp.db');
            fs.copyFileSync(req.file.path, DB_PATH);
            fs.unlinkSync(req.file.path);
            res.json({ sucesso: true, mensagem: 'Backup restaurado! Reinicie o servidor.', precisaReiniciar: true });
        } catch (err) {
            console.error('[ERRO] Restaurar:', err);
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ erro: 'Erro ao restaurar: ' + err.message });
        }
    });
});

router.post('/importar-json', function(req, res) {
    try {
        var dados = req.body;
        if (!dados) return res.status(400).json({ erro: 'Nenhum dado enviado' });

        var pacientesImportar = [];
        if (Array.isArray(dados)) pacientesImportar = dados;
        else if (dados.pacientes && Array.isArray(dados.pacientes)) pacientesImportar = dados.pacientes;
        else return res.status(400).json({ erro: 'Formato nao reconhecido' });

        if (pacientesImportar.length === 0) return res.status(400).json({ erro: 'Nenhum paciente no arquivo' });

        var importados = 0, duplicados = 0, erros = 0;
        var stmtVerifica = db.prepare('SELECT id FROM pacientes WHERE documento_valor = ? AND documento_tipo = ?');
        var stmtInsert = db.prepare('INSERT INTO pacientes (nome, documento_tipo, documento_valor, data_entrada, cidade, prioridade, status, sistema, nome_mae, nascimento, telefone, telefone2, endereco, medico, unidade) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        var stmtHist = db.prepare('INSERT INTO historico_status (paciente_id, status) VALUES (?, ?)');

        for (var i = 0; i < pacientesImportar.length; i++) {
            var p = pacientesImportar[i];
            if (!p) continue;
            try {
                var docTipo = p.documento_tipo || (p.documento ? p.documento.tipo : 'cpf');
                var docValor = p.documento_valor || (p.documento ? p.documento.valor : '');
                var dataEntrada = p.data_entrada || p.data || new Date().toISOString().split('T')[0];

                if (docValor) {
                    var existente = stmtVerifica.get([docValor.replace(/\D/g, ''), docTipo]);
                    if (existente) { duplicados++; continue; }
                }

                var result = stmtInsert.run([
                    p.nome || '', docTipo, docValor, dataEntrada, p.cidade || '', p.prioridade || 'azul',
                    p.status || 'aguardando', p.sistema || 'core', p.nome_mae || '', p.nascimento || '',
                    p.telefone || '', p.telefone2 || '', p.endereco || '', p.medico || '', p.unidade || ''
                ]);

                var novoId = result.lastInsertRowid;
                stmtHist.run([novoId, p.status || 'aguardando']);

                if (p.demandas && Array.isArray(p.demandas)) {
                    var stmtDem = db.prepare('INSERT INTO demandas (paciente_id, especialidade, procedimentos, pedido_core, pedido_sisreg, data_procedimento) VALUES (?, ?, ?, ?, ?, ?)');
                    for (var j = 0; j < p.demandas.length; j++) {
                        var d = p.demandas[j];
                        if (!d) continue;
                        stmtDem.run([novoId, d.especialidade || '', d.procedimentos || '', d.pedidoCore || d.pedido_core || '', d.pedidoSisreg || d.pedido_sisreg || '', d.data_procedimento || '']);
                    }
                }
                importados++;
            } catch (e) { erros++; }
        }

        res.json({ sucesso: true, importados: importados, duplicados: duplicados, erros: erros, total: pacientesImportar.length });
    } catch (err) {
        console.error('[ERRO] Importar JSON:', err);
        res.status(500).json({ erro: 'Erro ao importar: ' + err.message });
    }
});

module.exports = router;
