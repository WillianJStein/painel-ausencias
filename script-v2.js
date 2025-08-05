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
        // Como usamos no-cors, não podemos ler a resposta, então apenas recarregamos a página
        alert('Ação enviada com sucesso! A página será atualizada.');
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
            if
