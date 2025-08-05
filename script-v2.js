// ########## CÓDIGO FINAL E VITORIOSO (MISTO) ##########
document.addEventListener('DOMContentLoaded', function() {
    const NOVA_API_URL = 'https://script.google.com/macros/s/AKfycbxi4HR0tpAP0-ZWi8SeKKc-rD3Sh_eUKfvAG-OxixFjg2FaEJ0sxdM_sX8JY3JaEq0d/exec';

    // Técnica JSONP ("Telegrama") para LER dados (ignora CORS)
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
    
    // Técnica FETCH ("Carta") para ESCREVER dados
    async function postData(aba, dados, acao = 'adicionar') {
        const payload = { aba: aba, acao: acao, dados: dados };
        await fetch(NOVA_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            redirect: 'follow',
            body: JSON.stringify(payload),
        });
        // Como usamos no-cors, não podemos ler a resposta, então alertamos e recarregamos
        alert('Ação enviada com sucesso! A página será atualizada para refletir as mudanças.');
        location.reload();
    }

    async function carregarDados() {
        try {
            const [funcionarios, ausencias, informacoes, config] = await Promise.all([
                fetchJSONP(`${NOVA_API_URL}?aba=Funcionarios`),
                fetchJSONP(`${NOVA_API_URL}?aba=Ausencias`),
                fetchJSONP(`${NOVA_API_URL}?aba=Informacoes`),
                fetchJSONP(`${NOVA_API_URL}?aba=Config`)
            ]);
            if (funcionarios.error || ausencias.error || informacoes.error || config.error) {
                throw new Error('Erro da API: ' + (funcionarios.error || ausencias.error || informacoes.error || config.error));
            }
            const hoje = new Date();
            const dadosProcessados = processarAusencias(funcionarios, ausencias, hoje);
            renderizarPainel(dadosProcessados);
            atualizarResumo(dadosProcessados);
            renderizarCalendario(funcionarios, ausencias);
            renderizarInformacoes(informacoes);
            setupAbsenceModal(funcionarios);
            setupInfoModal(informacoes);
            renderizarConfig(config);
            setupDarkMode();
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
            const precisaDeAtencao = (funcionariosDoGrupo.filter(f => f.status_atual === 'Presente').length <= 1 && funcionariosDoGrupo.length > 1);
            const groupDiv = document.createElement('div');
            groupDiv.className = 'team-group';
            let groupHTML = `<div class="team-header"><h4>${nomeGrupo}</h4><span class="status-badge ${precisaDeAtencao ? 'warning' : 'ok'}">${precisaDeAtencao ? 'Atenção' : 'OK'}</span></div>`;
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
                let cardHTML = `<div class="info-card-header"><p>${info.mensagem}</p><div class="info-card-actions"><button class="action-btn edit-btn" title="Editar"><svg viewBox="0 0 32 32" fill="currentColor"><path d="M25.384,11.987a.993.993,0,0,1-.707-.293L20.434,7.452a1,1,0,0,1,0-1.414l2.122-2.121a3.07,3.07,0,0,1,4.242,0l1.414,1.414a3,3,0,0,1,0,4.242l-2.122,2.121A.993.993,0,0,1,25.384,11.987ZM22.555,6.745l2.829,2.828L26.8,8.159a1,1,0,0,0,0-1.414L25.384,5.331a1.023,1.023,0,0,0-1.414,0Z"></path><path d="M11.9,22.221a2,2,0,0,1-1.933-2.487l.875-3.5a3.02,3.02,0,0,1,.788-1.393l8.8-8.8a1,1,0,0,1,1.414,0l4.243,4.242a1,1,0,0,1,0,1.414l-8.8,8.8a3,3,0,0,1-1.393.79h0l-3.5.875A2.027,2.027,0,0,1,11.9,22.221Zm3.752-1.907h0ZM21.141,8.159l-8.094,8.093a1,1,0,0,0-.262.465l-.876,3.5,3.5-.876a1,1,0,0,0,.464-.263l8.094-8.094Z"></path><path d="M22,29H8a5.006,5.006,0,0,1-5-5V10A5.006,5.006,0,0,1,8,5h9.64a1,1,0,0,1,0,2H8a3,3,0,0,0-3,3V24a3,3,0,0,0,3,3H22a3,3,0,0,0,3-3V14.61a1,1,0,0,1,2,0V24A5.006,5.006,0,0,1,22,29Z"></path></svg></button><button class="action-btn delete-btn" title="Excluir"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19V4Z"></path></svg></button></div></div>`;
                if (info.data) {
                    cardHTML += `<div class="info-date">${new Date(info.data).toLocaleDateString()}</div>`;
                }
                card.innerHTML = cardHTML;
                board.appendChild(card);
            }
        });
        addInfoEventListeners(informacoes);
    }

    function renderizarConfig(config) {
        const cubData = config.find(item => item.chave === 'cub');
        const cubTitleElement = document.getElementById('cub-title');
        const cubValueElement = document.getElementById('cub-value');
        if (cubData && cubData.valor) {
            const cubValue = parseFloat(cubData.valor);
            cubValueElement.textContent = cubValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            if (cubData.detalhe) {
                try {
                    const dataReferencia = new Date(cubData.detalhe);
                    const mesAnoFormatado = dataReferencia.toLocaleString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                    const textoFinal = mesAnoFormatado.charAt(0).toUpperCase() + mesAnoFormatado.slice(1);
                    cubTitleElement.textContent = `CUB m² (${textoFinal}):`;
                } catch(e) {
                    cubTitleElement.textContent = `CUB m² (${cubData.detalhe}):`;
                }
            }
        }
    }
    
    function addInfoEventListeners(informacoes) {
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', async function(event) {
                const card = event.target.closest('.info-card');
                const infoId = card.dataset.infoId;
                if (confirm('Tem certeza de que deseja excluir esta informação?')) {
                    try {
                        await postData('Informacoes', { id: infoId }, 'excluir');
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
                await postData('Ausencias', novaAusencia, 'adicionar');
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
                await postData('Informacoes', novaInfo, acao);
            } catch (error) {
                console.error('Erro de rede:', error);
                alert('Erro de rede.');
                submitButton.disabled = false;
                submitButton.textContent = 'Salvar Informação';
            }
        });
    }
    
    function setupDarkMode() {
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        const body = document.body;
        if (localStorage.getItem('darkMode') === 'enabled') {
            body.classList.add('dark-mode');
        }
        darkModeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            if (body.classList.contains('dark-mode')) {
                localStorage.setItem('darkMode', 'enabled');
            } else {
                localStorage.setItem('darkMode', 'disabled');
            }
        });
    }

    window.addEventListener('click', function(event) {
        const absenceModal = document.getElementById('absence-modal');
        const infoModal = document.getElementById('info-modal');
        if (event.target == absenceModal) {
            const closeModalBtn = absenceModal.querySelector('.close-button');
            if (closeModalBtn) closeModalBtn.click();
        }
        if (event.target == infoModal) {
            const closeModalBtn = infoModal.querySelector('.close-button');
            if (closeModalBtn) closeModalBtn.click();
        }
    });

    carregarDados();
});
