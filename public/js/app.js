/* ================================================================
   APP.JS - Controle Principal SGP v9.0
   Todas as funcoes protegidas contra null/undefined
   ================================================================ */

(function() {
    'use strict';

    var editandoId = null;
    var demandasTemp = [];
    var tagsTemp = [];
    var estadoRetornoTemp = { pacienteId: null, demandas: [], sistema: 'core' };
    var secaoAtual = 'dashboard';
    var refreshTimer = null;
    var REFRESH_INTERVALO = 30;

    /* ---- Toast ---- */
    var Toast = {
        mostrar: function(msg, tipo, duracao) {
            tipo = tipo || 'info';
            duracao = duracao || 3500;
            var container = document.getElementById('toast-container');
            if (!container) return;
            var toast = document.createElement('div');
            toast.className = 'toast ' + tipo;
            toast.innerHTML = '<span class="toast-message">' + msg + '</span>';
            container.appendChild(toast);
            setTimeout(function() {
                if (toast.parentNode) {
                    toast.style.animation = 'slideIn .3s reverse';
                    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
                }
            }, duracao);
        }
    };

    /* ---- Leitura segura de elementos DOM ---- */
    function elVal(id) {
        var el = document.getElementById(id);
        return el ? (el.value || '') : '';
    }

    function elSet(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    function elShow(id, show) {
        var el = document.getElementById(id);
        if (el) el.style.display = show ? '' : 'none';
    }

    function elHtml(id, html) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }

    /* ---- Inicializacao ---- */
    async function inicializar() {
        aplicarTema(localStorage.getItem('sgp_tema') || 'light');
        definirDataAtual();
        definirMesAtual();
        configurarNavegacao();
        configurarFormulario();
        configurarLista();
        configurarRelatorios();
        configurarHeader();
        configurarModais();
        configurarAtalhos();
        await atualizarDashboard();
        await atualizarNotificacoes();
        iniciarRefreshAutomatico();
    }

    /* ---- Refresh Automatico ---- */
    function iniciarRefreshAutomatico() {
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(async function() {
            try {
                if (secaoAtual === 'dashboard') { await atualizarDashboard(); await atualizarAlertasRapidos(); }
                if (secaoAtual === 'lista') await carregarLista();
                if (secaoAtual === 'alertas') await carregarAlertas();
                await atualizarNotificacoes();
            } catch (err) {
                console.error('[Refresh] Erro silencioso:', err);
            }
        }, REFRESH_INTERVALO * 1000);
    }

    /* ---- Tema ---- */
    function aplicarTema(tema) {
        localStorage.setItem('sgp_tema', tema);
        document.documentElement.setAttribute('data-theme', tema);
        elSet('icone-tema', tema === 'dark' ? '☀️' : '🌙');
    }

    function alternarTema() {
        var atual = localStorage.getItem('sgp_tema') || 'light';
        aplicarTema(atual === 'dark' ? 'light' : 'dark');
        Toast.mostrar('Tema alterado', 'info', 1500);
    }

    /* ---- Navegacao ---- */
    function configurarNavegacao() {
        var botoes = document.querySelectorAll('.btn-nav');
        for (var i = 0; i < botoes.length; i++) {
            botoes[i].addEventListener('click', function(e) {
                e.preventDefault();
                var s = this.getAttribute('data-secao');
                if (s) navegar(s);
            });
        }
    }

    async function navegar(secao) {
        secaoAtual = secao;
        var secoes = document.querySelectorAll('.secao');
        for (var i = 0; i < secoes.length; i++) secoes[i].classList.remove('active');
        var navs = document.querySelectorAll('.btn-nav');
        for (var j = 0; j < navs.length; j++) navs[j].classList.remove('active');
        var el = document.getElementById('secao-' + secao);
        var btn = document.querySelector('.btn-nav[data-secao="' + secao + '"]');
        if (el) el.classList.add('active');
        if (btn) btn.classList.add('active');
        if (secao === 'dashboard') { await atualizarDashboard(); await atualizarAlertasRapidos(); }
        if (secao === 'lista') { await carregarLista(); await atualizarFiltroCidades(); await atualizarFiltroTags(); }
        if (secao === 'relatorios') await atualizarFiltroCidadesRelatorio();
        if (secao === 'cadastro') { await atualizarDatalists(); if (!editandoId && demandasTemp.length === 0) adicionarDemandaVazia(); }
        if (secao === 'alertas') await carregarAlertas();
        if (secao === 'backup') await carregarBackupsServidor();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ---- Dashboard SEGURO ---- */
    async function atualizarDashboard() {
        try {
            var stats = await API.getDashboardStats();
            if (!stats || typeof stats !== 'object') {
                stats = { total: 0, aguardando: 0, liberado: 0, retorno: 0, finalizado: 0, tempoMedio: 0, taxaConclusao: 0, atencao: 0, prioridade: { azul: 0, verde: 0, amarelo: 0, vermelho: 0 }, sistema: { core: 0, sisreg: 0, ambos: 0 }, porMes: [], porCidade: [] };
            }
            elSet('metrica-total', stats.total || 0);
            elSet('metrica-aguardando', stats.aguardando || 0);
            elSet('metrica-liberado', stats.liberado || 0);
            elSet('metrica-retorno', stats.retorno || 0);
            elSet('metrica-finalizado', stats.finalizado || 0);
            elSet('metrica-tempo-medio', stats.tempoMedio || 0);
            elSet('metrica-taxa-conclusao', (stats.taxaConclusao || 0) + '%');
            elSet('metrica-atencao', stats.atencao || 0);
            if (typeof ChartsManager !== 'undefined' && ChartsManager.renderizarDashboardFromStats) {
                ChartsManager.renderizarDashboardFromStats(stats);
            }
        } catch (err) {
            console.error('[ERRO] Dashboard:', err);
        }
    }

    async function atualizarAlertasRapidos() {
        try {
            var alertas = await API.getAlertas();
            if (!alertas) alertas = { alerta30dias: [], emergencias: [], retornosPendentes: [], total: 0 };
            var container = document.getElementById('alertas-rapidos');
            var lista = document.getElementById('lista-alertas-rapidos');
            if (!container || !lista) return;
            if (!alertas.total || alertas.total === 0) { container.style.display = 'none'; return; }
            container.style.display = 'block';
            var html = '';
            if (alertas.alerta30dias && alertas.alerta30dias.length > 0) html += '<div class="alerta-item alerta-critico"><strong>⏰ ' + alertas.alerta30dias.length + ' paciente(s) aguardando > 30 dias</strong></div>';
            if (alertas.emergencias && alertas.emergencias.length > 0) html += '<div class="alerta-item alerta-urgente"><strong>🔴 ' + alertas.emergencias.length + ' emergencia(s)</strong></div>';
            if (alertas.retornosPendentes && alertas.retornosPendentes.length > 0) html += '<div class="alerta-item alerta-atencao"><strong>🔄 ' + alertas.retornosPendentes.length + ' retorno(s) pendente(s)</strong></div>';
            lista.innerHTML = html;
        } catch (err) { console.error('Erro alertas:', err); }
    }

   async function atualizarNotificacoes() {
    try {
        var alertas = await API.getAlertas();
        if (!alertas) alertas = { total: 0 };
        
        // Carrega notificacoes lidas
        var lidas = JSON.parse(localStorage.getItem('notificacoes_lidas') || '[]');
        
        // Conta apenas notificacoes NAO lidas
        var totalNaoLidas = 0;
        
        if (alertas.emergencias) {
            alertas.emergencias.forEach(function(e) {
                if (lidas.indexOf('emergencia_' + e.id) === -1) totalNaoLidas++;
            });
        }
        if (alertas.alerta30dias) {
            alertas.alerta30dias.forEach(function(a) {
                if (lidas.indexOf('alerta30_' + a.id) === -1) totalNaoLidas++;
            });
        }
        if (alertas.retornosPendentes) {
            alertas.retornosPendentes.forEach(function(r) {
                if (lidas.indexOf('retorno_' + r.id) === -1) totalNaoLidas++;
            });
        }
        
        var badge = document.getElementById('badge-notificacoes');
        if (!badge) return;
        
        if (totalNaoLidas > 0) {
            badge.style.display = 'inline-block';
            badge.textContent = totalNaoLidas;
        } else {
            badge.style.display = 'none';
        }
    } catch (err) { 
        console.error('Erro notificacoes:', err); 
    }
}

    /* ---- Demandas ---- */

function adicionarDemandaVazia(dados) {
    dados = dados || {};
    demandasTemp.push({
        id: Date.now() + Math.random(),
        especialidade: dados.especialidade || '',
        procedimentos: dados.procedimentos || '',
        pedidoCore: dados.pedidoCore || '',
        pedidoSisreg: dados.pedidoSisreg || '',
        dataProcedimento: dados.dataProcedimento || '',
        cidadeDestino: dados.cidadeDestino || dados.cidade_destino || ''
    });
    renderizarDemandas('lista-demandas', demandasTemp);
}
    function removerDemanda(id) {
        if (demandasTemp.length <= 1) { Toast.mostrar('Deve haver pelo menos uma demanda', 'warning'); return; }
        demandasTemp = demandasTemp.filter(function(d) { return d.id !== id; });
        renderizarDemandas('lista-demandas', demandasTemp);
    }

    function atualizarDemanda(id, campo, valor) {
        for (var i = 0; i < demandasTemp.length; i++) {
            if (demandasTemp[i].id === id) { demandasTemp[i][campo] = valor; break; }
        }
    }

    function adicionarDemandaRetorno(dados) {
        dados = dados || {};
        estadoRetornoTemp.demandas.push({
            id: Date.now() + Math.random(),
            especialidade: dados.especialidade || '',
            procedimentos: dados.procedimentos || '',
            pedidoCore: dados.pedidoCore || '',
            pedidoSisreg: dados.pedidoSisreg || ''
        });
        renderizarDemandas('retorno-lista-demandas', estadoRetornoTemp.demandas);
    }

    function removerDemandaRetorno(id) {
        if (estadoRetornoTemp.demandas.length <= 1) { Toast.mostrar('Deve haver pelo menos uma demanda', 'warning'); return; }
        estadoRetornoTemp.demandas = estadoRetornoTemp.demandas.filter(function(d) { return d.id !== id; });
        renderizarDemandas('retorno-lista-demandas', estadoRetornoTemp.demandas);
    }

    function atualizarDemandaRetorno(id, campo, valor) {
        for (var i = 0; i < estadoRetornoTemp.demandas.length; i++) {
            if (estadoRetornoTemp.demandas[i].id === id) { estadoRetornoTemp.demandas[i][campo] = valor; break; }
        }
    }

function renderizarDemandas(containerId, listaTemp) {
    var container = document.getElementById(containerId);
    if (!container) return;
    if (!listaTemp || listaTemp.length === 0) {
        container.innerHTML = '<p style="color:var(--color-text-light);text-align:center;padding:20px;">Adicione uma demanda</p>';
        return;
    }
    var sistemaAtivo = 'core';
    if (containerId === 'lista-demandas') { sistemaAtivo = elVal('select-sistema') || 'core'; }
    else if (containerId === 'retorno-lista-demandas') { sistemaAtivo = estadoRetornoTemp.sistema || 'core'; }
    var mostrarCore = sistemaAtivo === 'core' || sistemaAtivo === 'ambos';
    var mostrarSisreg = sistemaAtivo === 'sisreg' || sistemaAtivo === 'ambos';
    var atualizador = containerId === 'lista-demandas' ? 'App.atualizarDemanda' : 'App.atualizarDemandaRetorno';
    var removedor = containerId === 'lista-demandas' ? 'App.removerDemanda' : 'App.removerDemandaRetorno';
    var html = '';
    for (var i = 0; i < listaTemp.length; i++) {
        var d = listaTemp[i];
        if (!d) continue;
        html += '<div class="demanda-card"><div class="demanda-header"><span class="demanda-titulo">Procedimento #' + (i + 1) + '</span>';
        if (listaTemp.length > 1) html += '<button type="button" class="btn-remover-demanda" onclick="' + removedor + '(' + d.id + ')">🗑️ Remover</button>';
        html += '</div><div class="demanda-grid">';
        html += '<div class="form-group full-width"><label>Especialidade <span class="obrigatorio">*</span></label><input type="text" value="' + Utils.escapeHtml(d.especialidade || '') + '" oninput="' + atualizador + '(' + d.id + ',\'especialidade\',this.value)" list="lista-especialidades" placeholder="Ex: Cardiologia"></div>';
        html += '<div class="form-group"><label>Cidade Destino <small style="color:var(--color-text-light);font-weight:normal;">(preencha ao liberar)</small></label><input type="text" value="' + Utils.escapeHtml(d.cidadeDestino || '') + '" oninput="' + atualizador + '(' + d.id + ',\'cidadeDestino\',this.value)" list="lista-cidades" placeholder="Para onde vai o paciente"></div>';
        html += '<div class="form-group"><label>Data do Procedimento</label><input type="date" value="' + (d.dataProcedimento || '') + '" oninput="' + atualizador + '(' + d.id + ',\'dataProcedimento\',this.value)"></div>';
        if (mostrarCore) html += '<div class="form-group"><label>Codigo Core</label><input type="text" value="' + Utils.escapeHtml(d.pedidoCore || '') + '" oninput="' + atualizador + '(' + d.id + ',\'pedidoCore\',this.value)" maxlength="50"></div>';
        if (mostrarSisreg) html += '<div class="form-group"><label>Codigo Sisreg</label><input type="text" value="' + Utils.escapeHtml(d.pedidoSisreg || '') + '" oninput="' + atualizador + '(' + d.id + ',\'pedidoSisreg\',this.value)" maxlength="50"></div>';
        html += '<div class="form-group full-width"><label>Procedimentos (descricao)</label><textarea rows="2" maxlength="1000" oninput="' + atualizador + '(' + d.id + ',\'procedimentos\',this.value)" placeholder="Descreva os procedimentos...">' + Utils.escapeHtml(d.procedimentos || '') + '</textarea></div>';
        html += '</div></div>';
    }
    container.innerHTML = html;
}
    /* ---- Tags ---- */
    function adicionarTag() {
        var input = document.getElementById('input-nova-tag');
        var selectCor = document.getElementById('select-cor-tag');
        if (!input || !selectCor) return;
        var nome = input.value.trim();
        if (!nome) { Toast.mostrar('Digite o nome da tag', 'warning'); return; }
        for (var i = 0; i < tagsTemp.length; i++) { if (tagsTemp[i].nome === nome) { Toast.mostrar('Tag ja existe', 'warning'); return; } }
        tagsTemp.push({ id: Date.now() + Math.random(), nome: nome, cor: selectCor.value });
        input.value = '';
        renderizarTags();
    }

    function removerTag(id) {
        tagsTemp = tagsTemp.filter(function(t) { return t.id !== id; });
        renderizarTags();
    }

    function renderizarTags() {
        var container = document.getElementById('lista-tags');
        if (!container) return;
        if (tagsTemp.length === 0) { container.innerHTML = '<p class="form-hint">Nenhuma tag adicionada</p>'; return; }
        var html = '';
        for (var i = 0; i < tagsTemp.length; i++) {
            var t = tagsTemp[i];
            html += '<span class="tag tag-' + t.cor + '">' + Utils.escapeHtml(t.nome) + '<button type="button" class="tag-remover" onclick="App.removerTag(' + t.id + ')">&times;</button></span>';
        }
        container.innerHTML = html;
    }

    /* ---- Observacoes ---- */
    async function adicionarObservacao() {
        var input = document.getElementById('input-observacao');
        if (!input) return;
        var texto = input.value.trim();
        if (!texto) { Toast.mostrar('Digite uma observacao', 'warning'); return; }
        if (!editandoId) { Toast.mostrar('Salve o paciente primeiro', 'warning'); return; }
        try {
            await API.adicionarObservacao(editandoId, texto);
            input.value = '';
            var paciente = await API.buscarPaciente(editandoId);
            renderizarObservacoes(paciente ? paciente.observacoes : []);
            Toast.mostrar('Observacao adicionada!', 'success');
        } catch (err) { Toast.mostrar('Erro: ' + err.message, 'error'); }
    }

    function renderizarObservacoes(observacoes) {
        var container = document.getElementById('lista-observacoes');
        if (!container) return;
        if (!observacoes || observacoes.length === 0) { container.innerHTML = '<p class="form-hint">Nenhuma observacao</p>'; return; }
        var html = '';
        for (var i = 0; i < observacoes.length; i++) {
            var obs = observacoes[i];
            if (!obs) continue;
            html += '<div class="observacao-item"><div class="observacao-header"><small>' + Utils.formatarDataHora(obs.data_criacao) + '</small></div><div class="observacao-texto">' + Utils.escapeHtml(obs.texto) + '</div></div>';
        }
        container.innerHTML = html;
    }

    /* ---- Documentos ---- */
    function adicionarDocumento() {
        if (!editandoId) { Toast.mostrar('Salve o paciente primeiro', 'warning'); return; }
        var input = document.getElementById('input-documento-arquivo');
        if (input) input.click();
    }

    async function processarDocumentos(files) {
        if (!editandoId || !files) return;
        for (var i = 0; i < files.length; i++) {
            try {
                await API.uploadDocumento(editandoId, files[i]);
                Toast.mostrar('Documento "' + files[i].name + '" anexado!', 'success');
            } catch (err) { Toast.mostrar('Erro ao anexar "' + files[i].name + '"', 'error'); }
        }
        var paciente = await API.buscarPaciente(editandoId);
        renderizarDocumentos(paciente ? paciente.documentos : []);
    }

    function renderizarDocumentos(documentos) {
        var container = document.getElementById('lista-documentos');
        if (!container) return;
        if (!documentos || documentos.length === 0) { container.innerHTML = '<p class="form-hint">Nenhum documento</p>'; return; }
        var html = '';
        for (var i = 0; i < documentos.length; i++) {
            var doc = documentos[i];
            if (!doc) continue;
            html += '<div class="documento-item"><span class="documento-nome">📄 ' + Utils.escapeHtml(doc.nome_original) + '</span><span class="documento-data">' + Utils.formatarDataHora(doc.data_upload) + '</span><a href="' + API.getDownloadUrl(doc.nome_arquivo) + '" class="btn btn-primary btn-small" target="_blank">📥 Baixar</a></div>';
        }
        container.innerHTML = html;
    }

    /* ---- Autocompletar ---- */
    var autocompleteTimeout = null;

    function configurarAutocompletar() {
        var inputNome = document.getElementById('input-nome');
        if (!inputNome) return;
        inputNome.addEventListener('input', function() {
            var termo = this.value.trim();
            if (termo.length < 3 || editandoId) return;
            if (autocompleteTimeout) clearTimeout(autocompleteTimeout);
            autocompleteTimeout = setTimeout(async function() {
                try {
                    var resultados = await API.buscarPorNome(termo);
                    if (resultados && resultados.length === 1) {
                        var p = resultados[0];
                        if (confirm('Paciente "' + p.nome + '" ja cadastrado.\nDeseja carregar os dados?')) editarPaciente(p.id);
                    } else if (resultados && resultados.length > 1) {
                        var nomes = resultados.map(function(r) { return r.nome; }).join('\n');
                        if (confirm('Encontrados ' + resultados.length + ' pacientes:\n\n' + nomes + '\n\nIr para a lista filtrada?')) {
                            navegar('lista');
                            var buscaEl = document.getElementById('input-busca');
                            if (buscaEl) buscaEl.value = termo;
                            filtrarPacientes();
                        }
                    }
                } catch (err) { console.error('Erro autocomplete:', err); }
            }, 800);
        });
    }

    /* ---- Formulario ---- */
    function configurarFormulario() {
        var form = document.getElementById('form-paciente');
        if (form) form.addEventListener('submit', function(e) { e.preventDefault(); salvarPaciente(); });

        var btnLimpar = document.getElementById('btn-limpar');
        if (btnLimpar) btnLimpar.addEventListener('click', limparFormulario);

        var btnCancelar = document.getElementById('btn-cancelar');
        if (btnCancelar) btnCancelar.addEventListener('click', cancelarEdicao);

        var btnAddDemanda = document.getElementById('btn-add-demanda');
        if (btnAddDemanda) btnAddDemanda.addEventListener('click', function() { adicionarDemandaVazia(); });

        var selSistema = document.getElementById('select-sistema');
        if (selSistema) selSistema.addEventListener('change', function() { renderizarDemandas('lista-demandas', demandasTemp); });

        var selTipo = document.getElementById('select-tipo-documento');
        if (selTipo) selTipo.addEventListener('change', atualizarMascaraDocumento);

        var inputDoc = document.getElementById('input-documento');
        if (inputDoc) inputDoc.addEventListener('input', function() {
            var tipo = elVal('select-tipo-documento');
            this.value = tipo === 'cpf' ? Utils.formatarCPF(this.value) : Utils.formatarCNS(this.value);
            validarDocumento();
        });

        var inputTel = document.getElementById('input-telefone');
        if (inputTel) inputTel.addEventListener('input', function() { this.value = Utils.formatarTelefone(this.value); });

        var inputTel2 = document.getElementById('input-telefone2');
        if (inputTel2) inputTel2.addEventListener('input', function() { this.value = Utils.formatarTelefone(this.value); });

        var btnAddTag = document.getElementById('btn-adicionar-tag');
        if (btnAddTag) btnAddTag.addEventListener('click', adicionarTag);

        var inputTag = document.getElementById('input-nova-tag');
        if (inputTag) inputTag.addEventListener('keypress', function(e) { if (e.key === 'Enter') { e.preventDefault(); adicionarTag(); } });

        var btnAddObs = document.getElementById('btn-adicionar-observacao');
        if (btnAddObs) btnAddObs.addEventListener('click', adicionarObservacao);

        var btnAddDoc = document.getElementById('btn-add-documento');
        if (btnAddDoc) btnAddDoc.addEventListener('click', adicionarDocumento);

        var inputDocArquivo = document.getElementById('input-documento-arquivo');
        if (inputDocArquivo) inputDocArquivo.addEventListener('change', function(e) { if (e.target.files && e.target.files.length > 0) processarDocumentos(e.target.files); });

        configurarAutocompletar();
    }

    function atualizarMascaraDocumento() {
        var tipo = elVal('select-tipo-documento');
        var input = document.getElementById('input-documento');
        if (!input) return;
        input.value = '';
        if (tipo === 'cpf') { input.placeholder = '000.000.000-00'; input.maxLength = 14; }
        else { input.placeholder = '000 0000 0000 000'; input.maxLength = 18; }
        var errEl = document.getElementById('documento-error');
        if (errEl) errEl.classList.remove('visible');
    }

    function validarDocumento() {
        var tipo = elVal('select-tipo-documento');
        var input = document.getElementById('input-documento');
        var err = document.getElementById('documento-error');
        if (!input || !err) return true;
        var valor = input.value.replace(/\D/g, '');
        err.textContent = '';
        err.classList.remove('visible');
        if (!valor) return true;
        if (tipo === 'cpf' && valor.length === 11 && !Utils.validarCPF(valor)) { err.textContent = 'CPF invalido'; err.classList.add('visible'); return false; }
        if (tipo === 'cns' && valor.length === 15 && !Utils.validarCNS(valor)) { err.textContent = 'CNS invalido'; err.classList.add('visible'); return false; }
        return true;
    }

    function definirDataAtual() {
        var i = document.getElementById('input-data');
        if (!i) return;
        var h = new Date();
        i.value = h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
    }

    function definirMesAtual() {
        var s = document.getElementById('select-mes-relatorio');
        if (s) s.value = new Date().getMonth() + 1;
    }

    async function atualizarDatalists() {
        try {
            var cidades = await API.getCidades();
            var lc = document.getElementById('lista-cidades');
            if (lc) { lc.innerHTML = ''; for (var i = 0; i < cidades.length; i++) { var o = document.createElement('option'); o.value = cidades[i]; lc.appendChild(o); } }
            var esp = await API.getEspecialidades();
            var le = document.getElementById('lista-especialidades');
            if (le) { le.innerHTML = ''; for (var j = 0; j < esp.length; j++) { var o2 = document.createElement('option'); o2.value = esp[j]; le.appendChild(o2); } }
        } catch (err) { console.error('Erro datalists:', err); }
    }

    /* ---- Salvar Paciente SEGURO ---- */
async function salvarPaciente() {
    if (!validarDocumento()) { Toast.mostrar('Documento invalido', 'error'); return; }

    var docValor = elVal('input-documento').replace(/\D/g, '');
    var nome = elVal('input-nome').trim();
    if (!nome) { Toast.mostrar('Nome obrigatorio', 'error'); return; }

    var demanda = {
        especialidade: demandasTemp[0] ? demandasTemp[0].especialidade : '',
        procedimentos: demandasTemp[0] ? demandasTemp[0].procedimentos : '',
        pedidoCore: demandasTemp[0] ? demandasTemp[0].pedidoCore : '',
        pedidoSisreg: demandasTemp[0] ? demandasTemp[0].pedidoSisreg : '',
        dataProcedimento: demandasTemp[0] ? demandasTemp[0].dataProcedimento : '',
        cidadeDestino: demandasTemp[0] ? (demandasTemp[0].cidadeDestino || '') : '',
        dataEntrada: elVal('input-data'),
        prioridade: elVal('select-prioridade'),
        sistema: elVal('select-sistema'),
        medico: elVal('input-medico'),
        unidade: elVal('input-unidade')
    };

    if (!demanda.especialidade) { Toast.mostrar('Especialidade obrigatoria', 'error'); return; }
    // Cidade destino NAO e obrigatoria no cadastro (status = aguardando)

    var dados = {
        nome: nome,
        documento: { tipo: elVal('select-tipo-documento'), valor: docValor },
        cidade: elVal('input-cidade').trim(),
        nomeMae: elVal('input-nome-mae').trim(),
        nascimento: elVal('input-nascimento'),
        telefone: elVal('input-telefone'),
        telefone2: elVal('input-telefone2'),
        endereco: elVal('input-endereco').trim(),
        tags: tagsTemp,
        demanda: demanda
    };

    var btnSalvar = document.getElementById('btn-salvar');
    if (btnSalvar) btnSalvar.disabled = true;

    try {
        if (editandoId !== null) {
            await API.atualizarPaciente(editandoId, {
                nome: dados.nome, documento: dados.documento, cidade: dados.cidade,
                nomeMae: dados.nomeMae, nascimento: dados.nascimento,
                telefone: dados.telefone, telefone2: dados.telefone2,
                endereco: dados.endereco, tags: dados.tags
            });
            await API.adicionarProcedimento(editandoId, demanda);
            Toast.mostrar('Novo procedimento adicionado!', 'success');
        } else {
            var resultado = await API.criarPacienteEProcedimento(dados);
            editandoId = resultado.paciente.id;
            var msg = resultado.paciente.pacienteExistente
                ? 'Paciente ja existia. Novo procedimento adicionado!'
                : 'Paciente cadastrado com primeiro procedimento!';
            Toast.mostrar(msg, 'success');
        }
        if (btnSalvar) btnSalvar.disabled = false;
        limparFormulario();
        await atualizarDashboard();
        await atualizarNotificacoes();
        navegar('lista');
    } catch (err) {
        if (btnSalvar) btnSalvar.disabled = false;
        Toast.mostrar(err.message, 'error');
    }
}

    function limparFormulario() {
        var form = document.getElementById('form-paciente');
        if (form) form.reset();
        editandoId = null;
        demandasTemp = [];
        tagsTemp = [];
        var pacId = document.getElementById('paciente-id');
        if (pacId) pacId.value = '';
        elSet('cadastro-titulo', 'Cadastro de Paciente');
        var btnSave = document.getElementById('btn-salvar');
        if (btnSave) { btnSave.innerHTML = '<span>💾</span> Cadastrar'; btnSave.disabled = false; }
        elShow('btn-cancelar', false);
        elShow('aviso-edicao', false);
        elShow('secao-historico', false);
        elShow('lista-retornos-form', false);
        elHtml('lista-retornos-form', '');
        var errEl = document.getElementById('documento-error');
        if (errEl) errEl.classList.remove('visible');
        renderizarTags();
        renderizarObservacoes([]);
        renderizarDocumentos([]);
        definirDataAtual();
        atualizarMascaraDocumento();
        renderizarDemandas('lista-demandas', demandasTemp);
    }

    function cancelarEdicao() {
        if (confirm('Cancelar edicao?')) { limparFormulario(); Toast.mostrar('Edicao cancelada', 'info'); }
    }

    async function editarPaciente(id) {
    try {
        var p = await API.buscarPaciente(id);
        if (!p) return;

        // Carrega APENAS dados pessoais (procedimentos antigos ficam no histórico)
        var pacId = document.getElementById('paciente-id');
        if (pacId) pacId.value = p.id;

        var inputNome = document.getElementById('input-nome');
        if (inputNome) inputNome.value = p.nome || '';

        var selTipo = document.getElementById('select-tipo-documento');
        if (selTipo) selTipo.value = p.documento_tipo || 'cpf';
        atualizarMascaraDocumento();

        if (p.documento_valor) {
            var inputDoc = document.getElementById('input-documento');
            if (inputDoc) inputDoc.value = p.documento_tipo === 'cpf' ? Utils.formatarCPF(p.documento_valor) : Utils.formatarCNS(p.documento_valor);
        }

        var campos = {
            'input-cidade': p.cidade, 'input-nome-mae': p.nome_mae,
            'input-nascimento': p.nascimento, 'input-telefone': p.telefone,
            'input-telefone2': p.telefone2, 'input-endereco': p.endereco
        };
        for (var key in campos) {
            var el = document.getElementById(key);
            if (el && campos[key]) el.value = campos[key];
        }

        tagsTemp = p.tags || [];
        renderizarTags();
        renderizarObservacoes(p.observacoes || []);
        renderizarDocumentos(p.documentos || []);

        editandoId = id;
        demandasTemp = [];
        adicionarDemandaVazia(); // Campo vazio para NOVO procedimento

        elSet('cadastro-titulo', 'Novo Procedimento para: ' + p.nome);
        var btnSave = document.getElementById('btn-salvar');
        if (btnSave) btnSave.innerHTML = '<span>💾</span> Adicionar Procedimento';
        elShow('btn-cancelar', true);
        elShow('aviso-edicao', true);
        var avisoEl = document.getElementById('aviso-edicao');
        if (avisoEl) avisoEl.innerHTML = '<p>✅ Dados pessoais carregados. Preencha o NOVO procedimento abaixo.</p><p>📋 Procedimentos anteriores: <strong>' + (p.demandas ? p.demandas.length : 0) + '</strong></p>';

        renderizarHistoricoProcedimentos(p);
        navegar('cadastro');
    } catch (err) { Toast.mostrar('Erro ao carregar paciente', 'error'); }
}

function renderizarHistoricoProcedimentos(p) {
    var demandas = p ? (p.demandas || []) : [];
    var secao = document.getElementById('secao-historico');
    var lista = document.getElementById('lista-retornos-form');
    if (!demandas.length) { if (secao) secao.style.display = 'none'; if (lista) lista.style.display = 'none'; return; }
    if (secao) { secao.style.display = 'block'; secao.innerHTML = '📋 Historico de Procedimentos <small class="hint-right">Clique para alterar status</small>'; }
    if (lista) {
        lista.style.display = 'block';
        var html = '';
        var LABELS = { aguardando: '⏳ Aguardando', liberado: '✅ Liberado', retorno: '🔄 Retorno', finalizado: '🏁 Finalizado' };
        for (var i = 0; i < demandas.length; i++) {
            var d = demandas[i];
            html += '<div class="retorno-item">';
            html += '<div class="retorno-numero"><span>' + (d.especialidade || 'Sem especialidade') + '</span>';
            html += '<span class="status-badge status-' + (d.status || '') + '">' + (LABELS[d.status] || d.status) + '</span>';
            html += '<select onchange="App.mudarStatusProcedimento(' + d.id + ', this.value)" style="padding:4px;font-size:.8em;">';
            html += '<option value="">Alterar...</option>';
            html += '<option value="aguardando">⏳ Aguardando</option>';
            html += '<option value="liberado">✅ Liberado</option>';
            html += '<option value="retorno">🔄 Retorno</option>';
            html += '<option value="finalizado">🏁 Finalizado</option>';
            html += '</select>';
            html += '<button class="btn-acao btn-excluir" onclick="App.excluirProcedimento(' + d.id + ')">🗑️</button>';
            html += '</div>';
            html += '<div class="retorno-info">';
            html += '<div><strong>Entrada:</strong> ' + Utils.formatarData(d.data_entrada) + '</div>';
            if (d.data_procedimento) html += '<div><strong>Procedimento:</strong> ' + Utils.formatarData(d.data_procedimento) + '</div>';
            html += '<div><strong>Prioridade:</strong> ' + (d.prioridade || '-') + '</div>';
            html += '<div><strong>Sistema:</strong> ' + (d.sistema || '-') + '</div>';
            if (d.medico) html += '<div><strong>Medico:</strong> ' + d.medico + '</div>';
            html += '</div></div>';
        }
        lista.innerHTML = html;
    }
}

async function mudarStatusProcedimento(demandaId, novoStatus) {
    if (!novoStatus) return;

    // Busca procedimento atual
    var proc = null;
    for (var i = 0; i < _todosPacientesCache.length; i++) {
        if (_todosPacientesCache[i].id === demandaId) { 
            proc = _todosPacientesCache[i]; 
            break; 
        }
    }

    // Se for liberar e nao tem cidade, abre modal
    if (novoStatus === 'liberado' && (!proc || !proc.cidade_destino)) {
        Toast.mostrar('⚠️ Preencha a Cidade Destino primeiro!', 'warning');
        editarProcedimento(demandaId);
        return;
    }

    var dados = { status: novoStatus };
    var hoje = new Date().toISOString().split('T')[0];
    
    if (novoStatus === 'liberado') dados.dataLiberacao = hoje;
    if (novoStatus === 'retorno') dados.dataRetorno = hoje;
    if (novoStatus === 'finalizado') dados.dataFinalizacao = hoje;

    try {
        await API.atualizarProcedimento(demandaId, dados);
        Toast.mostrar('✅ Status atualizado para ' + novoStatus + '!', 'success');
        await carregarLista();
        await atualizarDashboard();
        await atualizarNotificacoes();
    } catch (err) { 
        Toast.mostrar('❌ Erro: ' + err.message, 'error'); 
    }
}
async function excluirProcedimento(id) {
    if (!confirm('Excluir este procedimento?')) return;
    try {
        await API.excluirProcedimento(id);
        Toast.mostrar('Procedimento excluido', 'success');
        if (editandoId) { var p = await API.buscarPaciente(editandoId); renderizarHistoricoProcedimentos(p); }
        await atualizarDashboard();
    } catch (err) { Toast.mostrar(err.message, 'error'); }
}

    function renderizarHistoricoRetornos(p) {
        var retornos = p ? (p.retornos || []) : [];
        var secao = document.getElementById('secao-historico');
        var lista = document.getElementById('lista-retornos-form');
        if (!retornos.length) { if (secao) secao.style.display = 'none'; if (lista) lista.style.display = 'none'; return; }
        if (secao) secao.style.display = 'block';
        if (lista) lista.style.display = 'block';
        var html = '';
        for (var i = 0; i < retornos.length; i++) {
            var r = retornos[i];
            if (!r) continue;
            var isUltimo = i === retornos.length - 1;
            var isBloqueado = !isUltimo || r.finalizado;
            var especs = (r.demandas || []).map(function(d) { return d ? d.especialidade : ''; }).filter(function(e) { return e; }).join(', ') || '-';
            var classes = 'retorno-item' + (isUltimo && !r.finalizado ? ' ultimo' : '') + (isBloqueado ? ' bloqueado' : '');
            html += '<div class="' + classes + '"><div class="retorno-numero"><span>🔄 Retorno #' + r.numero + '</span><div>';
            if (r.finalizado) html += '<span class="status-badge status-finalizado">🏁 Finalizado</span>';
            if (isBloqueado) html += '<span class="status-badge status-aguardando">🔒 Bloqueado</span>';
            if (isUltimo && !r.finalizado) html += '<button class="btn-finalizar" onclick="App.finalizarRetorno(' + p.id + ',' + r.id + ')">🏁 Finalizar</button>';
            html += '</div></div><div class="retorno-info"><div><strong>Data:</strong> ' + Utils.formatarData(r.data_retorno) + '</div>';
            if (r.data_finalizacao) html += '<div><strong>Finalizado:</strong> ' + Utils.formatarData(r.data_finalizacao) + '</div>';
            html += '<div><strong>Especialidades:</strong> ' + especs + '</div>';
            if (r.observacao) html += '<div><strong>Obs:</strong> ' + r.observacao + '</div>';
            html += '</div></div>';
        }
        var ultimo = retornos[retornos.length - 1];
        if (!ultimo || ultimo.finalizado) html += '<button class="btn-novo-retorno" onclick="App.adicionarRetorno(' + p.id + ')">➕ Adicionar Novo Retorno</button>';
        if (lista) lista.innerHTML = html;
    }

    /* ---- Lista SEGURO ---- */
    function configurarLista() {
        var busca = document.getElementById('input-busca');
        if (busca) busca.addEventListener('input', filtrarPacientes);
        var ids = ['select-filtro-status', 'select-filtro-cidade', 'select-filtro-prioridade', 'select-filtro-sistema', 'select-filtro-tag'];
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (el) el.addEventListener('change', filtrarPacientes);
        }
        var btnLimpar = document.getElementById('btn-limpar-filtros');
        if (btnLimpar) btnLimpar.addEventListener('click', function() {
            var campos = ['input-busca', 'select-filtro-status', 'select-filtro-cidade', 'select-filtro-prioridade', 'select-filtro-sistema', 'select-filtro-tag'];
            for (var j = 0; j < campos.length; j++) { var c = document.getElementById(campos[j]); if (c) c.value = ''; }
            filtrarPacientes();
        });
    }

    var _todosPacientesCache = [];

    async function carregarLista() {
    try {
        var dados = await API.listarProcedimentos();
        if (!Array.isArray(dados)) dados = [];
        _todosPacientesCache = dados;
        filtrarPacientes();
    } catch (err) {
        console.error('[ERRO] Carregar lista:', err);
        _todosPacientesCache = [];
        filtrarPacientes();
    }
}

function filtrarPacientes() {
    var busca = elVal('input-busca').toLowerCase().trim();
    var status = elVal('select-filtro-status');
    var cidade = elVal('select-filtro-cidade');
    var prio = elVal('select-filtro-prioridade');
    var sis = elVal('select-filtro-sistema');

    var filtrados = _todosPacientesCache.filter(function(p) {
        if (!p) return false;
        var mb = !busca ||
            (p.nome || '').toLowerCase().indexOf(busca) !== -1 ||
            (p.cidade || '').toLowerCase().indexOf(busca) !== -1 ||
            (p.especialidade || '').toLowerCase().indexOf(busca) !== -1 ||
            (p.documento_valor || '').indexOf(busca) !== -1;
        var ms = !status || p.status === status;
        var mc = !cidade || p.cidade === cidade;
        var mp = !prio || p.prioridade === prio;
        var msis = !sis || p.sistema === sis;
        return mb && ms && mc && mp && msis;
    });
    renderizarTabela(filtrados);
}

function renderizarTabela(procedimentos) {
    var tbody = document.getElementById('tbody-pacientes');
    if (!tbody) return;
    tbody.innerHTML = '';
    elSet('total-resultados', procedimentos.length);
    
    if (!procedimentos || procedimentos.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--color-text-light);">📋 Nenhum procedimento cadastrado</td></tr>'; 
        return; 
    }

    var LABELS_STATUS = { 
        aguardando: '⏳ Aguardando', 
        liberado: '✅ Liberado', 
        retorno: '🔄 Retorno', 
        finalizado: '🏁 Finalizado' 
    };

    for (var idx = 0; idx < procedimentos.length; idx++) {
        var p = procedimentos[idx];
        if (!p) continue;
        
        var tr = document.createElement('tr');
        var dias = Utils.calcularDias(p.data_entrada);
        var dc = 'dias-ok';
        if (p.status !== 'finalizado') { 
            if (dias > 30) dc = 'dias-alerta'; 
            else if (dias > 15) dc = 'dias-atencao'; 
        }
        
        var doc = p.documento_valor ? 
            ((p.documento_tipo || '').toUpperCase() + ': ' + p.documento_valor) : '-';
        
        var sisBadge = '-';
        if (p.sistema === 'core') {
            sisBadge = '<span class="sistema-badge sistema-core">Core</span>';
        } else if (p.sistema === 'sisreg') {
            sisBadge = '<span class="sistema-badge sistema-sisreg">Sisreg</span>';
        } else if (p.sistema === 'ambos') {
            sisBadge = '<span class="sistema-badge sistema-core">Core</span> <span class="sistema-badge sistema-sisreg">Sisreg</span>';
        }

        // 11 COLUNAS (mesma ordem do <thead>)
        tr.innerHTML = 
            // 1. Paciente
            '<td><strong>' + (p.nome || '-') + '</strong></td>' +
            // 2. Documento
            '<td style="font-size:.82em;">' + doc + '</td>' +
            // 3. Especialidade
            '<td>' + (p.especialidade || '-') + '</td>' +
            // 4. Data Entrada
            '<td>' + Utils.formatarData(p.data_entrada) + '</td>' +
            // 5. Data Procedimento
            '<td>' + Utils.formatarData(p.data_procedimento) + '</td>' +
            // 6. Cidade Destino
            '<td><strong>' + (p.cidade_destino || '<span style="color:var(--color-warning);">pendente</span>') + '</strong></td>' +
            // 7. Prioridade
            '<td><span class="prioridade-badge prioridade-' + (p.prioridade || '') + '">' + (RelatorioManager.LABELS.prioridade[p.prioridade] || '') + '</span></td>' +
            // 8. Status
            '<td><span class="status-badge status-' + (p.status || '') + '">' + (LABELS_STATUS[p.status] || p.status || '') + '</span></td>' +
            // 9. Sistema
            '<td>' + sisBadge + '</td>' +
            // 10. Dias
            '<td class="dias-cell ' + dc + '">' + dias + 'd</td>' +
            // 11. Acoes
            '<td class="acoes-cell">' +
                '<button class="btn-acao btn-detalhes" onclick="App.verPaciente(' + p.paciente_id + ')" title="Ver detalhes">👁️</button>' +
                '<button class="btn-acao btn-editar" onclick="App.editarProcedimento(' + p.id + ')" title="Editar">✏️</button>' +
                '<button class="btn-acao btn-excluir" onclick="App.excluirProcedimentoDireto(' + p.id + ')" title="Excluir">🗑️</button>' +
                '<button class="btn-acao btn-copiar" onclick="App.editarPaciente(' + p.paciente_id + ')" title="Novo Procedimento">➕</button>' +
            '</td>';
        
        tbody.appendChild(tr);
    }
}

    async function atualizarFiltroCidades() {
        try { var cidades = await API.getCidades(); var s = document.getElementById('select-filtro-cidade'); if (!s) return; var a = s.value; s.innerHTML = '<option value="">Todas</option>'; for (var i = 0; i < cidades.length; i++) { var o = document.createElement('option'); o.value = cidades[i]; o.textContent = cidades[i]; s.appendChild(o); } s.value = a; } catch (e) {}
    }

    async function atualizarFiltroCidadesRelatorio() {
        try { var cidades = await API.getCidades(); var s = document.getElementById('select-cidade-relatorio'); if (!s) return; var a = s.value; s.innerHTML = '<option value="">Todas</option>'; for (var i = 0; i < cidades.length; i++) { var o = document.createElement('option'); o.value = cidades[i]; o.textContent = cidades[i]; s.appendChild(o); } s.value = a; } catch (e) {}
    }

    async function atualizarFiltroTags() {
        try { var tags = await API.getTags(); var s = document.getElementById('select-filtro-tag'); if (!s) return; var a = s.value; s.innerHTML = '<option value="">Todas</option>'; for (var i = 0; i < tags.length; i++) { var o = document.createElement('option'); o.value = tags[i].nome; o.textContent = tags[i].nome; s.appendChild(o); } s.value = a; } catch (e) {}
    }

    /* ---- Acoes ---- */
    async function mudarStatus(id, novoStatus) {
        try {
            if (novoStatus === 'liberado') { await API.atualizarPaciente(id, { status: 'liberado', dataLiberacao: new Date().toISOString().split('T')[0] }); Toast.mostrar('Paciente liberado!', 'success'); }
            else if (novoStatus === 'retorno') { adicionarRetorno(id); return; }
            await carregarLista(); await atualizarDashboard(); await atualizarNotificacoes();
        } catch (err) { Toast.mostrar(err.message, 'error'); }
    }

    async function adicionarRetorno(id) {
        try {
            var p = await API.buscarPaciente(id);
            if (!p) { Toast.mostrar('Paciente nao encontrado', 'error'); return; }
            estadoRetornoTemp.pacienteId = p.id;
            estadoRetornoTemp.sistema = p.sistema || 'core';
            var ultimoRetorno = p.retornos && p.retornos.length > 0 ? p.retornos[p.retornos.length - 1] : null;
            var base = ultimoRetorno && ultimoRetorno.demandas ? ultimoRetorno.demandas : (p.demandas || []);
            estadoRetornoTemp.demandas = base.map(function(d) { return { id: Date.now() + Math.random(), especialidade: d ? d.especialidade || '' : '', procedimentos: d ? d.procedimentos || '' : '', pedidoCore: d ? d.pedido_core || '' : '', pedidoSisreg: d ? d.pedido_sisreg || '' : '' }; });
            if (estadoRetornoTemp.demandas.length === 0) adicionarDemandaRetorno();

            elSet('retorno-paciente-id', p.id);
            elSet('retorno-nome', p.nome || '-');
            elSet('retorno-cidade', p.cidade || '-');
            elSet('retorno-data-cadastro', Utils.formatarData(p.data_entrada));

            var prioEl = document.getElementById('retorno-prioridade');
            if (prioEl) prioEl.innerHTML = p.prioridade ? '<span class="prioridade-badge prioridade-' + p.prioridade + '">' + (RelatorioManager.LABELS.prioridade[p.prioridade] || p.prioridade) + '</span>' : '-';

            var sb = '-';
            if (p.sistema === 'core') sb = '<span class="sistema-badge sistema-core">Core</span>';
            else if (p.sistema === 'sisreg') sb = '<span class="sistema-badge sistema-sisreg">Sisreg</span>';
            else if (p.sistema === 'ambos') sb = '<span class="sistema-badge sistema-core">Core</span> <span class="sistema-badge sistema-sisreg">Sisreg</span>';
            elHtml('retorno-sistema', sb);

            elSet('retorno-especialista', base.map(function(d) { return d ? d.especialidade : ''; }).filter(function(e) { return e; }).join(', ') || '-');

            var dataEl = document.getElementById('retorno-data');
            if (dataEl) dataEl.value = new Date().toISOString().split('T')[0];

            var obsEl = document.getElementById('retorno-observacao');
            if (obsEl) obsEl.value = ultimoRetorno ? (ultimoRetorno.observacao || '') : '';

            elSet('modal-retorno-titulo', 'Novo Retorno #' + (p.retornos ? p.retornos.length + 1 : 1) + ' - ' + p.nome);
            renderizarDemandas('retorno-lista-demandas', estadoRetornoTemp.demandas);
            abrirModal('modal-retorno');
        } catch (err) { Toast.mostrar('Erro: ' + err.message, 'error'); }
    }

    async function confirmarNovoRetorno() {
        var pacienteId = parseFloat(elVal('retorno-paciente-id'));
        var data = elVal('retorno-data');
        var obs = elVal('retorno-observacao');
        if (!pacienteId || isNaN(pacienteId)) { Toast.mostrar('ID invalido', 'error'); return; }
        if (!data) { Toast.mostrar('Informe a data', 'error'); return; }
        var dv = estadoRetornoTemp.demandas.filter(function(d) { return d && d.especialidade && d.especialidade.trim(); });
        if (dv.length === 0) { Toast.mostrar('Adicione pelo menos uma demanda', 'error'); return; }
        try {
            await API.adicionarRetorno({ pacienteId: pacienteId, data: data, demandas: dv, observacao: obs });
            fecharModal('modal-retorno');
            Toast.mostrar('Retorno criado!', 'success');
            await carregarLista(); await atualizarDashboard(); await atualizarNotificacoes();
            if (editandoId == pacienteId) { var p = await API.buscarPaciente(pacienteId); renderizarHistoricoRetornos(p); }
        } catch (err) { Toast.mostrar(err.message, 'error'); }
    }

    async function finalizarRetorno(pacienteId, retornoId) {
        if (!confirm('Finalizar este retorno?\n\nO paciente sera marcado como Finalizado.')) return;
        try {
            await API.finalizarRetorno(retornoId, new Date().toISOString().split('T')[0]);
            Toast.mostrar('Retorno finalizado!', 'success');
            await carregarLista(); await atualizarDashboard(); await atualizarNotificacoes();
            if (editandoId == pacienteId) { var p = await API.buscarPaciente(pacienteId); renderizarHistoricoRetornos(p); }
        } catch (err) { Toast.mostrar(err.message, 'error'); }
    }

    async function duplicarPaciente(id) {
        if (!confirm('Criar novo cadastro baseado neste paciente?')) return;
        try {
            var r = await API.duplicarPaciente(id);
            Toast.mostrar('Novo cadastro criado!', 'success');
            await carregarLista(); await atualizarDashboard();
            setTimeout(function() { editarPaciente(r.paciente.id); }, 300);
        } catch (err) { Toast.mostrar(err.message, 'error'); }
    }

    async function excluirPaciente(id) {
        var nome = 'este paciente';
        for (var i = 0; i < _todosPacientesCache.length; i++) {
            if (_todosPacientesCache[i] && _todosPacientesCache[i].id === id) { nome = _todosPacientesCache[i].nome; break; }
        }
        if (!confirm('Excluir ' + nome + '?')) return;
        try { await API.excluirPaciente(id); Toast.mostrar('Paciente excluido', 'success'); await carregarLista(); await atualizarDashboard(); await atualizarNotificacoes(); } catch (err) { Toast.mostrar(err.message, 'error'); }
    }

    /* ---- Ver Detalhes + PDF ---- */
    async function verDetalhes(id) {
        try {
            var p = await API.buscarPaciente(id);
            if (!p) return;
            var dias = Utils.calcularDias(p.data_entrada);
            var doc = p.documento_valor ? ((p.documento_tipo || '').toUpperCase() + ': ' + p.documento_valor) : '-';
            var html = '<div class="detalhes-grid">';
            html += '<div class="detalhe-item" style="grid-column:span 2;"><div class="detalhe-label">Nome</div><div class="detalhe-valor">' + p.nome + '</div></div>';
            html += '<div class="detalhe-item"><div class="detalhe-label">Documento</div><div class="detalhe-valor">' + doc + '</div></div>';
            html += '<div class="detalhe-item"><div class="detalhe-label">Entrada</div><div class="detalhe-valor">' + Utils.formatarData(p.data_entrada) + ' (' + dias + ' dias)</div></div>';
            if (p.nome_mae) html += '<div class="detalhe-item"><div class="detalhe-label">Mae</div><div class="detalhe-valor">' + p.nome_mae + '</div></div>';
            if (p.nascimento) html += '<div class="detalhe-item"><div class="detalhe-label">Nascimento</div><div class="detalhe-valor">' + Utils.formatarData(p.nascimento) + '</div></div>';
            if (p.telefone) html += '<div class="detalhe-item"><div class="detalhe-label">Telefone</div><div class="detalhe-valor">' + p.telefone + '</div></div>';
            if (p.telefone2) html += '<div class="detalhe-item"><div class="detalhe-label">Telefone 2</div><div class="detalhe-valor">' + p.telefone2 + '</div></div>';
            if (p.endereco) html += '<div class="detalhe-item full-width"><div class="detalhe-label">Endereco</div><div class="detalhe-valor">' + p.endereco + '</div></div>';
            if (p.medico) html += '<div class="detalhe-item"><div class="detalhe-label">Medico</div><div class="detalhe-valor">' + p.medico + '</div></div>';
            if (p.unidade) html += '<div class="detalhe-item"><div class="detalhe-label">Unidade</div><div class="detalhe-valor">' + p.unidade + '</div></div>';
            html += '<div class="detalhe-item"><div class="detalhe-label">Cidade</div><div class="detalhe-valor">' + (p.cidade || '-') + '</div></div>';
            html += '<div class="detalhe-item"><div class="detalhe-label">Prioridade</div><div class="detalhe-valor"><span class="prioridade-badge prioridade-' + (p.prioridade || '') + '">' + (RelatorioManager.LABELS.prioridade[p.prioridade] || '') + '</span></div></div>';
            html += '<div class="detalhe-item"><div class="detalhe-label">Status</div><div class="detalhe-valor"><span class="status-badge status-' + (p.status || '') + '">' + (RelatorioManager.LABELS.status[p.status] || p.status || '') + '</span></div></div>';
            html += '<div class="detalhe-item"><div class="detalhe-label">Sistema</div><div class="detalhe-valor">' + (p.sistema || '-') + '</div></div></div>';

            if (p.demandas && p.demandas.length > 0) {
                html += '<div class="historico-status"><h4>📋 Procedimentos (' + p.demandas.length + ')</h4>';
                for (var di = 0; di < p.demandas.length; di++) {
                    var d = p.demandas[di];
                    if (!d) continue;
                    html += '<div style="background:var(--color-border-light);padding:12px;border-radius:8px;margin-bottom:8px;"><div style="font-weight:700;color:var(--color-primary);margin-bottom:5px;">Procedimento #' + (di + 1) + ': ' + (d.especialidade || '-') + (d.data_procedimento ? ' <span style="font-weight:normal;font-size:.85em;">(' + Utils.formatarData(d.data_procedimento) + ')</span>' : '') + '</div>';
                    if (d.pedido_core) html += '<div style="font-size:.85em;"><strong>Core:</strong> ' + d.pedido_core + '</div>';
                    if (d.pedido_sisreg) html += '<div style="font-size:.85em;"><strong>Sisreg:</strong> ' + d.pedido_sisreg + '</div>';
                    if (d.procedimentos) html += '<div style="font-size:.85em;margin-top:5px;"><strong>Proc:</strong> ' + d.procedimentos + '</div>';
                    html += '</div>';
                }
                html += '</div>';
            }

            if (p.tags && p.tags.length > 0) {
                html += '<div class="historico-status"><h4>🏷️ Tags</h4><div style="display:flex;gap:8px;flex-wrap:wrap;">';
                for (var ti = 0; ti < p.tags.length; ti++) { if (p.tags[ti]) html += '<span class="tag tag-' + p.tags[ti].cor + '">' + p.tags[ti].nome + '</span>'; }
                html += '</div></div>';
            }

            if (p.documentos && p.documentos.length > 0) {
                html += '<div class="historico-status"><h4>📄 Documentos (' + p.documentos.length + ')</h4>';
                for (var dci = 0; dci < p.documentos.length; dci++) {
                    var dc = p.documentos[dci];
                    if (!dc) continue;
                    html += '<div style="background:var(--color-border-light);padding:10px;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;"><span>📄 ' + dc.nome_original + '</span><a href="' + API.getDownloadUrl(dc.nome_arquivo) + '" class="btn btn-primary btn-small" target="_blank">📥 Baixar</a></div>';
                }
                html += '</div>';
            }

            if (p.observacoes && p.observacoes.length > 0) {
                html += '<div class="historico-status"><h4>📝 Observacoes (' + p.observacoes.length + ')</h4>';
                for (var oi = 0; oi < p.observacoes.length; oi++) {
                    var obs = p.observacoes[oi];
                    if (!obs) continue;
                    html += '<div style="background:var(--color-border-light);padding:10px;border-radius:8px;margin-bottom:8px;border-left:4px solid var(--color-primary);"><div style="font-size:.8em;color:var(--color-text-light);margin-bottom:5px;">' + Utils.formatarDataHora(obs.data_criacao) + '</div><div>' + obs.texto + '</div></div>';
                }
                html += '</div>';
            }

            if (p.retornos && p.retornos.length) {
                html += '<div class="historico-status"><h4>🔄 Retornos (' + p.retornos.length + ')</h4><ul class="timeline">';
                for (var ri = 0; ri < p.retornos.length; ri++) {
                    var r = p.retornos[ri];
                    if (!r) continue;
                    var especs = (r.demandas || []).map(function(dd) { return dd ? dd.especialidade : ''; }).filter(function(e) { return e; }).join(', ') || '-';
                    html += '<li class="timeline-item"><div class="timeline-status">Retorno #' + r.numero + (r.finalizado ? ' 🏁' : '') + '</div><div class="timeline-data">Data: ' + Utils.formatarData(r.data_retorno) + (r.data_finalizacao ? ' | Finalizado: ' + Utils.formatarData(r.data_finalizacao) : '') + '</div><div class="timeline-data">Especialidades: ' + especs + '</div>';
                    if (r.observacao) html += '<div class="timeline-data">Obs: ' + r.observacao + '</div>';
                    html += '</li>';
                }
                html += '</ul></div>';
            }

            if (p.historicoStatus && p.historicoStatus.length > 1) {
                html += '<div class="historico-status"><h4>📜 Historico de Status</h4><ul class="timeline">';
                var hist = p.historicoStatus.slice().reverse();
                for (var hi = 0; hi < hist.length; hi++) {
                    var h = hist[hi];
                    if (!h) continue;
                    html += '<li class="timeline-item"><div class="timeline-status"><span class="status-badge status-' + h.status + '">' + (RelatorioManager.LABELS.status[h.status] || h.status || '') + '</span>' + (h.retorno_numero ? ' (Retorno #' + h.retorno_numero + ')' : '') + '</div><div class="timeline-data">' + Utils.formatarDataHora(h.data_criacao) + '</div></li>';
                }
                html += '</ul></div>';
            }

            elHtml('conteudo-detalhes', html);
            var btnImprimir = document.getElementById('btn-imprimir-ficha');
            if (btnImprimir) btnImprimir.onclick = function() { imprimirFichaPdf(p); };
            abrirModal('modal-detalhes');
        } catch (err) { Toast.mostrar('Erro ao carregar detalhes', 'error'); }
    }

    function imprimirFichaPdf(p) {
        var area = document.getElementById('area-impressao');
        if (!area) { Toast.mostrar('Erro: area de impressao nao encontrada', 'error'); return; }
        var doc = p.documento_valor ? ((p.documento_tipo || '').toUpperCase() + ': ' + p.documento_valor) : '-';
        var html = '<div class="ficha-pdf"><h1>SGP - Ficha do Paciente</h1><div class="subtitulo">Impresso em: ' + new Date().toLocaleString('pt-BR') + '</div>';
        html += '<h2>Identificacao</h2><div class="ficha-grid"><div class="ficha-campo"><label>NOME</label><span>' + (p.nome || '-') + '</span></div><div class="ficha-campo"><label>DOCUMENTO</label><span>' + doc + '</span></div><div class="ficha-campo"><label>DATA ENTRADA</label><span>' + Utils.formatarData(p.data_entrada) + '</span></div><div class="ficha-campo"><label>CIDADE</label><span>' + (p.cidade || '-') + '</span></div><div class="ficha-campo"><label>TELEFONE</label><span>' + (p.telefone || '-') + '</span></div><div class="ficha-campo"><label>TELEFONE 2</label><span>' + (p.telefone2 || '-') + '</span></div>';
        if (p.nome_mae) html += '<div class="ficha-campo"><label>MAE</label><span>' + p.nome_mae + '</span></div>';
        if (p.nascimento) html += '<div class="ficha-campo"><label>NASCIMENTO</label><span>' + Utils.formatarData(p.nascimento) + '</span></div>';
        if (p.endereco) html += '<div class="ficha-campo full-width"><label>ENDERECO</label><span>' + p.endereco + '</span></div>';
        html += '</div><h2>Atendimento</h2><div class="ficha-grid"><div class="ficha-campo"><label>PRIORIDADE</label><span>' + (RelatorioManager.LABELS.prioridade[p.prioridade] || '-') + '</span></div><div class="ficha-campo"><label>STATUS</label><span>' + (RelatorioManager.LABELS.status[p.status] || '-') + '</span></div><div class="ficha-campo"><label>SISTEMA</label><span>' + (p.sistema || '-') + '</span></div>';
        if (p.medico) html += '<div class="ficha-campo"><label>MEDICO</label><span>' + p.medico + '</span></div>';
        if (p.unidade) html += '<div class="ficha-campo"><label>UNIDADE</label><span>' + p.unidade + '</span></div>';
        html += '<div class="ficha-campo"><label>LIBERACAO</label><span>' + Utils.formatarData(p.data_liberacao) + '</span></div><div class="ficha-campo"><label>RETORNO</label><span>' + Utils.formatarData(p.data_retorno) + '</span></div><div class="ficha-campo"><label>FINALIZACAO</label><span>' + Utils.formatarData(p.data_finalizacao) + '</span></div></div>';

        if (p.demandas && p.demandas.length > 0) {
            html += '<h2>Procedimentos (' + p.demandas.length + ')</h2>';
            for (var i = 0; i < p.demandas.length; i++) {
                var d = p.demandas[i];
                if (!d) continue;
                html += '<div class="ficha-demanda"><strong>Procedimento #' + (i + 1) + ': ' + (d.especialidade || '-') + (d.data_procedimento ? ' (' + Utils.formatarData(d.data_procedimento) + ')' : '') + '</strong>';
                if (d.pedido_core) html += '<div>Codigo Core: ' + d.pedido_core + '</div>';
                if (d.pedido_sisreg) html += '<div>Codigo Sisreg: ' + d.pedido_sisreg + '</div>';
                if (d.procedimentos) html += '<div>Descricao: ' + d.procedimentos + '</div>';
                html += '</div>';
            }
        }

        if (p.retornos && p.retornos.length > 0) {
            html += '<h2>Historico de Retornos (' + p.retornos.length + ')</h2>';
            for (var j = 0; j < p.retornos.length; j++) {
                var r = p.retornos[j];
                if (!r) continue;
                html += '<div class="ficha-demanda"><strong>Retorno #' + r.numero + (r.finalizado ? ' [FINALIZADO]' : '') + '</strong><div>Data: ' + Utils.formatarData(r.data_retorno) + (r.data_finalizacao ? ' | Finalizado: ' + Utils.formatarData(r.data_finalizacao) : '') + '</div>';
                if (r.observacao) html += '<div>Obs: ' + r.observacao + '</div>';
                html += '</div>';
            }
        }

        html += '<div class="ficha-assinatura"><div>Assinatura do Responsavel</div><div>Carimbo da Unidade</div></div><div class="ficha-rodape">SGP - Sistema de Gerenciamento de Pacientes | Documento sem validade legal sem assinaturas</div></div>';
        area.innerHTML = html;
        setTimeout(function() { window.print(); }, 500);
    }

    /* ---- Alertas ---- */
    async function carregarAlertas() {
        try {
            var alertas = await API.getAlertas();
            if (!alertas) alertas = { alerta30dias: [], emergencias: [], retornosPendentes: [], total: 0 };
            var renderLista = function(lista, containerId, critico) {
                var el = document.getElementById(containerId);
                if (!el) return;
                if (!lista || !lista.length) { el.innerHTML = '<p class="alerta-vazio">Nenhum registro</p>'; return; }
                var html = '';
                for (var i = 0; i < lista.length; i++) {
                    var p = lista[i];
                    if (!p) continue;
                    html += '<div class="alerta-lista-item' + (critico ? ' alerta-critico' : '') + '" onclick="App.verDetalhes(' + p.id + ')"><strong>' + p.nome + '</strong><span class="alerta-dias">' + Utils.calcularDias(p.data_entrada) + ' dias</span></div>';
                }
                el.innerHTML = html;
            };
            renderLista(alertas.alerta30dias, 'lista-alerta-30dias', true);
            renderLista(alertas.emergencias, 'lista-alerta-emergencias', true);
            renderLista(alertas.retornosPendentes, 'lista-alerta-retornos', false);
        } catch (err) { Toast.mostrar('Erro ao carregar alertas', 'error'); }
    }

    /* ---- Relatorios ---- */
    function configurarRelatorios() {
        var btnGerar = document.getElementById('btn-gerar-relatorio');
        var btnPdf = document.getElementById('btn-gerar-pdf-relatorio');
        var btnCsv = document.getElementById('btn-exportar-csv');
        var selTipo = document.getElementById('select-tipo-relatorio');
        if (btnGerar) btnGerar.addEventListener('click', gerarRelatorioTela);
        if (btnPdf) btnPdf.addEventListener('click', gerarRelatorioPdf);
        if (btnCsv) btnCsv.addEventListener('click', exportarCSV);
        if (selTipo) selTipo.addEventListener('change', function() { var gm = document.getElementById('grupo-mes'); if (gm) gm.style.display = this.value === 'anual' ? 'none' : 'flex'; });
    }

    function getFiltrosRelatorio() {
        return {
            tipo: elVal('select-tipo-relatorio'),
            mes: elVal('select-mes-relatorio'),
            ano: elVal('input-ano-relatorio'),
            cidade: elVal('select-cidade-relatorio'),
            status: elVal('select-status-relatorio'),
            sistema: elVal('select-sistema-relatorio')
        };
    }

    async function gerarRelatorioTela() {
        try {
            var filtros = getFiltrosRelatorio();
            var pacientes = await API.gerarRelatorio(filtros);
            RelatorioManager.exibirRelatorio(pacientes, filtros.tipo, filtros.mes, filtros.ano, filtros.cidade, filtros.status, filtros.sistema);
            Toast.mostrar('Relatorio: ' + pacientes.length + ' pacientes', 'success');
        } catch (err) { Toast.mostrar(err.message, 'error'); }
    }

    async function gerarRelatorioPdf() {
        try {
            var filtros = getFiltrosRelatorio();
            var pacientes = await API.gerarRelatorio(filtros);
            if (!pacientes || !pacientes.length) { Toast.mostrar('Nenhum paciente encontrado', 'warning'); return; }
            RelatorioManager.gerarPdfRelatorio(pacientes, filtros.tipo, filtros.mes, filtros.ano, filtros.cidade, filtros.status, filtros.sistema);
            Toast.mostrar('Gerando PDF...', 'info', 2000);
        } catch (err) { Toast.mostrar(err.message, 'error'); }
    }

    async function exportarCSV() {
        try {
            var filtros = getFiltrosRelatorio();
            var pacientes = await API.gerarRelatorio(filtros);
            var r = RelatorioManager.exportarCSV(pacientes, filtros.tipo, filtros.mes, filtros.ano, filtros.cidade, filtros.status, filtros.sistema);
            if (r.sucesso) Toast.mostrar('CSV exportado!', 'success');
            else Toast.mostrar(r.erro, 'warning');
        } catch (err) { Toast.mostrar(err.message, 'error'); }
    }

    /* ---- Backup ---- */
    function criarBackup() { Toast.mostrar('Preparando backup...', 'info', 2000); API.criarBackup(); }

    async function carregarBackupsServidor() {
        var container = document.getElementById('lista-backups-servidor');
        if (!container) return;
        try {
            var backups = await API.listarBackups();
            if (!backups || backups.length === 0) { container.innerHTML = '<p style="color:var(--color-text-light);padding:15px;text-align:center;">Nenhum backup salvo</p>'; return; }
            var html = '';
            for (var i = 0; i < backups.length; i++) {
                var b = backups[i];
                html += '<div class="backup-item"><div class="backup-info"><span class="backup-nome">' + b.nome + '</span><span class="backup-meta">' + b.tamanho + ' • ' + Utils.formatarDataHora(b.data) + '</span></div><div class="backup-acoes"><button class="btn btn-primary btn-small" onclick="App.baixarBackupServidor(\'' + b.nome + '\')">📥 Baixar</button><button class="btn btn-danger btn-small" onclick="App.restaurarBackupServidor(\'' + b.nome + '\')">🔄 Restaurar</button></div></div>';
            }
            container.innerHTML = html;
        } catch (err) { container.innerHTML = '<p style="color:var(--color-danger);padding:15px;">Erro: ' + err.message + '</p>'; }
    }

    function baixarBackupServidor(nome) { API.baixarBackup(nome); Toast.mostrar('Download iniciado!', 'success'); }

    async function restaurarBackupServidor(nome) {
        if (!confirm('RESTAURAR BACKUP?\n\nSUBSTITUIRA TODOS os dados!\n\nREINICIE o servidor apos restaurar.')) return;
        try {
            Toast.mostrar('Baixando e restaurando...', 'info');
            var response = await fetch(API.BASE_URL + '/backup/baixar/' + encodeURIComponent(nome));
            var blob = await response.blob();
            var file = new File([blob], nome, { type: 'application/octet-stream' });
            var resultado = await API.restaurarBackup(file);
            Toast.mostrar(resultado.mensagem || 'Backup restaurado!', 'success', 5000);
        } catch (err) { Toast.mostrar('Erro: ' + err.message, 'error'); }
    }

    function configurarImportar() {
        var inputImportar = document.getElementById('input-importar');
        if (inputImportar) inputImportar.addEventListener('change', processarImportar);
        var inputRestaurar = document.getElementById('input-restaurar');
        if (inputRestaurar) inputRestaurar.addEventListener('change', processarRestaurarArquivo);
    }

    function processarImportar(e) {
        var file = e.target.files[0];
        if (!file) return;
        var preview = document.getElementById('importar-preview');
        if (preview) { preview.style.display = 'block'; preview.innerHTML = '<p>📖 Lendo: ' + file.name + '...</p>'; }
        var reader = new FileReader();
        reader.onload = async function(ev) {
            try {
                var dados = JSON.parse(ev.target.result);
                var count = 0;
                if (Array.isArray(dados)) count = dados.length;
                else if (dados.pacientes && Array.isArray(dados.pacientes)) count = dados.pacientes.length;
                if (preview) preview.innerHTML = '<p>✅ Arquivo valido! <strong>' + count + ' paciente(s)</strong>.</p><button class="btn btn-success btn-small" style="margin-top:8px;" onclick="App.confirmarImportar()">✅ Confirmar Importacao</button>';
                window._dadosImportarTemp = dados;
            } catch (err) { if (preview) preview.innerHTML = '<p style="color:var(--color-danger);">❌ Erro: ' + err.message + '</p>'; window._dadosImportarTemp = null; }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    async function confirmarImportar() {
        if (!window._dadosImportarTemp) { Toast.mostrar('Nenhum arquivo carregado', 'error'); return; }
        var preview = document.getElementById('importar-preview');
        if (preview) preview.innerHTML = '<p>⏳ Importando...</p>';
        try {
            var resultado = await API.importarDados(window._dadosImportarTemp);
            if (preview) preview.innerHTML = '<p>✅ <strong>Importacao concluida!</strong> Importados: ' + resultado.importados + ' | Duplicados: ' + resultado.duplicados + ' | Erros: ' + resultado.erros + '</p>';
            Toast.mostrar(resultado.importados + ' pacientes importados!', 'success', 5000);
            window._dadosImportarTemp = null;
            await atualizarDashboard(); await atualizarNotificacoes();
        } catch (err) { if (preview) preview.innerHTML = '<p style="color:var(--color-danger);">❌ Erro: ' + err.message + '</p>'; }
    }

    function processarRestaurarArquivo(e) {
        var file = e.target.files[0];
        if (!file) return;
        if (!confirm('RESTAURAR BACKUP?\n\nSUBSTITUIRA TODOS os dados!\n\nREINICIE o servidor apos restaurar.')) { e.target.value = ''; return; }
        Toast.mostrar('Restaurando...', 'info');
        API.restaurarBackup(file).then(function(resultado) { Toast.mostrar(resultado.mensagem || 'Backup restaurado!', 'success', 5000); }).catch(function(err) { Toast.mostrar('Erro: ' + err.message, 'error'); });
        e.target.value = '';
    }

    /* ---- Header, Modais, Atalhos ---- */
    function configurarHeader() {
    var btnTema = document.getElementById('btn-tema');
    if (btnTema) btnTema.addEventListener('click', alternarTema);
    
    var btnNotif = document.getElementById('btn-notificacoes');
    if (btnNotif) btnNotif.addEventListener('click', abrirNotificacoes);
    
    configurarImportar();
}

    function configurarModais() {
        var closes = document.querySelectorAll('[data-modal]');
        for (var i = 0; i < closes.length; i++) {
            closes[i].addEventListener('click', function() { fecharModal(this.getAttribute('data-modal')); });
        }
        var btnAddDemRet = document.getElementById('btn-add-demanda-retorno');
        if (btnAddDemRet) btnAddDemRet.addEventListener('click', function() { adicionarDemandaRetorno(); });
        var btnConfRet = document.getElementById('btn-confirmar-retorno');
        if (btnConfRet) btnConfRet.addEventListener('click', confirmarNovoRetorno);
    }

    function abrirModal(id) { var m = document.getElementById(id); if (m) m.classList.add('active'); }
    function fecharModal(id) { var m = document.getElementById(id); if (m) m.classList.remove('active'); }

    function configurarAtalhos() {
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'n') { e.preventDefault(); limparFormulario(); navegar('cadastro'); }
            if (e.ctrlKey && e.key === 'f') { e.preventDefault(); navegar('lista'); setTimeout(function() { var b = document.getElementById('input-busca'); if (b) b.focus(); }, 300); }
            if (e.ctrlKey && e.key === 'p') { var md = document.getElementById('modal-detalhes'); if (md && md.classList.contains('active')) { e.preventDefault(); var bp = document.getElementById('btn-imprimir-ficha'); if (bp) bp.click(); } }
            if (e.ctrlKey && e.key === 't') { e.preventDefault(); alternarTema(); }
            if (e.key === 'Escape') { var modais = document.querySelectorAll('.modal.active'); for (var i = 0; i < modais.length; i++) modais[i].classList.remove('active'); }
        });
    }

    /* ---- Edicao de Procedimento ---- */
