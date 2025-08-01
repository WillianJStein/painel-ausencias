// Aguarda o carregamento completo da página para rodar o script
document.addEventListener('DOMContentLoaded', function() {

    // URL da sua API gerada pelo Sheet.best (exatamente como o site fornece)
    const SHEET_URL = 'https://api.sheetbest.com/sheets/03fb9dd1-3bd9-4c41-a5d5-dad1f5574eaf';

    // Função principal para buscar e renderizar os dados
    async function carregarDados() {
        try {
            // Busca dados de ambas as abas usando o parâmetro "?_tab=NomeDaAba"
            const [funcionarios, ausencias] = await Promise.all([
                fetch(`${SHEET_URL}?_tab=Funcionarios`).then(res => res.json()),
                fetch(`${SHEET_URL}?_tab=Ausencias`).then(res => res.json())
            ]);

            // Se a busca falhar e retornar um objeto com 'error', lança um erro
            if (funcionarios.error || ausencias.error) {
                throw new Error('Uma das abas não foi encontrada. Verifique os nomes das abas na planilha.');
            }

            const hoje = new Date();
            const dadosProcessados = processarAusencias(funcionarios, ausencias, hoje);
            renderizarPainel(dadosProcessados);
            atualizarResumo(dadosProcessados);
			renderizarCalendario(funcionarios, ausencias);

        } catch (error) {
            console.error('Erro ao buscar dados da planilha:', error);
            document.getElementById('status-grid').innerHTML = '<p>Falha ao carregar os dados. Verifique a URL e os nomes das abas na planilha.</p>';
        }
    }

    // Função para verificar se alguém está ausente hoje
    function processarAusencias(funcionarios, ausencias, hoje) {
        return funcionarios.map(func => {
            const ausenciaAtiva = ausencias.find(aus => {
                if (aus.id_funcionario == func.id) {
                    // Converte a data dd/mm/yyyy para um objeto Date válido
                    const [diaInicio, mesInicio, anoInicio] = aus.data_inicio.split('/');
                    const [diaFim, mesFim, anoFim] = aus.data_fim.split('/');
                    const inicio = new Date(+anoInicio, mesInicio - 1, +diaInicio);
                    const fim = new Date(+anoFim, mesFim - 1, +diaFim);
                    
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

        const grupos = funcionarios.reduce((acc, func) => {
            const key = `${func.grupo} ${func.turno}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(func);
            return acc;
        }, {});

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
                const statusClass = func.status_atual.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
// Função para desenhar o calendário com os dados de ausências
function renderizarCalendario(funcionarios, ausencias) {
    const calendarEl = document.getElementById('calendar');

    // Formata os dados de ausências para o formato que o FullCalendar entende
    // ADICIONAMOS O .filter() AQUI para ignorar linhas vazias da planilha
    const eventos = ausencias.filter(aus => aus.data_inicio && aus.data_fim).map(aus => {
        const funcionario = funcionarios.find(f => f.id == aus.id_funcionario);
        const nomeFuncionario = funcionario ? funcionario.nome : 'Desconhecido';
        
        // Corrige as datas para incluir o dia final completo
        const [diaFim, mesFim, anoFim] = aus.data_fim.split('/');
        const dataFinalCorrigida = new Date(+anoFim, mesFim - 1, +diaFim);
        dataFinalCorrigida.setDate(dataFinalCorrigida.getDate() + 1);

        return {
            title: `${aus.tipo_ausencia} - ${nomeFuncionario}`,
            start: aus.data_inicio.split('/').reverse().join('-'), // Formato AAAA-MM-DD
            end: dataFinalCorrigida.toISOString().split('T')[0], // Formato AAAA-MM-DD
        };
    });

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br', // Define o idioma para Português do Brasil
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        events: eventos,
        eventColor: '#dc3545' // Cor dos eventos
    });
    calendar.render();
}
    // Inicia o processo
    carregarDados();
});