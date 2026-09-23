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

    loginButton.textContent =
        "Entrando...";

    statusElement.textContent = "";


    try {

        /*
         * 1. LOGIN NO SUPABASE AUTH
         */

        const {
            data,
            error
        } = await supabaseClient.auth.signInWithPassword({

            email: email,

            password: senha

        });


        if (error) {
            throw error;
        }


        if (!data.user) {

            throw new Error(
                "Não foi possível entrar na conta."
            );

        }


        /*
         * 2. BUSCAR O PERFIL
         */

        const {
            data: perfil,
            error: perfilError
        } = await supabaseClient
            .from("perfis")
            .select("tipo")
            .eq("id", data.user.id)
            .single();


        if (perfilError) {
            throw perfilError;
        }


        /*
         * 3. REDIRECIONAR
         */

        if (perfil.tipo === "empreendedor") {

            window.location.href =
                "painel.html";

        } else {

            statusElement.textContent =
                "Tipo de conta não reconhecido.";

        }


    } catch (error) {

        console.error(
            "Erro no login:",
            error
        );


        const mensagem =
            error?.message || "";


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
                "Erro ao entrar: " + mensagem;

        }

    } finally {

        loginButton.disabled = false;

        loginButton.textContent =
            "Entrar";

    }

});