function editarProcedimento(procId) {
    var proc = null;
    for (var i = 0; i < _todosPacientesCache.length; i++) {
        if (_todosPacientesCache[i].id === procId) { 
            proc = _todosPacientesCache[i]; 
            break; 
        }
    }
    
    if (!proc) { 
        Toast.mostrar('Procedimento nao encontrado', 'error'); 
        return; 
    }

    console.log('[CLIENT] Abrindo edicao:', proc);

    var setVal = function(id, val) { 
        var el = document.getElementById(id); 
        if (el) {
            el.value = val || '';
            el.style.borderColor = '';
            console.log('[CLIENT] Setando', id, '=', val);
        } else {
            console.warn('[CLIENT] Elemento NAO ENCONTRADO:', id);
        }
    };
    
    setVal('edit-proc-id', proc.id);
    setVal('edit-proc-nome', proc.nome);
    var doc = proc.documento_valor ? ((proc.documento_tipo || '').toUpperCase() + ': ' + proc.documento_valor) : '-';
    setVal('edit-proc-doc', doc);
    setVal('edit-proc-especialidade', proc.especialidade);
    setVal('edit-proc-cidade-destino', proc.cidade_destino);
    setVal('edit-proc-data-entrada', proc.data_entrada);
    setVal('edit-proc-data-procedimento', proc.data_procedimento);
    setVal('edit-proc-descricao', proc.procedimentos_desc);
    setVal('edit-proc-core', proc.pedido_core);
    setVal('edit-proc-sisreg', proc.pedido_sisreg);
    setVal('edit-proc-status', proc.status);
    setVal('edit-proc-liberacao', proc.data_liberacao);
    setVal('edit-proc-retorno', proc.data_retorno);
    setVal('edit-proc-finalizacao', proc.data_finalizacao);

    abrirModal('modal-editar-procedimento');
}

