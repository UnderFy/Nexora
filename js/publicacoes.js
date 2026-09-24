const formPublicacao = document.getElementById("form-publicacao");
const postMedia = document.getElementById("post-media");
const postTitulo = document.getElementById("post-titulo");
const postServico = document.getElementById("post-servico");
const postPreco = document.getElementById("post-preco");
const postTempo = document.getElementById("post-tempo");
const postDescricao = document.getElementById("post-descricao");
const btnSubmit = document.getElementById("btn-submit-post");
const pubErrorMsg = document.getElementById("pub-error-msg");
const postsList = document.getElementById("posts-list");

let negocioId = null;

async function inicializarPublicacoes() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            window.location.href = "index.html";
            return;
        }

        const { data: negocio } = await supabaseClient
            .from("negocios")
            .select("id")
            .eq("usuario_id", user.id)
            .single();

        if (!negocio) {
            alert("Cadastre seu negócio primeiro.");
            window.location.href = "meu-negocio.html";
            return;
        }

        negocioId = negocio.id;

        await carregarServicosDropdown();
        await carregarPublicacoes();

    } catch (err) {
        console.error("Erro ao inicializar publicações:", err);
    }
}

async function carregarServicosDropdown() {
    const { data: servicos } = await supabaseClient
        .from("servicos")
        .select("id, nome, preco")
        .eq("negocio_id", negocioId)
        .order("nome", { ascending: true });

    if (servicos && servicos.length > 0) {
        postServico.innerHTML = `<option value="">Nenhum (Apenas exibição)</option>` +
            servicos.map(s => `<option value="${s.id}">${s.nome} - R$ ${parseFloat(s.preco).toFixed(2)}</option>`).join("");
    }
}

// Preenche automaticamente preço se selecionar um serviço
postServico?.addEventListener("change", async () => {
    const sId = postServico.value;
    if (sId) {
        const { data: s } = await supabaseClient
            .from("servicos")
            .select("preco, duracao_minutos")
            .eq("id", sId)
            .single();
        if (s) {
            if (s.preco) postPreco.value = s.preco;
            if (s.duracao_minutos) postTempo.value = s.duracao_minutos;
        }
    }
});

formPublicacao?.addEventListener("submit", async (e) => {
    e.preventDefault();
    pubErrorMsg.style.display = "none";

    const file = postMedia.files[0];
    if (!file) {
        exibirErro("Selecione uma foto ou vídeo.");
        return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Enviando arquivo...";

    try {
        // 1. Identificar tipo de mídia
        const tipoMidia = file.type.startsWith("video") ? "video" : "imagem";
        const fileExt = file.name.split('.').pop();
        const fileName = `${negocioId}/${Date.now()}.${fileExt}`;

        // 2. Upload para o Supabase Storage
        const { data: storageData, error: storageErr } = await supabaseClient
            .storage
            .from("portfolio")
            .upload(fileName, file, { cacheControl: '3600', upsert: true });

        if (storageErr) throw storageErr;

        // 3. Obter URL pública
        const { data: publicUrlData } = supabaseClient
            .storage
            .from("portfolio")
            .getPublicUrl(fileName);

        const midiaUrl = publicUrlData.publicUrl;

        btnSubmit.textContent = "Salvando publicação...";

        // 4. Salvar no banco de dados
        const payload = {
            negocio_id: negocioId,
            servico_id: postServico.value || null,
            titulo: postTitulo.value.trim(),
            descricao: postDescricao.value.trim(),
            midia_url: midiaUrl,
            tipo_midia: tipoMidia,
            preco: parseFloat(postPreco.value),
            tempo_minutos: parseInt(postTempo.value),
        };

        const { error: dbErr } = await supabaseClient
            .from("publicacoes")
            .insert([payload]);

        if (dbErr) throw dbErr;

        formPublicacao.reset();
        await carregarPublicacoes();

    } catch (err) {
        console.error("Erro ao publicar:", err);
        exibirErro(err.message || "Erro ao salvar publicação.");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Publicar no Portfólio";
    }
});

async function carregarPublicacoes() {
    const { data: posts, error } = await supabaseClient
        .from("publicacoes")
        .select("*")
        .eq("negocio_id", negocioId)
        .order("created_at", { ascending: false });

    if (error || !posts || posts.length === 0) {
        postsList.innerHTML = `<p style="color: #64748b; font-size: 13px;">Nenhuma publicação realizada ainda.</p>`;
        return;
    }

    postsList.innerHTML = posts.map(post => {
        const precoFormatado = parseFloat(post.preco || 0).toFixed(2).replace(".", ",");
        const elementoMidia = post.tipo_midia === "video" 
            ? `<video src="${post.midia_url}" controls style="width: 100%; max-height: 250px; border-radius: 8px; object-fit: cover;"></video>`
            : `<img src="${post.midia_url}" style="width: 100%; max-height: 250px; border-radius: 8px; object-fit: cover;">`;

        return `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
                ${elementoMidia}
                <div>
                    <strong style="font-size: 15px; color: #0f172a;">${post.titulo}</strong>
                    <p style="font-size: 13px; color: #64748b; margin-top: 4px;">${post.descricao || ""}</p>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 8px; font-size: 13px;">
                    <span style="color: #10b981; font-weight: 600;">R$ ${precoFormatado}</span>
                    <span style="color: #64748b;">⏱️ ${post.tempo_minutos} min</span>
                </div>
                <button onclick="excluirPublicacao('${post.id}')" style="background: #fee2e2; color: #ef4444; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">Excluir Publicação</button>
            </div>
        `;
    }).join("");
}

async function excluirPublicacao(id) {
    if (!confirm("Deseja realmente excluir esta publicação do seu portfólio?")) return;

    const { error } = await supabaseClient
        .from("publicacoes")
        .delete()
        .eq("id", id);

    if (error) {
        alert("Erro ao excluir publicação.");
    } else {
        await carregarPublicacoes();
    }
}

function exibirErro(msg) {
    pubErrorMsg.textContent = msg;
    pubErrorMsg.style.display = "block";
}

// Inicializar
inicializarPublicacoes();
