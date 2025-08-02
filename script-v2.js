// Aguarda o carregamento completo da página para rodar o script
document.addEventListener('DOMContentLoaded', function() {
    const NOVA_API_URL = 'https://script.google.com/macros/s/AKfycbxi4HR0tpAP0-ZWi8SeKKc-rD3Sh_eUKfvAG-OxixFjg2FaEJ0sxdM_sX8JY3JaEq0d/exec';

    // Nova função para buscar dados usando a técnica JSONP ("telegrama cantado")
    function fetchJSONP(url) {
        return new Promise((resolve, reject) => {
            const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
            window[callbackName] = function(data) {
                delete window[callbackName];
                document.body.removeChild(script);
                resolve(data);
            };

            const script = document.createElement('script');
            script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + callbackName;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }
    
    // Função principal para buscar e renderizar os dados
    async function carregarDados() {
        try {
            const [funcionarios, ausencias] = await Promise.all([
                fetchJSONP(`${NOVA_API_URL}?aba=Funcionarios`),
                fetchJSONP(`${NOVA_API_URL}?aba=Ausencias`)
            ]);

            if (funcionarios.error || ausencias.error) {
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
            console.error('Erro ao carregar dados:', error);
            document.getElementById('status-grid').innerHTML = '<p>Falha ao carregar os dados. Verifique o console para mais detalhes.</p>';
        }
    }
    
    // O resto do seu código (processarAusencias, renderizarPainel, etc.) continua EXATAMENTE IGUAL
    // ... (cole aqui todo o resto do seu script-v2.js, da função "processarAusencias" até o final)
    // ... (Para facilitar, estou incluindo o código completo abaixo)
});


// ======== CÓDIGO COMPLETO PARA O script-v2.js (COPIE TUDO ABAIXO) =========
document.addEventListener('DOMContentLoaded', function() {
    const NOVA_API_URL = 'https://script.google.com/macros/s/AKfycbxi4HR0tpAP0-ZWi8SeKKc-rD3Sh_eUKfvAG-OxixFjg2FaEJ0sxdM_sX8JY3JaEq0d/exec';

    function fetchJSONP(url) {
        return new Promise((resolve, reject) => {
            const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
            window[callbackName] = function(data) {
                delete window[callbackName];
                document.body.removeChild(script);
                resolve(data);
            };
            const script = document.createElement('script');
            script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + callbackName;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    async function carregarDados() {
        try {
            const [funcionarios, ausencias] = await Promise.all([
                fetchJSONP(`${NOVA_API_URL}?aba=Funcionarios`),
                fetchJSONP(`${NOVA_API_URL}?aba=Ausencias`)
            ]);
            if (funcionarios.error || ausencias.error) {
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
            console.error('Erro ao carregar dados:', error);
            document.getElementById('status-grid').innerHTML = '<p>Falha ao carregar os dados. Verifique o console para mais detalhes.</p>';
        }
    }

    // Função para verificar se alguém está ausente hoje (VERSÃO COM AGENDAMENTO)
function processarAusencias(funcionarios, ausencias, hoje) {
    // Zera a hora de 'hoje' para comparar apenas os dias
    const hojeSemHoras = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

    return funcionarios.map(func => {
        const ausenciasDoFuncionario = ausencias.filter(aus => aus.id_funcionario == func.id && aus.data_inicio && aus.data_fim);

        // 1. Procura por uma ausência ATIVA HOJE
        const ausenciaAtiva = ausenciasDoFuncionario.find(aus => {
            const [diaInicio, mesInicio, anoInicio] = aus.data_inicio.split('/');
            const [diaFim, mesFim, anoFim] = aus.data_fim.split('/');
            const inicio = new Date(+anoInicio, mesInicio - 1, +diaInicio);
            const fim = new Date(+anoFim, mesFim - 1, +diaFim);
            if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) return false;
            
            return hojeSemHoras >= inicio && hojeSemHoras <= fim;
        });

        if (ausenciaAtiva) {
            return { ...func, status_atual: ausenciaAtiva.tipo_ausencia, detalhes_ausencia: `${ausenciaAtiva.data_inicio} - ${ausenciaAtiva.data_fim}` };
        }

        // 2. Se não há ausência ativa, procura pela PRÓXIMA ausência agendada
        const proximaAusencia = ausenciasDoFuncionario
            .map(aus => { // Converte as datas de string para objeto Date
                const [diaInicio, mesInicio, anoInicio] = aus.data_inicio.split('/');
                const inicio = new Date(+anoInicio, mesInicio - 1, +diaInicio);
                return { ...aus, dataObj: inicio };
            })
            .filter(aus => aus.dataObj >= hojeSemHoras) // Filtra apenas as futuras
            .sort((a, b) => a.dataObj - b.dataObj)[0]; // Ordena e pega a mais próxima

        if (proximaAusencia) {
            // Usa um nome de status diferente para o CSS
            const statusAgendado = proximaAusencia.tipo_ausencia.replace("ç", "c").replace("é", "e") + "-agendada";
            return { ...func, status_atual: statusAgendado, detalhes_ausencia: `Próxima: ${proximaAusencia.data_inicio}` };
        }

        // 3. Se não encontrou nada, está presente
        return { ...func, status_atual: 'Presente' };
    });
}

    function renderizarPainel(funcionarios) {
        const grid = document.getElementById('status-grid');
        grid.innerHTML = '';
        const grupos = funcionarios.reduce((acc, func) => {
            const key = `${func.grupo} ${func.turno}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(func);
            return acc;
        }, {});
        for (const nomeGrupo in grupos) {
            const funcionariosDoGrupo = grupos[nomeGrupo];
            const temAusente = funcionariosDoGrupo.some(f => f.status_atual !== 'Presente');
            const groupDiv = document.createElement('div');
            groupDiv.className = 'team-group';
            let groupHTML = `<div class="team-header"><h4>${nomeGrupo}</h4><span class="status-badge ${temAusente ? 'warning' : 'ok'}">${temAusente ? 'Atenção' : 'OK'}</span></div>`;
            funcionariosDoGrupo.forEach(func => {
                const statusClass = func.status_atual.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                groupHTML += `<div class="employee"><div><div class="employee-name">${func.nome}</div>${func.detalhes_ausencia ? `<div class="employee-details">${func.detalhes_ausencia}</div>` : ''}</div><span class="employee-status status-${statusClass}">${func.status_atual}</span></div>`;
            });
            groupDiv.innerHTML = groupHTML;
            grid.appendChild(groupDiv);
        }
    }

    function atualizarResumo(funcionarios) {
        const presentes = funcionarios.filter(f => f.status_atual === 'Presente').length;
        const ferias = funcionarios.filter(f => f.status_atual === 'Férias').length;
        const outrasAusencias = funcionarios.filter(f => f.status_atual !== 'Presente' && f.status_atual !== 'Férias').length;
        document.getElementById('count-presentes').textContent = presentes;
        document.getElementById('count-ferias').textContent = ferias;
        document.getElementById('count-ausentes').textContent = outrasAusencias;
    }

    function renderizarCalendario(funcionarios, ausencias) {
        const calendarEl = document.getElementById('calendar');
        const eventos = [];
        ausencias.forEach(aus => {
            if (!aus.id_funcionario || !aus.data_inicio || !aus.data_fim) return;
            try {
                const funcionario = funcionarios.find(f => f.id == aus.id_funcionario);
                const nomeFuncionario = funcionario ? funcionario.nome : 'Desconhecido';
                const partesInicio = aus.data_inicio.split('/');
                const partesFim = aus.data_fim.split('/');
                if (partesInicio.length !== 3 || partesFim.length !== 3) return;
                const inicio = new Date(+partesInicio[2], partesInicio[1] - 1, +partesInicio[0]);
                const fim = new Date(+partesFim[2], partesFim[1] - 1, +partesFim[0]);
                if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) return;
                fim.setDate(fim.getDate() + 1);
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
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },
            events: eventos,
            eventColor: '#dc3545'
        });
        calendar.render();
    }

    function setupAbsenceModal(funcionarios) {
        const modal = document.getElementById('absence-modal');
        const openModalBtn = document.querySelector('.register-button');
        const closeModalBtn = document.querySelector('.close-button');
        const employeeSelect = document.getElementById('employee-select');
        const absenceForm = document.getElementById('absence-form');
        const submitButton = absenceForm.querySelector('.submit-button');
        employeeSelect.innerHTML = '<option value="">Selecione um funcionário</option>';
        funcionarios.forEach(func => {
            const option = document.createElement('option');
            option.value = func.id;
            option.textContent = func.nome;
            employeeSelect.appendChild(option);
        });
        function fecharModal() {
            modal.style.display = 'none';
            absenceForm.reset();
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar Ausência';
        }
        openModalBtn.onclick = function() { modal.style.display = 'block'; }
        closeModalBtn.onclick = fecharModal;
        window.onclick = function(event) { if (event.target == modal) { fecharModal(); } }
        absenceForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            submitButton.disabled = true;
            submitButton.textContent = 'Salvando...';
            const novaAusencia = {
                id_funcionario: document.getElementById('employee-select').value,
                tipo_ausencia: document.getElementById('absence-type').value,
                data_inicio: document.getElementById('start-date').value.split('-').reverse().join('/'),
                data_fim: document.getElementById('end-date').value.split('-').reverse().join('/')
            };
            try {
                const response = await fetch(`${NOVA_API_URL}?aba=Ausencias`, {
                    method: 'POST',
                    body: JSON.stringify(novaAusencia),
                });
                const result = await response.json();
                if (result.status === "success") {
                    alert('Ausência registrada com sucesso!');
                    location.reload();
                } else {
                    alert('Erro ao registrar ausência. Resposta da API: ' + (result.error || 'Erro desconhecido'));
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

    carregarDados();
});