async function salvarEdicaoProcedimento() {
    var id = parseInt(elVal('edit-proc-id'));
    if (!id) { 
        Toast.mostrar('ID invalido', 'error'); 
        return; 
    }

    console.log('[CLIENT] ========================================');
    console.log('[CLIENT] INICIANDO SALVAMENTO');
    console.log('[CLIENT] ID:', id);

    // VALIDACAO CRITICA: Verificar se o elemento cidade existe
    var elCidade = document.getElementById('edit-proc-cidade-destino');
    
    if (!elCidade) {
        console.error('[CLIENT] ERRO CRITICO: Elemento edit-proc-cidade-destino NAO ENCONTRADO no DOM!');
        Toast.mostrar('Erro: Campo cidade nao encontrado. Recarregue a pagina (Ctrl+F5).', 'error');
        return;
    }

    console.log('[CLIENT] ✅ Elemento cidade encontrado');

    // LER VALORES DIRETAMENTE
    var cidadeDestino = (elCidade.value || '').trim();
    var elStatus = document.getElementById('edit-proc-status');
    var novoStatus = elStatus ? elStatus.value : '';

    console.log('[CLIENT] Valores lidos:');
    console.log('[CLIENT]   cidadeDestino:', cidadeDestino);
    console.log('[CLIENT]   novoStatus:', novoStatus);

    // VALIDACAO: Cidade obrigatoria apenas ao liberar
    if (novoStatus === 'liberado' && !cidadeDestino) {
        console.error('[CLIENT] VALIDACAO FALHOU: Status=liberado mas cidadeDestino vazio');
        Toast.mostrar('⚠️ Preencha a Cidade Destino antes de liberar!', 'error');
        elCidade.focus();
        elCidade.style.borderColor = 'var(--color-danger)';
        elCidade.style.borderWidth = '2px';
        return;
    }

    // MONTAR OBJETO DE DADOS
    var dados = {
        especialidade: elVal('edit-proc-especialidade'),
        cidadeDestino: cidadeDestino,  // CAMPO CRITICO
        dataEntrada: elVal('edit-proc-data-entrada'),
        dataProcedimento: elVal('edit-proc-data-procedimento'),
        procedimentos: elVal('edit-proc-descricao'),
        pedidoCore: elVal('edit-proc-core'),
        pedidoSisreg: elVal('edit-proc-sisreg'),
        status: novoStatus,
        dataLiberacao: elVal('edit-proc-liberacao'),
        dataRetorno: elVal('edit-proc-retorno'),
        dataFinalizacao: elVal('edit-proc-finalizacao')
    };

    // Preenche datas automaticamente
    var hoje = new Date().toISOString().split('T')[0];
    if (novoStatus === 'liberado' && !dados.dataLiberacao) dados.dataLiberacao = hoje;
    if (novoStatus === 'retorno' && !dados.dataRetorno) dados.dataRetorno = hoje;
    if (novoStatus === 'finalizado' && !dados.dataFinalizacao) dados.dataFinalizacao = hoje;

    console.log('[CLIENT] Dados sendo enviados:', JSON.stringify(dados, null, 2));
    console.log('[CLIENT] ========================================');

    try {
        await API.atualizarProcedimento(id, dados);
        Toast.mostrar('✅ Procedimento atualizado!', 'success');
        fecharModal('modal-editar-procedimento');
        await carregarLista();
        await atualizarDashboard();
        await atualizarNotificacoes();
    } catch (err) { 
        console.error('[CLIENT] ERRO:', err);
        Toast.mostrar('❌ Erro: ' + err.message, 'error'); 
    }
}

