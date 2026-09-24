// Elementos de ecrã
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
        const urlParams = new URLSearchParams(window.location.search);
        negocioId = urlParams.get("id");

        if (!negocioId) {
            exibirErro();
            return;
        }

        const hoje = new Date().toISOString().split("T")[0];
        bookingDate.min = hoje;
        bookingDate.value = hoje;

        const { data: negocio, error: errNegocio } = await supabaseClient
            .from("negocios")
            .select("*")
            .eq("id", negocioId)
            .maybeSingle();

        if (errNegocio || !negocio) {
            console.error("Erro ao procurar negócio:", errNegocio);
            exibirErro();
            return;
        }

        const nome = negocio.nome || "Meu Negócio";
        bizName.textContent = nome;
        bizAvatar.textContent = nome.trim().charAt(0).toUpperCase();
        
        const cidade = negocio.cidade || "";
        const endereco = negocio.endereco || "";
        bizLocation.textContent = `📍 ${[endereco, cidade].filter(Boolean).join(" - ") || "Localização não informada"}`;
        bizDescription.textContent = negocio.descricao || "";

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

        configurarHorarios();
        
        // Atualizar horários ocupados para a data inicial
        await verificarHorariosOcupados();

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
            if (slot.disabled) return;
            slots.forEach(s => s.classList.remove("active"));
            slot.classList.add("active");
            bookingTime.value = slot.getAttribute("data-time");
        });
    });

    // Quando a data muda, reanalisa os horários ocupados
    bookingDate?.addEventListener("change", verificarHorariosOcupados);
}

async function verificarHorariosOcupados() {
    const dataSelecionada = bookingDate.value;
    if (!dataSelecionada || !negocioId) return;

    const slots = document.querySelectorAll(".time-slot-btn");
    
    // Resetar todos os botões antes da verificação
    slots.forEach(slot => {
        slot.disabled = false;
        slot.classList.remove("active", "disabled");
        slot.style.opacity = "1";
        slot.style.cursor = "pointer";
        slot.title = "";
    });
    bookingTime.value = "";

    // Buscar agendamentos na base de dados para esta data
    const { data: agendamentos, error } = await supabaseClient
        .from("agendamentos")
        .select("horario, hora_inicio, status")
        .eq("negocio_id", negocioId)
        .or(`data.eq.${dataSelecionada},data_agendamento.eq.${dataSelecionada}`)
        .neq("status", "cancelado");

    if (error) {
        console.error("Erro ao verificar horários ocupados:", error);
        return;
    }

    // Criar conjunto de horários já reservados
    const ocupados = new Set();
    (agendamentos || []).forEach(item => {
        if (item.horario) ocupados.add(item.horario.substring(0, 5));
        if (item.hora_inicio) ocupados.add(item.hora_inicio.substring(0, 5));
    });

    // Desativar botões correspondentes aos horários ocupados
    slots.forEach(slot => {
        const hora = slot.getAttribute("data-time")?.substring(0, 5);
        if (ocupados.has(hora)) {
            slot.disabled = true;
            slot.classList.add("disabled");
            slot.style.opacity = "0.35";
            slot.style.cursor = "not-allowed";
            slot.title = "Horário já reservado";
        }
    });
}

function exibirErro() {
    loadingState.style.display = "none";
    publicContent.style.display = "none";
    errorState.style.display = "block";
}

bookingForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    errorMsg.style.display = "none";

    if (!servicoSelecionadoId) {
        mostrarErroForm("Selecione um serviço.");
        return;
    }

    if (!bookingTime.value) {
        mostrarErroForm("Selecione um horário disponível.");
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

        // Verificação final antes de salvar (evita agendamento duplo simultâneo)
        const { data: conflito } = await supabaseClient
            .from("agendamentos")
            .select("id")
            .eq("negocio_id", negocioId)
            .or(`data.eq.${dataFormatada},data_agendamento.eq.${dataFormatada}`)
            .or(`horario.eq.${horario},hora_inicio.eq.${horario}`)
            .neq("status", "cancelado")
            .maybeSingle();

        if (conflito) {
            mostrarErroForm("Este horário acabou de ser reservado por outro cliente. Escolha outro horário.");
            await verificarHorariosOcupados();
            return;
        }

        // 1. Cadastrar/Procurar Cliente
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
                .maybeSingle();

            if (novoCliente) clienteId = novoCliente.id;
        }

        // 2. Gravar Agendamento preenchendo todos os campos de hora e data
        const payload = {
            negocio_id: negocioId,
            servico_id: servicoSelecionadoId,
            cliente_id: clienteId,
            nome_cliente: nomeCliente,
            cliente_nome: nomeCliente,
            telefone_cliente: telefoneCliente,
            cliente_telefone: telefoneCliente,
            data: dataFormatada,
            data_agendamento: dataFormatada,
            horario: horario,
            hora_inicio: horario,
            status: "confirmado"
        };

        const { error: errAgendamento } = await supabaseClient
            .from("agendamentos")
            .insert([payload]);

        if (errAgendamento) throw errAgendamento;

        // 3. Ecrã de Sucesso
        document.getElementById("summary-service").textContent = servicoObj ? servicoObj.nome : "Serviço";
        document.getElementById("summary-date").textContent = dataFormatada.split("-").reverse().join("/");
        document.getElementById("summary-time").textContent = horario;
        document.getElementById("summary-client").textContent = nomeCliente;

        bookingSection.style.display = "none";
        successSection.style.display = "block";

    } catch (err) {
        console.error("Erro no agendamento:", err);
        const mensagemErro = err?.message || err?.details || "Erro desconhecido ao agendar.";
        mostrarErroForm(`Erro ao agendar: ${mensagemErro}`);
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
