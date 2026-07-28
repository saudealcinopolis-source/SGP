/* ================================================================
   ROTAS DE RETORNOS
   ================================================================ */

var express = require('express');
var router = express.Router();
var db = require('../database');

router.post('/', function(req, res) {
    try {
        var body = req.body || {};
        var pacienteId = body.pacienteId;
        var data = body.data || new Date().toISOString().split('T')[0];
        var demandas = body.demandas || [];
        var observacao = body.observacao || '';

        if (!pacienteId) return res.status(400).json({ erro: 'ID do paciente e obrigatorio' });

        var paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get([pacienteId]);
        if (!paciente) return res.status(404).json({ erro: 'Paciente nao encontrado' });

        var count = db.prepare('SELECT COUNT(*) as total FROM retornos WHERE paciente_id = ?').get([pacienteId]);
        var numero = ((count && count.total) ? count.total : 0) + 1;

        var result = db.prepare('INSERT INTO retornos (paciente_id, numero, data_retorno, observacao) VALUES (?, ?, ?, ?)')
            .run([pacienteId, numero, data, observacao]);
        var retornoId = result.lastInsertRowid;

        if (Array.isArray(demandas) && demandas.length > 0) {
            for (var i = 0; i < demandas.length; i++) {
                var d = demandas[i];
                if (!d) continue;
                db.prepare('INSERT INTO demandas_retorno (retorno_id, especialidade, procedimentos, pedido_core, pedido_sisreg) VALUES (?, ?, ?, ?, ?)')
                    .run([retornoId, d.especialidade || '', d.procedimentos || '', d.pedidoCore || '', d.pedidoSisreg || '']);
            }
        }

        db.prepare("UPDATE pacientes SET status='retorno', data_retorno=?, data_atualizacao=datetime('now','localtime') WHERE id=?")
            .run([data, pacienteId]);
        db.prepare('INSERT INTO historico_status (paciente_id, status, retorno_numero) VALUES (?, ?, ?)')
            .run([pacienteId, 'retorno', numero]);

        if (Array.isArray(demandas) && demandas.length > 0) {
            db.prepare('DELETE FROM demandas WHERE paciente_id = ?').run([pacienteId]);
            for (var j = 0; j < demandas.length; j++) {
                var dd = demandas[j];
                if (!dd) continue;
                db.prepare('INSERT INTO demandas (paciente_id, especialidade, procedimentos, pedido_core, pedido_sisreg, data_procedimento) VALUES (?, ?, ?, ?, ?, ?)')
                    .run([pacienteId, dd.especialidade || '', dd.procedimentos || '', dd.pedidoCore || '', dd.pedidoSisreg || '', '']);
            }
        }

        res.status(201).json({ sucesso: true, retornoId: retornoId, numero: numero });
    } catch (err) {
        console.error('[ERRO] Adicionar retorno:', err);
        res.status(500).json({ erro: err.message });
    }
});

router.put('/:id/finalizar', function(req, res) {
    try {
        var retorno = db.prepare('SELECT * FROM retornos WHERE id = ?').get([req.params.id]);
        if (!retorno) return res.status(404).json({ erro: 'Retorno nao encontrado' });
        if (retorno.finalizado === 1) return res.status(400).json({ erro: 'Retorno ja finalizado' });

        var body = req.body || {};
        var dataFinalizacao = body.dataFinalizacao || new Date().toISOString().split('T')[0];

        db.prepare('UPDATE retornos SET finalizado=1, data_finalizacao=? WHERE id=?').run([dataFinalizacao, req.params.id]);
        db.prepare("UPDATE pacientes SET status='finalizado', data_finalizacao=?, data_atualizacao=datetime('now','localtime') WHERE id=?")
            .run([dataFinalizacao, retorno.paciente_id]);
        db.prepare('INSERT INTO historico_status (paciente_id, status, retorno_numero) VALUES (?, ?, ?)')
            .run([retorno.paciente_id, 'finalizado', retorno.numero]);

        res.json({ sucesso: true });
    } catch (err) {
        console.error('[ERRO] Finalizar retorno:', err);
        res.status(500).json({ erro: err.message });
    }
});

module.exports = router;