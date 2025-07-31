// Aguarda o carregamento completo da página para rodar o script
document.addEventListener('DOMContentLoaded', function() {

    // URL da sua API gerada pelo Sheet.best
    const SHEET_URL = 'https://api.sheetbest.com/sheets/ed83873b-c4dc-45e6-ac5e-b1108852dceb';

    // Função principal para buscar e renderizar os dados
    async function carregarDados() {
        try {
            // Busca dados de ambas as abas (Funcionarios e Ausencias)
            const [funcionarios, ausencias] = await Promise.all([
                fetch(`${SHEET_URL}/tabs/Funcionarios`).then(res => res.json()),
                fetch(`${SHEET_URL}/tabs/Ausencias`).then(res => res.json())
            ]);

            const hoje = new Date();
            const dadosProcessados = processarAusencias(funcionarios, ausencias, hoje);
            renderizarPainel(dadosProcessados);
            atualizarResumo(dadosProcessados);

        } catch (error) {
            console.error('Erro ao buscar dados da planilha:', error);
            document.getElementById('status-grid').innerHTML = '<p>Falha ao carregar os dados. Verifique a URL da planilha e a conexão.</p>';
        }
    }

    // Função para verificar se alguém está ausente hoje
    function processarAusencias(funcionarios, ausencias, hoje) {
        return funcionarios.map(func => {
            const ausenciaAtiva = ausencias.find(aus => {
                if (aus.id_funcionario == func.id) {
                    const inicio = new Date(aus.data_inicio.split('/').reverse().join('-'));
                    const fim = new Date(aus.data_fim.split('/').reverse().join('-'));
                    // Ajusta para incluir o dia todo
                    fim.setHours(23, 59, 59, 999);
                    return hoje >= inicio && hoje <= fim;
                }
                return false;
            });

            if (ausenciaAtiva) {
                return { ...func, status_atual: ausenciaAtiva.tipo_ausencia, detalhes_ausencia: `${ausenciaAtiva.data_inicio} - ${ausenciaAtiva.data_fim}` };
            } else {
                return { ...func, status_atual: 'Presente' };
            }
        });
    }

    // Função para desenhar os cards na tela
    function renderizarPainel(funcionarios) {
        const grid = document.getElementById('status-grid');
        grid.innerHTML = ''; // Limpa a área antes de desenhar

        // Agrupa os funcionários por grupo e turno
        const grupos = funcionarios.reduce((acc, func) => {
            const key = `${func.grupo} ${func.turno}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(func);
            return acc;
        }, {});

        // Cria o HTML para cada grupo
        for (const nomeGrupo in grupos) {
            const funcionariosDoGrupo = grupos[nomeGrupo];
            const temAusente = funcionariosDoGrupo.some(f => f.status_atual !== 'Presente');

            const groupDiv = document.createElement('div');
            groupDiv.className = 'team-group';

            let groupHTML = `
                <div class="team-header">
                    <h4>${nomeGrupo}</h4>
                    <span class="status-badge ${temAusente ? 'warning' : 'ok'}">${temAusente ? 'Atenção' : 'OK'}</span>
                </div>
            `;

            funcionariosDoGrupo.forEach(func => {
                const statusClass = func.status_atual.toLowerCase().replace('é', 'e');
                groupHTML += `
                    <div class="employee">
                        <div>
                            <div class="employee-name">${func.nome}</div>
                            ${func.detalhes_ausencia ? `<div class="employee-details">${func.detalhes_ausencia}</div>` : ''}
                        </div>
                        <span class="employee-status status-${statusClass}">${func.status_atual}</span>
                    </div>
                `;
            });

            groupDiv.innerHTML = groupHTML;
            grid.appendChild(groupDiv);
        }
    }

    // Função para atualizar os contadores do resumo
    function atualizarResumo(funcionarios) {
        const presentes = funcionarios.filter(f => f.status_atual === 'Presente').length;
        const ferias = funcionarios.filter(f => f.status_atual === 'Férias').length;
        const outrasAusencias = funcionarios.filter(f => f.status_atual !== 'Presente' && f.status_atual !== 'Férias').length;

        document.getElementById('count-presentes').textContent = presentes;
        document.getElementById('count-ferias').textContent = ferias;
        document.getElementById('count-ausentes').textContent = outrasAusencias;
    }

    // Inicia o processo
    carregarDados();
});