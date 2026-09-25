/* ============================================================
   NEXORA - LÓGICA DE AGENDAMENTO PÚBLICO & MERCADO PAGO SPLIT (js/p.js)
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

// Estado de Pagamento & Mercado Pago
let configPagamentoNegocio = null;
let conexaoMercadoPago = null;
let mpInstance = null;
let cardPaymentBrickController = null;
let formaPagamentoSelecionada = "dinheiro";

async function inicializarPaginaPublica() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        // Leitura flexível: aceita tanto ?id=UUID quanto ?UUID diretamente
        negocioId = urlParams.get("id") || window.location.search.replace("?", "").split("&")[0].replace("id=", "").trim();

        if (!negocioId) {
            exibirErro();
            return;
        }

        if (bookingDate) {
            const hoje = new Date().toISOString().split("T")[0];
            bookingDate.min = hoje;
            bookingDate.value = hoje;
        }

        // Busca o negócio por id OU por user_id
        const { data: negocio, error: errNegocio } = await supabaseClient
            .from("negocios")
            .select("*")
            .or(`id.eq.${negocioId},user_id.eq.${negocioId}`)
            .maybeSingle();

        if (errNegocio || !negocio) {
            console.error("Erro ao procurar negócio:", errNegocio);
            exibirErro();
            return;
        }

        // CORREÇÃO ESSENCIAL: Garante que negocioId passe a ser o ID real do negócio
        negocioId = negocio.id;
        negocioDados = negocio;

        const nome = negocio.nome || "Meu Negócio";
        if (bizName) bizName.textContent = nome;
        if (bizAvatar) bizAvatar.textContent = nome.trim().charAt(0).toUpperCase();
        
        const cidade = negocio.cidade || "";
        const endereco = negocio.endereco || "";
        if (bizLocation) bizLocation.textContent = `📍 ${[endereco, cidade].filter(Boolean).join(" - ") || "Localização não informada"}`;
        if (bizDescription) bizDescription.textContent = negocio.descricao || "";

        // 1. Carregar Serviços disponíveis do negócio
        const { data: servicos, error: errServicos } = await supabaseClient
            .from("servicos")
            .select("*")
            .eq("negocio_id", negocioId)
            .order("nome", { ascending: true });

        if (errServicos || !servicos || servicos.length === 0) {
            if (servicesList) servicesList.innerHTML = `<p style="color: #64748b; font-size: 13px;">Nenhum serviço disponível para agendamento no momento.</p>`;
        } else {
            servicosDisponiveis = servicos;
            renderizarServicos(servicos);
        }

        // 2. Buscar conexão Mercado Pago ativa do Negócio
        const { data: conexaoMP } = await supabaseClient
            .from("mercadopago_conexoes")
            .select("*")
            .eq("negocio_id", negocioId)
            .eq("status", "ativo")
            .maybeSingle();

        conexaoMercadoPago = conexaoMP;

        // 3. Carregar Formas de Pagamento ativas do negócio
        await carregarFormasPagamento(negocioId);

        // 4. Configurar seletor de horários
        configurarHorarios();
        
        // 5. Atualizar horários ocupados para a data inicial
        await verificarHorariosOcupados();

        if (loadingState) loadingState.style.display = "none";
        if (publicContent) publicContent.style.display = "block";

    } catch (err) {
        console.error("Erro ao carregar perfil público:", err);
        exibirErro();
    }
}

function renderizarServicos(servicos) {
    if (!servicesList) return;

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

    if (formaPagamentoSelecionada === "credito" || formaPagamentoSelecionada === "debito") {
        renderizarMercadoPagoBrick();
    }
}

/* -------------------------------------------------------------
 * MÓDULO DE PAGAMENTO & MERCADO PAGO BRICK
 * ----------------------------------------------------------- */
