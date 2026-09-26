const SUPABASE_URL = "https://qkvijvkxnkadxipdwcel.supabase.co";
const SUPABASE_KEY = "sb_publishable_fxXLtlg78qrdqZaQhjUJQw_XoNhtuSK";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

/* ============================================================
   WRAPPER GLOBAL DE SEGURANÇA (PROTEÇÃO CONTRA LOADING INFINITO)
   Envolve qualquer requisição do Supabase com um limite de tempo (timeout).
   Se demorar mais que o tempo estipulado, destrava a aplicação e evita travamentos.
============================================================ */
async function safeSupabaseQuery(queryPromise, tempoLimiteMs = 8000) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Timeout: A operação demorou muito para responder.")), tempoLimiteMs);
    });

    try {
        // Dispara a query do Supabase e o relógio de timeout em paralelo
        const resultado = await Promise.race([queryPromise, timeoutPromise]);
        clearTimeout(timeoutId);
        
        if (resultado && resultado.error) {
            console.warn("Erro retornado pelo Supabase:", resultado.error.message);
        }
        
        return resultado;
    } catch (erro) {
        clearTimeout(timeoutId);
        console.warn("Falha ou timeout na requisição:", erro.message);
        return { data: null, error: erro };
    }
}