async function excluirProcedimentoDoModal() {
    var id = parseInt(elVal('edit-proc-id'));
    if (!id) return;
    if (!confirm('Excluir este procedimento? Esta acao nao pode ser desfeita.')) return;
    
    try {
        await API.excluirProcedimento(id);
        Toast.mostrar('Procedimento excluido', 'success');
        fecharModal('modal-editar-procedimento');
        await carregarLista();
        await atualizarDashboard();
    } catch (err) {
        Toast.mostrar('Erro ao excluir: ' + err.message, 'error');
    }
}  
    /* ---- Edicao de Procedimento via Modal ---- */
function editarProcedimento(procId) {
    var proc = null;
    for (var i = 0; i < _todosPacientesCache.length; i++) {
        if (_todosPacientesCache[i].id === procId) { 
            proc = _todosPacientesCache[i]; 
            break; 
        }
    }
    
    if (!proc) { 
        Toast.mostrar('Procedimento nao encontrado', 'error'); 
        return; 
    }

    console.log('[CLIENT] ========================================');
    console.log('[CLIENT] ABRINDO MODAL DE EDICAO');
    console.log('[CLIENT] Procedimento ID:', proc.id);
    console.log('[CLIENT] Cidade destino no cache:', proc.cidade_destino);
    console.log('[CLIENT] Status no cache:', proc.status);
    console.log('[CLIENT] ========================================');

    var setVal = function(id, val) { 
        var el = document.getElementById(id); 
        if (el) {
            el.value = val || '';
            el.style.borderColor = '';
            el.style.borderWidth = '';
            console.log('[CLIENT] Setando', id, '=', val || '(vazio)');
        } else {
            console.error('[CLIENT] ❌ Elemento NAO ENCONTRADO:', id);
        }
    };
    
    setVal('edit-proc-id', proc.id);
    setVal('edit-proc-nome', proc.nome);
    var doc = proc.documento_valor ? ((proc.documento_tipo || '').toUpperCase() + ': ' + proc.documento_valor) : '-';
    setVal('edit-proc-doc', doc);
    setVal('edit-proc-especialidade', proc.especialidade);
    setVal('edit-proc-cidade-destino', proc.cidade_destino);
    setVal('edit-proc-data-entrada', proc.data_entrada);
    setVal('edit-proc-data-procedimento', proc.data_procedimento);
    setVal('edit-proc-descricao', proc.procedimentos_desc);
    setVal('edit-proc-core', proc.pedido_core);
    setVal('edit-proc-sisreg', proc.pedido_sisreg);
    setVal('edit-proc-status', proc.status);
    setVal('edit-proc-liberacao', proc.data_liberacao);
    setVal('edit-proc-retorno', proc.data_retorno);
    setVal('edit-proc-finalizacao', proc.data_finalizacao);

    // MONITORAMENTO EM TEMPO REAL do campo cidade
    var elCidade = document.getElementById('edit-proc-cidade-destino');
    if (elCidade) {
        console.log('[CLIENT] ✅ Adicionando monitoramento ao campo cidade');
        
        // Remove listener anterior se existir
        elCidade.removeEventListener('input', window._cidadeInputHandler);
        
        // Adiciona novo listener
        window._cidadeInputHandler = function() {
            console.log('[CLIENT] 🔄 Campo cidade alterado para:', elCidade.value);
        };
        elCidade.addEventListener('input', window._cidadeInputHandler);
        
        console.log('[CLIENT] Valor inicial do campo cidade:', elCidade.value);
    } else {
        console.error('[CLIENT] ❌ CRITICO: Elemento edit-proc-cidade-destino NAO EXISTE no DOM!');
    }

    abrirModal('modal-editar-procedimento');
}

