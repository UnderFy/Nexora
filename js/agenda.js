// Elementos da Interface
const welcomeName = document.getElementById("welcome-name");
const sidebarName = document.getElementById("sidebar-name");
const sidebarAvatar = document.getElementById("sidebar-avatar");
const headerAvatar = document.getElementById("header-avatar");
const logoutButton = document.getElementById("logout-button");
const listaAgendamentos = document.getElementById("lista-agendamentos");

let negocioId = null;

async function carregarAgenda() {
    try {
        // 1. Verifica autenticação
        const { data: authData, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !authData.user) {
            window.location.href = "login.html";
            return;
        }

        const user = authData.user;

        // 2. Busca o perfil do usuário
        const { data: perfil, error: perfilError } = await supabaseClient
            .from("perfis")
            .select("nome, tipo")
            .eq("id", user.id)
            .single();

        if (perfilError || !perfil) throw new Error("Perfil não encontrado.");

        const nome = perfil.nome || "Empreendedor";
        const inicial = nome.trim().charAt(0).toUpperCase() || "N";

        sidebarName.textContent = nome;
        sidebarAvatar.textContent = inicial;
        headerAvatar.textContent = inicial;

        // 3. Busca o ID do Negócio associado ao usuário
        const { data: negocio, error: negocioError } = await supabaseClient
            .from("negocios")
            .select("id")
            .eq("id", user.id)
            .single();

        if (negocioError || !negocio) {
            listaAgendamentos.innerHTML = `
                <div style="text-align: center; padding: 30px;">
                    <p style="color: var(--text-secondary); margin-bottom: 12px;">Você ainda não configurou seu negócio.</p>
                    <a href="meu-negocio.html" class="primary-button" style="display: inline-block;">Configurar Negócio</a>
                </div>
            `;
            return;
        }

        negocioId = negocio.id;

        // 4. Busca os agendamentos cadastrados
        await buscarAgendamentos();

    } catch (error) {
        console.error("Erro ao carregar agenda:", error);
    }
}

async function buscarAgendamentos() {
    try {
        const { data: agendamentos, error } = await supabaseClient
            .from("agendamentos")
            .select(`
                id,
                cliente_nome,
                cliente_telefone,
                data_agendamento,
                hora_inicio,
                hora_fim,
                status,
                metodo_pagamento,
                sinal_pago,
                servicos ( nome, preco )
            `)
            .eq("negocio_id", negocioId)
            .order("data_agendamento", { ascending: true })
            .order("hora_inicio", { ascending: true });

        if (error) throw error;

        // Atualiza Contadores
        const hojeData = new Date().toISOString().split("T")[0];
        document.getElementById("total-hoje").textContent = agendamentos.filter(a => a.data_agendamento === hojeData).length;
        document.getElementById("total-pendentes").textContent = agendamentos.filter(a => a.status === "pendente").length;
        document.getElementById("total-confirmados").textContent = agendamentos.filter(a => a.status === "confirmado").length;
        document.getElementById("total-concluidos").textContent = agendamentos.filter(a => a.status === "concluido").length;

        // Renderiza Lista
        if (!agendamentos || agendamentos.length === 0) {
            listaAgendamentos.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <p>Nenhum agendamento encontrado.</p>
                </div>
            `;
            return;
        }

        listaAgendamentos.innerHTML = agendamentos.map(item => `
            <div class="quick-action" style="justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <span class="quick-icon blue">◷</span>
                    <div>
                        <strong>${item.cliente_nome} (${item.cliente_telefone})</strong>
                        <small>
                            ${formatarData(item.data_agendamento)} às ${item.hora_inicio.slice(0, 5)} 
                            | Serviço: ${item.servicos?.nome || "Geral"}
                        </small>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 12px; font-weight: 700; padding: 4px 8px; border-radius: 6px; ${getBadgeStyle(item.status)}">
                        ${item.status.toUpperCase()}
                    </span>
                    ${item.status === 'pendente' ? `
                        <button onclick="alterarStatus('${item.id}', 'confirmado')" class="primary-button" style="padding: 6px 12px; font-size: 11px;">Confirmar</button>
                    ` : ''}
                    ${item.status === 'confirmado' ? `
                        <button onclick="alterarStatus('${item.id}', 'concluido')" class="secondary-button" style="padding: 6px 12px; font-size: 11px; width: auto;">Concluir</button>
                    ` : ''}
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error("Erro ao buscar agendamentos:", err);
    }
}

async function alterarStatus(id, novoStatus) {
    const { error } = await supabaseClient
        .from("agendamentos")
        .update({ status: novoStatus })
        .eq("id", id);

    if (error) {
        alert("Erro ao atualizar agendamento.");
    } else {
        buscarAgendamentos();
    }
}

function formatarData(dataIso) {
    const [ano, mes, dia] = dataIso.split("-");
    return `${dia}/${mes}/${ano}`;
}

function getBadgeStyle(status) {
    switch (status) {
        case "confirmado": return "background: #DCFCE7; color: #15803D;";
        case "pendente": return "background: #FEF3C7; color: #B45309;";
        case "concluido": return "background: #F1F5F9; color: #475569;";
        case "cancelado": return "background: #FEE2E2; color: #B91C1C;";
        default: return "background: #F1F5F9; color: #475569;";
    }
}

// Evento Menu Mobile
document.getElementById("mobile-menu-button")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("mobile-open");
});

// Evento Logout
logoutButton?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
});

// Inicia
carregarAgenda();
