const form = document.getElementById("login-form");
const statusElement = document.getElementById("login-status");
const loginButton = document.getElementById("login-button");

form.addEventListener("submit", async function (event) {

    event.preventDefault();

    const email = document
        .getElementById("email")
        .value
        .trim();

    const senha = document
        .getElementById("senha")
        .value;

    if (!email || !senha) {
        statusElement.textContent =
            "Preencha todos os campos.";
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Entrando...";
    statusElement.textContent = "Entrando...";

    try {

        // 1. LOGIN
        const {
            data: authData,
            error: authError
        } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: senha
        });

        if (authError) {
            throw authError;
        }

        if (!authData.user) {
            throw new Error(
                "Usuário não encontrado após o login."
            );
        }

        statusElement.textContent =
            "Login realizado. Carregando perfil...";


        // 2. BUSCAR PERFIL
        const {
            data: perfis,
            error: perfilError
        } = await supabaseClient
            .from("perfis")
            .select("tipo")
            .eq("id", authData.user.id)
            .limit(1);

        if (perfilError) {
            throw perfilError;
        }

        if (!perfis || perfis.length === 0) {
            throw new Error(
                "Perfil do usuário não encontrado."
            );
        }

        const perfil = perfis[0];


        // 3. IDENTIFICAR TIPO DE CONTA

        if (perfil.tipo === "empreendedor") {

            statusElement.textContent =
                "Login realizado! Abrindo painel...";

            setTimeout(function () {

                window.location.href = "painel.html";

            }, 500);

        } else {

            throw new Error(
                "Tipo de conta não reconhecido."
            );

        }

    } catch (error) {

        console.error(
            "Erro no login:",
            error
        );

        const mensagem =
            error?.message || "Erro desconhecido.";

        if (
            mensagem
                .toLowerCase()
                .includes("invalid login credentials")
        ) {

            statusElement.textContent =
                "E-mail ou senha incorretos.";

        } else if (
            mensagem
                .toLowerCase()
                .includes("email not confirmed")
        ) {

            statusElement.textContent =
                "Confirme seu e-mail antes de entrar.";

        } else {

            statusElement.textContent =
                "ERRO: " + mensagem;

        }

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "Entrar";

    }

});
