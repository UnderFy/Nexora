const form = document.getElementById("business-form");

const statusElement =
    document.getElementById("business-status");

const saveButton =
    document.getElementById("save-business-button");

const logoutButton =
    document.getElementById("logout-button");


const nomeInput =
    document.getElementById("nome-negocio");

const usernameInput =
    document.getElementById("username-negocio");

const telefoneInput =
    document.getElementById("telefone");

const enderecoInput =
    document.getElementById("endereco");

const cidadeInput =
    document.getElementById("cidade");

const descricaoInput =
    document.getElementById("descricao");

const logoInput =
    document.getElementById("logo-input");


const previewName =
    document.getElementById("preview-name");

const previewUsername =
    document.getElementById("preview-username");

const previewDescription =
    document.getElementById("preview-description");

const previewCity =
    document.getElementById("preview-city");

const previewAvatar =
    document.getElementById("preview-avatar");


let usuarioAtual = null;

let negocioAtual = null;

let logoUrlAtual = null;


/* =========================================
   MENSAGEM
========================================= */

function mostrarMensagem(
    mensagem,
    tipo = "normal"
) {

    statusElement.textContent =
        mensagem;

    statusElement.className =
        "business-message " + tipo;

    statusElement.style.display = "block";

}


/* =========================================
   ATUALIZA PRÉVIA
========================================= */

