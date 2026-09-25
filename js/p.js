/* ============================================================
   NEXORA - LÓGICA DE AGENDAMENTO PÚBLICO & PAGAMENTO (js/p.js)
============================================================ */

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

// Elementos do Módulo de Pagamento
const containerPagamentos = document.getElementById("opcoes-pagamento-container");
const painelPix = document.getElementById("painel-pix-detalhes");
const painelCartao = document.getElementById("painel-cartao-detalhes");

let negocioId = null;
let negocioDados = null;
let servicosDisponiveis = [];
let servicoSelecionadoId = null;

// Estado de Pagamento
let configPagamentoNegocio = null;
let formaPagamentoSelecionada = "dinheiro";

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

        negocioDados = negocio;
        const nome = negocio.nome || "Meu Negócio";
        bizName.textContent = nome;
        bizAvatar.textContent = nome.trim().charAt(0).toUpperCase();
        
        const cidade = negocio.cidade || "";
        const endereco = negocio.endereco || "";
        bizLocation.textContent = `📍 ${[endereco, cidade].filter(Boolean).join(" - ") || "Localização não informada"}`;
        bizDescription.textContent = negocio.descricao || "";

        // 1. Carregar Serviços disponíveis
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

        // 2. Carregar Formas de Pagamento ativas do negócio
        await carregarFormasPagamento(negocioId);

        // 3. Configurar seletor de horários
        configurarHorarios();
        
        // 4. Atualizar horários ocupados para a data inicial
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

/* -------------------------------------------------------------
 * MÓDULO DE PAGAMENTO
 * ----------------------------------------------------------- */
async function carregarFormasPagamento(negocioIdParam) {
    if (!containerPagamentos) return;

    try {
        const { data, error } = await supabaseClient
            .from("configuracao_pagamentos")
            .select("*")
            .eq("negocio_id", negocioIdParam)
            .maybeSingle();

        configPagamentoNegocio = data || { aceita_dinheiro: true };
    } catch (e) {
        console.warn("Aviso ao buscar configurações de pagamento, aplicando padrão:", e);
        configPagamentoNegocio = { aceita_dinheiro: true };
    }

    containerPagamentos.innerHTML = "";

    const opcoes = [
        { id: "dinheiro", label: "💵 Dinheiro no Local", ativo: configPagamentoNegocio.aceita_dinheiro ?? true },
        { id: "pix", label: "⚡ Pix (Pago Antecipadamente)", ativo: configPagamentoNegocio.aceita_pix ?? false },
        { id: "credito", label: "💳 Cartão de Crédito (Antecipado)", ativo: configPagamentoNegocio.aceita_credito ?? false },
        { id: "debito", label: "💳 Cartão de Débito (Antecipado)", ativo: configPagamentoNegocio.aceita_debito ?? false }
    ];

    const opcoesAtivas = opcoes.filter(o => o.ativo);

    if (opcoesAtivas.length === 0) {
        opcoesAtivas.push({ id: "dinheiro", label: "💵 Dinheiro no Local", ativo: true });
    }

    opcoesAtivas.forEach((op, index) => {
        const label = document.createElement("label");
        label.className = `payment-option-card ${index === 0 ? 'selected' : ''}`;
        label.innerHTML = `
            <input type="radio" name="forma_pagamento_opcao" value="${op.id}" ${index === 0 ? 'checked' : ''}>
            <span style="font-size: 13px; font-weight: 600; color: #0f172a;">${op.label}</span>
        `;

        label.addEventListener("click", () => {
            document.querySelectorAll(".payment-option-card").forEach(c => c.classList.remove("selected"));
            label.classList.add("selected");
            label.querySelector("input").checked = true;
            alterarFormaPagamento(op.id);
        });

        containerPagamentos.appendChild(label);
    });

    alterarFormaPagamento(opcoesAtivas[0].id);
}

function alterarFormaPagamento(tipo) {
    formaPagamentoSelecionada = tipo;

    if (painelPix) painelPix.style.display = (tipo === "pix") ? "block" : "none";
    if (painelCartao) painelCartao.style.display = (tipo === "credito" || tipo === "debito") ? "block" : "none";

    if (tipo === "pix" && configPagamentoNegocio) {
        const titularEl = document.getElementById("pix-titular-display");
        const tipoEl = document.getElementById("pix-tipo-display");
        const chaveEl = document.getElementById("pix-chave-display");

        if (titularEl) titularEl.textContent = configPagamentoNegocio.titular_pix || (negocioDados?.nome || "Empreendedor");
        if (tipoEl) tipoEl.textContent = (configPagamentoNegocio.tipo_chave_pix || "Chave").toUpperCase();
        if (chaveEl) chaveEl.textContent = configPagamentoNegocio.chave_pix || "Não cadastrada";
    }
}

// Evento do botão de copiar chave Pix
document.getElementById("btn-copiar-pix")?.addEventListener("click", () => {
    const chave = document.getElementById("pix-chave-display")?.textContent;
    if (chave && chave !== "Não cadastrada" && chave !== "-") {
        navigator.clipboard.writeText(chave);
        alert("Chave Pix copiada!");
    }
});

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

        // 2. Upload de Comprovativo Pix (se aplicável)
        let comprovanteUrl = null;
        let statusPagamento = "pendente";

        if (formaPagamentoSelecionada === "pix") {
            statusPagamento = "aguardando_aprovacao_pix";
            const fileInput = document.getElementById("input-comprovante-pix");

            if (fileInput?.files[0]) {
                const file = fileInput.files[0];
                const fileExt = file.name.split('.').pop();
                const fileName = `comprovantes/pix_${Date.now()}.${fileExt}`;

                const { error: uploadErr } = await supabaseClient.storage
                    .from("portfolio")
                    .upload(fileName, file);

                if (!uploadErr) {
                    const { data: pubData } = supabaseClient.storage
                        .from("portfolio")
                        .getPublicUrl(fileName);
                    comprovanteUrl = pubData?.publicUrl || null;
                }
            }
        } else if (formaPagamentoSelecionada === "credito" || formaPagamentoSelecionada === "debito") {
            statusPagamento = "pago_cartao";
        } else {
            statusPagamento = "pendente_presencial";
        }

        // 3. Gravar Agendamento preenchendo todos os campos
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
            forma_pagamento: formaPagamentoSelecionada,
            status_pagamento: statusPagamento,
            comprovante_pix_url: comprovanteUrl,
            status: "confirmado"
        };

        const { error: errAgendamento } = await supabaseClient
            .from("agendamentos")
            .insert([payload]);

        if (errAgendamento) throw errAgendamento;

        // 4. Ecrã de Sucesso
        document.getElementById("summary-service").textContent = servicoObj ? servicoObj.nome : "Serviço";
        document.getElementById("summary-date").textContent = dataFormatada.split("-").reverse().join("/");
        document.getElementById("summary-time").textContent = horario;
        document.getElementById("summary-client").textContent = nomeCliente;

        const rotulosPagamento = {
            dinheiro: "Dinheiro Presencial",
            pix: "Pix Antecipado",
            credito: "Cartão de Crédito",
            debito: "Cartão de Débito"
        };
        const summaryPaymentEl = document.getElementById("summary-payment");
        if (summaryPaymentEl) {
            summaryPaymentEl.textContent = rotulosPagamento[formaPagamentoSelecionada] || formaPagamentoSelecionada;
        }

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

// Inicializar a aplicação pública
inicializarPaginaPublica();
