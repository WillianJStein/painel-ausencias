// ########## CÓDIGO CHECKPOINT "MORANGO DO AMOR" - VERSÃO FINAL ##########
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
        // Este fetch é "fire and forget" (atire e esqueça) devido às limitações do no-cors
        await fetch(NOVA_API_URL, {
            method: 'POST',
            mode: 'no-cors', // Importante para o POST no Apps Script
            redirect: 'follow',
            body: JSON.stringify(payload),
        });
        // Como usamos no-cors, não podemos ler a resposta, então apenas recarregamos a página
        alert('Ação enviada com sucesso! A página será atualizada.');
        location.reload();
    }

    // Função principal que carrega todos os dados
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

    // Função para processar o status de cada funcionário
    function processarAusencias(funcionarios, ausencias, hoje) {
        const
