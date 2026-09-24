// Elementos da interface
const welcomeName = document.getElementById("welcome-name");
const sidebarName = document.getElementById("sidebar-name");
const sidebarAvatar = document.getElementById("sidebar-avatar");
const headerAvatar = document.getElementById("header-avatar");
const logoutButton = document.getElementById("logout-button");

// Elementos dos Cards de Estatísticas
const statAgendamentos = document.querySelectorAll(".stat-card")[0];
const statClientes = document.querySelectorAll(".stat-card")[1];
const statPublicacoes = document.querySelectorAll(".stat-card")[2];
const statServicos = document.querySelectorAll(".stat-card")[3];

async function carregarPainel() {
    try {
        /* -------------------------------------------------------------
         * 1. VERIFICA AUTENTICAÇÃO E PERFIL DO USUÁRIO
         * ----------------------------------------------------------- */
        const { data: authData, error: authError } = await supabaseClient.auth.getUser();

        if (authError || !authData.user) {
            window.location.href = "login.html";
            return;
        }

        const user = authData.user;

        // Busca perfil
        const { data: perfil, error: perfilError } = await supabaseClient
            .from("perfis")
            .select("nome, username, tipo, foto_url")
            .eq("id", user.id)
            .limit(1);

        if (perfilError || !perfil || perfil.length === 0) {
            throw new Error("Perfil não encontrado.");
        }

        const dadosPerfil = perfil[0];

        if (dadosPerfil.tipo !== "empreendedor") {
            window.location.href = "login.html";
            return;
        }

        // Atualiza Nome e Avatar
        const nome = dadosPerfil.nome || "Empreendedor";
        welcomeName.textContent = nome.split(" ")[0];
        sidebarName.textContent = nome;

        const inicial = nome.trim().charAt(0).toUpperCase() || "N";
        sidebarAvatar.textContent = inicial;
        headerAvatar.textContent = inicial;

        /* -------------------------------------------------------------
         * 2. SINCRONIZA CONTADORES E DADOS DAS TABELAS DO SUPABASE
         * ----------------------------------------------------------- */
        await carregarEstatisticas(user.id);

    } catch (error) {
        console.error("Erro ao carregar painel:", error);
        if (error?.message?.toLowerCase().includes("jwt")) {
            window.location.href = "login.html";
            return;
        }
        welcomeName.textContent = "empreendedor";
        sidebarName.textContent = "Empreendedor";
    }
}

async function carregarEstatisticas(userId) {
    // 1. Agendamentos
    try {
        const { count, error } = await supabaseClient
            .from("agendamentos")
            .select("*", { count: "exact", head: true })
            .eq("empreendedor_id", userId);

        if (!error && count !== null) {
            const numEl = statAgendamentos.querySelector(".stat-number");
            const descEl = statAgendamentos.querySelector(".stat-description");
            numEl.textContent = count;
            descEl.textContent = count === 1 ? "1 agendamento realizado" : `${count} agendamentos no total`;
        }
    } catch (e) {
        console.warn("Erro ao buscar agendamentos:", e);
    }

    // 2. Clientes
    try {
        const { count, error } = await supabaseClient
            .from("clientes")
            .select("*", { count: "exact", head: true })
            .eq("empreendedor_id", userId);

        if (!error && count !== null) {
            const numEl = statClientes.querySelector(".stat-number");
            const descEl = statClientes.querySelector(".stat-description");
            numEl.textContent = count;
            descEl.textContent = count === 1 ? "1 cliente cadastrado" : `${count} clientes cadastrados`;
        }
    } catch (e) {
        console.warn("Erro ao buscar clientes:", e);
    }

    // 3. Publicações (Portfólio)
    try {
        const { count, error } = await supabaseClient
            .from("publicacoes")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

        if (!error && count !== null) {
            const numEl = statPublicacoes.querySelector(".stat-number");
            const descEl = statPublicacoes.querySelector(".stat-description");
            numEl.textContent = count;
            descEl.textContent = count === 1 ? "1 publicação ativa" : `${count} conteúdos publicados`;
        }
    } catch (e) {
        console.warn("Erro ao buscar publicações:", e);
    }

    // 4. Serviços
    try {
        const { count, error } = await supabaseClient
            .from("servicos")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

        if (!error && count !== null) {
            const numEl = statServicos.querySelector(".stat-number");
            const descEl = statServicos.querySelector(".stat-description");
            numEl.textContent = count;
            descEl.textContent = count === 1 ? "1 serviço cadastrado" : `${count} serviços cadastrados`;
        }
    } catch (e) {
        console.warn("Erro ao buscar serviços:", e);
    }
}

/* -------------------------------------------------------------
 * EVENTOS (LOGOUT E MENU MOBILE)
 * ----------------------------------------------------------- */

// Logout
if (logoutButton) {
    logoutButton.addEventListener("click", async function () {
        logoutButton.disabled = true;
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            console.error("Erro ao sair:", error);
            logoutButton.disabled = false;
            return;
        }
        window.location.href = "login.html";
    });
}

// Menu Mobile
const mobileMenuButton = document.getElementById("mobile-menu-button");
const sidebar = document.getElementById("sidebar");

if (mobileMenuButton && sidebar) {
    mobileMenuButton.addEventListener("click", function () {
        sidebar.classList.toggle("mobile-open");
    });

    document.querySelectorAll(".nav-item").forEach(function (item) {
        item.addEventListener("click", function () {
            sidebar.classList.remove("mobile-open");
        });
    });
}

// Inicia o painel
carregarPainel();
