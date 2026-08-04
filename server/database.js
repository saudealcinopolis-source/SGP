/* ================================================================
   BANCO DE DADOS - SQLite via sql.js (Otimizado para Render.com)
   ================================================================ */

var initSqlJs = require('sql.js');
var fs = require('fs');
var path = require('path');

// Usa variável de ambiente do Render para disco persistente, ou cai para pasta local
var DB_DIR = process.env.RENDER_DISK_PATH || path.join(__dirname, '..', 'dados');
var DB_PATH = path.join(DB_DIR, 'sgp.db');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

var db = null;

function salvar() {
    try {
        var data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (err) {
        console.error('[DB] Erro ao salvar:', err.message);
    }
}

function converterParams(sql, params) {
    if (!params) return { sql: sql, values: [] };
    if (Array.isArray(params)) return { sql: sql, values: params };
    var keys = Object.keys(params);
    var values = [];
    var sqlConvertido = sql;
    for (var i = 0; i < keys.length; i++) {
        values.push(params[keys[i]]);
        sqlConvertido = sqlConvertido.replace(new RegExp('@' + keys[i], 'g'), '?');
    }
    return { sql: sqlConvertido, values: values };
}

function executarSQL(sql, params) {
    var convertido = converterParams(sql, params);
    db.run(convertido.sql, convertido.values);
    salvar();
    var result = db.exec("SELECT last_insert_rowid() as id");
    var lastId = 0;
    if (result && result.length > 0 && result[0].values && result[0].values.length > 0) {
        lastId = result[0].values[0][0];
    }
    return { changes: db.getRowsModified(), lastInsertRowid: lastId };
}

function buscarUm(sql, params) {
    var convertido = converterParams(sql, params);
    var stmt = db.prepare(convertido.sql);
    if (convertido.values.length > 0) stmt.bind(convertido.values);
    var resultado = null;
    if (stmt.step()) {
        var colunas = stmt.getColumnNames();
        var valores = stmt.get();
        resultado = {};
        for (var i = 0; i < colunas.length; i++) resultado[colunas[i]] = valores[i];
    }
    stmt.free();
    return resultado;
}

function buscarTodos(sql, params) {
    var convertido = converterParams(sql, params);
    var stmt = db.prepare(convertido.sql);
    if (convertido.values.length > 0) stmt.bind(convertido.values);
    var resultados = [];
    while (stmt.step()) {
        var colunas = stmt.getColumnNames();
        var valores = stmt.get();
        var row = {};
        for (var i = 0; i < colunas.length; i++) row[colunas[i]] = valores[i];
        resultados.push(row);
    }
    stmt.free();
    return resultados;
}

async function inicializarBanco() {
    var SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        var buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
        console.log('[DB] Banco carregado:', DB_PATH);
    } else {
        db = new SQL.Database();
        console.log('[DB] Novo banco criado em:', DB_PATH);
    }

    // Otimizações de performance para SQLite
    db.run("PRAGMA foreign_keys = ON");
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA synchronous = NORMAL");
    db.run("PRAGMA cache_size = -64000");

    // Paciente = dados pessoais + médico solicitante
    db.run(
        "CREATE TABLE IF NOT EXISTS pacientes (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
        "nome TEXT NOT NULL, " +
        "documento_tipo TEXT NOT NULL DEFAULT 'cpf', " +
        "documento_valor TEXT NOT NULL DEFAULT '', " +
        "cidade TEXT DEFAULT '', " +
        "nome_mae TEXT DEFAULT '', " +
        "nascimento TEXT DEFAULT '', " +
        "telefone TEXT DEFAULT '', " +
        "telefone2 TEXT DEFAULT '', " +
        "endereco TEXT DEFAULT '', " +
        "medico_solicitante TEXT DEFAULT '', " +
        "data_cadastro TEXT NOT NULL DEFAULT (datetime('now','localtime')))"
    );

    // Procedimento = demanda isolada com local e médico do procedimento
    db.run(
        "CREATE TABLE IF NOT EXISTS demandas (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
        "paciente_id INTEGER NOT NULL, " +
        "especialidade TEXT NOT NULL DEFAULT '', " +
        "procedimentos TEXT DEFAULT '', " +
        "pedido_core TEXT DEFAULT '', " +
        "pedido_sisreg TEXT DEFAULT '', " +
        "data_procedimento TEXT DEFAULT '', " +
        "data_entrada TEXT NOT NULL DEFAULT (date('now','localtime')), " +
        "prioridade TEXT NOT NULL DEFAULT 'azul', " +
        "status TEXT NOT NULL DEFAULT 'aguardando', " +
        "sistema TEXT NOT NULL DEFAULT 'core', " +
        "unidade TEXT DEFAULT '', " +
        "local TEXT DEFAULT '', " +
        "medico_procedimento TEXT DEFAULT '', " +
        "cidade_destino TEXT DEFAULT '', " +
        "data_liberacao TEXT DEFAULT '', " +
        "data_retorno TEXT DEFAULT '', " +
        "data_finalizacao TEXT DEFAULT '', " +
        "FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE)"
    );

    // Migrações para bancos antigos
    var migracoes = [
        "ALTER TABLE pacientes ADD COLUMN medico_solicitante TEXT DEFAULT ''",
        "ALTER TABLE demandas ADD COLUMN local TEXT DEFAULT ''",
        "ALTER TABLE demandas ADD COLUMN medico_procedimento TEXT DEFAULT ''",
        "ALTER TABLE demandas ADD COLUMN cidade_destino TEXT DEFAULT ''",
        "ALTER TABLE demandas ADD COLUMN data_entrada TEXT DEFAULT ''",
        "ALTER TABLE demandas ADD COLUMN prioridade TEXT DEFAULT 'azul'",
        "ALTER TABLE demandas ADD COLUMN status TEXT DEFAULT 'aguardando'",
        "ALTER TABLE demandas ADD COLUMN sistema TEXT DEFAULT 'core'",
        "ALTER TABLE demandas ADD COLUMN unidade TEXT DEFAULT ''",
        "ALTER TABLE demandas ADD COLUMN data_liberacao TEXT DEFAULT ''",
        "ALTER TABLE demandas ADD COLUMN data_retorno TEXT DEFAULT ''",
        "ALTER TABLE demandas ADD COLUMN data_finalizacao TEXT DEFAULT ''"
    ];
    for (var i = 0; i < migracoes.length; i++) {
        try { db.run(migracoes[i]); } catch (e) { /* ignora se já existir */ }
    }

    db.run("CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY AUTOINCREMENT, paciente_id INTEGER NOT NULL, nome TEXT NOT NULL, cor TEXT NOT NULL DEFAULT 'azul', FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE)");
    db.run("CREATE TABLE IF NOT EXISTS historico_status (id INTEGER PRIMARY KEY AUTOINCREMENT, demanda_id INTEGER NOT NULL, status TEXT NOT NULL, data_criacao TEXT NOT NULL DEFAULT (datetime('now','localtime')), FOREIGN KEY (demanda_id) REFERENCES demandas(id) ON DELETE CASCADE)");

    db.run("CREATE INDEX IF NOT EXISTS idx_dem_paciente ON demandas(paciente_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_dem_status ON demandas(status)");
    db.run("CREATE INDEX IF NOT EXISTS idx_dem_data ON demandas(data_entrada)");
    db.run("CREATE INDEX IF NOT EXISTS idx_dem_cidade_destino ON demandas(cidade_destino)");
    db.run("CREATE INDEX IF NOT EXISTS idx_pac_documento ON pacientes(documento_valor)");
    db.run("CREATE INDEX IF NOT EXISTS idx_pac_nome ON pacientes(nome)");

    salvar();
    console.log('[DB] Tabelas prontas e otimizadas');
    return true;
}

module.exports = {
    init: inicializarBanco,
    prepare: function(sql) {
        return {
            run: function(params) { return executarSQL(sql, params); },
            get: function(params) { return buscarUm(sql, params); },
            all: function(params) { return buscarTodos(sql, params); }
        };
    },
    exec: function(sql) { db.run(sql); salvar(); },
    save: salvar
};