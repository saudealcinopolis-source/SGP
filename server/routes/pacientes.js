var express = require('express');
var router = express.Router();
var db = require('../database');

function v(obj, chave, padrao) {
    if (!obj) return padrao;
    var val = obj[chave];
    return (val === undefined || val === null) ? padrao : val;
}

// Monta paciente COMPLETO com lista de procedimentos isolados
function montarPacienteCompleto(p) {
    if (!p) return null;
    var demandas = db.prepare('SELECT * FROM demandas WHERE paciente_id = ? ORDER BY data_entrada DESC, id DESC').all([p.id]) || [];
    var tags = db.prepare('SELECT * FROM tags WHERE paciente_id = ?').all([p.id]) || [];
    var observacoes = db.prepare('SELECT * FROM observacoes WHERE paciente_id = ? ORDER BY data_criacao DESC').all([p.id]) || [];
    var documentos = db.prepare('SELECT id, nome_original, tipo_mime, tamanho_bytes, data_upload FROM documentos WHERE paciente_id = ? ORDER BY data_upload DESC').all([p.id]) || [];

    return {
        id: p.id || 0,
        nome: p.nome || '',
        documento_tipo: p.documento_tipo || 'cpf',
        documento_valor: p.documento_valor || '',
        cidade: p.cidade || '',
        nome_mae: p.nome_mae || '',
        nascimento: p.nascimento || '',
        telefone: p.telefone || '',
        telefone2: p.telefone2 || '',
        endereco: p.endereco || '',
        data_cadastro: p.data_cadastro || '',
        demandas: demandas,
        tags: tags,
        observacoes: observacoes,
        documentos: documentos
    };
}

// Lista TODOS os procedimentos (não pacientes) - ideal para controle de atrasos
router.get('/', function(req, res) {
    try {
        var sql = "SELECT d.*, p.nome, p.documento_tipo, p.documento_valor, p.cidade, p.telefone, p.telefone2, p.nascimento, p.nome_mae, p.endereco FROM demandas d INNER JOIN pacientes p ON p.id = d.paciente_id ORDER BY d.data_entrada DESC, d.id DESC";
        var procedimentos = db.prepare(sql).all() || [];

        // Agrupa tags por paciente
        var stmtTags = db.prepare('SELECT * FROM tags WHERE paciente_id = ?');
        var resultado = procedimentos.map(function(proc) {
            return {
                id: proc.id,
                paciente_id: proc.paciente_id,
                nome: proc.nome,
                documento_tipo: proc.documento_tipo,
                documento_valor: proc.documento_valor,
                cidade: proc.cidade,
                telefone: proc.telefone,
                especialidade: proc.especialidade,
                procedimentos_desc: proc.procedimentos,
                pedido_core: proc.pedido_core,
                pedido_sisreg: proc.pedido_sisreg,
                data_procedimento: proc.data_procedimento,
                data_entrada: proc.data_entrada,
                prioridade: proc.prioridade,
                status: proc.status,
                sistema: proc.sistema,
                medico: proc.medico,
                unidade: proc.unidade,
                data_liberacao: proc.data_liberacao,
                data_retorno: proc.data_retorno,
                data_finalizacao: proc.data_finalizacao,
                tags: stmtTags.all([proc.paciente_id]) || []
            };
        });

        res.json(resultado);
    } catch (err) {
        console.error('[ERRO] Listar:', err);
        res.json([]);
    }
});

router.get('/:id', function(req, res) {
    try {
        var paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get([req.params.id]);
        if (!paciente) return res.status(404).json({ erro: 'Paciente nao encontrado' });
        res.json(montarPacienteCompleto(paciente));
    } catch (err) {
        res.status(500).json({ erro: 'Erro' });
    }
});

// Busca paciente por nome (autocompletar)
router.get('/buscar-nome', function(req, res) {
    try {
        var termo = (req.query.q || '').trim();
        if (termo.length < 2) return res.json([]);
        var pacientes = db.prepare(
            'SELECT * FROM pacientes WHERE nome LIKE ? ORDER BY nome LIMIT 10'
        ).all(['%' + termo + '%']) || [];
        res.json(pacientes.map(montarPacienteCompleto));
    } catch (err) {
        res.json([]);
    }
});