async function salvarEdicaoProcedimento() {
    var id = parseInt(elVal('edit-proc-id'));
    if (!id) { 
        Toast.mostrar('ID invalido', 'error'); 
        return; 
    }

    console.log('[CLIENT] ========================================');
    console.log('[CLIENT] INICIANDO SALVAMENTO');
    console.log('[CLIENT] ID:', id);
    console.log('[CLIENT] ========================================');

    // VERIFICACAO CRITICA: Elemento cidade
    var elCidade = document.getElementById('edit-proc-cidade-destino');
    
    if (!elCidade) {
        console.error('[CLIENT] ❌ ERRO CRITICO: Elemento edit-proc-cidade-destino NAO ENCONTRADO!');
        console.error('[CLIENT] HTML do modal:', document.getElementById('modal-editar-procedimento').innerHTML);
        Toast.mostrar('Erro: Campo cidade nao encontrado no formulario. Recarregue a pagina.', 'error');
        return;
    }

    console.log('[CLIENT] ✅ Elemento cidade encontrado');
    console.log('[CLIENT] Estado do elemento cidade:');
    console.log('[CLIENT]   tagName:', elCidade.tagName);
    console.log('[CLIENT]   type:', elCidade.type);
    console.log('[CLIENT]   value:', elCidade.value);
    console.log('[CLIENT]   disabled:', elCidade.disabled);
    console.log('[CLIENT]   readonly:', elCidade.readOnly);
    console.log('[CLIENT]   hidden:', elCidade.hidden);
    console.log('[CLIENT]   display:', window.getComputedStyle(elCidade).display);
    console.log('[CLIENT]   visibility:', window.getComputedStyle(elCidade).visibility);

    // LER VALORES
    var cidadeDestino = (elCidade.value || '').trim();
    var elStatus = document.getElementById('edit-proc-status');
    var novoStatus = elStatus ? elStatus.value : '';

    console.log('[CLIENT] Valores lidos:');
    console.log('[CLIENT]   cidadeDestino (raw):', elCidade.value);
    console.log('[CLIENT]   cidadeDestino (trim):', cidadeDestino);
    console.log('[CLIENT]   novoStatus:', novoStatus);

    // VALIDACAO
    if (novoStatus === 'liberado' && !cidadeDestino) {
        console.error('[CLIENT] ❌ VALIDACAO FALHOU:');
        console.error('[CLIENT]   Status = liberado');
        console.error('[CLIENT]   Cidade = vazio');
        Toast.mostrar('⚠️ Preencha a Cidade Destino antes de liberar!', 'error');
        elCidade.focus();
        elCidade.style.borderColor = 'var(--color-danger)';
        elCidade.style.borderWidth = '2px';
        return;
    }

    // MONTAR OBJETO
    var dados = {
        especialidade: elVal('edit-proc-especialidade'),
        cidadeDestino: cidadeDestino,
        dataEntrada: elVal('edit-proc-data-entrada'),
        dataProcedimento: elVal('edit-proc-data-procedimento'),
        procedimentos: elVal('edit-proc-descricao'),
        pedidoCore: elVal('edit-proc-core'),
        pedidoSisreg: elVal('edit-proc-sisreg'),
        status: novoStatus,
        dataLiberacao: elVal('edit-proc-liberacao'),
        dataRetorno: elVal('edit-proc-retorno'),
        dataFinalizacao: elVal('edit-proc-finalizacao')
    };

    var hoje = new Date().toISOString().split('T')[0];
    if (novoStatus === 'liberado' && !dados.dataLiberacao) dados.dataLiberacao = hoje;
    if (novoStatus === 'retorno' && !dados.dataRetorno) dados.dataRetorno = hoje;
    if (novoStatus === 'finalizado' && !dados.dataFinalizacao) dados.dataFinalizacao = hoje;

    console.log('[CLIENT] Objeto final:');
    console.log(JSON.stringify(dados, null, 2));
    console.log('[CLIENT] cidadeDestino no objeto:', dados.cidadeDestino);
    console.log('[CLIENT] ========================================');

    try {
        await API.atualizarProcedimento(id, dados);
        Toast.mostrar('✅ Procedimento atualizado!', 'success');
        fecharModal('modal-editar-procedimento');
        await carregarLista();
        await atualizarDashboard();
        await atualizarNotificacoes();
    } catch (err) { 
        console.error('[CLIENT] ERRO:', err);
        Toast.mostrar('❌ Erro: ' + err.message, 'error'); 
    }
}

