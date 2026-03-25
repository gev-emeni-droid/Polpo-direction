interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare("SELECT * FROM planning_preferences WHERE id = 1").all();
        const row: any = results[0];

        if (!row) {
            // Initialize if not exists
            await context.env.DB.prepare(`
                INSERT INTO planning_preferences (id, darkMode, exportSelectedRoles, invoiceCounter)
                VALUES (1, 0, '[]', 0)
            `).run();
            return new Response(JSON.stringify({
                darkMode: false,
                exportSelectedRoles: [],
                invoiceCounter: 0
            }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({
            darkMode: row.darkMode === 1,
            exportSelectedRoles: row.exportSelectedRoles ? JSON.parse(row.exportSelectedRoles) : [],
            invoiceCounter: row.invoiceCounter || 0
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
        await context.env.DB.prepare(`
            INSERT OR REPLACE INTO planning_preferences (id, darkMode, exportSelectedRoles, invoiceCounter)
            VALUES (1, ?, ?, ?)
        `).bind(
            data.darkMode ? 1 : 0,
            JSON.stringify(data.exportSelectedRoles || []),
            data.invoiceCounter || 0
        ).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
}