// Cria paciente + primeiro procedimento
router.post('/', function(req, res) {
    try {
        var d = req.body || {};
        if (!d.nome || !d.nome.trim()) return res.status(400).json({ erro: 'Nome obrigatorio' });

        var docValor = d.documento ? (d.documento.valor || '').replace(/\D/g, '') : '';
        var docTipo = d.documento ? (d.documento.tipo || 'cpf') : 'cpf';

        // Verifica se paciente já existe pelo documento
        var existente = null;
        if (docValor) {
            existente = db.prepare('SELECT id FROM pacientes WHERE documento_valor = ? AND documento_tipo = ?').get([docValor, docTipo]);
        }

        var pacienteId;

        if (existente) {
            // Paciente já existe → apenas adiciona novo procedimento
            pacienteId = existente.id;
        } else {
            // Cria novo paciente
            var resultPac = db.prepare(
                'INSERT INTO pacientes (nome, documento_tipo, documento_valor, cidade, nome_mae, nascimento, telefone, telefone2, endereco) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).run([
                d.nome, docTipo, docValor,
                d.cidade || '', d.nomeMae || '', d.nascimento || '',
                d.telefone || '', d.telefone2 || '', d.endereco || ''
            ]);
            pacienteId = resultPac.lastInsertRowid;
            if (!pacienteId || pacienteId === 0) {
                var fb = db.prepare('SELECT id FROM pacientes WHERE documento_valor = ?').get([docValor]);
                if (fb) pacienteId = fb.id;
            }
        }

        if (!pacienteId) return res.status(500).json({ erro: 'Nao foi possivel criar/recuperar paciente' });

        // Insere NOVO procedimento isolado
        var dem = d.demanda || {};
        var resultDem = db.prepare(
            'INSERT INTO demandas (paciente_id, especialidade, procedimentos, pedido_core, pedido_sisreg, data_procedimento, data_entrada, prioridade, status, sistema, medico, unidade) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run([
            pacienteId,
            dem.especialidade || '',
            dem.procedimentos || '',
            dem.pedidoCore || '',
            dem.pedidoSisreg || '',
            dem.dataProcedimento || '',
            dem.dataEntrada || new Date().toISOString().split('T')[0],
            dem.prioridade || 'azul',
            'aguardando',
            dem.sistema || 'core',
            dem.medico || '',
            dem.unidade || ''
        ]);

        var demandaId = resultDem.lastInsertRowid;
        db.prepare('INSERT INTO historico_status (demanda_id, status) VALUES (?, ?)').run([demandaId, 'aguardando']);

        if (d.tags && Array.isArray(d.tags)) {
            // Remove tags antigas e reinsere (tags são do paciente)
            db.prepare('DELETE FROM tags WHERE paciente_id = ?').run([pacienteId]);
            for (var i = 0; i < d.tags.length; i++) {
                db.prepare('INSERT INTO tags (paciente_id, nome, cor) VALUES (?, ?, ?)').run([pacienteId, d.tags[i].nome || '', d.tags[i].cor || 'azul']);
            }
        }

        var paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get([pacienteId]);
        var completo = montarPacienteCompleto(paciente);
        completo.novaDemandaId = demandaId;
        completo.pacienteExistente = !!existente;

        res.status(201).json({ sucesso: true, paciente: completo });
    } catch (err) {
        console.error('[ERRO] Criar:', err);
        res.status(500).json({ erro: err.message });
    }
});

