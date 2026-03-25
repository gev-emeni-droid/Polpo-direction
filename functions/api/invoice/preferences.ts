interface Env {
    FACTURE_DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.FACTURE_DB.prepare("SELECT * FROM user_preferences WHERE id = 1").all();
        const row: any = results[0];

        if (!row) {
            // Initialize if not exists
            await context.env.FACTURE_DB.prepare(`
                INSERT INTO user_preferences (id, darkMode, invoicePageVisited)
                VALUES (1, 0, 0)
            `).run();
            return new Response(JSON.stringify({ darkMode: false, invoicePageVisited: false }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({
            darkMode: row.darkMode === 1,
            invoicePageVisited: row.invoicePageVisited === 1
        }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const data: any = await context.request.json();

        // Use INSERT OR REPLACE to upsert preferences
        await context.env.FACTURE_DB.prepare(`
            INSERT OR REPLACE INTO user_preferences (id, darkMode, invoicePageVisited)
            VALUES (1, ?, ?)
        `).bind(
            data.darkMode ? 1 : 0,
            data.invoicePageVisited ? 1 : 0
        ).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
}
