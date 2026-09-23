const form = document.getElementById("register-form");
const statusElement = document.getElementById("register-status");
const registerButton = document.getElementById("register-button");


form.addEventListener("submit", async function (event) {

    event.preventDefault();


    const nome = document
        .getElementById("nome")
        .value
        .trim();

    let username = document
        .getElementById("username")
        .value
        .trim()
        .toLowerCase();

    const email = document
        .getElementById("email")
        .value
        .trim();

    const senha = document
        .getElementById("senha")
        .value;


    username = username.replace(/^@/, "");


    if (!nome || !username || !email || !senha) {

        statusElement.textContent =
            "Preencha todos os campos.";

        return;
    }


    if (senha.length < 6) {

        statusElement.textContent =
            "A senha precisa ter pelo menos 6 caracteres.";

        return;
    }


    registerButton.disabled = true;

    registerButton.textContent =
        "Criando conta...";

    statusElement.textContent = "";


    try {

        /*
         * 1. CRIA A CONTA NO SUPABASE AUTH
         */

        const {
            data: authData,
            error: authError
        } = await supabaseClient.auth.signUp({

            email: email,

            password: senha

        });


        if (authError) {
            throw authError;
        }


        const user = authData.user;


        if (!user) {

            throw new Error(
                "Não foi possível criar o usuário."
            );

        }


        /*
         * 2. CRIA O PERFIL DO USUÁRIO
         */

        const {
            error: perfilError
        } = await supabaseClient
            .from("perfis")
            .insert({

                id: user.id,

                nome: nome,

                username: username,

                tipo: "empreendedor"

            });


        if (perfilError) {
            throw perfilError;
        }


        /*
         * 3. SUCESSO
         */

        statusElement.textContent =
            "Conta criada com sucesso!";


        form.reset();


        /*
         * Se a confirmação de e-mail estiver
         * ativada no Supabase, mostramos a mensagem.
         */

        if (!authData.session) {

            statusElement.textContent =
                "Conta criada! Verifique seu e-mail para confirmar o cadastro.";

        } else {

            statusElement.textContent =
                "Conta criada com sucesso!";

        }


    } catch (error) {

        console.error(error);


        if (
            error.message &&
            error.message.toLowerCase().includes("duplicate")
        ) {

            statusElement.textContent =
                "Esse nome de usuário já está sendo usado.";

        } else {

            statusElement.textContent =
                "Erro ao criar conta: " + error.message;

        }

    } finally {

        registerButton.disabled = false;

        registerButton.textContent =
            "Criar minha conta";

    }

});
