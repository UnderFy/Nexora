/* ============================================================
   NEXORA - LÓGICA DE SINCRONIZAÇÃO DO PAINEL (js/painel.js)
============================================================ */

// Inicializador de cliente Supabase
const client = window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null);

// Elementos do DOM
const welcomeName = document.getElementById("welcome-name");
const sidebarName = document.getElementById("sidebar-name");
const sidebarAvatar = document.getElementById("sidebar-avatar");
const headerAvatar = document.getElementById("header-avatar");
const logoutButton = document.getElementById("logout-button");

// Cards de Métricas
const statCards = document.querySelectorAll(".stat-card");
const statAgendamentos = statCards[0];
const statClientes = statCards[1];
const statPublicacoes = statCards[2];
const statServicos = statCards[3];

// Indicadores de Status
const statusIndicator = document.querySelector(".status-indicator");
const statusTitle = document.querySelector(".business-status strong");
const statusDesc = document.querySelector(".business-status p");

async function carregarPainel() {
    if (!client) {
        console.error("Cliente Supabase não inicializado.");
        return;
    }

    try {
        /* 1. AUTENTICAÇÃO */
        const { data: authData, error: authError } = await client.auth.getUser();

        if (authError || !authData?.user) {
            window.location.href = "login.html";
            return;
        }

        const user = authData.user;

        /* 2. DADOS DO PERFIL */
        try {
            const { data: perfil } = await client
                .from("perfis")
                .select("nome, username, tipo")
                .eq("id", user.id)
                .maybeSingle();

            if (perfil) {
                if (perfil.tipo && perfil.tipo !== "empreendedor") {
                    window.location.href = "login.html";
                    return;
                }
                const nomeCompleto = perfil.nome || user.user_metadata?.full_name || "Empreendedor";
                const primeiroNome = nomeCompleto.trim().split(" ")[0];
                const inicial = primeiroNome.charAt(0).toUpperCase() || "N";

                if (welcomeName) welcomeName.textContent = primeiroNome;
                if (sidebarName) sidebarName.textContent = nomeCompleto;
                if (sidebarAvatar) sidebarAvatar.textContent = inicial;
                if (headerAvatar) headerAvatar.textContent = inicial;
            }
        } catch (e) {
            console.warn("Aviso ao carregar perfil:", e);
        }

        /* 3. OBTÉM ID DO NEGÓCIO */
        const negocioId = await obterNegocioId(user.id);

        /* 4. BUSCA PARALELA DAS ESTATÍSTICAS */
        const [agendamentos, clientes, publicacoes, servicos] = await Promise.all([
            contarRegistros("agendamentos", negocioId, user.id),
            contarRegistros("clientes", negocioId, user.id),
            contarRegistros("publicacoes", negocioId, user.id),
            contarRegistros("servicos", negocioId, user.id)
        ]);

        /* 5. ATUALIZAÇÃO DA INTERFACE */
        atualizarCard(statAgendamentos, agendamentos, agendamentos === 1 ? "1 agendamento realizado" : `${agendamentos} agendamentos no total`);
        atualizarCard(statClientes, clientes, clientes === 1 ? "1 cliente cadastrado" : `${clientes} clientes cadastrados`);
        atualizarCard(statPublicacoes, publicacoes, publicacoes === 1 ? "1 publicação ativa" : `${publicacoes} conteúdos publicados`);
        atualizarCard(statServicos, servicos, servicos === 1 ? "1 serviço cadastrado" : `${servicos} serviços cadastrados`);

        // Status visual do negócio
        atualizarStatusNegocio(negocioId, servicos, publicacoes);

    } catch (error) {
        console.error("Erro ao sincronizar painel:", error);
    }
}

/**
 * Procura o registro da empresa na tabela 'negocios'
 */
async function obterNegocioId(userId) {
    const colunas = ["usuario_id", "user_id", "id"];
    for (const col of colunas) {
        try {
            const { data, error } = await client
                .from("negocios")
                .select("id")
                .eq(col, userId)
                .maybeSingle();

            if (!error && data?.id) {
                return data.id;
            }
        } catch (e) {
            // Tenta a próxima coluna
        }
    }
    return null;
}

/**
 * Conta os registros de uma tabela considerando variações de colunas de relação
 */
async function contarRegistros(tabela, negocioId, userId) {
    const tentativas = [];

    if (negocioId) {
        tentativas.push({ coluna: "negocio_id", valor: negocioId });
    }
    if (userId) {
        tentativas.push({ coluna: "usuario_id", valor: userId });
        tentativas.push({ coluna: "user_id", valor: userId });
        tentativas.push({ coluna: "empreendedor_id", valor: userId });
    }

    for (const item of tentativas) {
        try {
            const { data, count, error } = await client
                .from(tabela)
                .select("id", { count: "exact" })
                .eq(item.coluna, item.valor);

            if (!error) {
                return count !== null && count !== undefined ? count : (data ? data.length : 0);
            }
        } catch (err) {
            // Tenta a próxima combinação de colunas
        }
    }

    return 0;
}

/**
 * Escreve o resultado no Card correspondente
 */
function atualizarCard(cardElement, total, legenda) {
    if (!cardElement) return;
    const numEl = cardElement.querySelector(".stat-number");
    const descEl = cardElement.querySelector(".stat-description");

    if (numEl) numEl.textContent = total;
    if (descEl) descEl.textContent = legenda;
}

/**
 * Atualiza o indicador de status do negócio
 */
function atualizarStatusNegocio(negocioId, servicos, publicacoes) {
    if (!statusIndicator || !statusTitle || !statusDesc) return;

    if (negocioId && servicos > 0) {
        statusIndicator.style.background = "#10B981"; // Verde
        statusTitle.textContent = "Negócio Ativo e Pronto";
        statusDesc.textContent = "Seu perfil e serviços estão visíveis para receber agendamentos.";
    } else if (negocioId) {
        statusIndicator.style.background = "#F59E0B"; // Amarelo
        statusTitle.textContent = "Cadastre seus Serviços";
        statusDesc.textContent = "Seu negócio foi criado, mas adicione serviços para liberar agendamentos.";
    } else {
        statusIndicator.style.background = "#EF4444"; // Vermelho
        statusTitle.textContent = "Perfil em configuração";
        statusDesc.textContent = "Complete as informações do seu negócio para começar.";
    }
}

/* EVENTOS */
if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        await client.auth.signOut();
        window.location.href = "login.html";
    });
}

const mobileMenuBtn = document.getElementById("mobile-menu-button");
const sidebarEl = document.getElementById("sidebar");

if (mobileMenuBtn && sidebarEl) {
    mobileMenuBtn.addEventListener("click", () => {
        sidebarEl.classList.toggle("mobile-open");
    });

    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
            sidebarEl.classList.remove("mobile-open");
        });
    });
}

// Inicia a execução
carregarPainel();
