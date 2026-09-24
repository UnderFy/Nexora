// Elementos de tela
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const publicContent = document.getElementById("public-content");

const bizAvatar = document.getElementById("biz-avatar");
const bizName = document.getElementById("biz-name");
const bizLocation = document.getElementById("biz-location");
const bizDescription = document.getElementById("biz-description");
const servicesList = document.getElementById("services-list");

const bookingForm = document.getElementById("form-agendamento-publico");
const bookingDate = document.getElementById("booking-date");
const bookingTime = document.getElementById("booking-time");
const clientName = document.getElementById("client-name");
const clientPhone = document.getElementById("client-phone");
const btnSubmit = document.getElementById("btn-submit-booking");
const errorMsg = document.getElementById("booking-error-msg");

const bookingSection = document.getElementById("booking-section");
const successSection = document.getElementById("success-section");

let negocioId = null;
let servicosDisponiveis = [];
let servicoSelecionadoId = null;

async function inicializarPaginaPublica() {
    try {
        // 1. Obter o ID do negócio via Query String (?id=UUID_DO_NEGOCIO)
        const urlParams = new URLSearchParams(window.location.search);
        negocioId = urlParams.get("id");

        if (!negocioId) {
            exibirErro();
            return;
        }

        // 2. Definir a data mínima no calendário (hoje)
        const hoje = new Date().toISOString().split("T")[0];
        bookingDate.min = hoje;
        bookingDate.value = hoje;

        // 3. Buscar Dados do Negócio no Supabase
        const { data: negocio, error: errNegocio } = await supabaseClient
            .from("negocios")
            .select("*")
            .eq("id", negocioId)
            .maybeSingle();

        if (errNegocio || !negocio) {
            exibirErro();
            return;
        }

        // Preencher informações do Perfil
        const nome = negocio.nome || "Meu Negócio";
        bizName.textContent = nome;
        bizAvatar.textContent = nome.trim().charAt(0).toUpperCase();
        
        const cidade = negocio.cidade || "";
        const endereco = negocio.endereco || "";
        bizLocation.textContent = `📍 ${[endereco, cidade].filter(Boolean).join(" - ") || "Localização não informada"}`;
        bizDescription.textContent = negocio.descricao || "";

        // 4. Buscar Serviços do Negócio
        const { data: servicos, error: errServicos } = await supabaseClient
            .from("servicos")
            .select("*")
            .eq("negocio_id", negocioId)
            .order("nome", { ascending: true });

        if (errServicos || !servicos || servicos.length === 0) {
            servicesList.innerHTML = `<p style="color: #64748b; font-size: 13px;">Nenhum serviço disponível para agendamento no momento.</p>`;
        } else {
            servicosDisponiveis = servicos;
            renderizarServicos(servicos);
        }

        // Configurar Seletor de Horários
        configurarHorarios();

        // Mostrar tela principal
        loadingState.style.display = "none";
        publicContent.style.display = "block";

    } catch (err) {
        console.error("Erro ao carregar perfil público:", err);
        exibirErro();
    }
}

function renderizarServicos(servicos) {
    servicesList.innerHTML = servicos.map((servico, index) => {
        const preco = parseFloat(servico.preco || 0).toFixed(2).replace(".", ",");
        const duracao = servico.duracao_minutos || servico.duracao || 30;
        const isChecked = index === 0 ? "checked" : "";
        if (index === 0) servicoSelecionadoId = servico.id;

        return `
            <label class="service-selection-card ${index === 0 ? 'selected' : ''}" for="srv-${servico.id}">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="radio" name="servico_id" id="srv-${servico.id}" value="${servico.id}" ${isChecked} onchange="selecionarServico('${servico.id}')">
                    <div>
                        <strong style="font-size: 14px; color: #0f172a; display: block;">${servico.nome}</strong>
                        <small style="color: #64748b; font-size: 12px;">⏱️ ${duracao} min</small>
                    </div>
                </div>
                <strong style="color: #10b981; font-size: 14px;">R$ ${preco}</strong>
            </label>
        `;
    }).join("");
}

function selecionarServico(id) {
    servicoSelecionadoId = id;
    document.querySelectorAll(".service-selection-card").forEach(card => {
        card.classList.remove("selected");
    });
    const radio = document.getElementById(`srv-${id}`);
    if (radio) {
        radio.closest(".service-selection-card").classList.add("selected");
    }
}

function configurarHorarios() {
    const slots = document.querySelectorAll(".time-slot-btn");
    slots.forEach(slot => {
        slot.addEventListener("click", () => {
            slots.forEach(s => s.classList.remove("active"));
            slot.classList.add("active");
            bookingTime.value = slot.getAttribute("data-time");
        });
    });
}

function exibirErro() {
    loadingState.style.display = "none";
    publicContent.style.display = "none";
    errorState.style.display = "block";
}

// Submeter Agendamento
bookingForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    errorMsg.style.display = "none";

    if (!servicoSelecionadoId) {
        mostrarErroForm("Selecione um serviço.");
        return;
    }

    if (!bookingTime.value) {
        mostrarErroForm("Selecione um horário para o agendamento.");
        return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Agendando...";

    try {
        const servicoObj = servicosDisponiveis.find(s => s.id === servicoSelecionadoId);
        const dataFormatada = bookingDate.value;
        const horario = bookingTime.value;
        const nomeCliente = clientName.value.trim();
        const telefoneCliente = clientPhone.value.trim();

        // 1. Cadastrar/Garantir Cliente na Tabela 'clientes'
        let clienteId = null;
        const { data: clienteExistente } = await supabaseClient
            .from("clientes")
            .select("id")
            .eq("negocio_id", negocioId)
            .eq("telefone", telefoneCliente)
            .maybeSingle();

        if (clienteExistente) {
            clienteId = clienteExistente.id;
        } else {
            const { data: novoCliente } = await supabaseClient
                .from("clientes")
                .insert([{
                    negocio_id: negocioId,
                    nome: nomeCliente,
                    telefone: telefoneCliente
                }])
                .select("id")
                .single();

            if (novoCliente) clienteId = novoCliente.id;
        }

        // 2. Salvar Agendamento na Tabela 'agendamentos'
        const { error: errAgendamento } = await supabaseClient
            .from("agendamentos")
            .insert([{
                negocio_id: negocioId,
                servico_id: servicoSelecionadoId,
                cliente_id: clienteId,
                nome_cliente: nomeCliente,
                telefone_cliente: telefoneCliente,
                data: dataFormatada,
                horario: horario,
                status: "confirmado"
            }]);

        if (errAgendamento) throw errAgendamento;

        // 3. Exibir Tela de Confirmação
        document.getElementById("summary-service").textContent = servicoObj ? servicoObj.nome : "Serviço";
        document.getElementById("summary-date").textContent = dataFormatada.split("-").reverse().join("/");
        document.getElementById("summary-time").textContent = horario;
        document.getElementById("summary-client").textContent = nomeCliente;

        bookingSection.style.display = "none";
        successSection.style.display = "block";

    } catch (err) {
        console.error("Erro ao registrar agendamento:", err);
        mostrarErroForm("Erro ao registrar agendamento. Tente novamente.");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Confirmar Agendamento";
    }
});

function mostrarErroForm(texto) {
    errorMsg.textContent = texto;
    errorMsg.style.display = "block";
}

// Inicializar
inicializarPaginaPublica();