async function carregarFormasPagamento(negocioIdParam) {
    if (!containerPagamentos) return;

    try {
        const { data } = await supabaseClient
            .from("configuracao_pagamentos")
            .select("*")
            .eq("negocio_id", negocioIdParam)
            .maybeSingle();

        configPagamentoNegocio = data || { aceita_dinheiro: true };
    } catch (e) {
        configPagamentoNegocio = { aceita_dinheiro: true };
    }

    containerPagamentos.innerHTML = "";

    const opcoes = [
        { id: "dinheiro", label: "💵 Dinheiro no Local", ativo: configPagamentoNegocio.aceita_dinheiro ?? true },
        { id: "pix", label: "⚡ Pix (Pago Antecipadamente)", ativo: configPagamentoNegocio.aceita_pix ?? false },
        { id: "credito", label: "💳 Cartão de Crédito (Online)", ativo: (configPagamentoNegocio.aceita_credito ?? false) && !!conexaoMercadoPago },
        { id: "debito", label: "💳 Cartão de Débito (Online)", ativo: (configPagamentoNegocio.aceita_debito ?? false) && !!conexaoMercadoPago }
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

    if ((tipo === "credito" || tipo === "debito") && conexaoMercadoPago) {
        renderizarMercadoPagoBrick();
    }
}

// Renderizar Mercado Pago Card Payment Brick
async function renderizarMercadoPagoBrick() {
    if (!conexaoMercadoPago || !conexaoMercadoPago.public_key || typeof MercadoPago === "undefined") return;

    const servicoObj = servicosDisponiveis.find(s => s.id === servicoSelecionadoId);
    const precoTotal = servicoObj ? parseFloat(servicoObj.preco || 0) : 0;

    if (precoTotal <= 0) return;

    try {
        if (!mpInstance) {
            mpInstance = new MercadoPago(conexaoMercadoPago.public_key, { locale: 'pt-BR' });
        }

        const bricksBuilder = mpInstance.bricks();

        if (cardPaymentBrickController) {
            cardPaymentBrickController.unmount();
        }

        cardPaymentBrickController = await bricksBuilder.create('cardPayment', 'cardPaymentBrick_container', {
            initialization: {
                amount: precoTotal,
            },
            customization: {
                visual: {
                    style: {
                        theme: 'default'
                    }
                },
                paymentMethods: {
                    maxInstallments: 1
                }
            },
            callbacks: {
                onReady: () => {},
                onSubmit: (cardFormData) => {
                    return new Promise((resolve, reject) => {
                        processarPagamentoMercadoPago(cardFormData)
                            .then(() => resolve())
                            .catch((err) => reject(err));
                    });
                },
                onError: (error) => {
                    console.error("Erro no Mercado Pago Brick:", error);
                }
            }
        });
    } catch (e) {
        console.error("Erro ao inicializar Mercado Pago Brick:", e);
    }
}

async function processarPagamentoMercadoPago(cardFormData) {
    console.log("Dados do Cartão Tokenizados pelo MP:", cardFormData);
    return true;
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
            if (bookingTime) bookingTime.value = slot.getAttribute("data-time");
        });
    });

    bookingDate?.addEventListener("change", verificarHorariosOcupados);
}

async function verificarHorariosOcupados() {
    if (!bookingDate) return;
    const dataSelecionada = bookingDate.value;
    if (!dataSelecionada || !negocioId) return;

    const slots = document.querySelectorAll(".time-slot-btn");
    
    slots.forEach(slot => {
        slot.disabled = false;
        slot.classList.remove("active", "disabled");
        slot.style.opacity = "1";
        slot.style.cursor = "pointer";
        slot.title = "";
    });
    if (bookingTime) bookingTime.value = "";

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

    const ocupados = new Set();
    (agendamentos || []).forEach(item => {
        if (item.horario) ocupados.add(item.horario.substring(0, 5));
        if (item.hora_inicio) ocupados.add(item.hora_inicio.substring(0, 5));
    });

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
    if (loadingState) loadingState.style.display = "none";
    if (publicContent) publicContent.style.display = "none";
    if (errorState) errorState.style.display = "block";
}

bookingForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (errorMsg) errorMsg.style.display = "none";

    if (!servicoSelecionadoId) {
        mostrarErroForm("Selecione um serviço.");
        return;
    }

    if (!bookingTime || !bookingTime.value) {
        mostrarErroForm("Selecione um horário disponível.");
        return;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Agendando...";
    }

    try {
        const servicoObj = servicosDisponiveis.find(s => s.id === servicoSelecionadoId);
        const dataFormatada = bookingDate.value;
        const horario = bookingTime.value;
        const nomeCliente = clientName.value.trim();
        const telefoneCliente = clientPhone.value.trim();

        // Trava de segurança contra agendamento duplo
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

        // 1. Cadastrar / Procurar Cliente
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
            statusPagamento = "pago_cartao_mp";
        } else {
            statusPagamento = "pendente_presencial";
        }

        // 3. Gravar Agendamento no Supabase
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
        const srvEl = document.getElementById("summary-service");
        const dateEl = document.getElementById("summary-date");
        const timeEl = document.getElementById("summary-time");
        const clientEl = document.getElementById("summary-client");

        if (srvEl) srvEl.textContent = servicoObj ? servicoObj.nome : "Serviço";
        if (dateEl) dateEl.textContent = dataFormatada.split("-").reverse().join("/");
        if (timeEl) timeEl.textContent = horario;
        if (clientEl) clientEl.textContent = nomeCliente;

        const rotulosPagamento = {
            dinheiro: "Dinheiro Presencial",
            pix: "Pix Antecipado",
            credito: "Cartão de Crédito (Mercado Pago)",
            debito: "Cartão de Débito (Mercado Pago)"
        };
        const summaryPaymentEl = document.getElementById("summary-payment");
        if (summaryPaymentEl) {
            summaryPaymentEl.textContent = rotulosPagamento[formaPagamentoSelecionada] || formaPagamentoSelecionada;
        }

        if (bookingSection) bookingSection.style.display = "none";
        if (successSection) successSection.style.display = "block";

    } catch (err) {
        console.error("Erro no agendamento:", err);
        const mensagemErro = err?.message || err?.details || "Erro desconhecido ao agendar.";
        mostrarErroForm(`Erro ao agendar: ${mensagemErro}`);
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Confirmar Agendamento";
        }
    }
});

function mostrarErroForm(texto) {
    if (errorMsg) {
        errorMsg.textContent = texto;
        errorMsg.style.display = "block";
    }
}

// Inicializar aplicação
inicializarPaginaPublica();
