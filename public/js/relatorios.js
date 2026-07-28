/* ================================================================
   RELATORIOS - Tela + PDF + CSV (CORRIGIDO)
   ================================================================ */

var RelatorioManager = (function() {
    var LABELS = {
        prioridade: { azul: 'Nao Urgente', verde: 'Pouco Urgente', amarelo: 'Urgencia', vermelho: 'Emergencia' },
        status: { aguardando: 'Aguardando', liberado: 'Liberado', retorno: 'Em Retorno', finalizado: 'Finalizado' }
    };
    var MESES_FULL = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    function _formatarData(data) {
        if (!data) return '-';
        var p = data.split('-');
        if (p.length !== 3) return data;
        return p[2] + '/' + p[1] + '/' + p[0];
    }

    function _calcularStats(procedimentos) {
        var lista = procedimentos || [];
        return {
            total: lista.length,
            aguardando: lista.filter(function(p) { return p && p.status === 'aguardando'; }).length,
            liberado: lista.filter(function(p) { return p && p.status === 'liberado'; }).length,
            retorno: lista.filter(function(p) { return p && p.status === 'retorno'; }).length,
            finalizado: lista.filter(function(p) { return p && p.status === 'finalizado'; }).length
        };
    }

    return {
        LABELS: LABELS,

        exibirRelatorio: function(procedimentos, tipo, mes, ano, cidade, status, sistema) {
            var div = document.getElementById('resultado-relatorio');
            if (!div) return;
            var stats = _calcularStats(procedimentos);
            var titulo = tipo === 'mensal' ? 'Relatorio Mensal - ' + (MESES_FULL[parseInt(mes) - 1] || '') + '/' + ano : 'Relatorio Anual - ' + ano;
            var filtrosTexto = [];
            if (cidade) filtrosTexto.push('Cidade: ' + cidade);
            if (status) filtrosTexto.push('Status: ' + (LABELS.status[status] || status));
            if (sistema) filtrosTexto.push('Sistema: ' + sistema);

            if (!procedimentos || !procedimentos.length) {
                div.innerHTML = '<div class="mensagem-vazia"><div class="icone-vazio">😕</div><p>Nenhum procedimento encontrado para os filtros selecionados.</p><p style="font-size:.85em;margin-top:10px;">Verifique se existem cadastros no periodo escolhido.</p></div>';
                return;
            }

            var html = '<div style="margin-bottom:20px;"><h3 style="font-size:1.3em;margin-bottom:5px;">📊 ' + titulo + '</h3>';
            if (filtrosTexto.length) html += '<p style="color:var(--color-text-light);font-size:.9em;">' + filtrosTexto.join(' | ') + '</p>';
            html += '<p style="color:var(--color-text-light);font-size:.85em;margin-top:5px;">Total: <strong>' + stats.total + '</strong> | Aguardando: ' + stats.aguardando + ' | Liberados: ' + stats.liberado + ' | Retorno: ' + stats.retorno + ' | Finalizados: ' + stats.finalizado + '</p></div>';
            
            html += '<div class="tabela-container"><table><thead><tr><th>Paciente</th><th>Doc</th><th>Especialidade</th><th>Entrada</th><th>Data Proc.</th><th>Cidade</th><th>Prioridade</th><th>Status</th><th>Sistema</th></tr></thead><tbody>';

            for (var i = 0; i < procedimentos.length; i++) {
                var p = procedimentos[i];
                if (!p) continue;
                var doc = p.documento_valor ? ((p.documento_tipo || '').toUpperCase() + ': ' + p.documento_valor) : '-';
                html += '<tr>';
                html += '<td>' + (p.nome || '-') + '</td>';
                html += '<td style="font-size:.82em;">' + doc + '</td>';
                html += '<td><strong>' + (p.especialidade || '-') + '</strong></td>';
                html += '<td>' + _formatarData(p.data_entrada) + '</td>';
                html += '<td>' + _formatarData(p.data_procedimento) + '</td>';
                html += '<td>' + (p.cidade || '-') + '</td>';
                html += '<td><span class="prioridade-badge prioridade-' + (p.prioridade || '') + '">' + (LABELS.prioridade[p.prioridade] || '') + '</span></td>';
                html += '<td><span class="status-badge status-' + (p.status || '') + '">' + (LABELS.status[p.status] || p.status || '') + '</span></td>';
                html += '<td>' + (p.sistema || '-') + '</td>';
                html += '</tr>';
            }

            html += '</tbody></table></div>';
            div.innerHTML = html;
        },

                gerarPdfRelatorio: function(procedimentos, tipo, mes, ano, cidade, status, sistema) {
            var area = document.getElementById('area-impressao');
            if (!area) { alert('Erro: elemento #area-impressao nao encontrado no HTML'); return; }
            
            if (!procedimentos || !procedimentos.length) {
                alert('Nenhum procedimento para gerar PDF. Verifique os filtros.');
                return;
            }

            var stats = _calcularStats(procedimentos);
            var titulo = tipo === 'mensal' ? 'Relatorio Mensal - ' + (MESES_FULL[parseInt(mes) - 1] || '') + '/' + ano : 'Relatorio Anual - ' + ano;
            var filtrosTexto = [];
            if (cidade) filtrosTexto.push('Cidade: ' + cidade);
            if (status) filtrosTexto.push('Status: ' + (LABELS.status[status] || status));
            if (sistema) filtrosTexto.push('Sistema: ' + sistema);

            var html = '<div class="ficha-pdf">';
            html += '<h1>SGP - ' + titulo + '</h1>';
            html += '<div class="subtitulo">Gerado em: ' + new Date().toLocaleString('pt-BR');
            if (filtrosTexto.length) html += ' | ' + filtrosTexto.join(' | ');
            html += '</div>';

            html += '<h2>Resumo</h2>';
            html += '<div class="ficha-grid">';
            html += '<div class="ficha-campo"><label>TOTAL</label><span>' + stats.total + '</span></div>';
            html += '<div class="ficha-campo"><label>AGUARDANDO</label><span>' + stats.aguardando + '</span></div>';
            html += '<div class="ficha-campo"><label>LIBERADOS</label><span>' + stats.liberado + '</span></div>';
            html += '<div class="ficha-campo"><label>EM RETORNO</label><span>' + stats.retorno + '</span></div>';
            html += '<div class="ficha-campo"><label>FINALIZADOS</label><span>' + stats.finalizado + '</span></div>';
            html += '<div class="ficha-campo"><label>TAXA CONCLUSAO</label><span>' + (stats.total > 0 ? Math.round((stats.finalizado / stats.total) * 100) : 0) + '%</span></div>';
            html += '</div>';

            html += '<h2>Procedimentos (' + procedimentos.length + ')</h2>';

            for (var i = 0; i < procedimentos.length; i++) {
                var p = procedimentos[i];
                if (!p) continue;
                if (i > 0 && i % 15 === 0) html += '<div class="page-break"></div>';
                
                var doc = p.documento_valor ? ((p.documento_tipo || '').toUpperCase() + ': ' + p.documento_valor) : '-';
                var dias = 0;
                if (p.data_entrada) {
                    var d1 = new Date(p.data_entrada + 'T00:00:00');
                    var d2 = new Date();
                    dias = Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
                }
                
                html += '<div class="ficha-demanda">';
                html += '<strong>' + (p.nome || '-') + ' - ' + (p.especialidade || 'Sem especialidade') + '</strong>';
                html += '<div class="ficha-grid" style="margin-top:4px;">';
                html += '<div class="ficha-campo"><label>DOC</label><span>' + doc + '</span></div>';
                html += '<div class="ficha-campo"><label>ENTRADA</label><span>' + _formatarData(p.data_entrada) + ' (' + dias + 'd)</span></div>';
                html += '<div class="ficha-campo"><label>DATA PROC</label><span>' + _formatarData(p.data_procedimento) + '</span></div>';
                html += '<div class="ficha-campo"><label>CIDADE</label><span>' + (p.cidade || '-') + '</span></div>';
                html += '<div class="ficha-campo"><label>PRIORIDADE</label><span>' + (LABELS.prioridade[p.prioridade] || '-') + '</span></div>';
                html += '<div class="ficha-campo"><label>STATUS</label><span>' + (LABELS.status[p.status] || '-') + '</span></div>';
                html += '<div class="ficha-campo"><label>SISTEMA</label><span>' + (p.sistema || '-') + '</span></div>';
                html += '<div class="ficha-campo"><label>MEDICO</label><span>' + (p.medico || '-') + '</span></div>';
                html += '</div>';
                if (p.procedimentos_desc) {
                    html += '<div style="margin-top:4px;font-size:9pt;color:#334155;"><strong>Descricao:</strong> ' + p.procedimentos_desc + '</div>';
                }
                html += '</div>';
            }

            html += '<div class="ficha-rodape">SGP - Sistema de Gerenciamento de Pacientes</div>';
            html += '</div>';
            
            area.innerHTML = html;
            
            // Remove display:none inline antes de imprimir
            area.style.display = 'block';
            area.style.visibility = 'visible';
            
            console.log('[PDF] HTML injetado, tamanho:', html.length, 'caracteres');
            console.log('[PDF] Procedimentos:', procedimentos.length);
            
            // Aguarda renderizacao
            setTimeout(function() {
                window.print();
                // Restaura oculto apos impressao
                setTimeout(function() {
                    area.style.display = 'none';
                }, 1000);
            }, 800);
        },

        exportarCSV: function(procedimentos, tipo, mes, ano, cidade, status, sistema) {
            if (!procedimentos || !procedimentos.length) return { sucesso: false, erro: 'Sem dados' };
            var BOM = '\uFEFF';
            var sep = ';';
            var csv = BOM;
            csv += ['Paciente','Doc Tipo','Doc Valor','Especialidade','Entrada','Data Proc.','Cidade','Prioridade','Status','Sistema','Medico','Dias'].join(sep) + '\n';
            
            for (var i = 0; i < procedimentos.length; i++) {
                var p = procedimentos[i];
                if (!p) continue;
                var dias = 0;
                if (p.data_entrada) {
                    var d1 = new Date(p.data_entrada + 'T00:00:00');
                    var d2 = new Date();
                    dias = Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
                }
                var linha = [
                    p.nome || '', p.documento_tipo || '', p.documento_valor || '',
                    p.especialidade || '', p.data_entrada || '', p.data_procedimento || '',
                    p.cidade || '', p.prioridade || '', p.status || '', p.sistema || '',
                    p.medico || '', dias
                ].map(function(v) { return '"' + String(v).replace(/"/g, '""').replace(/\n/g, ' ') + '"'; });
                csv += linha.join(sep) + '\n';
            }
            
            var nome = 'relatorio_' + tipo + '_' + ano + (mes ? '_' + mes : '') + '.csv';
            var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.href = url;
            link.download = nome;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(function() { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
            return { sucesso: true };
        }
    };
})();