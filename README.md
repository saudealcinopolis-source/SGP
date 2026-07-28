# 🏥 SGP - Sistema de Gerenciamento de Pacientes

Sistema web para controle de demandas médicas com suporte a múltiplos procedimentos por paciente, relatórios em PDF e backup automático.

## ✨ Funcionalidades

- **Cadastro único de paciente** com dados pessoais preservados
- **Múltiplos procedimentos isolados** (cada um com status, datas e acompanhamento próprios)
- **Controle de atrasos** por procedimento individual
- **Relatórios em PDF** com filtros avançados
- **Visualização detalhada** do histórico completo do paciente
- **Edição e exclusão** individual de procedimentos
- **Backup e restauração** do banco de dados
- **Importação** de dados de sistemas antigos (JSON)
- **Tema claro/escuro**
- **Interface responsiva**

## 🚀 Como Rodar

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 18 ou superior)

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/SEU-USUARIO/sgp.git
cd sgp

2. Instale as dependências:
npm install

3.Inicie o servidor:
node server/index.js
Ou no Windows, execute o arquivo:
iniciar.bat dentro da pasta

4. Abra o navegador em: http://localhost:3000

### 📁 Estrutura do Projeto

SGP/
├── server/              # Backend (Node.js + Express)
│   ├── index.js        # Servidor principal
│   ├── database.js     # Configuração do SQLite
│   └── routes/         # Rotas da API
├── public/             # Frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── css/
│   └── js/
├── dados/              # Banco de dados (NÃO versionado)
├── backups/            # Backups do sistema (NÃO versionado)
├── package.json
└── README.md

### 💾 Backup
O sistema gera backups em formato .db. Use a aba Backup dentro do sistema ou execute:
fazer-backup.bat

### 🔧 Tecnologias
Backend: Node.js, Express, sql.js (SQLite em JavaScript puro)
Frontend: HTML5, CSS3, JavaScript Vanilla
Banco: SQLite (via sql.js, sem compilação nativa)
Outros: Multer (uploads), UUID, CORS

📄 Licença
Projeto desenvolvido para uso interno Thiago Souza Tavares.