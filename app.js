// Importa a biblioteca pg (node-postgres) e readline
const { Client } = require('pg');
const readline = require('readline');

// Configuração de conexão com o PostgreSQL
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: '271296',
  port: 5432,
});

// Criar interface de leitura do teclado
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Função para conectar ao banco de dados
async function connectDatabase() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados PostgreSQL.');
  } catch (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
  }
}

// Função para criar titulares iniciais com IDs específicos
async function createInitialTitulares() {
  const titulares = [
    { id: 1, nome: 'João', limite: 1000.00 },
    { id: 2, nome: 'Gabriel', limite: 1500.00 },
    { id: 3, nome: 'Vinicius', limite: 2000.00 },
    { id: 4, nome: 'Leandro', limite: 2500.00 },
  ];

  for (const titular of titulares) {
    try {
      const query = `
        INSERT INTO titulares(id, nome, limite) 
        VALUES($1, $2, $3) 
        ON CONFLICT (id) DO NOTHING
        RETURNING *`;
      const res = await client.query(query, [titular.id, titular.nome, titular.limite]);
      if (res.rowCount > 0) {
        console.log(`Titular ${titular.nome} criado com sucesso.`);
      } else {
        console.log(`Titular ${titular.nome} já existe.`);
      }
    } catch (err) {
      console.error(`Erro ao criar titular ${titular.nome}:`, err);
    }
  }
}

// Função para criar um novo titular
async function createTitular() {
  rl.question('Digite o nome do novo titular: ', async (nome) => {
    rl.question('Digite o limite do novo titular: ', async (limite) => {
      limite = parseFloat(limite);
      if (isNaN(limite)) {
        console.log('Erro: O limite informado não é válido.');
        rl.close();
        return;
      }

      try {
        const query = 'INSERT INTO titulares(nome, limite) VALUES($1, $2) RETURNING *';
        const res = await client.query(query, [nome, limite]);
        console.log('Novo titular criado com sucesso:', res.rows[0]);
        rl.close();
      } catch (err) {
        console.error('Erro ao criar titular:', err);
        rl.close();
      }
    });
  });
}

// Função para listar todos os titulares
async function listTitulares() {
  const query = 'SELECT * FROM titulares ORDER BY id';
  try {
    const res = await client.query(query);
    console.log('Lista de titulares:');
    res.rows.forEach(titular => {
      console.log(`ID: ${titular.id}, Nome: ${titular.nome}, Limite: ${titular.limite}`);
    });
  } catch (err) {
    console.error('Erro ao listar titulares:', err);
  }
}

// Função para iniciar a transação e alterar o limite de um titular
async function iniciarTransacaoParaAlteracao() {
  try {
    await client.query('BEGIN');

    await listTitulares();

    rl.question('Digite o ID do titular que deseja alterar: ', async (id) => {
      const res = await client.query('SELECT * FROM titulares WHERE id = $1', [id]);

      if (res.rows.length === 0) {
        console.log('Cliente não encontrado.');
        await client.query('ROLLBACK');
        rl.close();
        return;
      }

      const titularAtual = res.rows[0];
      console.log(`Dados atuais do titular: Nome: ${titularAtual.nome}, Limite: ${titularAtual.limite}`);

      rl.question('Digite o novo limite: ', async (novoLimite) => {
        novoLimite = parseFloat(novoLimite);
        if (isNaN(novoLimite)) {
          console.log('Erro: O limite informado não é válido.');
          await client.query('ROLLBACK');
          rl.close();
          return;
        }

        try {
          const updateRes = await client.query(
            'UPDATE titulares SET limite = $1 WHERE id = $2 RETURNING *',
            [novoLimite, id]
          );

          if (updateRes.rowCount > 0) {
            console.log('Limite atualizado com sucesso:', updateRes.rows[0]);

            rl.question('Confirma a alteração? (s/n): ', async (confirmacao) => {
              if (confirmacao.toLowerCase() === 's') {
                await client.query('COMMIT');
                console.log('Transação confirmada e concluída.');
              } else {
                await client.query('ROLLBACK');
                console.log('Alteração cancelada.');
              }
              rl.close();
            });
          }
        } catch (err) {
          console.error('Erro ao atualizar limite:', err);
          await client.query('ROLLBACK');
          rl.close();
        }
      });
    });
  } catch (err) {
    console.error('Erro na transação:', err);
    await client.query('ROLLBACK');
    rl.close();
  }
}

// Função principal que interage com o console
async function runApp() {
  await connectDatabase();
  await createInitialTitulares();

  rl.question('Escolha uma opção:\n1 - Cadastrar Titular\n2 - Alterar Limite\n3 - Listar Titulares\n4 - Sair\nEscolha: ', async (opcao) => {
    switch (opcao) {
      case '1':
        await createTitular();
        break;
      case '2':
        await iniciarTransacaoParaAlteracao();
        break;
      case '3':
        await listTitulares();
        rl.close();
        break;
      case '4':
        console.log('Encerrando aplicação.');
        rl.close();
        break;
      default:
        console.log('Opção inválida');
        rl.close();
        break;
    }
  });

  rl.on('close', async () => {
    await client.end();
  });
}

// Executa a aplicação
runApp();
