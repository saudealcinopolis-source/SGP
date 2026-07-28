/* ================================================================
   UTILITARIOS - Validadores e Formatadores
   ================================================================ */

var Utils = {
    validarCPF: function(cpf) {
        cpf = cpf.replace(/\D/g, '');
        if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
        var soma = 0;
        for (var i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
        var d1 = 11 - (soma % 11); if (d1 >= 10) d1 = 0;
        if (parseInt(cpf[9]) !== d1) return false;
        soma = 0;
        for (var j = 0; j < 10; j++) soma += parseInt(cpf[j]) * (11 - j);
        var d2 = 11 - (soma % 11); if (d2 >= 10) d2 = 0;
        return parseInt(cpf[10]) === d2;
    },

    validarCNS: function(cns) {
        cns = cns.replace(/\D/g, '');
        if (cns.length !== 15) return false;
        if (/^[12]/.test(cns)) {
            var s = 0;
            for (var i = 0; i < 15; i++) s += parseInt(cns[i]) * (15 - i);
            return s % 11 === 0;
        }
        return /^[789]\d{14}$/.test(cns);
    },

    formatarCPF: function(v) {
        v = v.replace(/\D/g, '').substring(0, 11);
        return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    },

    formatarCNS: function(v) {
        v = v.replace(/\D/g, '').substring(0, 15);
        return v.replace(/(\d{3})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4');
    },

    formatarTelefone: function(v) {
        v = v.replace(/\D/g, '').substring(0, 11);
        if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    },

    formatarData: function(d) {
        if (!d) return '-';
        var p = d.split('-');
        if (p.length !== 3) return d;
        return p[2] + '/' + p[1] + '/' + p[0];
    },

    formatarDataHora: function(iso) {
        if (!iso) return '-';
        try { return new Date(iso).toLocaleString('pt-BR'); } catch (e) { return iso; }
    },

    calcularDias: function(d) {
        if (!d) return 0;
        var d1 = new Date(d + 'T00:00:00');
        var d2 = new Date();
        return Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
    },

    escapeHtml: function(t) {
        if (!t) return '';
        return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
};