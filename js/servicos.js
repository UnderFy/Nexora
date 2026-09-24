// Elementos da Interface
const sidebarName = document.getElementById("sidebar-name");
const sidebarAvatar = document.getElementById("sidebar-avatar");
const headerAvatar = document.getElementById("header-avatar");
const logoutButton = document.getElementById("logout-button");

const listaServicos = document.getElementById("lista-servicos");
const containerForm = document.getElementById("container-form-servico");
const formServico = document.getElementById("form-servico");
const tituloForm = document.getElementById("titulo-form");
const mensagemServico = document.getElementById("mensagem-servico");

const btnNovoServico = document.getElementById("btn-novo-servico");
const btnCancelarServico = document.getElementById("btn-cancelar-servico");
const btnSalvarServico = document.getElementById("btn-salvar-servico");

// Inputs do formulário
const inputId = document.getElementById("servico-id");
const inputNome = document.getElementById("nome-servico");
const inputPreco = document.getElementById("preco-servico");
const inputDuracao = document.getElementById("duracao-servico");
const inputDescricao = document.getElementById("descricao-servico");

let negocioId = null;
let todosServicos = [];

async function carregarPaginaServicos() {
    try {
        // 1. Autenticação
        const { data: authData, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !authData.user) {
            window.location.href = "login.html";
            return;
        }

        const user = authData.user;

        // 2. Perfil
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

        // 3. Negócio
        const { data: negocio, error: negocioError } = await supabaseClient
            .from("negocios")
            .select("id")
            .or(`id.eq.${user.id},usuario_id.eq.${user.id}`)
            .maybeSingle();

        if (negocioError || !negocio) {
            listaServicos.innerHTML = `
                <div style="text-align: center; padding: 30px;">
                    <p style="color: var(--text-secondary); margin-bottom: 12px;">Você ainda não configurou seu negócio.</p>
                    <a href="meu-negocio.html" class="primary-button" style="display: inline-block;">Configurar Negócio</a>
                </div>
            `;
            btnNovoServico.style.display = "none";
            return;
        }

        negocioId = negocio.id;

        // Eventos do Formulário
        configurarEventos();

        // 4. Buscar Serviços cadastrados
        await buscarServicos();

    } catch (error) {
        console.error("Erro ao carregar página de serviços:", error);
    }
}

