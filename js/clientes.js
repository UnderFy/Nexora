// Elementos da Interface
const sidebarName = document.getElementById("sidebar-name");
const sidebarAvatar = document.getElementById("sidebar-avatar");
const headerAvatar = document.getElementById("header-avatar");
const logoutButton = document.getElementById("logout-button");
const listaClientes = document.getElementById("lista-clientes");
const buscaClienteInput = document.getElementById("busca-cliente");

let negocioId = null;
let todosClientes = [];

async function carregarPaginaClientes() {
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

        // 3. Busca o ID do Negócio do usuário
        const { data: negocio, error: negocioError } = await supabaseClient
            .from("negocios")
            .select("id")
            .or(`id.eq.${user.id},usuario_id.eq.${user.id}`)
            .maybeSingle();

        if (negocioError || !negocio) {
            listaClientes.innerHTML = `
                <div style="text-align: center; padding: 30px;">
                    <p style="color: var(--text-secondary); margin-bottom: 12px;">Você ainda não configurou seu negócio.</p>
                    <a href="meu-negocio.html" class="primary-button" style="display: inline-block;">Configurar Negócio</a>
                </div>
            `;
            return;
        }

        negocioId = negocio.id;

        // Ouvinte do campo de busca
        if (buscaClienteInput) {
            buscaClienteInput.addEventListener("input", renderizarListaClientes);
        }

        // 4. Carrega os clientes da base
        await buscarClientes();

    } catch (error) {
        console.error("Erro ao carregar módulo de clientes:", error);
    }
}

async function buscarClientes() {
    try {
        // Busca todos os agendamentos vinculados ao negócio
        const { data: agendamentos, error } = await supabaseClient
            .from("agendamentos")
            .select(`
                id,
                cliente_nome,
                cliente_telefone,
                data_agendamento,
                status
            `)
            .eq("negocio_id", negocioId)
            .order("data_agendamento", { ascending: false });

        if (error) throw error;

        // Agrupa os agendamentos por cliente (Telefone ou Nome)
        const mapaClientes = {};
        const mesAtualStr = new Date().toISOString().slice(0, 7); // Ex: "2026-09"

        (agendamentos || []).forEach(ag => {
            const nome = (ag.cliente_nome || "Cliente Sem Nome").trim();
            const telefone = (ag.cliente_telefone || "").replace(/\D/g, "");
            const chave = telefone ? telefone : nome.toLowerCase();

            if (!mapaClientes[chave]) {
                mapaClientes[chave] = {
                    nome: nome,
                    telefone: ag.cliente_telefone || "",
                    telefoneLimpo: telefone,
                    totalAgendamentos: 0,
                    atendidos: 0,
                    ultimoAgendamento: ag.data_agendamento,
                    atendidoEsteMes: false
                };
            }

            mapaClientes[chave].totalAgendamentos += 1;

            if (ag.status === "concluido" || ag.status === "confirmado") {
                mapaClientes[chave].atendidos += 1;
            }

            if (ag.data_agendamento && ag.data_agendamento.startsWith(mesAtualStr)) {
                mapaClientes[chave].atendidoEsteMes = true;
            }
        });

        todosClientes = Object.values(mapaClientes);

        // Atualiza as métricas
        atualizarMetricasClientes();

        // Renderiza
        renderizarListaClientes();

    } catch (err) {
        console.error("Erro ao buscar clientes:", err);
        listaClientes.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                <p>Erro ao carregar a lista de clientes.</p>
            </div>
        `;
    }
}

function atualizarMetricasClientes() {
    const total = todosClientes.length;
    const esteMes = todosClientes.filter(c => c.atendidoEsteMes).length;
    const recorrentes = todosClientes.filter(c => c.totalAgendamentos > 1).length;

    document.getElementById("total-clientes").textContent = total;
    document.getElementById("clientes-mes").textContent = esteMes;
    document.getElementById("clientes-recorrentes").textContent = recorrentes;
}

function renderizarListaClientes() {
    const termo = buscaClienteInput ? buscaClienteInput.value.toLowerCase().trim() : "";

    const filtrados = todosClientes.filter(cliente => {
        return cliente.nome.toLowerCase().includes(termo) ||
               cliente.telefone.includes(termo);
    });

    if (!filtrados || filtrados.length === 0) {
        listaClientes.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <p>Nenhum cliente encontrado.</p>
            </div>
        `;
        return;
    }

    listaClientes.innerHTML = filtrados.map(cliente => {
        const inicial = cliente.nome.charAt(0).toUpperCase() || "C";
        const linkWhatsapp = cliente.telefoneLimpo 
            ? `https://wa.me/55${cliente.telefoneLimpo}?text=Ol%C3%A1%20${encodeURIComponent(cliente.nome)}%2C%20tudo%20bem%3F` 
            : null;

        return `
            <div class="quick-action" style="justify-content: space-between; flex-wrap: wrap; gap: 14px; padding: 14px 16px; border-bottom: 1px solid #f1f5f9;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 42px; height: 42px; border-radius: 50%; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px;">
                        ${inicial}
                    </div>
                    <div>
                        <strong>${cliente.nome}</strong>
                        <br>
                        <small style="color: var(--text-secondary);">
                            📞 ${cliente.telefone || "Sem telefone"} | 📅 Último: <strong>${formatarData(cliente.ultimoAgendamento)}</strong>
                        </small>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <span style="font-size: 12px; font-weight: 600; background: #f1f5f9; padding: 6px 12px; border-radius: 20px; color: #475569;">
                        📊 ${cliente.totalAgendamentos} agendamento(s)
                    </span>

                    ${linkWhatsapp ? `
                        <a href="${linkWhatsapp}" target="_blank" class="primary-button" style="padding: 6px 14px; font-size: 12px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; background: #25D366; border-color: #25D366;">
                            <span>💬 WhatsApp</span>
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function formatarData(dataIso) {
    if (!dataIso) return "Sem registro";
    const [ano, mes, dia] = dataIso.split("-");
    return `${dia}/${mes}/${ano}`;
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

// Inicializa a página
carregarPaginaClientes();
