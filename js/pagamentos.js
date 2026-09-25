/* ============================================================
   NEXORA - PAINEL DE CONFIGURAÇÃO DE PAGAMENTOS (js/pagamentos.js)
============================================================ */

// 1. CONFIGURAÇÕES DA APLICAÇÃO MERCADO PAGO DA PLATAFORMA (NEXORA)
const NEXORA_MP_CLIENT_ID = "1362936289"; // 👈 COLE AQUI O SEU CLIENT_ID DO MERCADO PAGO
const REDIRECT_URI = window.location.origin + window.location.pathname;

// Elementos de Interface
const statusAlert = document.getElementById("status-alert");
const mpStatusText = document.getElementById("mp-status-text");
const btnConectarMP = document.getElementById("btn-conectar-mp");
const btnDesconectarMP = document.getElementById("btn-desconectar-mp");

const formConfig = document.getElementById("form-config-pagamentos");
const chkDinheiro = document.getElementById("aceita-dinheiro");
const chkPix = document.getElementById("aceita-pix");
const chkCredito = document.getElementById("aceita-credito");
const chkDebito = document.getElementById("aceita-debito");

const secaoPix = document.getElementById("secao-detalhes-pix");
const selTipoChave = document.getElementById("tipo-chave-pix");
const txtChavePix = document.getElementById("chave-pix");
const txtTitularPix = document.getElementById("titular-pix");
const btnSalvar = document.getElementById("btn-salvar-config");

let negocioId = null;

// Inicialização da Página
async function inicializarPainelPagamentos() {
    try {
        // Verificar sessão do usuário Supabase
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            exibirAlerta("Sessão expirada. Por favor, faça login novamente.", "erro");
            return;
        }

        // Buscar negócio do usuário
        const { data: negocio } = await supabaseClient
            .from("negocios")
            .select("id, nome")
            .limit(1)
            .maybeSingle();

        if (!negocio) {
            exibirAlerta("Nenhum negócio encontrado para este usuário.", "erro");
            return;
        }

        negocioId = negocio.id;

        // 1. Verificar se retornou do Mercado Pago com um código OAuth (?code=...)
        await verificarRetornoOAuth();

        // 2. Carregar estado da conexão Mercado Pago
        await carregarStatusMercadoPago();

        // 3. Carregar configurações gerais de pagamento
        await carregarConfiguracoesGerais();

    } catch (err) {
        console.error("Erro ao inicializar página de pagamentos:", err);
        exibirAlerta("Erro ao carregar configurações.", "erro");
    }
}

/* -------------------------------------------------------------
 * FLUXO OAUTH MERCADO PAGO
 * ----------------------------------------------------------- */

// 1. Gerar link e redirecionar para autorização no Mercado Pago
btnConectarMP?.addEventListener("click", () => {
    if (!NEXORA_MP_CLIENT_ID || NEXORA_MP_CLIENT_ID === "SEU_CLIENT_ID_AQUI") {
        alert("Atenção: Defina o NEXORA_MP_CLIENT_ID no arquivo js/pagamentos.js antes de continuar.");
        return;
    }

    const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${NEXORA_MP_CLIENT_ID}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    window.location.href = authUrl;
});

// 2. Capturar o código retornado pelo Mercado Pago (?code=...)
async function verificarRetornoOAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (code && negocioId) {
        exibirAlerta("Conectando sua conta do Mercado Pago...", "info");

        try {
            // Salvar temporariamente o registro de autorização
            const { error } = await supabaseClient
                .from("mercadopago_conexoes")
                .upsert({
                    negocio_id: negocioId,
                    mp_user_id: "conectado_pending",
                    access_token: code, // Guarda o código retornado para processamento
                    status: "ativo",
                    updated_at: new Date().toISOString()
                }, { onConflict: "negocio_id" });

            if (error) throw error;

            exibirAlerta(" Conta do Mercado Pago conectada com sucesso!", "sucesso");

            // Limpar o ?code= da URL
            window.history.replaceState({}, document.title, window.location.pathname);

        } catch (err) {
            console.error("Erro ao salvar autorização MP:", err);
            exibirAlerta("Erro ao concluir conexão com o Mercado Pago.", "erro");
        }
    }
}

