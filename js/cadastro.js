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
    registerButton.textContent = "Criando conta...";
    statusElement.textContent = "";

    try {

        /*
         * CRIA A CONTA NO SUPABASE AUTH
         *
         * Os dados abaixo serão utilizados pelo
         * trigger do Supabase para criar o perfil.
         */

        const {
            data: authData,
            error: authError
        } = await supabaseClient.auth.signUp({

            email: email,

            password: senha,

            options: {
                data: {
                    nome: nome,
                    username: username,
                    tipo: "empreendedor"
                }
            }

        });

        if (authError) {
            throw authError;
        }

        if (!authData.user) {

            throw new Error(
                "Não foi possível criar o usuário."
            );

        }

        /*
         * O perfil agora é criado automaticamente
         * pelo trigger do Supabase.
         */

        if (!authData.session) {

            statusElement.textContent =
                "Cadastro realizado! Verifique seu e-mail para confirmar sua conta.";

        } else {

            statusElement.textContent =
                "Cadastro realizado com sucesso!";

        }

        form.reset();

    } catch (error) {

        console.error("Erro no cadastro:", error);

        const mensagem =
            error?.message || "Erro desconhecido.";

        if (
            mensagem.toLowerCase().includes("duplicate") ||
            mensagem.toLowerCase().includes("unique")
        ) {

            statusElement.textContent =
                "Esse nome de usuário já está sendo usado.";

        } else {

            statusElement.textContent =
                "Erro ao criar conta: " + mensagem;

        }

    } finally {

        registerButton.disabled = false;

        registerButton.textContent =
            "Criar minha conta";

    }

});