async function excluirProcedimentoDoModal() {
    var id = parseInt(elVal('edit-proc-id'));
    if (!id) return;
    if (!confirm('Excluir este procedimento?')) return;
    try {
        await API.excluirProcedimento(id);
        Toast.mostrar('Excluido', 'success');
        fecharModal('modal-editar-procedimento');
        await carregarLista();
        await atualizarDashboard();
    } catch (err) { Toast.mostrar('Erro: ' + err.message, 'error'); }
}

async function excluirProcedimentoDireto(id) {
    if (!confirm('Excluir este procedimento?')) return;
    try {
        await API.excluirProcedimento(id);
        Toast.mostrar('Excluido', 'success');
        await carregarLista();
        await atualizarDashboard();
    } catch (err) { Toast.mostrar('Erro: ' + err.message, 'error'); }
}
    /* ---- Visualizacao detalhada do paciente ---- */
async function verPaciente(pacienteId) {
    try {
        var p = await API.buscarPaciente(pacienteId);
        if (!p) { Toast.mostrar('Paciente nao encontrado', 'error'); return; }

        var doc = p.documento_valor ? ((p.documento_tipo || '').toUpperCase() + ': ' + p.documento_valor) : '-';
        var LABELS_STATUS = { aguardando: '⏳ Aguardando', liberado: '✅ Liberado', retorno: '🔄 Retorno', finalizado: '🏁 Finalizado' };
        var LABELS_PRIO = { azul: '🔵 Azul', verde: '🟢 Verde', amarelo: '🟡 Amarelo', vermelho: '🔴 Vermelho' };

        var html = '';

        // Dados pessoais
        html += '<div class="form-titulo">👤 Dados Pessoais</div>';
        html += '<div class="detalhes-grid">';
        html += '<div class="detalhe-item" style="grid-column:span 2;"><div class="detalhe-label">Nome</div><div class="detalhe-valor">' + (p.nome || '-') + '</div></div>';
        html += '<div class="detalhe-item"><div class="detalhe-label">Documento</div><div class="detalhe-valor">' + doc + '</div></div>';
        html += '<div class="detalhe-item"><div class="detalhe-label">Cidade</div><div class="detalhe-valor">' + (p.cidade || '-') + '</div></div>';
        if (p.nascimento) html += '<div class="detalhe-item"><div class="detalhe-label">Nascimento</div><div class="detalhe-valor">' + Utils.formatarData(p.nascimento) + '</div></div>';
        if (p.nome_mae) html += '<div class="detalhe-item"><div class="detalhe-label">Mae</div><div class="detalhe-valor">' + p.nome_mae + '</div></div>';
        if (p.telefone) html += '<div class="detalhe-item"><div class="detalhe-label">Telefone</div><div class="detalhe-valor">' + p.telefone + '</div></div>';
        if (p.telefone2) html += '<div class="detalhe-item"><div class="detalhe-label">Telefone 2</div><div class="detalhe-valor">' + p.telefone2 + '</div></div>';
        if (p.endereco) html += '<div class="detalhe-item full-width"><div class="detalhe-label">Endereco</div><div class="detalhe-valor">' + p.endereco + '</div></div>';
        html += '</div>';

        // Tags
        if (p.tags && p.tags.length > 0) {
            html += '<div class="form-titulo">🏷️ Tags</div>';
            html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:15px;">';
            for (var ti = 0; ti < p.tags.length; ti++) {
                if (p.tags[ti]) html += '<span class="tag tag-' + p.tags[ti].cor + '">' + p.tags[ti].nome + '</span>';
            }
            html += '</div>';
        }

        // Procedimentos
        html += '<div class="form-titulo">📋 Procedimentos (' + (p.demandas ? p.demandas.length : 0) + ')</div>';
        if (p.demandas && p.demandas.length > 0) {
            for (var di = 0; di < p.demandas.length; di++) {
                var d = p.demandas[di];
                var dias = Utils.calcularDias(d.data_entrada);
                var dc = 'dias-ok';
                if (d.status !== 'finalizado') { if (dias > 30) dc = 'dias-alerta'; else if (dias > 15) dc = 'dias-atencao'; }

                html += '<div class="retorno-item" style="margin-bottom:10px;">';
                html += '<div class="retorno-numero" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">';
                html += '<strong style="font-size:1.05em;color:var(--color-primary);">' + (d.especialidade || 'Sem especialidade') + '</strong>';
                html += '<div style="display:flex;gap:5px;flex-wrap:wrap;">';
                html += '<span class="prioridade-badge prioridade-' + (d.prioridade || '') + '">' + (LABELS_PRIO[d.prioridade] || '') + '</span>';
                html += '<span class="status-badge status-' + (d.status || '') + '">' + (LABELS_STATUS[d.status] || d.status) + '</span>';
                html += '<span class="sistema-badge sistema-' + (d.sistema || '') + '">' + (d.sistema || '-') + '</span>';
                html += '</div></div>';
                html += '<div class="retorno-info" style="margin-top:8px;">';
                html += '<div><strong>Entrada:</strong> ' + Utils.formatarData(d.data_entrada) + ' <span class="' + dc + '">(' + dias + 'd)</span></div>';
                if (d.data_procedimento) html += '<div><strong>Data Proc:</strong> ' + Utils.formatarData(d.data_procedimento) + '</div>';
                if (d.medico) html += '<div><strong>Medico:</strong> ' + d.medico + '</div>';
                if (d.unidade) html += '<div><strong>Unidade:</strong> ' + d.unidade + '</div>';
                if (d.pedido_core) html += '<div><strong>Core:</strong> ' + d.pedido_core + '</div>';
                if (d.pedido_sisreg) html += '<div><strong>Sisreg:</strong> ' + d.pedido_sisreg + '</div>';
                if (d.data_liberacao) html += '<div><strong>Liberacao:</strong> ' + Utils.formatarData(d.data_liberacao) + '</div>';
                if (d.data_retorno) html += '<div><strong>Retorno:</strong> ' + Utils.formatarData(d.data_retorno) + '</div>';
                if (d.data_finalizacao) html += '<div><strong>Finalizacao:</strong> ' + Utils.formatarData(d.data_finalizacao) + '</div>';
                html += '</div>';
                if (d.procedimentos) {
                    html += '<div style="margin-top:8px;padding:8px;background:var(--color-border-light);border-radius:6px;border-left:3px solid var(--color-primary);">';
                    html += '<strong style="font-size:.85em;">Descricao:</strong><br>';
                    html += '<span style="font-size:.9em;">' + d.procedimentos + '</span>';
                    html += '</div>';
                }
                html += '</div>';
            }
        } else {
            html += '<p style="color:var(--color-text-light);text-align:center;padding:15px;">Nenhum procedimento cadastrado</p>';
        }

        // Observações
        if (p.observacoes && p.observacoes.length > 0) {
            html += '<div class="form-titulo">📝 Observacoes (' + p.observacoes.length + ')</div>';
            for (var oi = 0; oi < p.observacoes.length; oi++) {
                var obs = p.observacoes[oi];
                if (!obs) continue;
                html += '<div class="observacao-item" style="margin-bottom:8px;">';
                html += '<div class="observacao-header"><small>' + Utils.formatarDataHora(obs.data_criacao) + '</small></div>';
                html += '<div class="observacao-texto">' + Utils.escapeHtml(obs.texto) + '</div>';
                html += '</div>';
            }
        }

        // Documentos
        if (p.documentos && p.documentos.length > 0) {
            html += '<div class="form-titulo">📄 Documentos (' + p.documentos.length + ')</div>';
            for (var dci = 0; dci < p.documentos.length; dci++) {
                var dc = p.documentos[dci];
                if (!dc) continue;
                html += '<div class="documento-item" style="margin-bottom:6px;">';
                html += '<span class="documento-nome">📄 ' + Utils.escapeHtml(dc.nome_original) + '</span>';
                html += '<span class="documento-data">' + Utils.formatarDataHora(dc.data_upload) + '</span>';
                html += '<a href="' + API.getDownloadUrl(dc.nome_arquivo) + '" class="btn btn-primary btn-small" target="_blank">📥 Baixar</a>';
                html += '</div>';
            }
        }

        elHtml('conteudo-detalhes-paciente', html);

        // Guarda paciente para impressao
        window._pacienteParaImpressao = p;

        abrirModal('modal-detalhes-paciente');
    } catch (err) {
        Toast.mostrar('Erro ao carregar detalhes: ' + err.message, 'error');
    }
}

