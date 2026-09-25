/* ============================================================
   NEXORA - MÓDULO DE PAGAMENTOS (js/pagamentos.js)
============================================================ */

const client = window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null);

// Elementos da Interface
const welcomeName = document.getElementById("welcome-name");
const sidebarName = document.getElementById("sidebar-name");
const sidebarAvatar = document.getElementById("sidebar-avatar");
const headerAvatar = document.getElementById("header-avatar");
const logoutButton = document.getElementById("logout-button");

// Inputs do Formulário
const chkDinheiro = document.getElementById("aceita-dinheiro");
const chkPix = document.getElementById("aceita-pix");
const chkCredito = document.getElementById("aceita-credito");
const chkDebito = document.getElementById("aceita-debito");

const cardPix = document.getElementById("card-dados-pix");
const selTipoChave = document.getElementById("tipo-chave-pix");
const txtChavePix = document.getElementById("chave-pix");
const txtTitularPix = document.getElementById("titular-pix");

const btnSalvar = document.getElementById("btn-salvar-pagamentos");

let negocioIdAtual = null;

async function inicializarPagamentos() {
    if (!client) {
        console.error("Cliente Supabase não inicializado.");
        return;
    }

    try {
        // 1. Autenticação
        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError || !authData?.user) {
            window.location.href = "login.html";
            return;
        }

        const user = authData.user;

        // 2. Perfil
        const { data: perfil } = await client
            .from("perfis")
            .select("nome")
            .eq("id", user.id)
            .maybeSingle();

        if (perfil) {
            const nomeCompleto = perfil.nome || "Empreendedor";
            const inicial = nomeCompleto.trim().charAt(0).toUpperCase() || "N";
            if (sidebarName) sidebarName.textContent = nomeCompleto;
            if (sidebarAvatar) sidebarAvatar.textContent = inicial;
            if (headerAvatar) headerAvatar.textContent = inicial;
        }

        // 3. Obter ID do Negócio e Configurações de Pagamento
        negocioIdAtual = await obterNegocioId(user.id);

        if (negocioIdAtual) {
            await carregarConfiguracoesPagamento(negocioIdAtual);
        }

    } catch (err) {
        console.error("Erro ao carregar módulo de pagamentos:", err);
    }
}

async function obterNegocioId(userId) {
    const { data } = await client
        .from("negocios")
        .select("id")
        .eq("usuario_id", userId)
        .maybeSingle();
    return data?.id || null;
}

// Alterna exibição do card Pix ao marcar/desmarcar
if (chkPix) {
    chkPix.addEventListener("change", () => {
        if (cardPix) cardPix.style.display = chkPix.checked ? "block" : "none";
    });
}

// Carregar Configurações salvas do banco
async function carregarConfiguracoesPagamento(negocioId) {
    try {
        const { data, error } = await client
            .from("configuracao_pagamentos")
            .select("*")
            .eq("negocio_id", negocioId)
            .maybeSingle();

        if (data) {
            chkDinheiro.checked = data.aceita_dinheiro ?? true;
            chkPix.checked = data.aceita_pix ?? true;
            chkCredito.checked = data.aceita_credito ?? true;
            chkDebito.checked = data.aceita_debito ?? true;

            selTipoChave.value = data.tipo_chave_pix || "cpf";
            txtChavePix.value = data.chave_pix || "";
            txtTitularPix.value = data.titular_pix || "";

            if (cardPix) cardPix.style.display = chkPix.checked ? "block" : "none";
        }
    } catch (err) {
        console.warn("Aviso ao buscar configurações de pagamento:", err);
    }
}

// Salvar Alterações
if (btnSalvar) {
    btnSalvar.addEventListener("click", async () => {
        if (!negocioIdAtual) {
            alert("Crie primeiro o seu negócio antes de configurar pagamentos.");
            return;
        }

        btnSalvar.disabled = true;
        btnSalvar.textContent = "A salvar...";

        const payload = {
            negocio_id: negocioIdAtual,
            aceita_dinheiro: chkDinheiro.checked,
            aceita_pix: chkPix.checked,
            aceita_credito: chkCredito.checked,
            aceita_debito: chkDebito.checked,
            tipo_chave_pix: selTipoChave.value,
            chave_pix: txtChavePix.value.trim(),
            titular_pix: txtTitularPix.value.trim(),
            updated_at: new Date()
        };

        const { error } = await client
            .from("configuracao_pagamentos")
            .upsert(payload, { onConflict: "negocio_id" });

        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Alterações";

        if (error) {
            alert("Erro ao salvar configurações de pagamento: " + error.message);
        } else {
            alert("Configurações de pagamento salvas com sucesso!");
        }
    });
}

// Logout
if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        await client.auth.signOut();
        window.location.href = "login.html";
    });
}

// Menu Mobile
const mobileMenuBtn = document.getElementById("mobile-menu-button");
const sidebarEl = document.getElementById("sidebar");

if (mobileMenuBtn && sidebarEl) {
    mobileMenuBtn.addEventListener("click", () => {
        sidebarEl.classList.toggle("mobile-open");
    });
}

inicializarPagamentos();
