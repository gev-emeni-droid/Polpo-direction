// API to manage planning preferences stored in D1
export const planningPreferencesApi = {
    get: async (): Promise<{
        darkMode: boolean;
        exportSelectedRoles: any[];
        invoiceCounter: number;
    }> => {
        try {
            const res = await fetch('/api/planning-preferences');
            if (!res.ok) throw new Error('Failed to fetch planning preferences');
            return await res.json();
        } catch (e) {
            console.error(e);
            return {
                darkMode: false,
                exportSelectedRoles: [],
                invoiceCounter: 0
            };
        }
    },
    save: async (preferences: {
        darkMode: boolean;
        exportSelectedRoles: any[];
        invoiceCounter: number;
    }) => {
        await fetch('/api/planning-preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preferences)
        });
    }
};