function atualizarPreview() {

    const nome =
        nomeInput.value.trim();

    const username =
        usernameInput.value
            .trim()
            .toLowerCase()
            .replace(/^@/, "");

    const descricao =
        descricaoInput.value.trim();

    const cidade =
        cidadeInput.value.trim();


    previewName.textContent =
        nome || "Seu negócio";


    previewUsername.textContent =
        username
            ? "@" + username
            : "@seunegocio";


    previewDescription.textContent =
        descricao ||
        "Sua descrição aparecerá aqui.";


    previewCity.textContent =
        cidade ||
        "Sua cidade";


    if (previewAvatar) {

        if (logoUrlAtual) {

            previewAvatar.innerHTML =
                `<img src="${logoUrlAtual}" alt="Logo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;

        } else {

            const inicial =
                nome
                    ? nome.charAt(0).toUpperCase()
                    : "N";

            previewAvatar.innerHTML =
                inicial;

        }

    }

}


/* =========================================
   BUSCAR USUÁRIO
========================================= */

async function carregarUsuario() {

    const {
        data,
        error
    } =
        await supabaseClient.auth.getUser();


    if (error) {
        throw error;
    }


    if (!data.user) {

        window.location.href =
            "login.html";

        return null;

    }


    usuarioAtual =
        data.user;


    return data.user;

}


/* =========================================
   CARREGAR NEGÓCIO
========================================= */

async function carregarNegocio() {

    if (!usuarioAtual) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("negocios")
            .select("*")
            .or(`id.eq.${usuarioAtual.id},usuario_id.eq.${usuarioAtual.id}`)
            .maybeSingle();


    if (error) {
        throw error;
    }


    /*
     * Ainda não existe negócio.
     */

    if (!data) {

        negocioAtual = null;

        mostrarMensagem(
            "Seu negócio ainda não foi configurado.",
            "info"
        );

        atualizarPreview();

        return;

    }


    /*
     * Negócio encontrado.
     */

    negocioAtual =
        data;


    nomeInput.value =
        negocioAtual.nome || "";


    usernameInput.value =
        negocioAtual.username || "";


    telefoneInput.value =
        negocioAtual.telefone || "";


    enderecoInput.value =
        negocioAtual.endereco || "";


    cidadeInput.value =
        negocioAtual.cidade || "";


    descricaoInput.value =
        negocioAtual.descricao || "";


    logoUrlAtual =
        negocioAtual.logo_url || null;


    atualizarPreview();


    mostrarMensagem(
        "Dados do negócio carregados.",
        "success"
    );

}


/* =========================================
   SALVAR NEGÓCIO
========================================= */

form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        if (!usuarioAtual) {

            mostrarMensagem(
                "Sua sessão expirou. Entre novamente.",
                "error"
            );

            return;

        }


        const nome =
            nomeInput.value.trim();


        let username =
            usernameInput.value
                .trim()
                .toLowerCase()
                .replace(/^@/, "");


        const telefone =
            telefoneInput.value.trim();


        const endereco =
            enderecoInput.value.trim();


        const cidade =
            cidadeInput.value.trim();


        const descricao =
            descricaoInput.value.trim();


        /* =========================
           VALIDAÇÃO
        ========================== */

        if (!nome) {

            mostrarMensagem(
                "Digite o nome do negócio.",
                "error"
            );

            nomeInput.focus();

            return;

        }


        if (!username) {

            mostrarMensagem(
                "Digite um nome de usuário para o negócio.",
                "error"
            );

            usernameInput.focus();

            return;

        }


        if (!/^[a-z0-9._-]+$/.test(username)) {

            mostrarMensagem(
                "O nome de usuário pode conter apenas letras minúsculas, números, ponto, hífen e underline.",
                "error"
            );

            usernameInput.focus();

            return;

        }


        saveButton.disabled = true;

        saveButton.textContent =
            "Salvando...";


        mostrarMensagem(
            "Salvando informações..."
        );


        try {

            let logoUrl =
                logoUrlAtual;


            /* =========================
               UPLOAD DA LOGO (OPCIONAL)
            ========================== */

            if (logoInput && logoInput.files && logoInput.files[0]) {

                const file =
                    logoInput.files[0];

                const fileExt =
                    file.name.split('.').pop();

                const fileName =
                    `${usuarioAtual.id}-${Date.now()}.${fileExt}`;


                const { data: uploadData, error: uploadError } =
                    await supabaseClient
                        .storage
                        .from("logos")
                        .upload(fileName, file, { upsert: true });


                if (uploadError) {

                    console.warn(
                        "Bucket de logos não encontrado ou sem permissão de upload.",
                        uploadError
                    );

                } else if (uploadData) {

                    const { data: urlData } =
                        supabaseClient
                            .storage
                            .from("logos")
                            .getPublicUrl(fileName);


                    if (urlData && urlData.publicUrl) {

                        logoUrl =
                            urlData.publicUrl;

                    }

                }

            }


            /* =========================
               GRAVAR NO BANCO (UPSERT)
            ========================== */

            const dadosNegocio = {

                id:
                    usuarioAtual.id,

                usuario_id:
                    usuarioAtual.id,

                nome:
                    nome,

                username:
                    username,

                descricao:
                    descricao || null,

                telefone:
                    telefone || null,

                endereco:
                    endereco || null,

                cidade:
                    cidade || null,

                logo_url:
                    logoUrl || null

            };


            const { data, error } =
                await supabaseClient
                    .from("negocios")
                    .upsert(dadosNegocio)
                    .select()
                    .maybeSingle();


            if (error) {

                throw error;

            }


            negocioAtual =
                data;

            logoUrlAtual =
                dadosNegocio.logo_url;


            mostrarMensagem(
                "Negócio salvo com sucesso!",
                "success"
            );


            atualizarPreview();


        } catch (error) {

            console.error(
                "Erro ao salvar negócio:",
                error
            );


            const mensagem =
                error?.message ||
                "Erro desconhecido.";


            if (
                mensagem
                    .toLowerCase()
                    .includes("duplicate")
            ) {

                mostrarMensagem(
                    "Esse nome de usuário já está sendo usado. Escolha outro.",
                    "error"
                );

            } else {

                mostrarMensagem(
                    "Erro ao salvar: " +
                    mensagem,
                    "error"
                );

            }


        } finally {

            saveButton.disabled =
                false;

            saveButton.textContent =
                "Salvar negócio";

        }

    }
);


/* =========================================
   PRÉVIA EM TEMPO REAL
========================================= */

[
    nomeInput,
    usernameInput,
    cidadeInput,
    descricaoInput
].forEach(function (input) {

    input?.addEventListener(
        "input",
        atualizarPreview
    );

});


if (logoInput) {

    logoInput.addEventListener(
        "change",
        function (event) {

            const file =
                event.target.files[0];


            if (file) {

                const reader =
                    new FileReader();


                reader.onload =
                    function (e) {

                        logoUrlAtual =
                            e.target.result;

                        atualizarPreview();

                    };


                reader.readAsDataURL(file);

            }

        }
    );

}


/* =========================================
   LOGOUT
========================================= */

logoutButton?.addEventListener(
    "click",
    async function () {

        logoutButton.disabled =
            true;


        const {
            error
        } =
            await supabaseClient
                .auth
                .signOut();


        if (error) {

            console.error(
                "Erro ao sair:",
                error
            );

            logoutButton.disabled =
                false;

            return;

        }


        window.location.href =
            "login.html";

    }
);


/* =========================================
   INICIALIZAÇÃO
========================================= */

async function iniciarPagina() {

    try {

        const usuario =
            await carregarUsuario();


        if (!usuario) {
            return;
        }


        await carregarNegocio();


    } catch (error) {

        console.error(
            "Erro ao carregar página:",
            error
        );


        mostrarMensagem(
            "Não foi possível carregar os dados do negócio: " +
            (
                error?.message ||
                "erro desconhecido"
            ),
            "error"
        );

    }

}


iniciarPagina();
