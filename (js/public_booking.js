let configPagamentoNegocio = null;
let formaPagamentoSelecionada = null;

// 1. Busca as configurações de pagamento ao carregar a página do negócio
async function carregarFormasPagamentoPublicas(negocioId) {
    const { data, error } = await supabaseClient
        .from("configuracao_pagamentos")
        .select("*")
        .eq("negocio_id", negocioId)
        .maybeSingle();

    if (error || !data) {
        // Se não configurou, fallback para Dinheiro
        renderizarOpcoesPagamento({ aceita_dinheiro: true });
        return;
    }

    configPagamentoNegocio = data;
    renderizarOpcoesPagamento(data);
}

// 2. Renderiza as opções que o empreendedor ativou
function renderizarOpcoesPagamento(config) {
    const container = document.getElementById("opcoes-pagamento-container");
    container.innerHTML = "";

    const opcoes = [
        { id: "dinheiro", Label: "💵 Dinheiro no Local", ativo: config.aceita_dinheiro },
        { id: "pix", Label: "⚡ Pix (Pago Antecipadamente)", ativo: config.aceita_pix },
        { id: "credito", Label: "💳 Cartão de Crédito (Antecipado)", ativo: config.aceita_credito },
        { id: "debito", Label: "💳 Cartão de Débito (Antecipado)", ativo: config.aceita_debito }
    ];

    opcoes.filter(o => o.ativo).forEach((opcao, index) => {
        const label = document.createElement("label");
        label.style.cssText = "display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem; border: 1px solid #D1D5DB; border-radius: 8px; cursor: pointer;";
        
        label.innerHTML = `
            <input type="radio" name="forma_pagamento" value="${opcao.id}" ${index === 0 ? "checked" : ""}>
            <span style="font-weight: 500;">${opcao.Label}</span>
        `;

        label.querySelector("input").addEventListener("change", (e) => {
            alterarFormaPagamento(e.target.value);
        });

        container.appendChild(label);
    });

    // Define a opção padrão inicial
    const opcaoInicial = opcoes.find(o => o.ativo)?.id || "dinheiro";
    alterarFormaPagamento(opcaoInicial);
}

// 3. Altera a exibição dos campos de apoio (Pix / Cartão)
function alterarFormaPagamento(tipo) {
    formaPagamentoSelecionada = tipo;
    
    const painelPix = document.getElementById("painel-pix-detalhes");
    const painelCartao = document.getElementById("painel-cartao-detalhes");

    painelPix.style.display = (tipo === "pix") ? "block" : "none";
    painelCartao.style.display = (tipo === "credito" || tipo === "debito") ? "block" : "none";

    if (tipo === "pix" && configPagamentoNegocio) {
        document.getElementById("pix-titular-display").textContent = configPagamentoNegocio.titular_pix || "Empreendedor";
        document.getElementById("pix-tipo-display").textContent = (configPagamentoNegocio.tipo_chave_pix || "Chave").toUpperCase();
        document.getElementById("pix-chave-display").textContent = configPagamentoNegocio.chave_pix || "Não cadastrada";
    }
}

// Copiar Chave Pix
document.getElementById("btn-copiar-pix")?.addEventListener("click", () => {
    const chave = document.getElementById("pix-chave-display").textContent;
    navigator.clipboard.writeText(chave);
    alert("Chave Pix copiada para a área de transferência!");
});

// 4. Salvar Agendamento com Pagamento
async function finalizarAgendamento(dadosAgendamento) {
    let comprovanteUrl = null;
    let statusPagamento = "pendente";

    // Se for Pix e houver comprovante anexado, faz upload pro Bucket 'comprovantes'
    if (formaPagamentoSelecionada === "pix") {
        const fileInput = document.getElementById("input-comprovante-pix");
        if (fileInput?.files[0]) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `pix_${Date.now()}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from("portfolio")
                .upload(`comprovantes/${fileName}`, file);

            if (!uploadError) {
                const { data: publicUrlData } = supabaseClient.storage
                    .from("portfolio")
                    .getPublicUrl(`comprovantes/${fileName}`);
                comprovanteUrl = publicUrlData.publicUrl;
            }
        }
        statusPagamento = "aguardando_aprovacao_pix";
    } else if (formaPagamentoSelecionada === "credito" || formaPagamentoSelecionada === "debito") {
        statusPagamento = "pago_cartao";
    } else if (formaPagamentoSelecionada === "dinheiro") {
        statusPagamento = "pendente_presencial";
    }

    // Grava o agendamento no Supabase
    const { data, error } = await supabaseClient
        .from("agendamentos")
        .insert([{
            ...dadosAgendamento,
            forma_pagamento: formaPagamentoSelecionada,
            status_pagamento: statusPagamento,
            comprovante_pix_url: comprovanteUrl
        }]);

    if (error) {
        alert("Erro ao realizar agendamento: " + error.message);
    } else {
        alert("Agendamento realizado com sucesso!");
    }
}
