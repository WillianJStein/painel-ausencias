// ########## CÓDIGO FINAL E VITORIOSO (MISTO) ##########
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
    
    async function postData(aba, dados, acao = 'adicionar') {
        const payload = { aba: aba, acao: acao, dados: dados };
        await fetch(NOVA_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            redirect: 'follow',
            body: JSON.stringify(payload),
        });
        return { status: "success" }; 
    }

    async function carregarDados() {
        try {
            const [funcionarios, ausencias, informacoes] = await Promise.all([
                fetchJSONP(`${NOVA_API_URL}?aba=Funcionarios`),
                fetchJSONP(`${NOVA_API_URL}?aba=Ausencias`),
                fetchJSONP(`${NOVA_API_URL}?aba=Informacoes`)
            ]);
            if (funcionarios.error || ausencias.error || informacoes.error) {
                throw new Error('Erro da API: ' + (funcionarios.error || ausencias.error || informacoes.error));
            }
            const hoje = new Date();
            const dadosProcessados = processarAusencias(funcionarios, ausencias, hoje);
            renderizarPainel(dadosProcessados);
            atualizarResumo(dadosProcessados);
            renderizarCalendario(funcionarios, ausencias);
            renderizarInformacoes(informacoes);
            setupAbsenceModal(funcionarios);
            setupInfoModal(informacoes);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            document.getElementById('status-grid').innerHTML = '<p>Falha ao carregar os dados. Verifique o console.</p>';
        }
    }

    function processarAusencias(funcionarios, ausencias, hoje) {
        const hojeSemHoras = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        return funcionarios.map(func => {
            const ausenciasDoFuncionario = ausencias.filter(aus => aus.id_funcionario == func.id && aus.data_inicio && aus.data_fim);
            let statusFinal = { status_atual: 'Presente', detalhes_ausencia: '' };
            const ausenciaAtiva = ausenciasDoFuncionario.find(aus => {
                const inicio = new Date(aus.data_inicio);
                const fim = new Date(aus.data_fim);
                if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) return false;
                return hojeSemHoras >= inicio && hojeSemHoras <= fim;
            });
            if (ausenciaAtiva) {
                statusFinal = {
                    status_atual: ausenciaAtiva.tipo_ausencia,
                    detalhes_ausencia: `${new Date(ausenciaAtiva.data_inicio).toLocaleDateString()} - ${new Date(ausenciaAtiva.data_fim).toLocaleDateString()}`
                };
            } else {
                const proximaAusencia = ausenciasDoFuncionario
                    .map(aus => ({ ...aus, dataObj: new Date(aus.data_inicio) }))
                    .filter(aus => aus.dataObj >= hojeSemHoras)
                    .sort((a, b) => a.dataObj - b.dataObj)[0];
                if (proximaAusencia) {
                    statusFinal.detalhes_ausencia = `Próxima Ausência: ${new Date(proximaAusencia.data_inicio).toLocaleDateString()}`;
                }
            }
            return { ...func, ...statusFinal };
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
                const statusClass = func.status_atual.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '-');
                groupHTML += `<div class="employee"><div><div class="employee-name">${func.nome}</div>${func.detalhes_ausencia ? `<div class="employee-details">${func.detalhes_ausencia}</div>` : ''}</div><span class="employee-status status-${statusClass}">${func.status_atual}</span></div>`;
            });
            groupDiv.innerHTML = groupHTML;
            grid.appendChild(groupDiv);
        }
    }

    function atualizarResumo(funcionarios) {
        let presentes = 0;
        let ferias = 0;
        let ausentes = 0;
        funcionarios.forEach(func => {
            if (func.status_atual === 'Presente') {
                presentes++;
            } else if (func.status_atual === 'Férias') {
                ferias++;
            } else if (!func.status_atual.includes('-agendada')) {
                ausentes++;
            }
        });
        document.getElementById('count-presentes').textContent = presentes;
        document.getElementById('count-ferias').textContent = ferias;
        document.getElementById('count-ausentes').textContent = ausentes;
    }

    function renderizarCalendario(funcionarios, ausencias) {
        const calendarEl = document.getElementById('calendar');
        const coresDosEventos = { 'Atestado': '#dc3545', 'Férias': '#fd7e14', 'Licença': '#6f42c1' };
        const corPadrao = '#6c757d';
        const eventos = [];
        ausencias.forEach(aus => {
            if (!aus.id_funcionario || !aus.data_inicio || !aus.data_fim) return;
            try {
                const funcionario = funcionarios.find(f => f.id == aus.id_funcionario);
                const nomeFuncionario = funcionario ? funcionario.nome : 'Desconhecido';
                const inicio = new Date(aus.data_inicio);
                const fim = new Date(aus.data_fim);
                if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) return;
                fim.setDate(fim.getDate() + 1);
                eventos.push({
                    title: `${aus.tipo_ausencia} - ${nomeFuncionario}`,
                    start: inicio.toISOString().split('T')[0],
                    end: fim.toISOString().split('T')[0],
                    color: coresDosEventos[aus.tipo_ausencia] || corPadrao
                });
            } catch (error) {
                console.error("Erro ao processar uma ausência para o calendário:", aus, error);
            }
        });
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'pt-br',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },
            events: eventos
        });
        calendar.render();
    }
    
    function renderizarInformacoes(informacoes) {
        const board = document.getElementById('info-board');
        board.innerHTML = '';
        if (!informacoes || informacoes.length === 0) {
            board.innerHTML = '<p>Nenhuma informação no momento.</p>';
            return;
        }
        informacoes.sort((a, b) => {
            const aDestaque = a.destaque && a.destaque.toString().toUpperCase() === 'TRUE';
            const bDestaque = b.destaque && b.destaque.toString().toUpperCase() === 'TRUE';
            if (aDestaque === bDestaque) return 0;
            return aDestaque ? -1 : 1;
        });
        informacoes.forEach(info => {
            if (info.mensagem) {
                const card = document.createElement('div');
                card.className = 'info-card';
                card.dataset.infoId = info.id;
                if (info.destaque && info.destaque.toString().toUpperCase() === 'TRUE') {
                    card.classList.add('destaque');
                }
                let cardHTML = `<div class="info-card-header"><p>${info.mensagem}</p><div class="info-card-actions"><button class="action-btn edit-btn" title="Editar">✏️</button><button class="action-btn delete-btn" title="Excluir">🗑️</button></div></div>`;
                if (info.data) {
                    cardHTML += `<div class="info-date">${new Date(info.data).toLocaleDateString()}</div>`;
                }
                card.innerHTML = cardHTML;
                board.appendChild(card);
            }
        });
        addInfoEventListeners(informacoes);
    }
    
    function addInfoEventListeners(informacoes) {
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', async function(event) {
                const card = event.target.closest('.info-card');
                const infoId = card.dataset.infoId;
                if (confirm('Tem certeza de que deseja excluir esta informação?')) {
                    try {
                        const result = await postData('Informacoes', { id: infoId }, 'excluir');
                        if (result.status === "success") {
                            alert('Informação excluída com sucesso! A página será atualizada.');
                            location.reload();
                        } else { alert('Erro ao excluir.'); }
                    } catch (error) { alert('Erro de rede ao tentar excluir.'); }
                }
            });
        });
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', function(event) {
                const card = event.target.closest('.info-card');
                const infoId = card.dataset.infoId;
                const infoParaEditar = informacoes.find(info => info.id == infoId);
                if (infoParaEditar) {
                    const modal = document.getElementById('info-modal');
                    document.getElementById('info-id').value = infoParaEditar.id;
                    document.getElementById('info-message').value = infoParaEditar.mensagem;
                    document.getElementById('info-highlight').checked = (infoParaEditar.destaque && infoParaEditar.destaque.toString().toUpperCase() === 'TRUE');
                    modal.style.display = 'block';
                }
            });
        });
    }

    function setupAbsenceModal(funcionarios) {
        const modal = document.getElementById('absence-modal');
        const openModalBtn = document.querySelector('.register-button');
        const closeModalBtn = modal.querySelector('.close-button');
        const absenceForm = document.getElementById('absence-form');
        const submitButton = absenceForm.querySelector('.submit-button');
        const employeeSelect = document.getElementById('employee-select');
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
                const result = await postData('Ausencias', novaAusencia, 'adicionar');
                if (result.status === "success") {
                    alert('Ausência registrada com sucesso! A página será atualizada.');
                    location.reload();
                } else {
                    alert('Erro ao registrar ausência.');
                    submitButton.disabled = false;
                    submitButton.textContent = 'Salvar Ausência';
                }
            } catch (error) {
                console.error('Erro de rede:', error);
                alert('Erro de rede.');
                submitButton.disabled = false;
                submitButton.textContent = 'Salvar Ausência';
            }
        });
    }

    function setupInfoModal(informacoes) {
        const modal = document.getElementById('info-modal');
        const openModalBtn = document.getElementById('add-info-button');
        const closeModalBtn = modal.querySelector('.close-button');
        const infoForm = document.getElementById('info-form');
        const submitButton = infoForm.querySelector('.submit-button');
        openModalBtn.onclick = function() {
            document.getElementById('info-id').value = '';
            infoForm.reset();
            modal.style.display = 'block';
        }
        function fecharModalInfo() {
            modal.style.display = 'none';
            infoForm.reset();
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar Informação';
        }
        closeModalBtn.onclick = fecharModalInfo;
        infoForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            submitButton.disabled = true;
            submitButton.textContent = 'Salvando...';
            const infoId = document.getElementById('info-id').value;
            const novaInfo = {
                id: infoId,
                mensagem: document.getElementById('info-message').value,
                destaque: document.getElementById('info-highlight').checked ? 'TRUE' : 'FALSE'
            };
            try {
                const acao = infoId ? 'editar' : 'adicionar';
                const result = await postData('Informacoes', novaInfo, acao);
                if (result.status === "success") {
                    alert('Informação registrada com sucesso! A página será atualizada.');
                    location.reload();
                } else {
                    alert('Erro ao registrar informação.');
                    submitButton.disabled = false;
                    submitButton.textContent = 'Salvar Informação';
                }
            } catch (error) {
                console.error('Erro de rede:', error);
                alert('Erro de rede.');
                submitButton.disabled = false;
                submitButton.textContent = 'Salvar Informação';
            }
        });
    }
    
    // Configura o fechamento dos modais ao clicar fora
    window.addEventListener('click', function(event) {
        const absenceModal = document.getElementById('absence-modal');
        const infoModal = document.getElementById('info-modal');
        if (event.target == absenceModal) {
            absenceModal.style.display = 'none';
        }
        if (event.target == infoModal) {
            infoModal.style.display = 'none';
        }
    });

    carregarDados();
});
