/* ================================================================
   GRAFICOS SVG PURO
   ================================================================ */

var ChartsManager = (function() {
    var CORES = { azul: '#3b82f6', verde: '#10b981', amarelo: '#f59e0b', vermelho: '#ef4444', core: '#3730a3', sisreg: '#9f1239', ambos: '#6366f1', cinza: '#94a3b8' };
    var MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    var DONUT = { cx: 150, cy: 150, rExterno: 110, rInterno: 65 };
    var BARRAS = { w: 800, h: 300, pad: { t: 20, r: 20, b: 50, l: 50 }, linhas: 5 };

    function _pontoCirculo(cx, cy, raio, angulo) {
        return { x: cx + raio * Math.cos(angulo), y: cy + raio * Math.sin(angulo) };
    }

    function _segmentoDonut(angInicio, angFim, cor) {
        var pct = (angFim - angInicio) / (2 * Math.PI);
        if (pct >= 0.999) {
            return '<circle cx="' + DONUT.cx + '" cy="' + DONUT.cy + '" r="' + DONUT.rExterno + '" fill="' + cor + '"/><circle cx="' + DONUT.cx + '" cy="' + DONUT.cy + '" r="' + DONUT.rInterno + '" fill="var(--color-surface)"/>';
        }
        var p1 = _pontoCirculo(DONUT.cx, DONUT.cy, DONUT.rExterno, angInicio);
        var p2 = _pontoCirculo(DONUT.cx, DONUT.cy, DONUT.rExterno, angFim);
        var p3 = _pontoCirculo(DONUT.cx, DONUT.cy, DONUT.rInterno, angFim);
        var p4 = _pontoCirculo(DONUT.cx, DONUT.cy, DONUT.rInterno, angInicio);
        var la = pct > 0.5 ? 1 : 0;
        return '<path d="M ' + p1.x + ' ' + p1.y + ' A ' + DONUT.rExterno + ' ' + DONUT.rExterno + ' 0 ' + la + ' 1 ' + p2.x + ' ' + p2.y + ' L ' + p3.x + ' ' + p3.y + ' A ' + DONUT.rInterno + ' ' + DONUT.rInterno + ' 0 ' + la + ' 0 ' + p4.x + ' ' + p4.y + ' Z" fill="' + cor + '" stroke="var(--color-surface)" stroke-width="2"/>';
    }

    function _renderDonut(svgId, legendaId, dados) {
        var svg = document.getElementById(svgId);
        var leg = document.getElementById(legendaId);
        if (!svg || !leg) return;
        svg.innerHTML = '';
        leg.innerHTML = '';
        var validos = (dados || []).filter(function(d) { return d && d.valor > 0; });
        if (!validos.length) {
            svg.innerHTML = '<text x="150" y="150" text-anchor="middle" fill="var(--color-text-light)" font-size="14">Sem dados</text>';
            leg.innerHTML = '<span style="color:var(--color-text-light);">Nenhum dado</span>';
            return;
        }
        var total = validos.reduce(function(s, d) { return s + d.valor; }, 0);
        var ang = -Math.PI / 2;
        var htmlSvg = '';
        validos.forEach(function(d) {
            var pct = d.valor / total;
            var angF = ang + (pct * 2 * Math.PI);
            htmlSvg += _segmentoDonut(ang, angF, d.cor);
            ang = angF;
        });
        svg.innerHTML = htmlSvg + '<text x="' + DONUT.cx + '" y="' + (DONUT.cy - 5) + '" text-anchor="middle" font-size="28" font-weight="bold" fill="var(--color-text)">' + total + '</text><text x="' + DONUT.cx + '" y="' + (DONUT.cy + 18) + '" text-anchor="middle" font-size="11" fill="var(--color-text-light)">Total</text>';
        validos.forEach(function(d) {
            var pct = ((d.valor / total) * 100).toFixed(1);
            var item = document.createElement('div');
            item.className = 'legenda-item';
            item.innerHTML = '<span class="legenda-cor" style="background:' + d.cor + '"></span><span>' + d.label + '</span><span class="legenda-valor">' + d.valor + ' (' + pct + '%)</span>';
            leg.appendChild(item);
        });
    }

    function _renderBarras(svgId, dados) {
        var svg = document.getElementById(svgId);
        if (!svg) return;
        svg.innerHTML = '';
        if (!dados || !dados.length || dados.every(function(d) { return !d || d.valor === 0; })) {
            svg.innerHTML = '<text x="400" y="150" text-anchor="middle" fill="var(--color-text-light)" font-size="14">Sem dados</text>';
            return;
        }
        var hu = BARRAS.h - BARRAS.pad.t - BARRAS.pad.b;
        var max = Math.max.apply(null, dados.map(function(d) { return d ? d.valor : 0; })) || 1;
        var lb = (BARRAS.w - BARRAS.pad.l - BARRAS.pad.r) / dados.length;
        var html = '';
        for (var i = 0; i <= BARRAS.linhas; i++) {
            var y = BARRAS.pad.t + (hu / BARRAS.linhas) * i;
            var val = Math.round(max - (max / BARRAS.linhas) * i);
            html += '<line x1="' + BARRAS.pad.l + '" y1="' + y + '" x2="' + (BARRAS.w - BARRAS.pad.r) + '" y2="' + y + '" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="2,2"/><text x="' + (BARRAS.pad.l - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="var(--color-text-light)">' + val + '</text>';
        }
        dados.forEach(function(d, idx) {
            if (!d) return;
            var esp = lb * 0.2;
            var le = lb - esp;
            var x = BARRAS.pad.l + (lb * idx) + (esp / 2);
            var altB = (d.valor / max) * hu;
            var yPos = BARRAS.pad.t + hu - altB;
            var cor = d.cor || CORES.cinza;
            html += '<rect x="' + x + '" y="' + yPos + '" width="' + le + '" height="' + altB + '" fill="' + cor + '" rx="4"><title>' + d.label + ': ' + d.valor + '</title></rect>';
            if (d.valor > 0) html += '<text x="' + (x + le / 2) + '" y="' + (yPos - 5) + '" text-anchor="middle" font-size="11" font-weight="600" fill="var(--color-text)">' + d.valor + '</text>';
            var lbl = d.label.length > 12 ? d.label.substring(0, 10) + '...' : d.label;
            html += '<text x="' + (x + le / 2) + '" y="' + (BARRAS.h - BARRAS.pad.b + 18) + '" text-anchor="middle" font-size="11" fill="var(--color-text-light)">' + lbl + '</text>';
        });
        svg.innerHTML = html;
    }

    return {
        MESES: MESES,
        CORES: CORES,
        renderizarDashboardFromStats: function(stats) {
            if (!stats) stats = {};
            if (!stats.prioridade) stats.prioridade = {};
            if (!stats.sistema) stats.sistema = {};
            _renderDonut('grafico-prioridade', 'legenda-prioridade', [
                { label: 'Azul', valor: stats.prioridade.azul || 0, cor: CORES.azul },
                { label: 'Verde', valor: stats.prioridade.verde || 0, cor: CORES.verde },
                { label: 'Amarelo', valor: stats.prioridade.amarelo || 0, cor: CORES.amarelo },
                { label: 'Vermelho', valor: stats.prioridade.vermelho || 0, cor: CORES.vermelho }
            ]);
            _renderDonut('grafico-sistema', 'legenda-sistema', [
                { label: 'Core', valor: stats.sistema.core || 0, cor: CORES.core },
                { label: 'Sisreg', valor: stats.sistema.sisreg || 0, cor: CORES.sisreg },
                { label: 'Ambos', valor: stats.sistema.ambos || 0, cor: CORES.ambos }
            ]);
            _renderBarras('grafico-meses', (stats.porMes || []).map(function(m) {
                var partes = (m.mes || '').split('-');
                return { label: MESES[parseInt(partes[1]) - 1] + '/' + (partes[0] || '').slice(-2), valor: m.total || 0, cor: CORES.azul };
            }));
            _renderBarras('grafico-cidades', (stats.porCidade || []).map(function(c) {
                return { label: c.cidade || '', valor: c.total || 0, cor: CORES.verde };
            }));
        }
    };
})();