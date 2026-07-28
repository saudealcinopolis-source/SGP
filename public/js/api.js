var API = {
    BASE_URL: '/api',
    request: function(method, endpoint, body) {
        return fetch(this.BASE_URL + endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        }).then(function(response) {
            return response.json().then(function(data) {
                if (!response.ok) throw new Error(data.erro || 'Erro');
                return data;
            });
        });
    },
    listarProcedimentos: function() { return this.request('GET', '/pacientes'); },
    buscarPaciente: function(id) { return this.request('GET', '/pacientes/' + id); },
    criarPacienteEProcedimento: function(d) { return this.request('POST', '/pacientes', d); },
    atualizarPaciente: function(id, d) { return this.request('PUT', '/pacientes/' + id, d); },
    excluirPaciente: function(id) { return this.request('DELETE', '/pacientes/' + id); },
    adicionarProcedimento: function(pacienteId, d) { return this.request('POST', '/pacientes/' + pacienteId + '/procedimento', d); },
    atualizarProcedimento: function(id, d) { return this.request('PUT', '/pacientes/procedimento/' + id, d); },
    excluirProcedimento: function(id) { return this.request('DELETE', '/pacientes/procedimento/' + id); },
    getDashboardStats: function() { return this.request('GET', '/pacientes/stats/dashboard'); },
    getAlertas: function() { return this.request('GET', '/pacientes/alertas/lista'); },
    getCidades: function() { return this.request('GET', '/pacientes/listas/cidades'); },
    getEspecialidades: function() { return this.request('GET', '/pacientes/listas/especialidades'); },
    getTags: function() { return this.request('GET', '/pacientes/listas/tags'); },
    buscarPorNome: function(nome) { return this.request('GET', '/pacientes/buscar-nome?q=' + encodeURIComponent(nome)); },
    uploadDocumento: function(pacienteId, file) {
        var fd = new FormData(); fd.append('documento', file);
        return fetch(this.BASE_URL + '/documentos/upload/' + pacienteId, { method: 'POST', body: fd })
            .then(function(r) { return r.json().then(function(d) { if (!r.ok) throw new Error(d.erro); return d; }); });
    },
    getDownloadUrl: function(f) { return this.BASE_URL + '/documentos/download/' + f; },
    removerDocumento: function(id) { return this.request('DELETE', '/documentos/' + id); },
    adicionarObservacao: function(pid, texto) { return this.request('POST', '/extras/observacoes', { pacienteId: pid, texto: texto }); },
    gerarRelatorio: function(f) { return this.request('GET', '/extras/relatorio?' + new URLSearchParams(f).toString()); },
    criarBackup: function() { window.open(this.BASE_URL + '/backup/criar', '_blank'); },
    listarBackups: function() { return this.request('GET', '/backup/listar'); },
    baixarBackup: function(nome) { window.open(this.BASE_URL + '/backup/baixar/' + encodeURIComponent(nome), '_blank'); },
    restaurarBackup: function(file) {
        var fd = new FormData(); fd.append('backup', file);
        return fetch(this.BASE_URL + '/backup/restaurar', { method: 'POST', body: fd })
            .then(function(r) { return r.json().then(function(d) { if (!r.ok) throw new Error(d.erro); return d; }); });
    },
    importarDados: function(dados) { return this.request('POST', '/backup/importar-json', dados); }
};