async function buscarServicos() {
    try {
        const { data: servicos, error } = await supabaseClient
            .from("servicos")
            .select("*")
            .eq("negocio_id", negocioId)
            .order("nome", { ascending: true });

        if (error) throw error;

        todosServicos = servicos || [];

        atualizarMetricasServicos();
        renderizarListaServicos();

    } catch (err) {
        console.error("Erro ao buscar serviços:", err);
        listaServicos.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                <p>Erro ao carregar serviços.</p>
            </div>
        `;
    }
}

function atualizarMetricasServicos() {
    const total = todosServicos.length;
    let precoMedio = 0;

    if (total > 0) {
        const soma = todosServicos.reduce((acc, s) => acc + (parseFloat(s.preco) || 0), 0);
        precoMedio = soma / total;
    }

    document.getElementById("total-servicos").textContent = total;
    document.getElementById("preco-medio").textContent = `R$ ${precoMedio.toFixed(2).replace('.', ',')}`;
}

function renderizarListaServicos() {
    if (!todosServicos || todosServicos.length === 0) {
        listaServicos.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <p>Nenhum serviço cadastrado ainda. Clique em "+ Novo Serviço" para começar.</p>
            </div>
        `;
        return;
    }

    listaServicos.innerHTML = todosServicos.map(servico => {
        const precoFormatado = parseFloat(servico.preco || 0).toFixed(2).replace('.', ',');
        const duracao = servico.duracao_minutos || servico.duracao || 30;

        return `
            <div class="quick-action" style="justify-content: space-between; flex-wrap: wrap; gap: 14px; padding: 14px 16px; border-bottom: 1px solid #f1f5f9;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <span class="quick-icon purple">◇</span>
                    <div>
                        <strong>${servico.nome}</strong>
                        ${servico.descricao ? `<br><small style="color: var(--text-secondary);">${servico.descricao}</small>` : ''}
                        <br>
                        <small style="color: var(--text-secondary);">
                            ⏱️ <strong>${duracao} min</strong>
                        </small>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <span style="font-size: 15px; font-weight: 700; color: #10b981;">
                        R$ ${precoFormatado}
                    </span>

                    <button onclick="editarServico('${servico.id}')" class="secondary-button" style="padding: 6px 12px; font-size: 11px; width: auto;">
                        Editar
                    </button>
                    <button onclick="excluirServico('${servico.id}')" class="secondary-button" style="padding: 6px 12px; font-size: 11px; width: auto; color: #dc2626; border-color: #fca5a5;">
                        Excluir
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function configurarEventos() {
    // Abrir Form para Novo Serviço
    btnNovoServico?.addEventListener("click", () => {
        formServico.reset();
        inputId.value = "";
        tituloForm.textContent = "Cadastrar Novo Serviço";
        containerForm.style.display = "block";
        ocultarMensagem();
        inputNome.focus();
    });

    // Cancelar Form
    btnCancelarServico?.addEventListener("click", () => {
        containerForm.style.display = "none";
        formServico.reset();
        ocultarMensagem();
    });

    // Submeter Formulário (Salvar / Editar)
    formServico?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = inputId.value;
        const nome = inputNome.value.trim();
        const preco = parseFloat(inputPreco.value);
        const duracao = parseInt(inputDuracao.value) || 30;
        const descricao = inputDescricao.value.trim();

        if (!nome || isNaN(preco)) {
            mostrarMensagem("Preencha o nome e o preço corretamente.", "error");
            return;
        }

        btnSalvarServico.disabled = true;
        btnSalvarServico.textContent = "Salvando...";

        try {
            const dadosServico = {
                negocio_id: negocioId,
                nome: nome,
                preco: preco,
                duracao_minutos: duracao,
                descricao: descricao || null
            };

            let erroOperacao = null;

            if (id) {
                // Atualizar
                const { error } = await supabaseClient
                    .from("servicos")
                    .update(dadosServico)
                    .eq("id", id);
                erroOperacao = error;
            } else {
                // Inserir
                const { error } = await supabaseClient
                    .from("servicos")
                    .insert([dadosServico]);
                erroOperacao = error;
            }

            if (erroOperacao) throw erroOperacao;

            mostrarMensagem("Serviço salvo com sucesso!", "success");

            setTimeout(() => {
                containerForm.style.display = "none";
                formServico.reset();
                ocultarMensagem();
            }, 1000);

            await buscarServicos();

        } catch (err) {
            console.error("Erro ao salvar serviço:", err);
            mostrarMensagem("Erro ao salvar serviço: " + (err?.message || "erro desconhecido"), "error");
        } finally {
            btnSalvarServico.disabled = false;
            btnSalvarServico.textContent = "Salvar Serviço";
        }
    });
}

function editarServico(id) {
    const servico = todosServicos.find(s => s.id === id);
    if (!servico) return;

    inputId.value = servico.id;
    inputNome.value = servico.nome || "";
    inputPreco.value = servico.preco || "";
    inputDuracao.value = servico.duracao_minutos || servico.duracao || 30;
    inputDescricao.value = servico.descricao || "";

    tituloForm.textContent = "Editar Serviço";
    containerForm.style.display = "block";
    ocultarMensagem();
    containerForm.scrollIntoView({ behavior: 'smooth' });
}

async function excluirServico(id) {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;

    try {
        const { error } = await supabaseClient
            .from("servicos")
            .delete()
            .eq("id", id);

        if (error) throw error;

        await buscarServicos();

    } catch (err) {
        console.error("Erro ao excluir serviço:", err);
        alert("Erro ao excluir serviço: " + (err?.message || "erro desconhecido"));
    }
}

function mostrarMensagem(texto, tipo = "normal") {
    if (!mensagemServico) return;
    mensagemServico.textContent = texto;
    mensagemServico.className = `business-message ${tipo}`;
    mensagemServico.style.display = "block";
}

function ocultarMensagem() {
    if (mensagemServico) mensagemServico.style.display = "none";
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

// Inicialização
carregarPaginaServicos();