function imprimirFichaPaciente() {
    var p = window._pacienteParaImpressao;
    if (!p) { Toast.mostrar('Nenhum paciente para imprimir', 'error'); return; }

    var area = document.getElementById('area-impressao');
    if (!area) { Toast.mostrar('Area de impressao nao encontrada', 'error'); return; }

    var doc = p.documento_valor ? ((p.documento_tipo || '').toUpperCase() + ': ' + p.documento_valor) : '-';
    var LABELS_STATUS = { aguardando: 'Aguardando', liberado: 'Liberado', retorno: 'Em Retorno', finalizado: 'Finalizado' };
    var LABELS_PRIO = { azul: 'Nao Urgente', verde: 'Pouco Urgente', amarelo: 'Urgencia', vermelho: 'Emergencia' };

    var html = '<div class="ficha-pdf">';
    html += '<h1>SGP - Ficha Completa do Paciente</h1>';
    html += '<div class="subtitulo">Impresso em: ' + new Date().toLocaleString('pt-BR') + '</div>';

    html += '<h2>Dados Pessoais</h2>';
    html += '<div class="ficha-grid">';
    html += '<div class="ficha-campo"><label>NOME</label><span>' + (p.nome || '-') + '</span></div>';
    html += '<div class="ficha-campo"><label>DOCUMENTO</label><span>' + doc + '</span></div>';
    html += '<div class="ficha-campo"><label>CIDADE</label><span>' + (p.cidade || '-') + '</span></div>';
    if (p.nascimento) html += '<div class="ficha-campo"><label>NASCIMENTO</label><span>' + Utils.formatarData(p.nascimento) + '</span></div>';
    if (p.nome_mae) html += '<div class="ficha-campo"><label>MAE</label><span>' + p.nome_mae + '</span></div>';
    if (p.telefone) html += '<div class="ficha-campo"><label>TELEFONE</label><span>' + p.telefone + '</span></div>';
    if (p.telefone2) html += '<div class="ficha-campo"><label>TELEFONE 2</label><span>' + p.telefone2 + '</span></div>';
    if (p.endereco) html += '<div class="ficha-campo" style="grid-column:1/-1;"><label>ENDERECO</label><span>' + p.endereco + '</span></div>';
    html += '</div>';

    html += '<h2>Procedimentos (' + (p.demandas ? p.demandas.length : 0) + ')</h2>';
    if (p.demandas && p.demandas.length > 0) {
        for (var i = 0; i < p.demandas.length; i++) {
            var d = p.demandas[i];
            var dias = Utils.calcularDias(d.data_entrada);
            html += '<div class="ficha-demanda">';
            html += '<strong>' + (d.especialidade || 'Sem especialidade') + '</strong>';
            html += '<div class="ficha-grid" style="margin-top:4px;">';
            html += '<div class="ficha-campo"><label>ENTRADA</label><span>' + Utils.formatarData(d.data_entrada) + ' (' + dias + 'd)</span></div>';
            if (d.data_procedimento) html += '<div class="ficha-campo"><label>DATA PROC</label><span>' + Utils.formatarData(d.data_procedimento) + '</span></div>';
            html += '<div class="ficha-campo"><label>PRIORIDADE</label><span>' + (LABELS_PRIO[d.prioridade] || d.prioridade || '-') + '</span></div>';
            html += '<div class="ficha-campo"><label>STATUS</label><span>' + (LABELS_STATUS[d.status] || d.status || '-') + '</span></div>';
            html += '<div class="ficha-campo"><label>SISTEMA</label><span>' + (d.sistema || '-') + '</span></div>';
            if (d.medico) html += '<div class="ficha-campo"><label>MEDICO</label><span>' + d.medico + '</span></div>';
            if (d.unidade) html += '<div class="ficha-campo"><label>UNIDADE</label><span>' + d.unidade + '</span></div>';
            if (d.pedido_core) html += '<div class="ficha-campo"><label>CORE</label><span>' + d.pedido_core + '</span></div>';
            if (d.pedido_sisreg) html += '<div class="ficha-campo"><label>SISREG</label><span>' + d.pedido_sisreg + '</span></div>';
            html += '</div>';
            if (d.procedimentos) html += '<div style="margin-top:4px;font-size:9pt;color:#334155;"><strong>Descricao:</strong> ' + d.procedimentos + '</div>';
            html += '</div>';
        }
    }

    if (p.observacoes && p.observacoes.length > 0) {
        html += '<h2>Observacoes (' + p.observacoes.length + ')</h2>';
        for (var j = 0; j < p.observacoes.length; j++) {
            var obs = p.observacoes[j];
            html += '<div class="ficha-demanda"><strong>' + Utils.formatarDataHora(obs.data_criacao) + '</strong><div>' + obs.texto + '</div></div>';
        }
    }

    html += '<div class="ficha-assinatura"><div>Assinatura do Responsavel</div><div>Carimbo da Unidade</div></div>';
    html += '<div class="ficha-rodape">SGP - Sistema de Gerenciamento de Pacientes | Documento sem validade legal sem assinaturas</div>';
    html += '</div>';

    area.innerHTML = html;
    area.style.display = 'block';
    area.style.visibility = 'visible';

    setTimeout(function() {
        window.print();
        setTimeout(function() { area.style.display = 'none'; }, 1000);
    }, 800);
}
/* ---- Sistema de Notificações com Marcao de Lido ---- */
async function abrirNotificacoes() {
    abrirModal('modal-notificacoes');
    
    var conteudo = document.getElementById('conteudo-notificacoes');
    if (!conteudo) return;
    
    conteudo.innerHTML = '<p style="text-align:center;color:var(--color-text-light);padding:20px;">Carregando alertas...</p>';
    
    try {
        var alertas = await API.getAlertas();
        if (!alertas) alertas = { alerta30dias: [], emergencias: [], retornosPendentes: [], total: 0 };

        // Carrega notificaes lidas do localStorage
        var lidas = JSON.parse(localStorage.getItem('notificacoes_lidas') || '[]');

        var html = '';

        if (alertas.total === 0) {
            html += '<div style="text-align:center;padding:40px;">';
            html += '<div style="font-size:4em;margin-bottom:15px;">✨</div>';
            html += '<h3 style="color:var(--color-text-light);">Tudo em dia!</h3>';
            html += '<p style="color:var(--color-text-light);">Nenhuma notificacao pendente no momento.</p>';
            html += '</div>';
        } else {
            // Botao para limpar todas
            html += '<div style="background:var(--color-border-light);padding:12px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">';
            html += '<strong>🔔 ' + alertas.total + ' alerta(s) requerem atencao</strong>';
            html += '<button class="btn btn-secondary btn-small" onclick="App.limparTodasNotificacoes()">✓ Marcar todas como lidas</button>';
            html += '</div>';

            // Emergencias
            if (alertas.emergencias && alertas.emergencias.length > 0) {
                html += '<div style="margin-bottom:20px;">';
                html += '<h4 style="color:var(--color-danger);border-bottom:2px solid var(--color-danger);padding-bottom:5px;margin-bottom:10px;">🔴 Emergencias (' + alertas.emergencias.length + ')</h4>';
                for (var i = 0; i < alertas.emergencias.length; i++) {
                    var e = alertas.emergencias[i];
                    var dias = calcularDias(e.data_entrada);
                    var chaveLida = 'emergencia_' + e.id;
                    var estaLida = lidas.indexOf(chaveLida) !== -1;
                    
                    html += '<div style="background:' + (estaLida ? 'rgba(148,163,184,.1)' : 'rgba(239,68,68,.08)') + ';border-left:4px solid ' + (estaLida ? 'var(--color-border)' : 'var(--color-danger)') + ';padding:12px;margin-bottom:8px;border-radius:6px;opacity:' + (estaLida ? '0.6' : '1') + ';">';
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">';
                    html += '<div><strong>' + (e.nome || 'Paciente') + '</strong>';
                    html += '<div style="font-size:.85em;color:var(--color-text-light);margin-top:3px;">' + (e.especialidade || '-') + '</div>';
                    html += '</div>';
                    html += '<div style="display:flex;gap:8px;align-items:center;">';
                    html += '<span style="background:' + (estaLida ? 'var(--color-border)' : 'var(--color-danger)') + ';color:white;padding:4px 10px;border-radius:10px;font-size:.8em;font-weight:bold;">' + dias + ' dias</span>';
                    if (!estaLida) {
                        html += '<button class="btn btn-secondary btn-small" onclick="App.marcarNotificacaoLida(\'' + chaveLida + '\')">✓ Lido</button>';
                    }
                    html += '</div></div></div>';
                }
                html += '</div>';
            }

            // Aguardando > 30 dias
            if (alertas.alerta30dias && alertas.alerta30dias.length > 0) {
                html += '<div style="margin-bottom:20px;">';
                html += '<h4 style="color:var(--color-warning);border-bottom:2px solid var(--color-warning);padding-bottom:5px;margin-bottom:10px;">⏰ Aguardando > 30 dias (' + alertas.alerta30dias.length + ')</h4>';
                for (var j = 0; j < alertas.alerta30dias.length; j++) {
                    var a = alertas.alerta30dias[j];
                    var diasA = calcularDias(a.data_entrada);
                    var chaveLida = 'alerta30_' + a.id;
                    var estaLida = lidas.indexOf(chaveLida) !== -1;
                    
                    html += '<div style="background:' + (estaLida ? 'rgba(148,163,184,.1)' : 'rgba(245,158,11,.08)') + ';border-left:4px solid ' + (estaLida ? 'var(--color-border)' : 'var(--color-warning)') + ';padding:12px;margin-bottom:8px;border-radius:6px;opacity:' + (estaLida ? '0.6' : '1') + ';">';
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">';
                    html += '<div><strong>' + (a.nome || 'Paciente') + '</strong>';
                    html += '<div style="font-size:.85em;color:var(--color-text-light);margin-top:3px;">' + (a.especialidade || '-') + ' • ' + (a.cidade_destino || 'sem destino') + '</div>';
                    html += '</div>';
                    html += '<div style="display:flex;gap:8px;align-items:center;">';
                    html += '<span style="background:' + (estaLida ? 'var(--color-border)' : 'var(--color-warning)') + ';color:white;padding:4px 10px;border-radius:10px;font-size:.8em;font-weight:bold;">' + diasA + ' dias</span>';
                    if (!estaLida) {
                        html += '<button class="btn btn-secondary btn-small" onclick="App.marcarNotificacaoLida(\'' + chaveLida + '\')">✓ Lido</button>';
                    }
                    html += '</div></div></div>';
                }
                html += '</div>';
            }

            // Retornos pendentes
            if (alertas.retornosPendentes && alertas.retornosPendentes.length > 0) {
                html += '<div style="margin-bottom:20px;">';
                html += '<h4 style="color:var(--color-info);border-bottom:2px solid var(--color-info);padding-bottom:5px;margin-bottom:10px;">🔄 Retornos Pendentes (' + alertas.retornosPendentes.length + ')</h4>';
                for (var k = 0; k < alertas.retornosPendentes.length; k++) {
                    var r = alertas.retornosPendentes[k];
                    var chaveLida = 'retorno_' + r.id;
                    var estaLida = lidas.indexOf(chaveLida) !== -1;
                    
                    html += '<div style="background:' + (estaLida ? 'rgba(148,163,184,.1)' : 'rgba(29,78,216,.08)') + ';border-left:4px solid ' + (estaLida ? 'var(--color-border)' : 'var(--color-info)') + ';padding:12px;margin-bottom:8px;border-radius:6px;opacity:' + (estaLida ? '0.6' : '1') + ';">';
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">';
                    html += '<div><strong>' + (r.nome || 'Paciente') + '</strong>';
                    html += '<div style="font-size:.85em;color:var(--color-text-light);margin-top:3px;">' + (r.especialidade || '-') + '</div>';
                    html += '</div>';
                    html += '<div style="display:flex;gap:8px;align-items:center;">';
                    html += '<span style="background:' + (estaLida ? 'var(--color-border)' : 'var(--color-info)') + ';color:white;padding:4px 10px;border-radius:10px;font-size:.8em;font-weight:bold;">Retorno</span>';
                    if (!estaLida) {
                        html += '<button class="btn btn-secondary btn-small" onclick="App.marcarNotificacaoLida(\'' + chaveLida + '\')">✓ Lido</button>';
                    }
                    html += '</div></div></div>';
                }
                html += '</div>';
            }
        }

        conteudo.innerHTML = html;
    } catch (err) {
        console.error('[NOTIF] Erro:', err);
        conteudo.innerHTML = '<p style="color:var(--color-danger);text-align:center;padding:20px;">Erro ao carregar notificacoes: ' + err.message + '</p>';
    }
}

