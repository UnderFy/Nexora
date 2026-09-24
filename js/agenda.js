// Elementos da Interface
const welcomeName = document.getElementById("welcome-name");
const sidebarName = document.getElementById("sidebar-name");
const sidebarAvatar = document.getElementById("sidebar-avatar");
const headerAvatar = document.getElementById("header-avatar");
const logoutButton = document.getElementById("logout-button");
const listaAgendamentos = document.getElementById("lista-agendamentos");

const filtroDataInput = document.getElementById("filtro-data");
const limparDataBtn = document.getElementById("limpar-data");
const botoesFiltroStatus = document.querySelectorAll(".btn-filtro");

let negocioId = null;
let todosAgendamentos = [];
let filtroStatusAtual = "todos";
let filtroDataAtual = "";

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

        if (sidebarName) sidebarName.textContent = nome;
        if (sidebarAvatar) sidebarAvatar.textContent = inicial;
        if (headerAvatar) headerAvatar.textContent = inicial;

        // 3. Busca o ID do Negócio associado ao usuário
        const { data: negocio, error: negocioError } = await supabaseClient
            .from("negocios")
            .select("id")
            .or(`id.eq.${user.id},usuario_id.eq.${user.id}`)
            .maybeSingle();

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

        // Configura ouvintes dos filtros
        configurarFiltros();

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

        todosAgendamentos = agendamentos || [];

        // Atualiza Contadores
        atualizarMetricas();

        // Renderiza Lista aplicando filtros
        aplicarFiltrosERenderizar();

    } catch (err) {
        console.error("Erro ao buscar agendamentos:", err);
        listaAgendamentos.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                <p>Erro ao carregar agendamentos.</p>
            </div>
        `;
    }
}

function atualizarMetricas() {
    const hojeData = new Date().toISOString().split("T")[0];
    
    document.getElementById("total-hoje").textContent = 
        todosAgendamentos.filter(a => a.data_agendamento === hojeData).length;

    document.getElementById("total-pendentes").textContent = 
        todosAgendamentos.filter(a => a.status === "pendente").length;

    document.getElementById("total-confirmados").textContent = 
        todosAgendamentos.filter(a => a.status === "confirmado").length;

    document.getElementById("total-concluidos").textContent = 
        todosAgendamentos.filter(a => a.status === "concluido").length;
}

function configurarFiltros() {
    // Filtro por botões de status
    botoesFiltroStatus.forEach(btn => {
        btn.addEventListener("click", () => {
            botoesFiltroStatus.forEach(b => {
                b.style.background = "#fff";
                b.style.color = "#333";
            });
            btn.style.background = "#000";
            btn.style.color = "#fff";

            filtroStatusAtual = btn.dataset.status;
            aplicarFiltrosERenderizar();
        });
    });

    // Filtro por Data
    if (filtroDataInput) {
        filtroDataInput.addEventListener("change", (e) => {
            filtroDataAtual = e.target.value;
            aplicarFiltrosERenderizar();
        });
    }

    if (limparDataBtn) {
        limparDataBtn.addEventListener("click", () => {
            if (filtroDataInput) filtroDataInput.value = "";
            filtroDataAtual = "";
            aplicarFiltrosERenderizar();
        });
    }
}

function aplicarFiltrosERenderizar() {
    let filtrados = todosAgendamentos;

    // 1. Aplica Filtro de Status
    if (filtroStatusAtual !== "todos") {
        filtrados = filtrados.filter(item => item.status === filtroStatusAtual);
    }

    // 2. Aplica Filtro de Data
    if (filtroDataAtual) {
        filtrados = filtrados.filter(item => item.data_agendamento === filtroDataAtual);
    }

    // 3. Renderiza o resultado
    if (!filtrados || filtrados.length === 0) {
        listaAgendamentos.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <p>Nenhum agendamento encontrado para os filtros selecionados.</p>
            </div>
        `;
        return;
    }

    listaAgendamentos.innerHTML = filtrados.map(item => {
        const servicoNome = item.servicos?.nome || "Serviço Geral";
        const preco = item.servicos?.preco ? ` - R$ ${parseFloat(item.servicos.preco).toFixed(2)}` : "";
        
        return `
            <div class="quick-action" style="justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #f1f5f9;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <span class="quick-icon blue">◷</span>
                    <div>
                        <strong>${item.cliente_nome}</strong> 
                        ${item.cliente_telefone ? `<span style="font-size: 12px; color: var(--text-secondary);">(${item.cliente_telefone})</span>` : ''}
                        <br>
                        <small style="color: var(--text-secondary);">
                            📅 <strong>${formatarData(item.data_agendamento)}</strong> às <strong>${item.hora_inicio ? item.hora_inicio.slice(0, 5) : '--:--'}</strong> 
                            | 🏷️ ${servicoNome}${preco}
                        </small>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; ${getBadgeStyle(item.status)}">
                        ${item.status ? item.status.toUpperCase() : 'PENDENTE'}
                    </span>
                    
                    ${item.status === 'pendente' ? `
                        <button onclick="alterarStatus('${item.id}', 'confirmado')" class="primary-button" style="padding: 6px 12px; font-size: 11px; width: auto;">Confirmar</button>
                        <button onclick="alterarStatus('${item.id}', 'cancelado')" class="secondary-button" style="padding: 6px 12px; font-size: 11px; width: auto; color: #dc2626; border-color: #fca5a5;">Cancelar</button>
                    ` : ''}

                    ${item.status === 'confirmado' ? `
                        <button onclick="alterarStatus('${item.id}', 'concluido')" class="secondary-button" style="padding: 6px 12px; font-size: 11px; width: auto;">Concluir</button>
                        <button onclick="alterarStatus('${item.id}', 'cancelado')" class="secondary-button" style="padding: 6px 12px; font-size: 11px; width: auto; color: #dc2626; border-color: #fca5a5;">Cancelar</button>
                    ` : ''}

                    ${item.status === 'concluido' || item.status === 'cancelado' ? `
                        <button onclick="alterarStatus('${item.id}', 'pendente')" class="secondary-button" style="padding: 4px 8px; font-size: 10px; width: auto; opacity: 0.7;" title="Reabrir agendamento">Reabrir</button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function alterarStatus(id, novoStatus) {
    try {
        const { error } = await supabaseClient
            .from("agendamentos")
            .update({ status: novoStatus })
            .eq("id", id);

        if (error) {
            throw error;
        }

        // Atualiza o item na lista local para resposta instantânea
        const agendamento = todosAgendamentos.find(a => a.id === id);
        if (agendamento) {
            agendamento.status = novoStatus;
        }

        // Atualiza os contadores e a renderização
        atualizarMetricas();
        aplicarFiltrosERenderizar();

    } catch (err) {
        console.error("Erro ao alterar status:", err);
        alert("Erro ao atualizar o status do agendamento: " + (err?.message || err));
    }
}

function formatarData(dataIso) {
    if (!dataIso) return "";
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
