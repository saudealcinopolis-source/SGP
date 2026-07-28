/* ================================================================
   ROTAS DE OBSERVACOES E RELATORIOS (CORRIGIDO)
   ================================================================ */

var express = require('express');
var router = express.Router();
var db = require('../database');

router.post('/observacoes', function(req, res) {
    try {
        var body = req.body || {};
        if (!body.pacienteId || !body.texto) return res.status(400).json({ erro: 'Dados invalidos' });
        db.prepare('INSERT INTO observacoes (paciente_id, texto) VALUES (?, ?)').run([body.pacienteId, body.texto]);
        res.status(201).json({ sucesso: true });
    } catch (err) { res.status(500).json({ erro: err.message }); }
});

/* ----------------------------------------------------------------
   GET /api/extras/relatorio
   Retorna PROCEDIMENTOS filtrados (não pacientes)
   ---------------------------------------------------------------- */
router.get('/relatorio', function(req, res) {
    try {
        var tipo = req.query.tipo || '';
        var mes = req.query.mes || '';
        var ano = req.query.ano || '';
        var cidade = req.query.cidade || '';
        var status = req.query.status || '';
        var sistema = req.query.sistema || '';

        var sql = "SELECT d.*, p.nome, p.documento_tipo, p.documento_valor, p.cidade, p.telefone FROM demandas d INNER JOIN pacientes p ON p.id = d.paciente_id WHERE 1=1";
        var params = [];

        if (tipo === 'mensal' && mes && ano) {
            sql += " AND strftime('%m', d.data_entrada)=? AND strftime('%Y', d.data_entrada)=?";
            params.push(String(mes).padStart(2, '0'));
            params.push(String(ano));
        } else if (tipo === 'anual' && ano) {
            sql += " AND strftime('%Y', d.data_entrada)=?";
            params.push(String(ano));
        }
        if (cidade) { sql += ' AND p.cidade=?'; params.push(cidade); }
        if (status) { sql += ' AND d.status=?'; params.push(status); }
        if (sistema) { sql += ' AND d.sistema=?'; params.push(sistema); }
        sql += ' ORDER BY d.data_entrada DESC, d.id DESC';

        var stmtTag = db.prepare('SELECT * FROM tags WHERE paciente_id = ?');
        var procedimentos = db.prepare(sql).all(params) || [];

        var resultado = procedimentos.map(function(p) {
            return {
                id: p.id || 0,
                paciente_id: p.paciente_id || 0,
                nome: p.nome || '',
                documento_tipo: p.documento_tipo || '',
                documento_valor: p.documento_valor || '',
                data_entrada: p.data_entrada || '',
                cidade: p.cidade || '',
                telefone: p.telefone || '',
                especialidade: p.especialidade || '',
                procedimentos_desc: p.procedimentos || '',
                pedido_core: p.pedido_core || '',
                pedido_sisreg: p.pedido_sisreg || '',
                data_procedimento: p.data_procedimento || '',
                prioridade: p.prioridade || 'azul',
                status: p.status || 'aguardando',
                sistema: p.sistema || 'core',
                medico: p.medico || '',
                unidade: p.unidade || '',
                data_liberacao: p.data_liberacao || '',
                data_retorno: p.data_retorno || '',
                data_finalizacao: p.data_finalizacao || '',
                tags: stmtTag.all([p.paciente_id]) || []
            };
        });

        console.log('[Relatorio] Retornando', resultado.length, 'procedimentos');
        res.json(resultado);
    } catch (err) {
        console.error('[ERRO] Relatorio:', err);
        res.json([]);
    }
});

module.exports = router;