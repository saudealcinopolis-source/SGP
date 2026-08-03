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
        res.status(500).json({ erro: err.message });
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
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/restaurar', function(req, res) {
    var uploadHandler = multer({ dest: BACKUP_DIR }).single('backup');
    uploadHandler(req, res, function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
        try {
            var DB_PATH = path.join(__dirname, '..', '..', 'dados', 'sgp.db');
            fs.copyFileSync(req.file.path, DB_PATH);
            fs.unlinkSync(req.file.path);
            res.json({ sucesso: true, mensagem: 'Backup restaurado! Reinicie o servidor.', precisaReiniciar: true });
        } catch (err) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ erro: err.message });
        }
    });
});

// Importação MELHORADA - puxa TODOS os pacientes do sistema antigo
router.post('/importar-json', function(req, res) {
    try {
        var dados = req.body;
        if (!dados) return res.status(400).json({ erro: 'Nenhum dado enviado' });

        var pacientesImportar = [];
        if (Array.isArray(dados)) pacientesImportar = dados;
        else if (dados.pacientes && Array.isArray(dados.pacientes)) pacientesImportar = dados.pacientes;
        else return res.status(400).json({ erro: 'Formato nao reconhecido' });

        if (pacientesImportar.length === 0) return res.status(400).json({ erro: 'Nenhum paciente no arquivo' });

        var importados = 0, duplicados = 0, erros = 0, procedimentos = 0;
        var stmtVerifica = db.prepare('SELECT id FROM pacientes WHERE documento_valor = ? AND documento_tipo = ?');
        var stmtPac = db.prepare('INSERT INTO pacientes (nome, documento_tipo, documento_valor, cidade, nome_mae, nascimento, telefone, telefone2, endereco) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        var stmtDem = db.prepare('INSERT INTO demandas (paciente_id, especialidade, procedimentos, pedido_core, pedido_sisreg, data_procedimento, data_entrada, prioridade, status, sistema, medico, unidade, cidade_destino) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        var stmtTag = db.prepare('INSERT INTO tags (paciente_id, nome, cor) VALUES (?, ?, ?)');
        var stmtHist = db.prepare('INSERT INTO historico_status (demanda_id, status) VALUES (?, ?)');

        for (var i = 0; i < pacientesImportar.length; i++) {
            var p = pacientesImportar[i];
            if (!p) continue;
            
            try {
                var docTipo = p.documento_tipo || (p.documento ? p.documento.tipo : 'cpf') || 'cpf';
                var docValor = p.documento_valor || (p.documento ? p.documento.valor : '') || '';
                var cidadeOrigem = p.cidade || p.cidade_origem || '';

                // Verifica duplicata por documento
                var pacienteId = null;
                if (docValor) {
                    var existente = stmtVerifica.get([docValor.replace(/\D/g, ''), docTipo]);
                    if (existente) {
                        pacienteId = existente.id;
                        duplicados++;
                    }
                }

                // Se não existe, cria paciente
                if (!pacienteId) {
                    var resultPac = stmtPac.run([
                        p.nome || '', docTipo, docValor,
                        cidadeOrigem,
                        p.nome_mae || p.nomeMae || '',
                        p.nascimento || '',
                        p.telefone || '',
                        p.telefone2 || '',
                        p.endereco || ''
                    ]);
                    pacienteId = resultPac.lastInsertRowid;
                    importados++;
                }

                if (!pacienteId) continue;

                // Importa demandas/procedimentos
                var demandas = p.demandas || [];
                
                // Se não tem demandas mas tem dados de procedimento no paciente, cria uma
                if (demandas.length === 0 && (p.especialidade || p.status)) {
                    demandas = [{
                        especialidade: p.especialidade || '',
                        procedimentos: p.procedimentos || '',
                        pedido_core: p.pedido_core || p.pedidoCore || '',
                        pedido_sisreg: p.pedido_sisreg || p.pedidoSisreg || '',
                        data_procedimento: p.data_procedimento || p.dataProcedimento || '',
                        data_entrada: p.data_entrada || p.data || '',
                        prioridade: p.prioridade || 'azul',
                        status: p.status || 'aguardando',
                        sistema: p.sistema || 'core',
                        medico: p.medico || '',
                        unidade: p.unidade || '',
                        cidade_destino: p.cidade_destino || p.cidadeDestino || cidadeOrigem
                    }];
                }

                for (var j = 0; j < demandas.length; j++) {
                    var d = demandas[j];
                    if (!d) continue;
                    
                    var cidadeDestino = d.cidade_destino || d.cidadeDestino || p.cidade_destino || cidadeOrigem;
                    
                    try {
                        var resultDem = stmtDem.run([
                            pacienteId,
                            d.especialidade || '',
                            d.procedimentos || '',
                            d.pedido_core || d.pedidoCore || '',
                            d.pedido_sisreg || d.pedidoSisreg || '',
                            d.data_procedimento || d.dataProcedimento || '',
                            d.data_entrada || d.dataEntrada || p.data_entrada || p.data || new Date().toISOString().split('T')[0],
                            d.prioridade || 'azul',
                            d.status || 'aguardando',
                            d.sistema || 'core',
                            d.medico || '',
                            d.unidade || '',
                            cidadeDestino
                        ]);
                        stmtHist.run([resultDem.lastInsertRowid, d.status || 'aguardando']);
                        procedimentos++;
                    } catch (eDem) {
                        console.error('[IMPORT] Erro demanda:', eDem.message);
                    }
                }

                // Importa tags
                if (p.tags && Array.isArray(p.tags)) {
                    for (var k = 0; k < p.tags.length; k++) {
                        var t = p.tags[k];
                        if (!t) continue;
                        try { stmtTag.run([pacienteId, t.nome || '', t.cor || 'azul']); } catch (eTag) {}
                    }
                }
            } catch (e) {
                console.error('[IMPORT] Erro paciente:', p.nome, e.message);
                erros++;
            }
        }

        res.json({ 
            sucesso: true, 
            importados: importados, 
            duplicados: duplicados, 
            erros: erros, 
            procedimentos: procedimentos,
            total: pacientesImportar.length 
        });
    } catch (err) {
        console.error('[ERRO] Importar JSON:', err);
        res.status(500).json({ erro: err.message });
    }
});

module.exports = router;