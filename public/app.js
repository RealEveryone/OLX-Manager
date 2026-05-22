document.addEventListener('DOMContentLoaded', () => {
    fetchProfiles();
    document.getElementById('btn-sync').addEventListener('click', scanStatuses);
    document.getElementById('btn-add').addEventListener('click', addProfile);
    document.getElementById('btn-open-active').addEventListener('click', openActiveProfiles);
});

async function fetchProfiles() {
    const res = await fetch('/api/profiles');
    const data = await res.json();
    renderTable(data, false);
}

function renderTable(profiles, hasStatusData = false) {
    const tbody = document.getElementById('profiles-tbody');
    tbody.innerHTML = '';

    if (profiles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: #a0aec0;">Няма конфигурирани акаунти. Добавете нов профил по-долу.</td></tr>`;
        return;
    }

    profiles.forEach(p => {
        let statusHtml = `<span class="status-badge status-unknown">Непроверен</span>`;
        let unreadHtml = `<span style="color: #a0aec0;">—</span>`;

        if (hasStatusData) {
            if (p.status === 'Logged Out') {
                statusHtml = `<span class="status-badge status-logout"> Излязъл (Sign-out)</span>`;
                unreadHtml = `<span style="color: var(--danger); font-weight:600;">Недостъпно</span>`;
            } else if (p.status === 'Active') {
                statusHtml = `<span class="status-badge status-active">Активна сесия</span>`;
                unreadHtml = p.unreadCount > 0 ? `<span class="message-badge">${p.unreadCount} нови</span>` : `0 съобщения`;
            } else {
                statusHtml = `<span class="status-badge status-logout">Грешка в мрежата</span>`;
                unreadHtml = `—`;
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${p.id}</td>
            <td><strong>${p.name}</strong></td>
            <td>${statusHtml}</td>
            <td>${unreadHtml}</td>
            <td style="text-align: right;">
                <button class="btn-action" onclick="openProfile(${p.id})">🌐 Отвори</button>
                <button class="btn-danger" onclick="deleteProfile(${p.id})">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function scanStatuses() {
    const tbody = document.getElementById('profiles-tbody');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; font-weight:500; color: var(--olx-teal);">
        <span class="sync-loader">⏳ Изпълнява се дълбока проверка в реално време през Chromium Headless... Моля, изчакайте.</span>
    </td></tr>`;

    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        renderTable(data, true);
    } catch(e) {
        alert("Грешка при комуникация със сървъра.");
        fetchProfiles();
    }
}

async function openProfile(id) {
    await fetch(`/api/open/${id}`, { method: 'POST' });
}

async function openActiveProfiles() {
    const res = await fetch('/api/open-active', { method: 'POST' });
    const data = await res.json();
    alert(`Операцията приключи! Стартирани прозорци за активни профили с нови съобщения: ${data.count}`);
}

async function addProfile() {
    const input = document.getElementById('new-profile-name');
    const name = input.value;
    if (!name.trim()) return;

    const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.success) {
        input.value = '';
        fetchProfiles();
    }
}

async function deleteProfile(id) {
    if (!confirm('Сигурни ли сте, че искате да изтриете този профил и кеш данните му от диска?')) return;

    const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
        fetchProfiles();
    }
}