// Atualiza DADOS PESSOAIS do paciente (não mexe em procedimentos)
router.put('/:id', function(req, res) {
    try {
        var id = Number(req.params.id);
        var d = req.body || {};
        var atual = db.prepare('SELECT * FROM pacientes WHERE id = ?').get([id]);
        if (!atual) return res.status(404).json({ erro: 'Paciente nao encontrado' });

        db.prepare(
            'UPDATE pacientes SET nome=?, documento_tipo=?, documento_valor=?, cidade=?, nome_mae=?, nascimento=?, telefone=?, telefone2=?, endereco=? WHERE id=?'
        ).run([
            d.nome || atual.nome,
            d.documento ? (d.documento.tipo || atual.documento_tipo) : atual.documento_tipo,
            d.documento ? ((d.documento.valor || '').replace(/\D/g, '')) : atual.documento_valor,
            d.cidade !== undefined ? d.cidade : atual.cidade,
            d.nomeMae !== undefined ? d.nomeMae : atual.nome_mae,
            d.nascimento !== undefined ? d.nascimento : atual.nascimento,
            d.telefone !== undefined ? d.telefone : atual.telefone,
            d.telefone2 !== undefined ? d.telefone2 : atual.telefone2,
            d.endereco !== undefined ? d.endereco : atual.endereco,
            id
        ]);

        if (d.tags && Array.isArray(d.tags)) {
            db.prepare('DELETE FROM tags WHERE paciente_id = ?').run([id]);
            for (var i = 0; i < d.tags.length; i++) {
                db.prepare('INSERT INTO tags (paciente_id, nome, cor) VALUES (?, ?, ?)').run([id, d.tags[i].nome || '', d.tags[i].cor || 'azul']);
            }
        }

        res.json({ sucesso: true, paciente: montarPacienteCompleto(db.prepare('SELECT * FROM pacientes WHERE id = ?').get([id])) });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// Adiciona NOVO procedimento a paciente existente
router.post('/:id/procedimento', function(req, res) {
    try {
        var id = Number(req.params.id);
        var paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get([id]);
        if (!paciente) return res.status(404).json({ erro: 'Paciente nao encontrado' });

        var dem = req.body || {};
        var result = db.prepare(
            'INSERT INTO demandas (paciente_id, especialidade, procedimentos, pedido_core, pedido_sisreg, data_procedimento, data_entrada, prioridade, status, sistema, medico, unidade) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run([
            id,
            dem.especialidade || '',
            dem.procedimentos || '',
            dem.pedidoCore || '',
            dem.pedidoSisreg || '',
            dem.dataProcedimento || '',
            dem.dataEntrada || new Date().toISOString().split('T')[0],
            dem.prioridade || 'azul',
            'aguardando',
            dem.sistema || 'core',
            dem.medico || '',
            dem.unidade || ''
        ]);

        db.prepare('INSERT INTO historico_status (demanda_id, status) VALUES (?, ?)').run([result.lastInsertRowid, 'aguardando']);
        res.status(201).json({ sucesso: true, demandaId: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// Atualiza STATUS/DADOS de um procedimento específico
router.put('/procedimento/:id', function(req, res) {
    try {
        var id = Number(req.params.id);
        var d = req.body || {};
        var atual = db.prepare('SELECT * FROM demandas WHERE id = ?').get([id]);
        if (!atual) return res.status(404).json({ erro: 'Procedimento nao encontrado' });

        db.prepare(
            "UPDATE demandas SET especialidade=?, procedimentos=?, pedido_core=?, pedido_sisreg=?, data_procedimento=?, prioridade=?, status=?, sistema=?, medico=?, unidade=?, data_liberacao=?, data_retorno=?, data_finalizacao=? WHERE id=?"
        ).run([
            d.especialidade !== undefined ? d.especialidade : atual.especialidade,
            d.procedimentos !== undefined ? d.procedimentos : atual.procedimentos,
            d.pedidoCore !== undefined ? d.pedidoCore : atual.pedido_core,
            d.pedidoSisreg !== undefined ? d.pedidoSisreg : atual.pedido_sisreg,
            d.dataProcedimento !== undefined ? d.dataProcedimento : atual.data_procedimento,
            d.prioridade || atual.prioridade,
            d.status || atual.status,
            d.sistema || atual.sistema,
            d.medico !== undefined ? d.medico : atual.medico,
            d.unidade !== undefined ? d.unidade : atual.unidade,
            d.dataLiberacao !== undefined ? d.dataLiberacao : atual.data_liberacao,
            d.dataRetorno !== undefined ? d.dataRetorno : atual.data_retorno,
            d.dataFinalizacao !== undefined ? d.dataFinalizacao : atual.data_finalizacao,
            id
        ]);

        if (d.status && d.status !== atual.status) {
            db.prepare('INSERT INTO historico_status (demanda_id, status) VALUES (?, ?)').run([id, d.status]);
        }

        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

router.delete('/procedimento/:id', function(req, res) {
    try {
        var result = db.prepare('DELETE FROM demandas WHERE id = ?').run([req.params.id]);
        res.json({ sucesso: result.changes > 0 });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

router.delete('/:id', function(req, res) {
    try {
        var result = db.prepare('DELETE FROM pacientes WHERE id = ?').run([req.params.id]);
        res.json({ sucesso: result.changes > 0 });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// Stats por PROCEDIMENTO
router.get('/stats/dashboard', function(req, res) {
    var vazio = { total: 0, aguardando: 0, liberado: 0, retorno: 0, finalizado: 0, tempoMedio: 0, taxaConclusao: 0, atencao: 0, prioridade: { azul: 0, verde: 0, amarelo: 0, vermelho: 0 }, sistema: { core: 0, sisreg: 0, ambos: 0 }, porMes: [], porCidade: [] };
    try {
        var s = db.prepare(
            "SELECT COUNT(*) as total, " +
            "SUM(CASE WHEN status='aguardando' THEN 1 ELSE 0 END) as aguardando, " +
            "SUM(CASE WHEN status='liberado' THEN 1 ELSE 0 END) as liberado, " +
            "SUM(CASE WHEN status='retorno' THEN 1 ELSE 0 END) as retorno, " +
            "SUM(CASE WHEN status='finalizado' THEN 1 ELSE 0 END) as finalizado, " +
            "SUM(CASE WHEN prioridade='azul' THEN 1 ELSE 0 END) as prio_azul, " +
            "SUM(CASE WHEN prioridade='verde' THEN 1 ELSE 0 END) as prio_verde, " +
            "SUM(CASE WHEN prioridade='amarelo' THEN 1 ELSE 0 END) as prio_amarelo, " +
            "SUM(CASE WHEN prioridade='vermelho' THEN 1 ELSE 0 END) as prio_vermelho, " +
            "SUM(CASE WHEN sistema='core' THEN 1 ELSE 0 END) as sis_core, " +
            "SUM(CASE WHEN sistema='sisreg' THEN 1 ELSE 0 END) as sis_sisreg, " +
            "SUM(CASE WHEN sistema='ambos' THEN 1 ELSE 0 END) as sis_ambos " +
            "FROM demandas"
        ).get() || {};

        var tm = db.prepare("SELECT AVG(julianday('now','localtime') - julianday(data_entrada)) as media FROM demandas WHERE status != 'finalizado' AND data_entrada != ''").get() || {};
        var at = db.prepare("SELECT COUNT(*) as total FROM demandas WHERE status != 'finalizado' AND julianday('now','localtime') - julianday(data_entrada) > 30").get() || {};

        var porMes = db.prepare("SELECT strftime('%Y-%m', data_entrada) as mes, COUNT(*) as total FROM demandas WHERE data_entrada != '' AND data_entrada >= date('now','localtime','-6 months') GROUP BY mes ORDER BY mes").all() || [];
        var porCidade = db.prepare("SELECT p.cidade, COUNT(*) as total FROM demandas d INNER JOIN pacientes p ON p.id = d.paciente_id WHERE p.cidade != '' GROUP BY p.cidade ORDER BY total DESC LIMIT 10").all() || [];

        var totalPac = s.total || 0;
        var totalFin = s.finalizado || 0;

        res.json({
            total: totalPac, aguardando: s.aguardando || 0, liberado: s.liberado || 0,
            retorno: s.retorno || 0, finalizado: totalFin,
            tempoMedio: Math.round(tm.media || 0),
            taxaConclusao: totalPac > 0 ? Math.round((totalFin / totalPac) * 100) : 0,
            atencao: at.total || 0,
            prioridade: { azul: s.prio_azul || 0, verde: s.prio_verde || 0, amarelo: s.prio_amarelo || 0, vermelho: s.prio_vermelho || 0 },
            sistema: { core: (s.sis_core || 0) + (s.sis_ambos || 0), sisreg: (s.sis_sisreg || 0) + (s.sis_ambos || 0), ambos: s.sis_ambos || 0 },
            porMes: porMes, porCidade: porCidade
        });
    } catch (err) {
        console.error('[Stats]', err);
        res.json(vazio);
    }
});

router.get('/alertas/lista', function(req, res) {
    try {
        var a30 = db.prepare("SELECT d.*, p.nome FROM demandas d INNER JOIN pacientes p ON p.id = d.paciente_id WHERE d.status='aguardando' AND julianday('now','localtime') - julianday(d.data_entrada) > 30 ORDER BY d.data_entrada ASC").all() || [];
        var em = db.prepare("SELECT d.*, p.nome FROM demandas d INNER JOIN pacientes p ON p.id = d.paciente_id WHERE d.prioridade='vermelho' AND d.status != 'finalizado' ORDER BY d.data_entrada ASC").all() || [];
        var rp = db.prepare("SELECT d.*, p.nome FROM demandas d INNER JOIN pacientes p ON p.id = d.paciente_id WHERE d.status='retorno' ORDER BY d.data_entrada ASC").all() || [];
        res.json({ alerta30dias: a30, emergencias: em, retornosPendentes: rp, total: a30.length + em.length + rp.length });
    } catch (err) {
        res.json({ alerta30dias: [], emergencias: [], retornosPendentes: [], total: 0 });
    }
});

router.get('/listas/cidades', function(req, res) {
    try { res.json((db.prepare("SELECT DISTINCT cidade FROM pacientes WHERE cidade != '' ORDER BY cidade").all() || []).map(function(c) { return c.cidade; })); } catch (e) { res.json([]); }
});
router.get('/listas/especialidades', function(req, res) {
    try { res.json((db.prepare("SELECT DISTINCT especialidade FROM demandas WHERE especialidade != '' ORDER BY especialidade").all() || []).map(function(e) { return e.especialidade; })); } catch (e) { res.json([]); }
});
router.get('/listas/tags', function(req, res) {
    try { res.json(db.prepare("SELECT DISTINCT nome, cor FROM tags ORDER BY nome").all() || []); } catch (e) { res.json([]); }
});

module.exports = router;