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
    statusElement.textContent = "1. Tentando entrar...";

    try {

        // LOGIN
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
                "Usuário não retornado pelo Supabase."
            );
        }

        statusElement.textContent =
            "2. Login realizado. Buscando perfil...";

        // BUSCAR PERFIL
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

        if (!perfil) {
            throw new Error(
                "Perfil não encontrado."
            );
        }

        statusElement.textContent =
            "3. Perfil encontrado: " + perfil.tipo;

        // REDIRECIONAMENTO
        if (perfil.tipo === "empreendedor") {

            statusElement.textContent =
                "4. Redirecionando para o painel...";

            setTimeout(function () {

                window.location.href = "painel.html";

            }, 500);

        } else {

            statusElement.textContent =
                "Tipo de conta não reconhecido: " +
                perfil.tipo;

        }

    } catch (error) {

        console.error("Erro no login:", error);

        statusElement.textContent =
            "ERRO: " +
            (error?.message || "Erro desconhecido.");

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "Entrar";

    }

});
