// Aguarda o carregamento completo da página para rodar o script
document.addEventListener('DOMContentLoaded', function() {

    // URL da sua API gerada pelo Sheet.best (exatamente como o site fornece)
    const SHEET_URL = 'https://api.sheetbest.com/sheets/03fb9dd1-3bd9-4c41-a5d5-dad1f5574eaf';

// Função principal para buscar e renderizar os dados
    async function carregarDados() {
        // <<-- AQUI ESTÁ A GRANDE MUDANÇA -->>
        const NOVA_API_URL = 'https://script.google.com/macros/s/AKfycbxi4HR0tpAP0-ZWi8SeKKc-rD3Sh_eUKfvAG-OxixFjg2FaEJ0sxdM_sX8JY3JaEq0d/exec';

        try {
            // Busca dados de ambas as abas usando o parâmetro "?aba=NomeDaAba"
            const [funcionarios, ausencias] = await Promise.all([
                fetch(`${NOVA_API_URL}?aba=Funcionarios`).then(res => res.json()),
                fetch(`${NOVA_API_URL}?aba=Ausencias`).then(res => res.json())
            ]);

            // Se a busca falhar e retornar um objeto com 'error', lança um erro
            if (funcionarios.error || ausencias.error) {
                // Imprime o erro específico no console para nos ajudar a depurar
                console.error("Erro da API:", funcionarios.error || ausencias.error);
                throw new Error('Uma das abas não foi encontrada ou houve um erro na API.');
            }

            const hoje = new Date();
            const dadosProcessados = processarAusencias(funcionarios, ausencias, hoje);
            renderizarPainel(dadosProcessados);
            atualizarResumo(dadosProcessados);
            renderizarCalendario(funcionarios, ausencias);
            setupAbsenceModal(funcionarios);

        } catch (error) {
            console.error('Erro ao buscar dados da planilha:', error);
            document.getElementById('status-grid').innerHTML = '<p>Falha ao carregar os dados. Verifique o console para mais detalhes.</p>';
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

    const eventos = []; // Começa com uma lista de eventos vazia

    // Processa cada ausência individualmente com verificação de segurança
    ausencias.forEach(aus => {
        // Pula a linha se não tiver os dados mínimos necessários
        if (!aus.id_funcionario || !aus.data_inicio || !aus.data_fim) {
            return; 
        }

        try {
            const funcionario = funcionarios.find(f => f.id == aus.id_funcionario);
            const nomeFuncionario = funcionario ? funcionario.nome : 'Desconhecido';

            // Validação robusta da data de início
            const partesInicio = aus.data_inicio.split('/');
            if (partesInicio.length !== 3) return; // Pula se o formato não for DD/MM/AAAA
            const inicio = new Date(+partesInicio[2], partesInicio[1] - 1, +partesInicio[0]);

            // Validação robusta da data de fim
            const partesFim = aus.data_fim.split('/');
            if (partesFim.length !== 3) return; // Pula se o formato não for DD/MM/AAAA
            const fim = new Date(+partesFim[2], partesFim[1] - 1, +partesFim[0]);

            // Verifica se as datas criadas são válidas
            if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
                console.warn('Data inválida encontrada e ignorada:', aus);
                return; // Pula esta ausência se a data for inválida
            }
            
            // Adiciona 1 dia à data final para que o FullCalendar inclua o último dia
            fim.setDate(fim.getDate() + 1);

            // Adiciona o evento à lista
            eventos.push({
                title: `${aus.tipo_ausencia} - ${nomeFuncionario}`,
                start: inicio.toISOString().split('T')[0],
                end: fim.toISOString().split('T')[0],
            });

        } catch (error) {
            console.error("Erro ao processar uma ausência para o calendário:", aus, error);
        }
    });

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        events: eventos,
        eventColor: '#dc3545'
    });
    calendar.render();
}
// Função para controlar o Modal de Ausência
function setupAbsenceModal(funcionarios) {
    const modal = document.getElementById('absence-modal');
    const openModalBtn = document.querySelector('.register-button');
    const closeModalBtn = document.querySelector('.close-button');
    const employeeSelect = document.getElementById('employee-select');
    const absenceForm = document.getElementById('absence-form');
    const submitButton = absenceForm.querySelector('.submit-button');

    // Preenche o seletor com os nomes dos funcionários
    employeeSelect.innerHTML = '<option value="">Selecione um funcionário</option>';
    funcionarios.forEach(func => {
        const option = document.createElement('option');
        option.value = func.id;
        option.textContent = func.nome;
        employeeSelect.appendChild(option);
    });

    // Abre o modal
    openModalBtn.onclick = function() {
        modal.style.display = 'block';
    }

    // Função para fechar o modal
    function fecharModal() {
        modal.style.display = 'none';
        absenceForm.reset();
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar Ausência';
    }

    // Fecha o modal no botão 'X' e na área externa
    closeModalBtn.onclick = fecharModal;
    window.onclick = function(event) {
        if (event.target == modal) {
            fecharModal();
        }
    }

    // --- LÓGICA DE ENVIO ATUALIZADA ---
    absenceForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';

        const idFuncionario = document.getElementById('employee-select').value;
        const tipoAusencia = document.getElementById('absence-type').value;
        const dataInicioInput = document.getElementById('start-date').value;
        const dataFimInput = document.getElementById('end-date').value;

        const dataInicioFormatada = dataInicioInput.split('-').reverse().join('/');
        const dataFimFormatada = dataFimInput.split('-').reverse().join('/');

        const novaAusencia = {
            id_funcionario: idFuncionario,
            tipo_ausencia: tipoAusencia,
            data_inicio: dataInicioFormatada,
            data_fim: dataFimFormatada
        };
        
        // Imprime no console o que estamos enviando
        console.log('Enviando para a API:', novaAusencia);

        try {
            const response = await fetch(`${SHEET_URL}?_tab=Ausencias`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(novaAusencia), // Alteração: enviando um objeto único, não um array
            });

            // Imprime a resposta completa da API no console para depuração
            const result = await response.json();
            console.log('Resposta da API:', result);

            if (response.ok && result.created === 1) {
                alert('Ausência registrada com sucesso!');
                fecharModal();
                carregarDados();
            } else {
                alert('Erro ao registrar ausência. Resposta da API: ' + (result.message || 'Erro desconhecido'));
                submitButton.disabled = false;
                submitButton.textContent = 'Salvar Ausência';
            }
        } catch (error) {
            console.error('Erro de rede ao enviar formulário:', error);
            alert('Erro de rede. Verifique sua conexão e tente novamente.');
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar Ausência';
        }
    });
}
    // Inicia o processo
    carregarDados();
});