function marcarNotificacaoLida(chave) {
    var lidas = JSON.parse(localStorage.getItem('notificacoes_lidas') || '[]');
    if (lidas.indexOf(chave) === -1) {
        lidas.push(chave);
        localStorage.setItem('notificacoes_lidas', JSON.stringify(lidas));
    }
    abrirNotificacoes(); // Recarrega
    atualizarNotificacoes(); // Atualiza badge
}

function limparTodasNotificacoes() {
    if (!confirm('Marcar todas as notificacoes como lidas?')) return;
    localStorage.setItem('notificacoes_lidas', JSON.stringify([]));
    abrirNotificacoes();
    atualizarNotificacoes();
    Toast.mostrar('Todas as notificacoes marcadas como lidas', 'success');
}

function calcularDias(dataEntrada) {
    if (!dataEntrada) return 0;
    var d1 = new Date(dataEntrada + 'T00:00:00');
    var d2 = new Date();
    return Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
}

function verAlertas() {
    fecharModal('modal-notificacoes');
    navegar('alertas');
}

function calcularDias(dataEntrada) {
    if (!dataEntrada) return 0;
    var d1 = new Date(dataEntrada + 'T00:00:00');
    var d2 = new Date();
    return Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
}

function verProcedimentoAlerta(procId) {
    fecharModal('modal-notificacoes');
    navegar('lista');
    setTimeout(function() {
        editarProcedimento(procId);
    }, 300);
}

function verProcedimentoEmergencia(procId) {
    verProcedimentoAlerta(procId);
}

function verAlertas() {
    fecharModal('modal-notificacoes');
    navegar('alertas');
}

    /* ---- API Global ---- */
    window.App = {
    navegar: navegar, editarPaciente: editarPaciente, excluirPaciente: excluirPaciente,
    duplicarPaciente: duplicarPaciente, verDetalhes: verDetalhes, mudarStatus: mudarStatus,
    adicionarRetorno: adicionarRetorno, confirmarNovoRetorno: confirmarNovoRetorno,
    finalizarRetorno: finalizarRetorno, fecharModal: fecharModal,
    adicionarDemanda: adicionarDemandaVazia, removerDemanda: removerDemanda, atualizarDemanda: atualizarDemanda,
    adicionarDemandaRetorno: adicionarDemandaRetorno, removerDemandaRetorno: removerDemandaRetorno, atualizarDemandaRetorno: atualizarDemandaRetorno,
    alternarTema: alternarTema, adicionarTag: adicionarTag, removerTag: removerTag, adicionarObservacao: adicionarObservacao,
    criarBackup: criarBackup, carregarBackupsServidor: carregarBackupsServidor,
    baixarBackupServidor: baixarBackupServidor, restaurarBackupServidor: restaurarBackupServidor,
    confirmarImportar: confirmarImportar,
    mudarStatusProcedimento: mudarStatusProcedimento,
    excluirProcedimento: excluirProcedimento,
    editarProcedimento: editarProcedimento,
    salvarEdicaoProcedimento: salvarEdicaoProcedimento,
    excluirProcedimentoDoModal: excluirProcedimentoDoModal,
    excluirProcedimentoDireto: excluirProcedimentoDireto,
    verPaciente: verPaciente,
    imprimirFichaPaciente: imprimirFichaPaciente,
    abrirNotificacoes: abrirNotificacoes,
    verProcedimentoAlerta: verProcedimentoAlerta,
    verProcedimentoEmergencia: verProcedimentoEmergencia,
    verAlertas: verAlertas,
    marcarNotificacaoLida: marcarNotificacaoLida,
    limparTodasNotificacoes: limparTodasNotificacoes,
    verAlertas: verAlertas,
    testarCampoCidade: testarCampoCidade
};

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializar);
    else inicializar();
})();

function testarCampoCidade() {
    console.log('[CLIENT] ========================================');
    console.log('[CLIENT] TESTE MANUAL DO CAMPO CIDADE');
    console.log('[CLIENT] ========================================');
    
    var elCidade = document.getElementById('edit-proc-cidade-destino');
    
    if (!elCidade) {
        console.error('[CLIENT] ❌ Elemento NAO ENCONTRADO!');
        alert('ERRO: Campo cidade nao encontrado no DOM!');
        return;
    }
    
    console.log('[CLIENT] Elemento encontrado:', elCidade);
    console.log('[CLIENT] Valor atual:', elCidade.value);
    console.log('[CLIENT] Tipo:', elCidade.type);
    console.log('[CLIENT] Nome:', elCidade.name);
    console.log('[CLIENT] ID:', elCidade.id);
    console.log('[CLIENT] Visivel:', window.getComputedStyle(elCidade).display !== 'none');
    
    alert('Campo encontrado!\n\nValor atual: "' + elCidade.value + '"\n\nDigite algo no campo e clique OK para ver se atualiza.');
    
    console.log('[CLIENT] Valor apos alerta:', elCidade.value);
    console.log('[CLIENT] ========================================');
}