// 3. Verificar se o negócio já tem conta Mercado Pago ativa
async function carregarStatusMercadoPago() {
    if (!negocioId) return;

    const { data: conexao } = await supabaseClient
        .from("mercadopago_conexoes")
        .select("*")
        .eq("negocio_id", negocioId)
        .eq("status", "ativo")
        .maybeSingle();

    if (conexao) {
        mpStatusText.textContent = "✅ Conectado e Ativo";
        mpStatusText.style.color = "#10b981";
        btnConectarMP.style.display = "none";
        btnDesconectarMP.style.display = "block";
    } else {
        mpStatusText.textContent = "❌ Não Conectado";
        mpStatusText.style.color = "#f59e0b";
        btnConectarMP.style.display = "block";
        btnDesconectarMP.style.display = "none";
    }
}

// 4. Desconectar Mercado Pago
btnDesconectarMP?.addEventListener("click", async () => {
    if (!confirm("Deseja realmente desconectar a sua conta do Mercado Pago?")) return;

    try {
        await supabaseClient
            .from("mercadopago_conexoes")
            .update({ status: "inativo" })
            .eq("negocio_id", negocioId);

        exibirAlerta("Conta do Mercado Pago desconectada.", "info");
        await carregarStatusMercadoPago();
    } catch (err) {
        console.error("Erro ao desconectar:", err);
        exibirAlerta("Erro ao desconectar conta.", "erro");
    }
});

/* -------------------------------------------------------------
 * CONFIGURAÇÕES GERAIS DE PAGAMENTO
 * ----------------------------------------------------------- */

// Mostrar/Ocultar campos de Pix ao marcar o checkbox
chkPix?.addEventListener("change", () => {
    secaoPix.style.display = chkPix.checked ? "block" : "none";
});

// Carregar opções do negócio do Supabase
async function carregarConfiguracoesGerais() {
    if (!negocioId) return;

    const { data } = await supabaseClient
        .from("configuracao_pagamentos")
        .select("*")
        .eq("negocio_id", negocioId)
        .maybeSingle();

    if (data) {
        chkDinheiro.checked = data.aceita_dinheiro ?? true;
        chkPix.checked = data.aceita_pix ?? false;
        chkCredito.checked = data.aceita_credito ?? false;
        chkDebito.checked = data.aceita_debito ?? false;

        selTipoChave.value = data.tipo_chave_pix || "cpf";
        txtChavePix.value = data.chave_pix || "";
        txtTitularPix.value = data.titular_pix || "";

        secaoPix.style.display = chkPix.checked ? "block" : "none";
    }
}

// Salvar formulário
formConfig?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!negocioId) return;

    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    try {
        const payload = {
            negocio_id: negocioId,
            aceita_dinheiro: chkDinheiro.checked,
            aceita_pix: chkPix.checked,
            aceita_credito: chkCredito.checked,
            aceita_debito: chkDebito.checked,
            tipo_chave_pix: selTipoChave.value,
            chave_pix: txtChavePix.value.trim(),
            titular_pix: txtTitularPix.value.trim(),
            updated_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from("configuracao_pagamentos")
            .upsert(payload, { onConflict: "negocio_id" });

        if (error) throw error;

        exibirAlerta("Configurações salvas com sucesso!", "sucesso");

    } catch (err) {
        console.error("Erro ao salvar configurações:", err);
        exibirAlerta("Erro ao salvar configurações.", "erro");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "💾 Salvar Configurações de Pagamento";
    }
});

// Utilitário de Alertas
function exibirAlerta(mensagem, tipo) {
    statusAlert.textContent = mensagem;
    statusAlert.style.display = "block";

    if (tipo === "sucesso") {
        statusAlert.style.background = "#d1fae5";
        statusAlert.style.color = "#065f46";
        statusAlert.style.border = "1px solid #a7f3d0";
    } else if (tipo === "erro") {
        statusAlert.style.background = "#fee2e2";
        statusAlert.style.color = "#991b1b";
        statusAlert.style.border = "1px solid #fca5a5";
    } else {
        statusAlert.style.background = "#e0f2fe";
        statusAlert.style.color = "#075985";
        statusAlert.style.border = "1px solid #bae6fd";
    }

    setTimeout(() => {
        statusAlert.style.display = "none";
    }, 5000);
}

// Inicializar
inicializarPainelPagamentos();
